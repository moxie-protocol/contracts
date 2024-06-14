// SPDX-License-Identifier: LGPL-3.0-or-later
pragma solidity >=0.6.8;

///
/// @dev Standardized interface for an allowList manager for easyAuction
/// The interface was inspired by EIP-1271
interface IAllowListVerifier {
    /// @dev Should return whether the a specific user has access to an auction
    /// by returning the magic value from AllowListVerifierHelper
    function isAllowed(
        address user,
        uint256 auctionId,
        bytes calldata callData
    ) external view returns (bytes4);
}
