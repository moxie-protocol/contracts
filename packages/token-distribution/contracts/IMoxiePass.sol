// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.7.3;

interface IMoxiePass {
    function mint(address to, string memory uri) external;
}