// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {GraduationHook} from "../contracts/uniswap/GraduationHook.sol";
import {HelperConfig} from "./HelperConfig.s.sol";
import {UniswapDeployer} from "../contracts/tests/UniswapDeployer.sol";
import {MoxieBondingCurveV3} from "../contracts/MoxieBondingCurveV3.sol";
import {ProxyAdmin} from "openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {IPositionManager} from "@uniswap/briefcase/src/protocols/v4-periphery/interfaces/IPositionManager.sol";
import {IUniversalRouter} from "@uniswap/briefcase/src/protocols/universal-router/interfaces/IUniversalRouter.sol";
import {ITransparentUpgradeableProxy} from "openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract DeployGraduation is HelperConfig {
    function run() public {
        (
            uint256 deployerKey,
            uint256 ownerKey,
            ,
            uint256 proxyAdminOwnerAccount
        ) = deriveKeys();
        address owner = vm.addr(ownerKey);

        vm.startBroadcast(deployerKey);
        // deploy graduation hook
        // UniswapDeployer uniswapDeployer = UniswapDeployer(
        //     currentNetworkConfig.uniswapDeployer
        // );

        UniswapDeployer uniswapDeployer = new UniswapDeployer();

        bytes memory graduationConstructorArgs = abi.encode(
            uniswapDeployer.poolManager(),
            currentNetworkConfig.moxieBondingCurveInstance
        );

        (address graduationHookAddress, bytes32 salt) = uniswapDeployer
            .mineHookAddress(
                address(uniswapDeployer),
                4096, // after initialize hook flag
                type(GraduationHook).creationCode,
                graduationConstructorArgs
            );

        console.log("Graduation hook address: %s", graduationHookAddress);

        address graduationHook = uniswapDeployer.deployHook(
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
        vm.startPrank(0x9313eDE439fC91852D4Fd8f753C5569255286790);
        MoxieBondingCurveV3 implementation = MoxieBondingCurveV3(
            currentNetworkConfig.moxieBondingCurveInstance
        );

        implementation.graduateSubject(owner);
        // implementation.swap(owner, true, 1000000000000000000, 0);
        vm.stopPrank();
    }
}
