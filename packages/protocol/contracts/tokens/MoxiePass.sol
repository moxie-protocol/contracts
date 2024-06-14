// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title MOXIE PASS  NFT required to participate in Moxie protocol
 * @author Moxie Team
   @notice Only allow one mint per wallet, non transferrable & token uri for each tokenId.
 */
contract MoxiePass is ERC721, ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 private _nextTokenId;

    error MoxiePass_InvalidAdmin();
    error MoxiePass_InvalidMinter();
    error MoxiePass_TransferNotAllowed();
    error MoxiePass_OnlyOneMintAllowed();

    /**
     * @dev Constructor
     * @param defaultAdmin Address of admin to manage roles
     * @param minter Minter wallet address. 
     */
    constructor(
        address defaultAdmin,
        address minter
    ) ERC721("Moxie Pass", "MXP") {
        if (defaultAdmin == address(0)) revert MoxiePass_InvalidAdmin();
        if (minter == address(0)) revert MoxiePass_InvalidMinter();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);

        uint256 balance = balanceOf(to);

        if (balance > 0) revert MoxiePass_OnlyOneMintAllowed();

        if (from != address(0)) {
            revert MoxiePass_TransferNotAllowed();
        }
        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Mint to an address with a URI
     * @param to Address of beneficiary.
     * @param uri Token URI of NFT.
     */
    function mint(address to, string memory uri) public onlyRole(MINTER_ROLE) {
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    // The following functions are overrides required by Solidity.

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}