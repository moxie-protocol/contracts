// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IMoxieBondingCurve} from "./interfaces/IMoxieBondingCurve.sol";
import {SecurityModule} from "./SecurityModule.sol";
import {ITokenManager} from "./interfaces/ITokenManager.sol";
import {IERC20Extended} from "./interfaces/IERC20Extended.sol";
import {IStaking} from "./interfaces/IStaking.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Staking
 * @author Moxie Team
 * @notice Staking contract allows staking of subject tokens for a lock period.
 */
contract Staking is IStaking, SecurityModule {
    using SafeERC20 for IERC20Extended;

    bytes32 public constant CHANGE_LOCK_DURATION =
        keccak256("CHANGE_LOCK_DURATION");

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
    function initialize(
        address _tokenManager,
        address _moxieBondingCurve,
        address _moxieToken,
        address _defaultAdmin
    ) external initializer {
        __AccessControl_init();
        __Pausable_init();

        _validateInput(
            _tokenManager,
            _moxieBondingCurve,
            _moxieToken,
            _defaultAdmin
        );

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
     * @param _unlockTimeInSec Unlocktime of lock in secs.
     * @param _isBuy Whether the lock is created from a buy operation.
     */
    function _createLock(
        address _subject,
        uint256 _amount,
        uint256 _lockPeriodInSec,
        uint256 _unlockTimeInSec,
        address _beneficiary,
        bool _isBuy
    )
        internal
        returns (IERC20Extended _subjectToken)
    {
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
            _isBuy
        );
    }

    /**
     * @notice Extracts expired locks and deletes them.
     * @param _subject Subject address for which locks are being extracted.
     * @param _indexes Indexes of the locks to be extracted.
     * @return subjectToken_ Address of the subject token.
     * @return totalAmount_ Total amount of tokens withdrawn.
     */
    function _extractExpiredAndDeleteLocks(
        address _subject,
        uint256[] memory _indexes
    ) internal returns (address subjectToken_, uint256 totalAmount_) {
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
                revert Staking_LockNotExpired(
                    index,
                    block.timestamp,
                    lockInfo.unlockTimeInSec
                );
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
     * @param _unlockTimeInSec Unlocktime of lock in secs.
     * @param _beneficiary Beneficiary of the lock. 
     */
    function _depositAndLock(
        address _subject,
        uint256 _amount,
        uint256 _lockPeriodInSec,
        uint256 _unlockTimeInSec,
        address _beneficiary
    ) internal  {
        IERC20Extended subjectToken;
        (subjectToken) = _createLock(
            _subject,
            _amount,
            _lockPeriodInSec,
            _unlockTimeInSec,
            _beneficiary,
            false
        );

        // Transfer the tokens to this contract
        subjectToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    /**
     * @notice Calculates unlock time.
     * @param _lockPeriodInSec Lock period to set.
     * @return unlock time in sec
     */
    function _getUnlockTime(uint256 _lockPeriodInSec) internal view returns(uint256) {
        return block.timestamp + _lockPeriodInSec;
    }

    /**
     * @notice Sets the lock period for staking. only owner can call this function.
     * @param _lockPeriodInSec Lock period to set.
     * @param _allowed Boolean to allow or disallow the lock period.
     */
    function setLockPeriod(
        uint256 _lockPeriodInSec,
        bool _allowed
    ) external onlyRole(CHANGE_LOCK_DURATION) {
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
    function depositAndLock(
        address _subject,
        uint256 _amount,
        uint256 _lockPeriodInSec
    )
        external
        whenNotPaused
        onlyValidLockPeriod(_lockPeriodInSec)
        returns (uint256 unlockTimeInSec_)
    {

        unlockTimeInSec_ = _getUnlockTime(_lockPeriodInSec);

        _depositAndLock(
            _subject,
            _amount,
            _lockPeriodInSec,
            unlockTimeInSec_,
            msg.sender
        );
    }

    /**
     * External function to deposit and lock tokens for a beneficiary.
     * @param _subject Subject address for which tokens are getting deposited.
     * @param _amount amount of tokens getting deposited.
     * @param _lockPeriodInSec lock period for the tokens.
     * @param _beneficiary Address of the beneficiary for the lock.
     * @return unlockTimeInSec_ Unlock times for the locks.
     */
    function depositAndLockFor(
        address _subject,
        uint256 _amount,
        uint256 _lockPeriodInSec,
        address _beneficiary
    )
        external
        whenNotPaused
        onlyValidLockPeriod(_lockPeriodInSec)
        returns (uint256 unlockTimeInSec_)
    {

        unlockTimeInSec_ = _getUnlockTime(_lockPeriodInSec);

        _depositAndLock(
            _subject,
            _amount,
            _lockPeriodInSec,
            unlockTimeInSec_,
            _beneficiary
        );
    }

    /**
     * External function to deposit and lock multiple tokens.
     * @param _subjects Subject addresses for which tokens are getting deposited.
     * @param _amounts Amounts of tokens getting deposited.
     * @param _lockPeriodInSec Lock periods for the tokens.
     * @return unlockTimeInSec_ Unlock times for the locks.
     */
    function depositAndLockMultiple(
        address[] memory _subjects,
        uint256[] memory _amounts,
        uint256 _lockPeriodInSec
    )
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
            _depositAndLock(
                _subjects[i],
                _amounts[i],
                _lockPeriodInSec,
                unlockTimeInSec_,
                msg.sender
            );
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
    )
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
            _depositAndLock(
                _subjects[i],
                _amounts[i],
                _lockPeriodInSec,
                unlockTimeInSec_,
                _beneficiary
            );
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
        moxieToken.safeTransferFrom(msg.sender, address(this), _depositAmount);
        moxieToken.approve(address(moxieBondingCurve), _depositAmount);
        amount_ = moxieBondingCurve.buyShares(
            _subject,
            _depositAmount,
            _minReturnAmountAfterFee
        );

        unlockTimeInSec_ = _getUnlockTime(_lockPeriodInSec);
        _createLock(
            _subject,
            amount_,
            _lockPeriodInSec,
            unlockTimeInSec_,
            msg.sender,
            true
        );
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
        moxieToken.safeTransferFrom(msg.sender, address(this), _depositAmount);
        moxieToken.approve(address(moxieBondingCurve), _depositAmount);
        amount_ = moxieBondingCurve.buyShares(
            _subject,
            _depositAmount,
            _minReturnAmountAfterFee
        );

        unlockTimeInSec_ = _getUnlockTime(_lockPeriodInSec);

        _createLock(
            _subject,
            amount_,
            _lockPeriodInSec,
            unlockTimeInSec_,
            _beneficiary,
            true
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
        if (
            _subjects.length != _depositAmounts.length ||
            _subjects.length != _minReturnAmountsAfterFee.length
        ) {
            revert Staking_InvalidInputLength();
        }

        amounts_ = new uint256[](_subjects.length);

        uint256 totalDepositAmount = 0;

        for (uint256 i = 0; i < _subjects.length; i++) {
            totalDepositAmount += _depositAmounts[i];
        }

        moxieToken.safeTransferFrom(
            msg.sender,
            address(this),
            totalDepositAmount
        );
        moxieToken.approve(address(moxieBondingCurve), totalDepositAmount);

        unlockTimeInSec_ = _getUnlockTime(_lockPeriodInSec);

        for (uint256 i = 0; i < _subjects.length; i++) {
            uint256 amount = moxieBondingCurve.buyShares(
                _subjects[i],
                _depositAmounts[i],
                _minReturnAmountsAfterFee[i]
            );
            _createLock(
                _subjects[i],
                amount,
                _lockPeriodInSec,
                unlockTimeInSec_,
                msg.sender,
                true
            );
            amounts_[i] = amount;
        }
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
        if (
            _subjects.length != _depositAmounts.length ||
            _subjects.length != _minReturnAmountsAfterFee.length
        ) {
            revert Staking_InvalidInputLength();
        }

        uint256 totalDepositAmount = 0;

        for (uint256 i = 0; i < _subjects.length; i++) {
            totalDepositAmount += _depositAmounts[i];
        }

        moxieToken.safeTransferFrom(
            msg.sender,
            address(this),
            totalDepositAmount
        );
        moxieToken.approve(address(moxieBondingCurve), totalDepositAmount);

        amounts_ = new uint256[](_subjects.length);

        unlockTimeInSec_ = _getUnlockTime(_lockPeriodInSec);


        for (uint256 i = 0; i < _subjects.length; i++) {
            amounts_[i] = moxieBondingCurve.buyShares(
                _subjects[i],
                _depositAmounts[i],
                _minReturnAmountsAfterFee[i]
            );
            _createLock(
                _subjects[i],
                amounts_[i],
                _lockPeriodInSec,
                unlockTimeInSec_,
                _beneficiary,
                true
            );
        }
    }

    /**
     * External function to withdraw locked tokens.
     * @param _subject Subject address for which tokens are being withdrawn.
     * @param _indexes Indexes of the locks to be withdrawn.
     * @return totalAmount_ Total amount of tokens withdrawn.
     */
    function withdraw(
        address _subject,
        uint256[] memory _indexes
    ) external whenNotPaused returns (uint256 totalAmount_) {
        address subjectTokenAddress;

        (subjectTokenAddress, totalAmount_) = _extractExpiredAndDeleteLocks(
            _subject,
            _indexes
        );

        IERC20Extended subjectToken = IERC20Extended(subjectTokenAddress);

        subjectToken.safeTransfer(msg.sender, totalAmount_);
        emit Withdraw(
            msg.sender,
            _subject,
            subjectTokenAddress,
            _indexes,
            totalAmount_
        );
    }

    /**
     * External function to extend the lock period of the tokens.
     * @param _subject Subject address for which tokens are being extended.
     * @param _indexes Indexes of the locks to be extended.
     * @param _lockPeriodInSec New lock period for the tokens.
     * @return totalAmount_ Total amount of tokens extended for lock.
     * @return unlockTimeInSec_ unlock time is the timestamp of the extended lock.
     */
    function extendLock(
        address _subject,
        uint256[] memory _indexes,
        uint256 _lockPeriodInSec
    )
        external
        whenNotPaused
        onlyValidLockPeriod(_lockPeriodInSec)
        returns (uint256 totalAmount_, uint256 unlockTimeInSec_)
    {
        address subjectToken;
        (subjectToken, totalAmount_) = _extractExpiredAndDeleteLocks(
            _subject,
            _indexes
        );
        emit LockExtended(
            msg.sender,
            _subject,
            subjectToken,
            _indexes,
            totalAmount_
        );

        unlockTimeInSec_ = _getUnlockTime(_lockPeriodInSec);

        _createLock(
            _subject,
            totalAmount_,
            _lockPeriodInSec,
            unlockTimeInSec_,
            msg.sender,
            false
        );

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
    function extendLockFor(
        address _subject,
        uint256[] memory _indexes,
        uint256 _lockPeriodInSec,
        address _beneficiary
    )
        external
        whenNotPaused
        onlyValidLockPeriod(_lockPeriodInSec)
        returns (uint256 totalAmount_, uint256 unlockTimeInSec_)
    {
        address subjectToken;
        (subjectToken, totalAmount_) = _extractExpiredAndDeleteLocks(
            _subject,
            _indexes
        );
        emit LockExtended(
            msg.sender,
            _subject,
            subjectToken,
            _indexes,
            totalAmount_
        );

        unlockTimeInSec_ = _getUnlockTime(_lockPeriodInSec);

        _createLock(
            _subject,
            totalAmount_,
            _lockPeriodInSec,
            unlockTimeInSec_,
            _beneficiary,
            false
        );

    }

    /**
     * External function to get the total staked amount for a user & subject token.
     * @param _user User address for which total staked amount is being calculated.
     * @param _subject Subject address for which total staked amount is being calculated.
     * @param _indexes Indexes of the locks for which total staked amount is being calculated.
     */
    function getTotalStakedAmount(
        address _user,
        address _subject,
        uint256[] calldata _indexes
    ) external view returns (uint256 totalAmount_) {
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
