// SPDX-License-Identifier: LGPL-3.0-or-later
pragma solidity >=0.6.8;

library AllowListVerifierHelper {
    /// @dev Value returned by a call to `isAllowed` if the check
    /// was successful. The value is defined as:
    /// bytes4(keccak256("isAllowed(address,uint256,bytes)"))
    bytes4 internal constant MAGICVALUE = 0x19a05a7e;
}
