// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {HelperConfig} from "./HelperConfig.s.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {IPositionManager} from "@uniswap/briefcase/src/protocols/v4-periphery/interfaces/IPositionManager.sol";
import {IUniversalRouter} from "@uniswap/briefcase/src/protocols/universal-router/interfaces/IUniversalRouter.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {HookMiner} from "../contracts/tests/UniswapDeployer.sol";
import {IGraduationHook} from "../contracts/interfaces/IGraduationHook.sol";
import {IERC20Extended} from "../contracts/interfaces/IERC20Extended.sol";
import {IMoxieBondingCurveV3} from "../contracts/interfaces/IMoxieBondingCurveV3.sol";
contract DeployGraduation is HelperConfig {
    function deployHook(bytes memory creationCode, bytes memory constructorArgs, bytes32 salt)
        public
        returns (address hookAddress)
    {
        bytes memory initCode = abi.encodePacked(creationCode, constructorArgs);
        assembly ("memory-safe") {
            let ptr := mload(0x40)
            let success := create2(0, add(initCode, 0x20), mload(initCode), salt)

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
        (uint256 deployerKey,,, uint256 proxyAdminOwnerAccount) = deriveKeys();

        vm.startBroadcast(deployerKey);
        bytes memory graduationConstructorArgs =
            abi.encode(currentNetworkConfig.poolManager, currentNetworkConfig.moxieBondingCurveInstance);
        bytes memory graduationCreationCode = vm.getCode("GraduationHook.sol:GraduationHook");
        (address graduationHookAddress, bytes32 salt) = HookMiner.find(
            currentNetworkConfig.deterministicDeploymentProxy,
            4096, // after initialize hook flag
            graduationCreationCode,
            graduationConstructorArgs
        );
        console.log("Graduation hook address: %s", graduationHookAddress);
        address graduationHook = deployHook(graduationCreationCode, graduationConstructorArgs, salt);
        console.log("Graduation hook deployed to %s", graduationHook);

        bytes memory moxieBondingCurveV3CreationCode = vm.getCode("MoxieBondingCurveV3.sol:MoxieBondingCurveV3");

        address moxieBondingCurveV3MasterCopy;
        assembly ("memory-safe") {
            moxieBondingCurveV3MasterCopy :=
                create(0, add(moxieBondingCurveV3CreationCode, 0x20), mload(moxieBondingCurveV3CreationCode))
        }
        console.log("MoxieBondingCurveV3 deployed to %s", address(moxieBondingCurveV3MasterCopy));
        IMoxieBondingCurveV3 moxieBondingCurveV3MasterCopyInstance = IMoxieBondingCurveV3(moxieBondingCurveV3MasterCopy);
        /// ----------------------------------
        ///           Initialize
        /// ----------------------------------
        moxieBondingCurveV3MasterCopyInstance.initialize(
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
        moxieBondingCurveV3MasterCopyInstance.reinitialize(
            currentNetworkConfig.defaultGraduationMarketCap,
            IGraduationHook(graduationHook),
            IPositionManager(currentNetworkConfig.positionManager),
            IUniversalRouter(currentNetworkConfig.router),
            currentNetworkConfig.feeInput.swapFeeRatioProtocolPct
        );
        ProxyAdmin proxyAdmin = ProxyAdmin(currentNetworkConfig.moxieBondingCurveProxyAdminOwner);

        vm.stopBroadcast();

        /// ----------------------------------
        ///           Upgrade and reinitialize
        /// ----------------------------------
        vm.startBroadcast(proxyAdminOwnerAccount);
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(currentNetworkConfig.moxieBondingCurveInstance),
            address(moxieBondingCurveV3MasterCopy),
            abi.encodeWithSelector(
                IMoxieBondingCurveV3.reinitialize.selector,
                currentNetworkConfig.defaultGraduationMarketCap,
                graduationHook,
                IPositionManager(currentNetworkConfig.positionManager),
                IUniversalRouter(currentNetworkConfig.router),
                currentNetworkConfig.feeInput.swapFeeRatioProtocolPct
            )
        );

        vm.stopBroadcast();
    }
}
