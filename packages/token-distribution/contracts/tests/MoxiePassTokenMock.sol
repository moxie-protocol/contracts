// SPDX-License-Identifier: MIT

pragma solidity ^0.7.3;

import "../IERC721Mintable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MoxiePassTokenMock is ERC721, Ownable, IERC721Mintable {

    uint256 private _tokenIdCounter;

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {
        _tokenIdCounter = 0;
    }

    function mint(address to) public override {
        _mint(to, _tokenIdCounter);
        _tokenIdCounter += 1;
    }
}
