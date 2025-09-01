// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Define minimal WETH interface
interface IWETH is IERC20{
    function withdraw(uint256 wad) external;
}