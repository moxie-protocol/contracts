// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Define minimal WETH interface
interface IWETH is IERC20{
    function withdraw(uint256 wad) external;
}