// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

interface IMoxieTokenLockWallet {
    function approveSubjectToken(address _subject) external;

    fallback() external;
}
