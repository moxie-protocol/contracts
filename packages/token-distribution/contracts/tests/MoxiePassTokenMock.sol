// SPDX-License-Identifier: MIT

pragma solidity ^0.7.3;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MoxiePassTokenMock is ERC721, Ownable {

    uint256 private _tokenIdCounter;
    string public tokenUri;

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {
        _tokenIdCounter = 0;
    }

    function mint(address to, string memory uri ) public {
        _mint(to, _tokenIdCounter);
        _tokenIdCounter += 1;
        tokenUri = uri;
    }
}
