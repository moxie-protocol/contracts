// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IMoxieBondingCurveV2} from "./interfaces/IMoxieBondingCurveV2.sol";
import {SecurityModule} from "./SecurityModule.sol";
import {ITokenManager} from "./interfaces/ITokenManager.sol";
import {IERC20Extended} from "./interfaces/IERC20Extended.sol";
import {IStakingV2} from "./interfaces/IStakingV2.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Staking
 * @author Moxie Team
 * @notice Staking contract allows staking of subject tokens for a lock period.
 */
contract StakingV2 is IStakingV2, SecurityModule {
    using SafeERC20 for IERC20Extended;

    bytes32 public constant CHANGE_LOCK_DURATION = keccak256("CHANGE_LOCK_DURATION");

    ITokenManager public tokenManager;
    IMoxieBondingCurveV2 public moxieBondingCurve;
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
        moxieBondingCurve = IMoxieBondingCurveV2(_moxieBondingCurve);
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
     * @param _tokenManager Address of the token manager.
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
     * @param _amount Amount of tokens getting deposited.
     * @param _lockPeriodInSec Lock period for the tokens.
     * @param _beneficiary Address of the beneficiary for the lock.
     * @param _unlockTimeInSec Unlock time of lock in secs.
     * @param _moxieDepositAmount Amount of moxie tokens deposited for buying.
     */
    function _createLock(
        address _subject,
        uint256 _amount,
        uint256 _lockPeriodInSec,
        uint256 _unlockTimeInSec,
        address _beneficiary,
        uint256 _moxieDepositAmount
    ) internal returns (IERC20Extended _subjectToken) {
        if (_isZeroAddress(_subject)) {
            revert Staking_InvalidSubject();
        }
        if (_amount == 0) {
            revert Staking_AmountShouldBeGreaterThanZero();
        }
        if (_isZeroAddress(_beneficiary)) {
            revert Staking_InvalidBeneficiary();
        }
        _subjectToken = IERC20Extended(tokenManager.tokens(_subject));
        if (address(_subjectToken) == address(0)) {
            revert Staking_InvalidSubjectToken();
        }
        uint256 _index = lockCount++;
        LockInfo memory lockInfo = LockInfo({
            amount: _amount,
            unlockTimeInSec: _unlockTimeInSec,
            subject: _subject,
            subjectToken: address(_subjectToken),
            user: _beneficiary,
            lockPeriodInSec: _lockPeriodInSec
        });
        // lock the tokens
        locks[_index] = lockInfo;

        emit Lock(
            _beneficiary,
            _subject,
            address(_subjectToken),
            _index,
            _amount,
            _unlockTimeInSec,
            _lockPeriodInSec,
            _moxieDepositAmount == 0 ? address(0) : msg.sender,
            _moxieDepositAmount
        );
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
     * @param _unlockTimeInSec Unlock time of lock in secs.
     * @param _beneficiary Beneficiary of the lock.
     */
    function _depositAndLock(
        address _subject,
        uint256 _amount,
        uint256 _lockPeriodInSec,
        uint256 _unlockTimeInSec,
        address _beneficiary
    ) internal {
        IERC20Extended subjectToken;
        (subjectToken) = _createLock(_subject, _amount, _lockPeriodInSec, _unlockTimeInSec, _beneficiary, 0);

        // Transfer the tokens to this contract
        subjectToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    /**
     * @notice Calculates unlock time.
     * @param _lockPeriodInSec Lock period to set.
     * @return unlock time in sec
     */
    function _getUnlockTime(uint256 _lockPeriodInSec) internal view returns (uint256) {
        return block.timestamp + _lockPeriodInSec;
    }

    /**
     * @notice Buys and locks tokens for the caller.
     * @param _subject The address of the subject to buy and lock for.
     * @param _depositAmount The amount of tokens to deposit for buying and locking.
     * @param _minReturnAmountAfterFee The minimum return amount after fee for buying.
     * @param _lockPeriodInSec The lock period in seconds for the tokens.
     * @param _orderReferrer Address of order referrer.
     * @return amount_ The amount of tokens bought and locked.
     * @return unlockTimeInSec_ The unlock time in seconds for the tokens.
     */
    function _buyAndLock(
        address _subject,
        uint256 _depositAmount,
        uint256 _minReturnAmountAfterFee,
        uint256 _lockPeriodInSec,
        address _orderReferrer
    ) internal returns (uint256 amount_, uint256 unlockTimeInSec_) {
        moxieToken.safeTransferFrom(msg.sender, address(this), _depositAmount);
        moxieToken.approve(address(moxieBondingCurve), _depositAmount);
        amount_ = moxieBondingCurve.buySharesV2(_subject, _depositAmount, _minReturnAmountAfterFee, _orderReferrer);

        unlockTimeInSec_ = _getUnlockTime(_lockPeriodInSec);
        _createLock(_subject, amount_, _lockPeriodInSec, unlockTimeInSec_, msg.sender, _depositAmount);
    }

    /**
     * @notice Buys and locks tokens for a specific beneficiary.
     * @param _subject The address of the subject to buy and lock for.
     * @param _depositAmount The amount of tokens to deposit for buying and locking.
     * @param _minReturnAmountAfterFee The minimum return amount after fee for buying.
     * @param _lockPeriodInSec The lock period in seconds for the tokens.
     * @param _beneficiary The address of the beneficiary for whom the tokens are being bought and locked.
     * @param _orderReferrer Address of order referrer.
     * @return amount_ The amount of tokens bought and locked.
     * @return unlockTimeInSec_ The unlock time in seconds for the tokens.
     */
    function _buyAndLockFor(
        address _subject,
        uint256 _depositAmount,
        uint256 _minReturnAmountAfterFee,
        uint256 _lockPeriodInSec,
        address _beneficiary,
        address _orderReferrer
    ) internal returns (uint256 amount_, uint256 unlockTimeInSec_) {
        moxieToken.safeTransferFrom(msg.sender, address(this), _depositAmount);
        moxieToken.approve(address(moxieBondingCurve), _depositAmount);
        amount_ = moxieBondingCurve.buySharesV2(_subject, _depositAmount, _minReturnAmountAfterFee, _orderReferrer);

        unlockTimeInSec_ = _getUnlockTime(_lockPeriodInSec);

        _createLock(_subject, amount_, _lockPeriodInSec, unlockTimeInSec_, _beneficiary, _depositAmount);
    }

    /**
     * @notice Buys and locks multiple subjects for a beneficiary.
     * @param _subjects The addresses of the subjects to buy and lock for.
     * @param _depositAmounts The amounts of tokens to deposit for each subject.
     * @param _minReturnAmountsAfterFee The minimum return amounts after fee for each subject.
     * @param _lockPeriodInSec The lock period in seconds for the subjects.
     * @param _orderReferrer Address of order referrer.
     * @return amounts_ The amounts of tokens bought and locked for each subject.
     * @return unlockTimeInSec_ The unlock time in seconds for the subjects.
     */
    function _buyAndLockMultiple(
        address[] memory _subjects,
        uint256[] memory _depositAmounts,
        uint256[] memory _minReturnAmountsAfterFee,
        uint256 _lockPeriodInSec,
        address _orderReferrer
    ) internal returns (uint256[] memory amounts_, uint256 unlockTimeInSec_) {
        if (_subjects.length != _depositAmounts.length || _subjects.length != _minReturnAmountsAfterFee.length) {
            revert Staking_InvalidInputLength();
        }

        amounts_ = new uint256[](_subjects.length);

        uint256 totalDepositAmount = 0;

        for (uint256 i = 0; i < _subjects.length; i++) {
            totalDepositAmount += _depositAmounts[i];
        }

        moxieToken.safeTransferFrom(msg.sender, address(this), totalDepositAmount);
        moxieToken.approve(address(moxieBondingCurve), totalDepositAmount);

        unlockTimeInSec_ = _getUnlockTime(_lockPeriodInSec);

        for (uint256 i = 0; i < _subjects.length; i++) {
            uint256 amount = moxieBondingCurve.buySharesV2(
                _subjects[i], _depositAmounts[i], _minReturnAmountsAfterFee[i], _orderReferrer
            );
            _createLock(_subjects[i], amount, _lockPeriodInSec, unlockTimeInSec_, msg.sender, _depositAmounts[i]);
            amounts_[i] = amount;
        }
    }

    /**
     * @notice Buys and locks multiple subjects for a beneficiary.
     *
     * @param _subjects An array of subject addresses to buy and lock.
     * @param _depositAmounts An array of deposit amounts corresponding to each subject.
     * @param _minReturnAmountsAfterFee An array of minimum return amounts after fee corresponding to each subject.
     * @param _lockPeriodInSec The lock period in seconds.
     * @param _beneficiary The address of the beneficiary.
     * @param _orderReferrer Address of order referrer.
     *
     * @return amounts_ An array of bought amounts corresponding to each subject.
     * @return unlockTimeInSec_ The unlock time in seconds.
     */
    function _buyAndLockMultipleFor(
        address[] memory _subjects,
        uint256[] memory _depositAmounts,
        uint256[] memory _minReturnAmountsAfterFee,
        uint256 _lockPeriodInSec,
        address _beneficiary,
        address _orderReferrer
    ) internal returns (uint256[] memory amounts_, uint256 unlockTimeInSec_) {
        if (_subjects.length != _depositAmounts.length || _subjects.length != _minReturnAmountsAfterFee.length) {
            revert Staking_InvalidInputLength();
        }

        uint256 totalDepositAmount = 0;

        for (uint256 i = 0; i < _subjects.length; i++) {
            totalDepositAmount += _depositAmounts[i];
        }

        moxieToken.safeTransferFrom(msg.sender, address(this), totalDepositAmount);
        moxieToken.approve(address(moxieBondingCurve), totalDepositAmount);

        amounts_ = new uint256[](_subjects.length);

        unlockTimeInSec_ = _getUnlockTime(_lockPeriodInSec);

        for (uint256 i = 0; i < _subjects.length; i++) {
            amounts_[i] = moxieBondingCurve.buySharesV2(
                _subjects[i], _depositAmounts[i], _minReturnAmountsAfterFee[i], _orderReferrer
            );
            _createLock(_subjects[i], amounts_[i], _lockPeriodInSec, unlockTimeInSec_, _beneficiary, _depositAmounts[i]);
        }
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
     * @return unlockTimeInSec_ Unlock times for the locks.
     */
    function depositAndLock(address _subject, uint256 _amount, uint256 _lockPeriodInSec)
        external
        whenNotPaused
        onlyValidLockPeriod(_lockPeriodInSec)
        returns (uint256 unlockTimeInSec_)
    {
        unlockTimeInSec_ = _getUnlockTime(_lockPeriodInSec);

        _depositAndLock(_subject, _amount, _lockPeriodInSec, unlockTimeInSec_, msg.sender);
    }

    /**
     * External function to deposit and lock tokens for a beneficiary.
     * @param _subject Subject address for which tokens are getting deposited.
     * @param _amount amount of tokens getting deposited.
     * @param _lockPeriodInSec lock period for the tokens.
     * @param _beneficiary Address of the beneficiary for the lock.
     * @return unlockTimeInSec_ Unlock times for the locks.
     */
    function depositAndLockFor(address _subject, uint256 _amount, uint256 _lockPeriodInSec, address _beneficiary)
        external
        whenNotPaused
        onlyValidLockPeriod(_lockPeriodInSec)
        returns (uint256 unlockTimeInSec_)
    {
        unlockTimeInSec_ = _getUnlockTime(_lockPeriodInSec);

        _depositAndLock(_subject, _amount, _lockPeriodInSec, unlockTimeInSec_, _beneficiary);
    }

    /**
     * External function to deposit and lock multiple tokens.
     * @param _subjects Subject addresses for which tokens are getting deposited.
     * @param _amounts Amounts of tokens getting deposited.
     * @param _lockPeriodInSec Lock periods for the tokens.
     * @return unlockTimeInSec_ Unlock times for the locks.
     */
    function depositAndLockMultiple(address[] memory _subjects, uint256[] memory _amounts, uint256 _lockPeriodInSec)
        external
        whenNotPaused
        onlyValidLockPeriod(_lockPeriodInSec)
        returns (uint256 unlockTimeInSec_)
    {
        if (_subjects.length != _amounts.length) {
            revert Staking_InvalidInputLength();
        }

        unlockTimeInSec_ = _getUnlockTime(_lockPeriodInSec);

        for (uint256 i = 0; i < _subjects.length; i++) {
            _depositAndLock(_subjects[i], _amounts[i], _lockPeriodInSec, unlockTimeInSec_, msg.sender);
        }
    }

    /**
     * External function to deposit and lock multiple tokens.
     * @param _subjects Subject addresses for which tokens are getting deposited.
     * @param _amounts Amounts of tokens getting deposited.
     * @param _lockPeriodInSec Lock periods for the tokens.
     * @param _beneficiary Address of the beneficiary for the lock.
     * @return unlockTimeInSec_ Unlock times for the locks.
     */
    function depositAndLockMultipleFor(
        address[] memory _subjects,
        uint256[] memory _amounts,
        uint256 _lockPeriodInSec,
        address _beneficiary
    ) external whenNotPaused onlyValidLockPeriod(_lockPeriodInSec) returns (uint256 unlockTimeInSec_) {
        if (_subjects.length != _amounts.length) {
            revert Staking_InvalidInputLength();
        }

        unlockTimeInSec_ = _getUnlockTime(_lockPeriodInSec);

        for (uint256 i = 0; i < _subjects.length; i++) {
            _depositAndLock(_subjects[i], _amounts[i], _lockPeriodInSec, unlockTimeInSec_, _beneficiary);
        }
    }

    /**
     * External function to buy & lock tokens.
     * @param _subject Subject address for which tokens are being bought & deposited.
     * @param _depositAmount amount of moxie tokens getting deposited.
     * @param _minReturnAmountAfterFee Slippage setting which determines minimum amount of tokens after fee.
     * @param _lockPeriodInSec Lock period for the tokens.
     * @return amount_ Amount of tokens bought & locked.
     * @return unlockTimeInSec_ Unlock times for the locks.
     */
    function buyAndLock(
        address _subject,
        uint256 _depositAmount,
        uint256 _minReturnAmountAfterFee,
        uint256 _lockPeriodInSec
    )
        external
        whenNotPaused
        onlyValidLockPeriod(_lockPeriodInSec)
        returns (uint256 amount_, uint256 unlockTimeInSec_)
    {
        (amount_, unlockTimeInSec_) =
            _buyAndLock(_subject, _depositAmount, _minReturnAmountAfterFee, _lockPeriodInSec, address(0));
    }

    /**
     * External function to buy & lock tokens.
     * @param _subject Subject address for which tokens are being bought & deposited.
     * @param _depositAmount amount of moxie tokens getting deposited.
     * @param _minReturnAmountAfterFee Slippage setting which determines minimum amount of tokens after fee.
     * @param _lockPeriodInSec Lock period for the tokens.
     * @param _beneficiary Address of the beneficiary for the lock.
     * @return amount_ Amount of tokens bought & locked.
     * @return unlockTimeInSec_ Unlock times for the locks.
     */
    function buyAndLockFor(
        address _subject,
        uint256 _depositAmount,
        uint256 _minReturnAmountAfterFee,
        uint256 _lockPeriodInSec,
        address _beneficiary
    )
        external
        whenNotPaused
        onlyValidLockPeriod(_lockPeriodInSec)
        returns (uint256 amount_, uint256 unlockTimeInSec_)
    {
        (amount_, unlockTimeInSec_) = _buyAndLockFor(
            _subject, _depositAmount, _minReturnAmountAfterFee, _lockPeriodInSec, _beneficiary, address(0)
        );
    }

    /**
     * External function to buy & lock multiple tokens.
     * @param _subjects Subject addresses for which tokens are being bought & deposited.
     * @param _depositAmounts Amounts of moxie tokens getting deposited.
     * @param _minReturnAmountsAfterFee Slippage settings which determine minimum amounts of tokens after fee.
     * @param _lockPeriodInSec Lock periods for the tokens.
     * @return amounts_ Amounts of tokens bought & locked.
     * @return unlockTimeInSec_ Unlock times for the locks.
     */
    function buyAndLockMultiple(
        address[] memory _subjects,
        uint256[] memory _depositAmounts,
        uint256[] memory _minReturnAmountsAfterFee,
        uint256 _lockPeriodInSec
    )
        external
        whenNotPaused
        onlyValidLockPeriod(_lockPeriodInSec)
        returns (uint256[] memory amounts_, uint256 unlockTimeInSec_)
    {
        (amounts_, unlockTimeInSec_) =
            _buyAndLockMultiple(_subjects, _depositAmounts, _minReturnAmountsAfterFee, _lockPeriodInSec, address(0));
    }

    /**
     * External function to buy & lock multiple tokens.
     * @param _subjects Subject addresses for which tokens are being bought & deposited.
     * @param _depositAmounts Amounts of moxie tokens getting deposited.
     * @param _minReturnAmountsAfterFee Slippage settings which determine minimum amounts of tokens after fee.
     * @param _lockPeriodInSec Lock periods for the tokens.
     * @param _beneficiary Address of the beneficiary for the lock.
     * @return amounts_ Amounts of tokens bought & locked.
     * @return unlockTimeInSec_ Unlock times for the locks.
     */
    function buyAndLockMultipleFor(
        address[] memory _subjects,
        uint256[] memory _depositAmounts,
        uint256[] memory _minReturnAmountsAfterFee,
        uint256 _lockPeriodInSec,
        address _beneficiary
    )
        external
        whenNotPaused
        onlyValidLockPeriod(_lockPeriodInSec)
        returns (uint256[] memory amounts_, uint256 unlockTimeInSec_)
    {
        (amounts_, unlockTimeInSec_) = _buyAndLockMultipleFor(
            _subjects, _depositAmounts, _minReturnAmountsAfterFee, _lockPeriodInSec, _beneficiary, address(0)
        );
    }

    /**
     * External function to buy & lock tokens.
     * @param _subject Subject address for which tokens are being bought & deposited.
     * @param _depositAmount amount of moxie tokens getting deposited.
     * @param _minReturnAmountAfterFee Slippage setting which determines minimum amount of tokens after fee.
     * @param _lockPeriodInSec Lock period for the tokens.
     * @param  _orderReferrer Address of order referrer
     * @return amount_ Amount of tokens bought & locked.
     * @return unlockTimeInSec_ Unlock times for the locks.
     */
    function buyAndLockV2(
        address _subject,
        uint256 _depositAmount,
        uint256 _minReturnAmountAfterFee,
        uint256 _lockPeriodInSec,
        address _orderReferrer
    )
        external
        whenNotPaused
        onlyValidLockPeriod(_lockPeriodInSec)
        returns (uint256 amount_, uint256 unlockTimeInSec_)
    {
        (amount_, unlockTimeInSec_) =
            _buyAndLock(_subject, _depositAmount, _minReturnAmountAfterFee, _lockPeriodInSec, _orderReferrer);
    }

    /**
     * External function to buy & lock tokens.
     * @param _subject Subject address for which tokens are being bought & deposited.
     * @param _depositAmount amount of moxie tokens getting deposited.
     * @param _minReturnAmountAfterFee Slippage setting which determines minimum amount of tokens after fee.
     * @param _lockPeriodInSec Lock period for the tokens.
     * @param _beneficiary Address of the beneficiary for the lock.
     * @param  _orderReferrer Address of order referrer
     * @return amount_ Amount of tokens bought & locked.
     * @return unlockTimeInSec_ Unlock times for the locks.
     */
    function buyAndLockForV2(
        address _subject,
        uint256 _depositAmount,
        uint256 _minReturnAmountAfterFee,
        uint256 _lockPeriodInSec,
        address _beneficiary,
        address _orderReferrer
    )
        external
        whenNotPaused
        onlyValidLockPeriod(_lockPeriodInSec)
        returns (uint256 amount_, uint256 unlockTimeInSec_)
    {
        (amount_, unlockTimeInSec_) = _buyAndLockFor(
            _subject, _depositAmount, _minReturnAmountAfterFee, _lockPeriodInSec, _beneficiary, _orderReferrer
        );
    }

    /**
     * External function to buy & lock multiple tokens.
     * @param _subjects Subject addresses for which tokens are being bought & deposited.
     * @param _depositAmounts Amounts of moxie tokens getting deposited.
     * @param _minReturnAmountsAfterFee Slippage settings which determine minimum amounts of tokens after fee.
     * @param _lockPeriodInSec Lock periods for the tokens.
     * @param  _orderReferrer Address of order referrer
     * @return amounts_ Amounts of tokens bought & locked.
     * @return unlockTimeInSec_ Unlock times for the locks.
     */
    function buyAndLockMultipleV2(
        address[] memory _subjects,
        uint256[] memory _depositAmounts,
        uint256[] memory _minReturnAmountsAfterFee,
        uint256 _lockPeriodInSec,
        address _orderReferrer
    )
        external
        whenNotPaused
        onlyValidLockPeriod(_lockPeriodInSec)
        returns (uint256[] memory amounts_, uint256 unlockTimeInSec_)
    {
        (amounts_, unlockTimeInSec_) =
            _buyAndLockMultiple(_subjects, _depositAmounts, _minReturnAmountsAfterFee, _lockPeriodInSec, _orderReferrer);
    }

    /**
     * External function to buy & lock multiple tokens.
     * @param _subjects Subject addresses for which tokens are being bought & deposited.
     * @param _depositAmounts Amounts of moxie tokens getting deposited.
     * @param _minReturnAmountsAfterFee Slippage settings which determine minimum amounts of tokens after fee.
     * @param _lockPeriodInSec Lock periods for the tokens.
     * @param _beneficiary Address of the beneficiary for the lock.
     * @param  _orderReferrer Address of order referrer
     * @return amounts_ Amounts of tokens bought & locked.
     * @return unlockTimeInSec_ Unlock times for the locks.
     */
    function buyAndLockMultipleForV2(
        address[] memory _subjects,
        uint256[] memory _depositAmounts,
        uint256[] memory _minReturnAmountsAfterFee,
        uint256 _lockPeriodInSec,
        address _beneficiary,
        address _orderReferrer
    )
        external
        whenNotPaused
        onlyValidLockPeriod(_lockPeriodInSec)
        returns (uint256[] memory amounts_, uint256 unlockTimeInSec_)
    {
        (amounts_, unlockTimeInSec_) = _buyAndLockMultipleFor(
            _subjects, _depositAmounts, _minReturnAmountsAfterFee, _lockPeriodInSec, _beneficiary, _orderReferrer
        );
    }

    /**
     * External function to withdraw locked tokens.
     * @param _subject Subject address for which tokens are being withdrawn.
     * @param _indexes Indexes of the locks to be withdrawn.
     * @return totalAmount_ Total amount of tokens withdrawn.
     */
    function withdraw(address _subject, uint256[] memory _indexes)
        external
        whenNotPaused
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
     * @return totalAmount_ Total amount of tokens extended for lock.
     * @return unlockTimeInSec_ unlock time is the timestamp of the extended lock.
     */
    function extendLock(address _subject, uint256[] memory _indexes, uint256 _lockPeriodInSec)
        external
        whenNotPaused
        onlyValidLockPeriod(_lockPeriodInSec)
        returns (uint256 totalAmount_, uint256 unlockTimeInSec_)
    {
        address subjectToken;
        (subjectToken, totalAmount_) = _extractExpiredAndDeleteLocks(_subject, _indexes);
        emit LockExtended(msg.sender, _subject, subjectToken, _indexes, totalAmount_);

        unlockTimeInSec_ = _getUnlockTime(_lockPeriodInSec);

        _createLock(_subject, totalAmount_, _lockPeriodInSec, unlockTimeInSec_, msg.sender, 0);
    }

    /**
     * External function to extend the lock period of the tokens.
     * @param _subject Subject address for which tokens are being extended.
     * @param _indexes Indexes of the locks to be extended.
     * @param _lockPeriodInSec New lock period for the tokens.
     * @param _beneficiary Address of the beneficiary for the lock.
     * @return totalAmount_ Total amount of tokens extended for lock.
     * @return unlockTimeInSec_ unlock time is the timestamp of the extended lock.
     */
    function extendLockFor(address _subject, uint256[] memory _indexes, uint256 _lockPeriodInSec, address _beneficiary)
        external
        whenNotPaused
        onlyValidLockPeriod(_lockPeriodInSec)
        returns (uint256 totalAmount_, uint256 unlockTimeInSec_)
    {
        address subjectToken;
        (subjectToken, totalAmount_) = _extractExpiredAndDeleteLocks(_subject, _indexes);
        emit LockExtended(msg.sender, _subject, subjectToken, _indexes, totalAmount_);

        unlockTimeInSec_ = _getUnlockTime(_lockPeriodInSec);

        _createLock(_subject, totalAmount_, _lockPeriodInSec, unlockTimeInSec_, _beneficiary, 0);
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
