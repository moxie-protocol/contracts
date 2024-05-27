// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

// @dev The following global imports are suppressed in solhint as there is no name conflicts in the imported names.
// solhint-disable-next-line no-global-import
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
// solhint-disable-next-line no-global-import
import "@openzeppelin/contracts/access/Ownable.sol";
// solhint-disable-next-line no-global-import
import "./lib/AllowListVerifierHelper.sol";
// solhint-disable-next-line no-global-import
import "./interface/IAllowListVerifier.sol";

/// @title Whitelisting Contract with ERC-721 Address Setter
/// @notice This contract allows the owner to set the address of an ERC-721 contract.
/// @dev This function is restricted to the contract owner and sets the address for an ERC-721 contract.
contract MoxiePassVerifier is Ownable, IAllowListVerifier {
    IERC721 public erc721ContractAddress;

    /**
     * @dev The operation failed because the address is zero
     */
    error InvalidSenderAddress();

    /**
     * @dev The operation failed because the address does not hold the moxie pass
     */
    error NotaMoxiePassHolder();

    /**
     * @dev Modifier to make a function callable only when the msg.sender holds moxie padd
     */
    modifier onlyMoxiePassHolder() {
        isMoxiePassHolder();
        _;
    }

    constructor(address _ownerAddress) Ownable(_ownerAddress) {}

    /// @notice Sets the address of the ERC-721 contract.
    /// @dev This function can only be called by the contract owner. It sets the `erc721ContractAddress` to the specified address. By design, the contract owner can set the erc721ContractAddress to 0 to disable the allow list check.
    /// @param _erc721ContractAddress The address of the ERC-721 contract to be set.
    function setErc721ContractAddress(
        address _erc721ContractAddress
    ) public onlyOwner {
        erc721ContractAddress = IERC721(_erc721ContractAddress);
    }

    /**
     * @dev Throws if the contract is paused.
     */
    function isMoxiePassHolder() internal view virtual {
        if (
            address(erc721ContractAddress) != address(0) &&
            erc721ContractAddress.balanceOf(msg.sender) == 0
        ) {
            revert NotaMoxiePassHolder();
        }
    }

    function isMoxiePassHolder(address _address) external view returns (bool) {
        if (address(erc721ContractAddress) == address(0)) {
            return true;
        }
        return erc721ContractAddress.balanceOf(_address) > 0;
    }

    /// @notice Checks if the specified user is allowed to perform an action in the given auction.
    /// @dev The function is a view function and does not modify state. It returns a bytes4 selector indicating whether the action is allowed.
    /// @param user The address of the user whose permission is being checked.
    /// @param auctionId The ID of the auction in which the action is to be performed.
    /// @param callData The calldata associated with the action to be performed.
    /// @return A bytes4 selector indicating whether the user is allowed to perform the action in the auction.
    function isAllowed(
        address user,
        uint256 auctionId,
        // solhint-disable-next-line no-unused-vars
        bytes calldata callData
    ) external view returns (bytes4) {
        // If the user address is 0, return 0
        if (user == address(0)) {
            return bytes4(0);
        }

        // The auction Id should be greater than 0 to be valid
        if (auctionId == 0) {
            return bytes4(0);
        }

        // If the erc721ContractAddress is 0, that mean the check if the user holds the NFT is not required.
        // @dev this is by design, as the contract owner can set the erc721ContractAddress to 0 to disable the check
        if (address(erc721ContractAddress) == address(0)) {
            return AllowListVerifierHelper.MAGICVALUE;
        }

        // Check if the user is the owner of the NFT
        if (erc721ContractAddress.balanceOf(user) != 0) {
            return AllowListVerifierHelper.MAGICVALUE;
        }

        // Finally return 0
        return bytes4(0);
    }
}
