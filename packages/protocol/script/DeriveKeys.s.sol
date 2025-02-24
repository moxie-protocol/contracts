// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";

contract DeriveKeys is Script {
    function deriveKeys()
        internal
        view
        returns (
            uint256 deployerKey,
            uint256 ownerKey,
            uint256 minterKey,
            uint256 proxyAdminOwnerAccount
        )
    {
        string memory mnemonic = vm.envString("MNEMONIC");
        deployerKey = vm.deriveKey(mnemonic, 0);
        ownerKey = vm.deriveKey(mnemonic, 1);
        minterKey = vm.deriveKey(mnemonic, 2);
        if (block.chainid == 31337) {
            proxyAdminOwnerAccount = vm.deriveKey(mnemonic, 1);
        } else if (block.chainid == 84532) {
            proxyAdminOwnerAccount = vm.deriveKey(mnemonic, 8);
        } else {
            proxyAdminOwnerAccount = vm.deriveKey(mnemonic, 8);
        }
    }
}
