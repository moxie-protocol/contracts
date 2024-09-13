// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IMoxieBondingCurve} from "./interfaces/IMoxieBondingCurve.sol";
import {SecurityModule} from "./SecurityModule.sol";
import {ITokenManager} from "./interfaces/ITokenManager.sol";
import {IERC20Extended} from "./interfaces/IERC20Extended.sol";
import {IStaking} from "./interfaces/IStaking.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title Staking
 * @author Moxie Team
 * @notice Staking contract allows staking of subject tokens for a lock period.
 */
contract Staking is IStaking, SecurityModule, ReentrancyGuard, OwnableUpgradeable {
    using SafeERC20 for IERC20Extended;

    bytes32 public constant CHANGE_LOCK_DURATION = keccak256("CHANGE_LOCK_DURATION");

    ITokenManager public tokenManager;
    IMoxieBondingCurve public moxieBondingCurve;
    IERC20Extended public moxieToken;

    uint256 public lockCount;

    mapping(uint256 lockId => LockInfo lockinfo) public locks;
    mapping(uint256 lockPeriod => bool allowed) public lockPeriods;

    /**
     * @dev function to initialize the contract.
     * @param _tokenManager  Address of the token manager.
     * @param _moxieBondingCurve Address of the moxie bonding curve.
     * @param _moxieToken Address of the moxie token.
     * @param _defaultAdmin Address of the staking admin.
     */
    function initialize(address _tokenManager, address _moxieBondingCurve, address _moxieToken, address _defaultAdmin)
        external
        initializer
    {
        __AccessControl_init();
        __Pausable_init();
        _validateInput(_tokenManager, _moxieBondingCurve, _moxieToken, _defaultAdmin);
        tokenManager = ITokenManager(_tokenManager);
        moxieBondingCurve = IMoxieBondingCurve(_moxieBondingCurve);
        moxieToken = IERC20Extended(_moxieToken);
        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
    }

    /**
     * @dev Internal function to validate initialization input.
     * @param _tokenManager  Address of the token manager.
     * @param _moxieBondingCurve Address of the moxie bonding curve.
     * @param _moxieToken Address of the moxie token.
     * @param _defaultAdmin Address of the staking admin.
     */
    function _validateInput(
        address _tokenManager,
        address _moxieBondingCurve,
        address _moxieToken,
        address _defaultAdmin
    ) internal pure {
        if (_isZeroAddress(_tokenManager)) {
            revert Staking_InvalidTokenManager();
        }
        if (_isZeroAddress(_moxieBondingCurve)) {
            revert Staking_InvalidMoxieBondingCurve();
        }
        if (_isZeroAddress(_moxieToken)) {
            revert Staking_InvalidMoxieToken();
        }
        if (_isZeroAddress(_defaultAdmin)) {
            revert Staking_InvalidDefaultAdmin();
        }
    }
    /**
     * @dev Internal function to validate address.
     * @param _address  Address to validate.
     */

    function _isZeroAddress(address _address) internal pure returns (bool) {
        return _address == address(0);
    }
    /**
     * @notice Sets the lock period for staking. only owner can call this function.
     */

    function setLockPeriod(uint256 _lockPeriod, bool _allowed) external onlyRole(CHANGE_LOCK_DURATION) {
        if (lockPeriods[_lockPeriod] == _allowed) {
            revert Staking_LockPeriodAlreadySet();
        }
        lockPeriods[_lockPeriod] = _allowed;
        emit LockPeriodUpdated(_lockPeriod, _allowed);
    }

    modifier onlyValidLockPeriod(uint256 _lockPeriod) {
        if (!lockPeriods[_lockPeriod]) {
            revert Staking_InvalidLockPeriod();
        }
        _;
    }

    /**
     * Allows to deposit tokens for a lock period.
     * @param _subject subject address for which tokens are getting deposited.
     * @param _amount _Amount of tokens getting deposited.
     */
    function _deposit(address _subject, uint256 _amount, uint256 _lockPeriod, bool _takeSubjectToken)
        internal
        onlyValidLockPeriod(_lockPeriod)
    {
        if (_amount == 0) {
            revert Staking_AmountShouldBeGreaterThanZero();
        }
        IERC20Extended subjectToken = IERC20Extended(tokenManager.tokens(_subject));
        if (address(subjectToken) == address(0)) {
            revert Staking_InvalidSubjectToken();
        }
        uint256 _index = lockCount++;
        uint256 unlockTime = block.timestamp + _lockPeriod;
        LockInfo memory lockInfo = LockInfo({
            amount: _amount,
            unlockTime: unlockTime,
            subject: _subject,
            subjectToken: address(subjectToken),
            user: msg.sender,
            lockPeriod: _lockPeriod
        });
        // lock the tokens
        locks[_index] = lockInfo;
        // emit event
        emit Lock(msg.sender, _subject, address(subjectToken), _index, _amount, unlockTime, _lockPeriod);
        // Transfer the tokens to this contract
        if (_takeSubjectToken) {
            subjectToken.safeTransferFrom(msg.sender, address(this), _amount);
        }
    }

    /**
     * External function to deposit and lock tokens.
     * @param _subject Subject address for which tokens are getting deposited.
     * @param _amount amount of tokens getting deposited.
     * @param _lockPeriod lock period for the tokens.
     */
    function depositAndLock(address _subject, uint256 _amount, uint256 _lockPeriod) external nonReentrant {
        _deposit(_subject, _amount, _lockPeriod, true);
    }

    /**
     * External function to buy & lock tokens.
     * @param _subject Subject address for which tokens are getting deposited.
     * @param _depositAmount amount of moxie tokens getting deposited.
     */
    function buyAndLock(address _subject, uint256 _depositAmount, uint256 _minReturnAmountAfterFee, uint256 _lockPeriod)
        external
        onlyValidLockPeriod(_lockPeriod)
        nonReentrant
    {
        // transfer moxie to this contract
        moxieToken.safeTransferFrom(msg.sender, address(this), _depositAmount);
        // approve moxie bonding curve
        moxieToken.approve(address(moxieBondingCurve), _depositAmount);
        // pull moxie
        uint256 _amount = moxieBondingCurve.buyShares(_subject, _depositAmount, _minReturnAmountAfterFee);
        uint256 unlockTime = block.timestamp + _lockPeriod;
        address subjectToken = address(tokenManager.tokens(_subject));
        LockInfo memory lockInfo = LockInfo({
            amount: _amount,
            unlockTime: unlockTime,
            subject: _subject,
            subjectToken: subjectToken,
            user: msg.sender,
            lockPeriod: _lockPeriod
        });
        uint256 _index = lockCount++;
        locks[_index] = lockInfo;
        emit Lock(msg.sender, _subject, subjectToken, _index, _amount, unlockTime, _lockPeriod);
    }

    function _extractExpiredAndDeleteLocks(uint256[] memory _indexes, address _subject)
        internal
        returns (address _subjectToken, uint256 _totalAmount)
    {
        if (_indexes.length == 0) {
            revert Staking_EmptyIndexes();
        }
        LockInfo memory lockInfo = locks[_indexes[0]];
        _subjectToken = lockInfo.subjectToken;
        for (uint256 i = 0; i < _indexes.length; i++) {
            uint256 _index = _indexes[i];
            lockInfo = locks[_index];
            if (lockInfo.subject != _subject) {
                revert Staking_SubjectsDoesntMatch(_index);
            }
            if (lockInfo.unlockTime > block.timestamp) {
                revert Staking_LockNotExpired(_index, block.timestamp, lockInfo.unlockTime);
            }
            if (lockInfo.user != msg.sender) {
                revert Staking_NotOwner(_index);
            }
            _totalAmount += lockInfo.amount;
            delete locks[_index];
        }
    }

    function withdraw(uint256[] memory _indexes, address _subject) external nonReentrant {
        (address _subjectToken, uint256 _totalAmount) = _extractExpiredAndDeleteLocks(_indexes, _subject);
        IERC20Extended subjectToken = IERC20Extended(_subjectToken);
        subjectToken.transfer(msg.sender, _totalAmount);
        emit Withdraw(msg.sender, _subject, _subjectToken, _indexes, _totalAmount);
    }

    function extendLock(uint256[] memory _indexes, address _subject, uint256 _lockPeriod)
        external
        onlyValidLockPeriod(_lockPeriod)
        nonReentrant
    {
        (, uint256 _totalAmount) = _extractExpiredAndDeleteLocks(_indexes, _subject);
        emit LockExtended(_indexes);
        _deposit(_subject, _totalAmount, _lockPeriod, false);
    }

    function getTotalStakedAmount(address _user, address _subject, uint256[] calldata _indexes)
        external
        view
        returns (uint256)
    {
        uint256 totalAmount;
        for (uint256 i = 0; i < _indexes.length; i++) {
            uint256 _index = _indexes[i];
            LockInfo memory lockInfo = locks[_index];
            if (lockInfo.user != _user) {
                revert Staking_NotSameUser(_index);
            }
            if (lockInfo.subject != _subject) {
                revert Staking_SubjectsDoesntMatch(_index);
            }
            totalAmount += lockInfo.amount;
        }
        return totalAmount;
    }
}
