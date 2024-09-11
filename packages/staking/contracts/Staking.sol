// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IMoxieBondingCurve} from "./interfaces/IMoxieBondingCurve.sol";
import {SecurityModule} from "./SecurityModule.sol";
import {ITokenManager} from "./interfaces/ITokenManager.sol";
import {IERC20Extended} from "./interfaces/IERC20Extended.sol";
import {IStaking} from "./interfaces/IStaking.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Staking
 * @author  Moxie Team
 * @notice Staking contract allows staking of subject tokens for a lock period.
 */
contract Staking is IStaking, SecurityModule, ReentrancyGuard {
    using SafeERC20 for IERC20Extended;

    uint256 private s_lockPeriod;
    uint256 private s_LockCount;

    ITokenManager private immutable i_tokenManager;
    IMoxieBondingCurve private immutable i_moxieBondingCurve;
    IERC20Extended private immutable i_moxieToken;

    constructor(
        address _tokenManager,
        address _moxieBondingCurve,
        address _moxieToken,
        uint256 _lockPeriod
    ) {
        i_tokenManager = ITokenManager(_tokenManager);
        i_moxieBondingCurve = IMoxieBondingCurve(_moxieBondingCurve);
        i_moxieToken = IERC20Extended(_moxieToken);
        s_lockPeriod = _lockPeriod;
    }

    mapping(uint256 lockId => LockInfo lockinfo) private s_locks;

    /**
     * @notice Sets the lock period for staking. only owner can call this function.
     */
    function setLockPeriod(uint256 _lockPeriod) external {
        s_lockPeriod = _lockPeriod;
    }

    /**
     * @notice Returns the lock period for staking.
     */
    function getLockPeriod() external view returns (uint256) {
        return s_lockPeriod;
    }

    /**
     * @notice Returns the total number of locks.
     */
    function getLockCount() external view returns (uint256) {
        return s_LockCount;
    }

    /**
     * Allows to deposit tokens for a lock period.
     * @param _subject subject address for which tokens are getting deposited.
     * @param _amount _Amount of tokens getting deposited.
     */
    function _deposit(address _subject, uint256 _amount) internal {
        if (_amount == 0) {
            revert AmountShouldBeGreaterThanZero();
        }
        IERC20Extended subjectToken = IERC20Extended(
            i_tokenManager.tokens(_subject)
        );
        if (address(subjectToken) == address(0)) {
            revert InvalidSubjectToken();
        }
        uint256 index = s_LockCount++;
        uint256 unlockTime = block.timestamp + s_lockPeriod;
        LockInfo memory lockInfo = LockInfo({
            amount: _amount,
            unlockTime: unlockTime,
            subject: _subject,
            subjectToken: address(subjectToken),
            user: msg.sender
        });
        // lock the tokens
        s_locks[index] = lockInfo;
        // emit event
        emit Deposit(
            msg.sender,
            _subject,
            address(subjectToken),
            index,
            _amount,
            unlockTime
        );
        // Transfer the tokens to this contract
        bool success = subjectToken.transferFrom(
            msg.sender,
            address(this),
            _amount
        );
        if (!success) {
            revert TransferFailed();
        }
    }

    /**
     * External function to deposit and lock tokens.
     * @param _subject Subject address for which tokens are getting deposited.
     * @param _amount amount of tokens getting deposited.
     */
    function depositAndLock(
        address _subject,
        uint256 _amount
    ) external nonReentrant {
        _deposit(_subject, _amount);
    }

    /**
     * External function to buy & lock tokens.
     * @param _subject Subject address for which tokens are getting deposited.
     * @param _depositAmount amount of moxie tokens getting deposited.
     */

    function buyAndLock(
        address _subject,
        uint256 _depositAmount,
        uint256 _minReturnAmountAfterFee
    ) external nonReentrant {
        // transfer moxie to this contract
        i_moxieToken.safeTransferFrom(
            msg.sender,
            address(this),
            _depositAmount
        );
        // approve moxie bonding curve
        i_moxieToken.approve(address(i_moxieBondingCurve), _depositAmount);
        // pull moxie
        uint256 _amount = i_moxieBondingCurve.buyShares(
            _subject,
            _depositAmount,
            _minReturnAmountAfterFee
        );
        uint256 unlockTime = block.timestamp + s_lockPeriod;
        address subjectToken = address(i_tokenManager.tokens(_subject));
        LockInfo memory lockInfo = LockInfo({
            amount: _amount,
            unlockTime: unlockTime,
            subject: _subject,
            subjectToken: subjectToken,
            user: msg.sender
        });
        uint256 index = s_LockCount++;
        s_locks[index] = lockInfo;
        emit Deposit(
            msg.sender,
            _subject,
            subjectToken,
            index,
            _amount,
            unlockTime
        );
    }

    function withdraw(uint256[] memory _indexes) external nonReentrant {
        if (_indexes.length == 0) {
            revert EmptyIndexes();
        }
        uint256 totalAmount = 0;
        LockInfo memory firstLockInfo = s_locks[_indexes[0]];
        IERC20Extended subjectToken = IERC20Extended(
            firstLockInfo.subjectToken
        );
        for (uint256 i = 0; i < _indexes.length; i++) {
            LockInfo memory lockInfo = s_locks[_indexes[i]];
            if (firstLockInfo.subject != lockInfo.subject) {
                revert SubjectsDoesntMatch(i);
            }
            if (lockInfo.unlockTime > block.timestamp) {
                revert LockNotExpired(i, block.timestamp, lockInfo.unlockTime);
            }
            if (lockInfo.user != msg.sender) {
                revert NotOwner();
            }
            totalAmount += lockInfo.amount;
            delete s_locks[_indexes[i]];
        }
        subjectToken.transfer(msg.sender, totalAmount);
        emit Withdraw(
            msg.sender,
            firstLockInfo.subject,
            firstLockInfo.subjectToken,
            _indexes,
            totalAmount
        );
    }

    function getLockInfo(
        uint256 _index
    ) external view returns (LockInfo memory) {
        return s_locks[_index];
    }

    // for a given user, how much user staked for a given subject input: array of indexes
    // output: total amount staked
    // we can use it for withdrawal

    function getTotalStakedAmount(
        address _user,
        address _subject,
        uint256[] calldata _indexes
    ) external view returns (uint256) {
        uint256 totalAmount;
        for (uint256 i = 0; i < _indexes.length; i++) {
            LockInfo memory lockInfo = s_locks[_indexes[i]];
            if (lockInfo.user != _user) {
                revert NotSameUser(i);
            }
            if (lockInfo.subject != _subject) {
                revert InvalidSubjectToken();
            }
            totalAmount += lockInfo.amount;
        }
        return totalAmount;
    }
}
