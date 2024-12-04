// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IStaking {
    error Staking_EmptyIndexes();
    error Staking_SubjectsDoesNotMatch(uint256 index);
    error Staking_AmountShouldBeGreaterThanZero();
    error Staking_InvalidSubjectToken();
    error Staking_InvalidSubject();
    error Staking_LockNotExpired(uint256 index, uint256 currentTime, uint256 unlockTime);
    error Staking_NotOwner(uint256 index);
    error Staking_NotSameUser(uint256 index);
    error Staking_InvalidLockPeriod();
    error Staking_InvalidTokenManager();
    error Staking_InvalidMoxieBondingCurve();
    error Staking_InvalidMoxieToken();
    error Staking_InvalidDefaultAdmin();
    error Staking_LockPeriodAlreadySet();
    error Staking_InvalidInputLength();
    error Staking_InvalidBeneficiary();

    struct LockInfo {
        address user;
        address subject;
        address subjectToken;
        uint256 unlockTimeInSec;
        uint256 amount;
        uint256 lockPeriodInSec;
    }

    event Lock(
        address indexed _user,
        address indexed _subject,
        address indexed _subjectToken,
        uint256 _index,
        uint256 _amount,
        uint256 _unlockTimeInSec,
        uint256 _lockPeriodInSec,
        address _buyer,
        uint256 _moxieDepositAmount
    );

    event LockExtended(
        address indexed _user,
        address indexed _subject,
        address indexed _subjectToken,
        uint256[] _indexes,
        uint256 _amount
    );

    event LockPeriodUpdated(uint256 indexed _lockPeriodInSec, bool indexed _allowed);

    event Withdraw(
        address indexed _user,
        address indexed _subject,
        address indexed _subjectToken,
        uint256[] _indexes,
        uint256 _amount
    );

    function depositAndLock(address _subject, uint256 _amount, uint256 _lockPeriodInSec)
        external
        returns (uint256 unlockTimeInSec_);

    function depositAndLockFor(address _subject, uint256 _amount, uint256 _lockPeriodInSec, address _beneficiary)
        external
        returns (uint256 unlockTimeInSec_);

    function buyAndLock(
        address _subject,
        uint256 _depositAmount,
        uint256 _minReturnAmountAfterFee,
        uint256 _lockPeriodInSec
    ) external returns (uint256 amount_, uint256 unlockTimeInSec_);

    function buyAndLockFor(
        address _subject,
        uint256 _depositAmount,
        uint256 _minReturnAmountAfterFee,
        uint256 _lockPeriodInSec,
        address _beneficiary
    ) external returns (uint256 amount_, uint256 unlockTimeInSec_);

    function withdraw(address _subject, uint256[] memory _indexes) external returns (uint256 totalAmount_);

    function extendLock(address _subject, uint256[] memory _indexes, uint256 _lockPeriodInSec)
        external
        returns (uint256 totalAmount_, uint256 unlockTimeInSec_);

    function extendLockFor(address _subject, uint256[] memory _indexes, uint256 _lockPeriodInSec, address _beneficiary)
        external
        returns (uint256 totalAmount_, uint256 unlockTimeInSec_);
    function setLockPeriod(uint256 _lockPeriodInSec, bool _allowed) external;

    function getTotalStakedAmount(address _user, address _subject, uint256[] calldata _indexes)
        external
        view
        returns (uint256);
}
