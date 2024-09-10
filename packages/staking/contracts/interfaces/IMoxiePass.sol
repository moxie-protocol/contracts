// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.0;

interface IMoxiePass {
    function mint(address to, string memory uri) external;
}
