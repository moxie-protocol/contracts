// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

interface IMoxieTokenLockWallet {
    function approveProtocol() external;

    fallback() external payable;
}
