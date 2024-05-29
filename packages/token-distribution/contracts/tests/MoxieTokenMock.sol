// SPDX-License-Identifier: MIT

pragma solidity ^0.7.3;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Graph Token Mock contract.
 * @dev Used for testing purposes, DO NOT USE IN PRODUCTION
 */
contract MoxieTokenMock is Ownable, ERC20 {
    /**
     * @notice Contract Constructor.
     * @param _initialSupply Initial supply
     * @param _mintTo Address to whitch to mint the initial supply
     */
    constructor(uint256 _initialSupply, address _mintTo) ERC20("Moxie Token Mock", "MOX-Mock") {
        // Deploy to mint address
        _mint(_mintTo, _initialSupply);
    }

    /**
     * @notice Burn tokens from an address
     * @param _from Address to burn tokens from
     * @param _amount Amount of tokens to burn
     */
    function burn(address _from, uint256 _amount) external {
        _burn(_from, _amount);
    }
}
