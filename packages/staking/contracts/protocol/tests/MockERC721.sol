// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// solhint-disable-next-line no-global-import
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC721 is ERC721 {
    constructor(
        string memory name_,
        string memory symbol_
    ) ERC721(name_, symbol_) {
        _mint(msg.sender, 1);
    }

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}
