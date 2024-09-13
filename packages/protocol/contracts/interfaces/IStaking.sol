// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IStaking {
    error Staking_EmptyIndexes();
    error Staking_SubjectsDoesntMatch(uint256 index);
    error Staking_AmountShouldBeGreaterThanZero();
    error Staking_InvalidSubjectToken();
    error Staking_TransferFailed();
    error Staking_LockNotExpired(uint256 index, uint256 currentTime, uint256 unlockTime);
    error Staking_InvalidIndex(uint256 index);
    error Staking_NotOwner(uint256 index);
    error Staking_AlreadyWithdrawn();
    error Staking_InvalidOwner();
    error Staking_NotSameUser(uint256 index);
    error Staking_InvalidLockPeriod();
    error Staking_InvalidTokenManager();
    error Staking_InvalidMoxieBondingCurve();
    error Staking_InvalidMoxieToken();
    error Staking_InvalidDefaultAdmin();
    error Staking_LockPeriodAlreadySet();

    struct LockInfo {
        address user;
        address subject;
        address subjectToken;
        uint256 unlockTime;
        uint256 amount;
        uint256 lockPeriod;
    }

    event Lock(
        address indexed user,
        address indexed subject,
        address indexed subjectToken,
        uint256 index,
        uint256 amount,
        uint256 unlockTime,
        uint256 lockPeriod
    );

    event LockExtended(uint256[] indexes);

    event LockPeriodUpdated(uint256 indexed lockPeriod, bool indexed allowed);

    event Withdraw(
        address indexed user, address indexed subject, address indexed subjectToken, uint256[] indexes, uint256 amount
    );

    function depositAndLock(address _subject, uint256 _amount, uint256 _lockPeriod) external;

    function buyAndLock(address _subject, uint256 _depositAmount, uint256 _minReturnAmountAfterFee, uint256 _lockPeriod)
        external;
    function withdraw(uint256[] memory _indexes, address _subject) external;

    function extendLock(uint256[] memory _indexes, address _subject, uint256 _lockPeriod) external;
    function setLockPeriod(uint256 _lockPeriod, bool _allowed) external;

    function getTotalStakedAmount(address _user, address _subject, uint256[] calldata _indexes)
        external
        view
        returns (uint256);
}
