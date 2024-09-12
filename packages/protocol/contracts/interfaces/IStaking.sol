// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IStaking {
    error EmptyIndexes();
    error SubjectsDoesntMatch(uint256 index);
    error AmountShouldBeGreaterThanZero();
    error InvalidSubject();
    error InvalidSubjectToken();
    error TransferFailed();
    error LockNotExpired(uint256 index, uint256 currentTime, uint256 unlockTime);
    error InvalidIndex(uint256 index);
    error NotOwner();
    error AlreadyWithdrawn();
    error InvalidOwner();
    error NotSameUser(uint256 index);
    error InvalidLockPeriod();

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
