// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract MoxieToken is ERC20, ERC20Burnable, ERC20Permit {

    uint256 public constant TOKEN_INITIAL_SUPPLY = 10_000_000_000;

    constructor() ERC20("Moxie", "MOXIE") ERC20Permit("Moxie") {
        _mint(msg.sender, TOKEN_INITIAL_SUPPLY * 10 ** decimals());
    }
} 