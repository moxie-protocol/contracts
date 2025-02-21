// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {GraduationHook} from "../contracts/uniswap/GraduationHook.sol";
import {HelperConfig} from "./HelperConfig.s.sol";
import {MoxieBondingCurveV3} from "../contracts/MoxieBondingCurveV3.sol";
import {ProxyAdmin} from "openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {IPositionManager} from "@uniswap/briefcase/src/protocols/v4-periphery/interfaces/IPositionManager.sol";
import {IUniversalRouter} from "@uniswap/briefcase/src/protocols/universal-router/interfaces/IUniversalRouter.sol";
import {ITransparentUpgradeableProxy} from "openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {HookMiner} from "../contracts/tests/UniswapDeployer.sol";
import {MoxieToken} from "../contracts/tokens/MoxieToken.sol";
import {TokenManager} from "../contracts/TokenManager.sol";

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
            uint256 ownerKey,
            ,
            uint256 proxyAdminOwnerAccount
        ) = deriveKeys();
        address owner = vm.addr(ownerKey);

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

        MoxieBondingCurveV3 moxieBondingCurveV3 = new MoxieBondingCurveV3();
        console.log(
            "MoxieBondingCurveV3 deployed to %s",
            address(moxieBondingCurveV3)
        );
        TokenManager tokenManager = TokenManager(
            currentNetworkConfig.tokenManager
        );
        /// ----------------------------------
        ///           Initialize
        /// ----------------------------------
        moxieBondingCurveV3.initialize(
            currentNetworkConfig.moxieToken,
            currentNetworkConfig.formula,
            currentNetworkConfig.tokenManager,
            currentNetworkConfig.vault,
            owner,
            currentNetworkConfig.feeInput,
            currentNetworkConfig.feeBeneficiary,
            currentNetworkConfig.subjectFactory
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
            address(moxieBondingCurveV3),
            abi.encodeWithSelector(
                MoxieBondingCurveV3.reinitialize.selector,
                currentNetworkConfig.defaultGraduationMarketCap,
                graduationHook,
                IPositionManager(currentNetworkConfig.positionManager),
                IUniversalRouter(currentNetworkConfig.router),
                currentNetworkConfig.feeInput.swapFeeRatioProtocolPct
            )
        );
        vm.stopBroadcast();

        /// ----------------------------------
        ///           Testing swap
        /// ----------------------------------
        vm.startPrank(0x9b36D8BED0AFB3EE990961786271ED136d798dBe);
        // vm.startPrank(0x7FEbaDA1daEFdA307c6F52f4818De6fE190C5B82);
        address subjectToken = tokenManager.tokens(
            0x7FEbaDA1daEFdA307c6F52f4818De6fE190C5B82
        );
        MoxieBondingCurveV3 implementation = MoxieBondingCurveV3(
            currentNetworkConfig.moxieBondingCurveInstance
        );
        MoxieToken moxieToken = MoxieToken(currentNetworkConfig.moxieToken);
        uint256 initialMoxieBalance = moxieToken.balanceOf(
            // 0x7FEbaDA1daEFdA307c6F52f4818De6fE190C5B82
            0x9b36D8BED0AFB3EE990961786271ED136d798dBe
        );
        console.log("initial moxie balance", initialMoxieBalance);
        // 1. Graduate
        implementation.graduateSubject(
            0x7FEbaDA1daEFdA307c6F52f4818De6fE190C5B82
        );
        // 2. Swap - buy sell
        uint256 moxieAmount = 100000000000000000000000; // 100k moxie
        moxieToken.approve(
            currentNetworkConfig.moxieBondingCurveInstance,
            moxieAmount
        );
        uint256 initialSubjectBalance = IERC20Extended(subjectToken).balanceOf(
            // 0x7FEbaDA1daEFdA307c6F52f4818De6fE190C5B82
            0x9b36D8BED0AFB3EE990961786271ED136d798dBe
        );
        console.log("initial moxie balance", initialMoxieBalance);
        console.log("initial subject balance", initialSubjectBalance);
        // buy
        implementation.swap(
            0x7FEbaDA1daEFdA307c6F52f4818De6fE190C5B82,
            true,
            moxieAmount,
            0
        );
        uint256 moxieBalanceAfterBuy = moxieToken.balanceOf(
            // 0x7FEbaDA1daEFdA307c6F52f4818De6fE190C5B82
            0x9b36D8BED0AFB3EE990961786271ED136d798dBe
        );
        uint256 subjectBalanceAfterBuy = IERC20Extended(subjectToken).balanceOf(
                // 0x7FEbaDA1daEFdA307c6F52f4818De6fE190C5B82
                0x9b36D8BED0AFB3EE990961786271ED136d798dBe
            );
        console.log("moxie balance after buy", moxieBalanceAfterBuy);
        console.log("subject balance after buy", subjectBalanceAfterBuy);

        // 3. Fee distribution
        // take out fee, burn subjectFee, moxie part of fee 50% to protocolRewards 50% to feeBeneficiary
        implementation.distributeSwapFee(
            0x7FEbaDA1daEFdA307c6F52f4818De6fE190C5B82
        );
        vm.stopPrank();
    }
}
