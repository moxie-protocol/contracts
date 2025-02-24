// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {GraduationHook} from "../contracts/uniswap/GraduationHook.sol";
import {HelperConfig} from "./HelperConfig.s.sol";
import {MoxieBondingCurveV3} from "../contracts/MoxieBondingCurveV3.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {IPositionManager} from "@uniswap/briefcase/src/protocols/v4-periphery/interfaces/IPositionManager.sol";
import {IUniversalRouter} from "@uniswap/briefcase/src/protocols/universal-router/interfaces/IUniversalRouter.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {HookMiner} from "../contracts/tests/UniswapDeployer.sol";
import {MoxieToken} from "../contracts/tokens/MoxieToken.sol";
import {TokenManager} from "../contracts/TokenManager.sol";
import {IGraduationHook} from "../contracts/interfaces/IGraduationHook.sol";
import {IERC20Extended} from "../contracts/interfaces/IERC20Extended.sol";

contract DeployGraduation is HelperConfig {
    function deployHook(
        bytes memory creationCode,
        bytes memory constructorArgs,
        bytes32 salt
    ) public returns (address hookAddress) {
        bytes memory initCode = abi.encodePacked(creationCode, constructorArgs);
        assembly ("memory-safe") {
            let ptr := mload(0x40)
            let success := create2(
                0,
                add(initCode, 0x20),
                mload(initCode),
                salt
            )

            if iszero(success) {
                // Get the size of the returned error message
                let errorSize := returndatasize()
                // Copy the error message to memory
                returndatacopy(ptr, 0, errorSize)
                // Revert with the error message
                revert(ptr, errorSize)
            }

            hookAddress := success
        }
        return hookAddress;
    }

    function run() public {
        (
            uint256 deployerKey,
            ,
            ,
            uint256 proxyAdminOwnerAccount
        ) = deriveKeys();

        vm.startBroadcast(deployerKey);
        bytes memory graduationConstructorArgs = abi.encode(
            currentNetworkConfig.poolManager,
            currentNetworkConfig.moxieBondingCurveInstance
        );
        (address graduationHookAddress, bytes32 salt) = HookMiner.find(
            currentNetworkConfig.deterministicDeploymentProxy,
            4096, // after initialize hook flag
            type(GraduationHook).creationCode,
            graduationConstructorArgs
        );
        console.log("Graduation hook address: %s", graduationHookAddress);
        address graduationHook = deployHook(
            type(GraduationHook).creationCode,
            graduationConstructorArgs,
            salt
        );
        console.log("Graduation hook deployed to %s", graduationHook);

        MoxieBondingCurveV3 moxieBondingCurveV3MasterCopy = new MoxieBondingCurveV3();
        console.log(
            "MoxieBondingCurveV3 deployed to %s",
            address(moxieBondingCurveV3MasterCopy)
        );
        /// ----------------------------------
        ///           Initialize
        /// ----------------------------------
        moxieBondingCurveV3MasterCopy.initialize(
            currentNetworkConfig.moxieToken,
            currentNetworkConfig.formula,
            currentNetworkConfig.tokenManager,
            currentNetworkConfig.vault,
            currentOwner,
            currentNetworkConfig.feeInput,
            currentNetworkConfig.feeBeneficiary,
            currentNetworkConfig.subjectFactory
        );

        // reinitialize
        moxieBondingCurveV3MasterCopy.reinitialize(
            currentNetworkConfig.defaultGraduationMarketCap,
            IGraduationHook(graduationHook),
            IPositionManager(currentNetworkConfig.positionManager),
            IUniversalRouter(currentNetworkConfig.router),
            currentNetworkConfig.feeInput.swapFeeRatioProtocolPct
        );
        ProxyAdmin proxyAdmin = ProxyAdmin(
            currentNetworkConfig.moxieBondingCurveProxyAdminOwner
        );

        vm.stopBroadcast();

        /// ----------------------------------
        ///           Upgrade and reinitialize
        /// ----------------------------------
        vm.startBroadcast(proxyAdminOwnerAccount);
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(
                currentNetworkConfig.moxieBondingCurveInstance
            ),
            address(moxieBondingCurveV3MasterCopy),
            ""
            // abi.encodeWithSelector(
            //     MoxieBondingCurveV3.reinitialize.selector,
            //     currentNetworkConfig.defaultGraduationMarketCap,
            //     graduationHook,
            //     IPositionManager(currentNetworkConfig.positionManager),
            //     IUniversalRouter(currentNetworkConfig.router),
            //     currentNetworkConfig.feeInput.swapFeeRatioProtocolPct
            // )
        );
        vm.stopBroadcast();
    }
}
