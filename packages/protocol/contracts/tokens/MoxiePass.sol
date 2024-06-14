// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MoxiePass is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 private _nextTokenId;

    error MoxiePass_InvalidAdmin();
    error MoxiePass_InvalidMinter();
    error MoxiePass_TransferNotAllowed();

    constructor(
        address defaultAdmin,
        address minter
    ) ERC721("Moxie Pass", "MXP") {
        if (defaultAdmin == address(0)) revert MoxiePass_InvalidAdmin();

        if (minter == address(0)) revert MoxiePass_InvalidMinter();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
    }

    function _baseURI() internal pure override returns (string memory) {
        return "https://moxie.xyz/moxie-pass/";
    }

    function mint(address to) public onlyRole(MINTER_ROLE) {
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
    }
    
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);

        if(from != address(0))  {
            revert MoxiePass_TransferNotAllowed();
        }
        return super._update(to, tokenId, auth);
    }

    // The following functions are overrides required by Solidity.

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
