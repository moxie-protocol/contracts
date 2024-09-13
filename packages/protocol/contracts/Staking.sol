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
contract Staking is IStaking, SecurityModule, ReentrancyGuard {
    using SafeERC20 for IERC20Extended;

    bytes32 public constant CHANGE_LOCK_DURATION = keccak256("CHANGE_LOCK_DURATION");

    ITokenManager public tokenManager;
    IMoxieBondingCurve public moxieBondingCurve;
    IERC20Extended public moxieToken;

    uint256 public lockCount;

    mapping(uint256 lockId => LockInfo lockInfo) public locks;
    mapping(uint256 lockPeriodInSec => bool allowed) public lockPeriodsInSec;

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
     * @dev Modifier to check if the lock period is allowed.
     * @param _lockPeriod Lock period to check.
     */
    modifier onlyValidLockPeriod(uint256 _lockPeriod) {
        if (!lockPeriodsInSec[_lockPeriod]) {
            revert Staking_InvalidLockPeriod();
        }
        _;
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
     * Created lock for a deposit.
     * @param _subject subject address for which tokens are getting deposited.
     * @param _amount _Amount of tokens getting deposited.
     */
    function _createLock(address _subject, uint256 _amount, uint256 _lockPeriodInSec)
        internal
        onlyValidLockPeriod(_lockPeriodInSec)
        returns (IERC20Extended _subjectToken, uint256 unlockTimeInSec_)
    {
        if (_isZeroAddress(_subject)) {
            revert Staking_InvalidSubject();
        }
        if (_amount == 0) {
            revert Staking_AmountShouldBeGreaterThanZero();
        }
        _subjectToken = IERC20Extended(tokenManager.tokens(_subject));
        if (address(_subjectToken) == address(0)) {
            revert Staking_InvalidSubjectToken();
        }
        uint256 _index = lockCount++;
        unlockTimeInSec_ = block.timestamp + _lockPeriodInSec;
        LockInfo memory lockInfo = LockInfo({
            amount: _amount,
            unlockTimeInSec: unlockTimeInSec_,
            subject: _subject,
            subjectToken: address(_subjectToken),
            user: msg.sender,
            lockPeriodInSec: _lockPeriodInSec
        });
        // lock the tokens
        locks[_index] = lockInfo;
        // emit event
        emit Lock(msg.sender, _subject, address(_subjectToken), _index, _amount, unlockTimeInSec_, _lockPeriodInSec);
    }

    /**
     * @notice Extracts expired locks and deletes them.
     * @param _subject Subject address for which locks are being extracted.
     * @param _indexes Indexes of the locks to be extracted.
     * @return subjectToken_ Address of the subject token.
     * @return totalAmount_ Total amount of tokens withdrawn.
     */
    function _extractExpiredAndDeleteLocks(address _subject, uint256[] memory _indexes)
        internal
        returns (address subjectToken_, uint256 totalAmount_)
    {
        if (_isZeroAddress(_subject)) {
            revert Staking_InvalidSubject();
        }

        if (_indexes.length == 0) {
            revert Staking_EmptyIndexes();
        }
        LockInfo memory lockInfo = locks[_indexes[0]];
        subjectToken_ = lockInfo.subjectToken;

        for (uint256 i = 0; i < _indexes.length; i++) {
            uint256 index = _indexes[i];
            lockInfo = locks[index];
            if (lockInfo.subject != _subject) {
                revert Staking_SubjectsDoesNotMatch(index);
            }
            if (lockInfo.unlockTimeInSec > block.timestamp) {
                revert Staking_LockNotExpired(index, block.timestamp, lockInfo.unlockTimeInSec);
            }
            if (lockInfo.user != msg.sender) {
                revert Staking_NotOwner(index);
            }
            totalAmount_ += lockInfo.amount;
            delete locks[index];
        }
    }

    /**
     * @notice Deposits and locks tokens for a single subject.
     * @param _subject Subject address for which tokens are being deposited.
     * @param _amount Amount of tokens being deposited.
     * @param _lockPeriodInSec Lock period for the tokens.
     */
    function _depositAndLock(address _subject, uint256 _amount, uint256 _lockPeriodInSec)
        internal
        returns (uint256 unlockTimeInSec_)
    {
        IERC20Extended subjectToken;
        (subjectToken, unlockTimeInSec_) = _createLock(_subject, _amount, _lockPeriodInSec);

        unlockTimeInSec_ = unlockTimeInSec_;
        // Transfer the tokens to this contract
        subjectToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    /**
     * @notice Buys tokens and creates a lock.
     * @param _subject Subject address for which tokens are being bought & deposited.
     * @param _depositAmount Amount of moxie tokens getting deposited.
     * @param _minReturnAmountAfterFee Slippage setting which determines minimum amount of tokens after fee.
     * @param _lockPeriodInSec Lock period for the tokens.
     * @return amount_ Amount of tokens bought.
     * @return unlockTimeInSec_ Unlock time for the lock.
     */
    function _buyAndLock(
        address _subject,
        uint256 _depositAmount,
        uint256 _minReturnAmountAfterFee,
        uint256 _lockPeriodInSec
    ) internal returns (uint256 amount_, uint256 unlockTimeInSec_) {
        moxieToken.safeTransferFrom(msg.sender, address(this), _depositAmount);
        moxieToken.approve(address(moxieBondingCurve), _depositAmount);
        amount_ = moxieBondingCurve.buyShares(_subject, _depositAmount, _minReturnAmountAfterFee);
        (, unlockTimeInSec_) = _createLock(_subject, amount_, _lockPeriodInSec);
    }

    /**
     * @notice Sets the lock period for staking. only owner can call this function.
     * @param _lockPeriodInSec Lock period to set.
     * @param _allowed Boolean to allow or disallow the lock period.
     */
    function setLockPeriod(uint256 _lockPeriodInSec, bool _allowed) external onlyRole(CHANGE_LOCK_DURATION) {
        if (lockPeriodsInSec[_lockPeriodInSec] == _allowed) {
            revert Staking_LockPeriodAlreadySet();
        }
        lockPeriodsInSec[_lockPeriodInSec] = _allowed;
        emit LockPeriodUpdated(_lockPeriodInSec, _allowed);
    }

    /**
     * External function to deposit and lock tokens.
     * @param _subject Subject address for which tokens are getting deposited.
     * @param _amount amount of tokens getting deposited.
     * @param _lockPeriodInSec lock period for the tokens.
     */
    function depositAndLock(address _subject, uint256 _amount, uint256 _lockPeriodInSec)
        external
        nonReentrant
        returns (uint256 unlockTimeInSec_)
    {
        unlockTimeInSec_ = _depositAndLock(_subject, _amount, _lockPeriodInSec);
    }

    /**
     * External function to deposit and lock multiple tokens.
     * @param _subjects Subject addresses for which tokens are getting deposited.
     * @param _amounts Amounts of tokens getting deposited.
     * @param _lockPeriodsInSec Lock periods for the tokens.
     */
    function depositAndLockMultiple(address[] memory _subjects, uint256[] memory _amounts, uint256 _lockPeriodsInSec)
        external
        nonReentrant
        returns (uint256[] memory unlockTimeInSec_)
    {
        if (_subjects.length != _amounts.length) {
            revert Staking_InvalidInputLength();
        }

        unlockTimeInSec_ = new uint256[](_subjects.length);

        for (uint256 i = 0; i < _subjects.length; i++) {
            unlockTimeInSec_[i] = _depositAndLock(_subjects[i], _amounts[i], _lockPeriodsInSec);
        }
    }

    /**
     * External function to buy & lock tokens.
     * @param _subject Subject address for which tokens are being bought & deposited.
     * @param _depositAmount amount of moxie tokens getting deposited.
     * @param _minReturnAmountAfterFee Slippage setting which determines minimum amount of tokens after fee.
     * @param _lockPeriodInSec Lock period for the tokens.
     */
    function buyAndLock(
        address _subject,
        uint256 _depositAmount,
        uint256 _minReturnAmountAfterFee,
        uint256 _lockPeriodInSec
    ) external onlyValidLockPeriod(_lockPeriodInSec) nonReentrant returns (uint256 amount_, uint256 unlockTimeInSec_) {
        return _buyAndLock(_subject, _depositAmount, _minReturnAmountAfterFee, _lockPeriodInSec);
    }

    /**
     * External function to buy & lock multiple tokens.
     * @param _subjects Subject addresses for which tokens are being bought & deposited.
     * @param _depositAmounts Amounts of moxie tokens getting deposited.
     * @param _minReturnAmountsAfterFee Slippage settings which determine minimum amounts of tokens after fee.
     * @param _lockPeriodsInSec Lock periods for the tokens.
     * @return amounts_ Amounts of tokens bought & locked.
     * @return unlockTimeInSec_ Unlock times for the locks.
     */
    function buyAndLockMultiple(
        address[] memory _subjects,
        uint256[] memory _depositAmounts,
        uint256[] memory _minReturnAmountsAfterFee,
        uint256 _lockPeriodsInSec
    )
        external
        onlyValidLockPeriod(_lockPeriodsInSec)
        nonReentrant
        returns (uint256[] memory amounts_, uint256 unlockTimeInSec_)
    {
        if (_subjects.length != _depositAmounts.length || _subjects.length != _minReturnAmountsAfterFee.length) {
            revert Staking_InvalidInputLength();
        }

        amounts_ = new uint256[](_subjects.length);

        for (uint256 i = 0; i < _subjects.length; i++) {
            (amounts_[i], unlockTimeInSec_) =
                _buyAndLock(_subjects[i], _depositAmounts[i], _minReturnAmountsAfterFee[i], _lockPeriodsInSec);
        }
    }

    /**
     * External function to withdraw locked tokens.
     * @param _subject Subject address for which tokens are being withdrawn.
     * @param _indexes Indexes of the locks to be withdrawn.
     */
    function withdraw(address _subject, uint256[] memory _indexes)
        external
        nonReentrant
        returns (uint256 totalAmount_)
    {
        address subjectTokenAddress;

        (subjectTokenAddress, totalAmount_) = _extractExpiredAndDeleteLocks(_subject, _indexes);

        IERC20Extended subjectToken = IERC20Extended(subjectTokenAddress);

        subjectToken.safeTransfer(msg.sender, totalAmount_);
        emit Withdraw(msg.sender, _subject, subjectTokenAddress, _indexes, totalAmount_);
    }

    /**
     * External function to extend the lock period of the tokens.
     * @param _subject Subject address for which tokens are being extended.
     * @param _indexes Indexes of the locks to be extended.
     * @param _lockPeriodInSec New lock period for the tokens.
     * @return totalAmount_
     * @return unlockTimeInSec_ unlock time is the timestamp of the extended lock.
     */
    function extendLock(address _subject, uint256[] memory _indexes, uint256 _lockPeriodInSec)
        external
        onlyValidLockPeriod(_lockPeriodInSec)
        nonReentrant
        returns (uint256 totalAmount_, uint256 unlockTimeInSec_)
    {
        (, totalAmount_) = _extractExpiredAndDeleteLocks(_subject, _indexes);
        emit LockExtended(_indexes);
        (, uint256 unlockTimeInSec) = _createLock(_subject, totalAmount_, _lockPeriodInSec);

        unlockTimeInSec_ = unlockTimeInSec;
    }

    /**
     * External function to get the total staked amount for a user & subject token.
     * @param _user User address for which total staked amount is being calculated.
     * @param _subject Subject address for which total staked amount is being calculated.
     * @param _indexes Indexes of the locks for which total staked amount is being calculated.
     */
    function getTotalStakedAmount(address _user, address _subject, uint256[] calldata _indexes)
        external
        view
        returns (uint256 totalAmount_)
    {
        for (uint256 i = 0; i < _indexes.length; i++) {
            uint256 _index = _indexes[i];
            LockInfo memory lockInfo = locks[_index];
            if (lockInfo.user != _user) {
                revert Staking_NotSameUser(_index);
            }
            if (lockInfo.subject != _subject) {
                revert Staking_SubjectsDoesNotMatch(_index);
            }
            totalAmount_ += lockInfo.amount;
        }
    }
}
