// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IStaking {
    error EmptyIndexes();
    error SubjectsDoesntMatch(uint256 index);
    error AmountShouldBeGreaterThanZero();
    error InvalidSubjectToken();
    error TransferFailed();
    error LockNotExpired(
        uint256 index,
        uint256 currentTime,
        uint256 unlockTime
    );
    error InvalidIndex(uint256 index);
    error NotOwner();
    error AlreadyWithdrawn();
    error InvalidOwner();
    error NotSameUser(uint256 index);

    struct LockInfo {
        address user;
        address subject;
        address subjectToken;
        uint256 unlockTime;
        uint256 amount;
    }

    event Lock(
        address indexed user,
        address indexed subject,
        address indexed subjectToken,
        uint256 index,
        uint256 amount,
        uint256 unlockTime
    );

    event LockExtended(uint256[] indexes);

    event LockPeriodUpdated(uint256 indexed lockPeriod);

    event Withdraw(
        address indexed user,
        address indexed subject,
        address indexed subjectToken,
        uint256[] indexes,
        uint256 amount
    );

    function depositAndLock(address _subject, uint256 _amount) external;

    function buyAndLock(
        address _subject,
        uint256 _depositAmount,
        uint256 _minReturnAmountAfterFee
    ) external;

    function withdraw(uint256[] memory _indexes) external;

    function getLockInfo(
        uint256 _index
    ) external view returns (LockInfo memory);

    function getTotalStakedAmount(
        address _user,
        address _subject,
        uint256[] calldata _indexes
    ) external view returns (uint256);
}
