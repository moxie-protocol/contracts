// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
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

contract TestDumping is HelperConfig {
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
            uint256 proxyAdminOwnerAccountKey
        ) = deriveKeys();
        address owner = vm.addr(ownerKey);
        address deployer = vm.addr(deployerKey);
        address proxyAdminOwnerAccount = vm.addr(proxyAdminOwnerAccountKey);
        address subject = 0x7FEbaDA1daEFdA307c6F52f4818De6fE190C5B82;
        address richUser = 0x9b36D8BED0AFB3EE990961786271ED136d798dBe;
        if (block.chainid == 8453) {
            owner = 0x1626EB1B25F819377acb6d72913618FB93e2fcB9;
            deployer = 0xc853D3B5F801e6eDD922E6690D4b813B683600aB;
            proxyAdminOwnerAccount = 0x1626EB1B25F819377acb6d72913618FB93e2fcB9;
            subject = 0xC46dc9ebdD60b18daaAc750A537FE053280517A6;
            richUser = 0x76eC2D459cd9D0Fa90A9AfA801918d9746FbeA3d;
        }
        MoxieBondingCurveV3 implementation = MoxieBondingCurveV3(
            currentNetworkConfig.moxieBondingCurveInstance
        );
        MoxieToken moxieToken = MoxieToken(currentNetworkConfig.moxieToken);
        uint256 moxieAmount = 100000000000000000000000; // 100k moxie
        // uint256 moxieAmount = 100000000000000000000; // 100 moxie
        // uint256 moxieAmount = 1000000000000000000; // 1 moxie

        TokenManager tokenManager = TokenManager(
            currentNetworkConfig.tokenManager
        );
        address subjectToken = tokenManager.tokens(subject);
        IERC20Extended subjectTokenContract = IERC20Extended(subjectToken);

        vm.startPrank(richUser);
        uint256 moxieBalanceBefore = moxieToken.balanceOf(richUser);
        uint256 subjectTokenBalanceBeforeBuying = subjectTokenContract
            .balanceOf(richUser);
        moxieToken.approve(
            currentNetworkConfig.moxieBondingCurveInstance,
            moxieAmount
        );
        uint256 subjectTokensGot = implementation.buyShares(
            subject,
            moxieAmount,
            0
        );

        uint256 subjectTokenBalanceAfterBuying = subjectTokenContract.balanceOf(
            richUser
        );
        console2.log("subject tokens got", subjectTokensGot);
        uint256 subjectTokensGot2 = subjectTokenBalanceAfterBuying -
            subjectTokenBalanceBeforeBuying;
        console2.log("subject tokens got by balance", subjectTokensGot2);
        uint256 moxieBalanceAfter = moxieToken.balanceOf(richUser);
        uint256 moxieSpent = moxieBalanceBefore - moxieBalanceAfter;
        console2.log("moxie spent for first buy", moxieSpent);
        vm.stopPrank();

        vm.startBroadcast(deployer);
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
        console2.log("Graduation hook address: %s", graduationHookAddress);
        address graduationHook = deployHook(
            type(GraduationHook).creationCode,
            graduationConstructorArgs,
            salt
        );
        console2.log("Graduation hook deployed to %s", graduationHook);

        MoxieBondingCurveV3 moxieBondingCurveV3 = new MoxieBondingCurveV3();
        console2.log(
            "MoxieBondingCurveV3 deployed to %s",
            address(moxieBondingCurveV3)
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
        ///           Test dumping
        /// ----------------------------------
        // vm.startPrank(richUser);
        // implementation.graduateSubject(subject);

        // subjectTokenContract.approve(
        //     currentNetworkConfig.moxieBondingCurveInstance,
        //     subjectTokensGot
        // );
        // uint256 moxieBalanceBeforeSwap = moxieToken.balanceOf(richUser);
        // implementation.swap(subject, false, subjectTokensGot2, 0);
        // uint256 moxieBalanceAfterSwap = moxieToken.balanceOf(richUser);
        // console2.log("moxieBalanceBefore swap", moxieBalanceBeforeSwap);
        // console2.log("moxieBalanceAfter swap", moxieBalanceAfterSwap);
        // console2.log("moxieAmount", moxieAmount);
        // vm.stopPrank();
    }
}
