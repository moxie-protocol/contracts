// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {HelperConfig} from "./HelperConfig.s.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {IERC20Extended} from "../contracts/interfaces/IERC20Extended.sol";
import {IMoxieBondingCurveV3} from "../contracts/interfaces/IMoxieBondingCurveV3.sol";
import {IGraduationHook} from "../contracts/interfaces/IGraduationHook.sol";
import {IPositionManager} from "@uniswap/briefcase/src/protocols/v4-periphery/interfaces/IPositionManager.sol";
import {IUniversalRouter} from "@uniswap/briefcase/src/protocols/universal-router/interfaces/IUniversalRouter.sol";

contract UpgradeMoxieBondingCurve is HelperConfig {
 

    function run() public {
        (uint256 deployerKey,,, uint256 proxyAdminOwnerAccount) = deriveKeys();

        vm.startBroadcast(deployerKey);
      

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
            ""
        );


        vm.stopBroadcast();
        
        // IMoxieBondingCurveV3 instance = IMoxieBondingCurveV3(currentNetworkConfig.moxieBondingCurveInstance);
        // vm.startPrank(0x59bBAb6e11E83Dd60850783783143cf1c2A3AA49);
        // IERC20Extended moxieToken = IERC20Extended(currentNetworkConfig.moxieToken);
        // moxieToken.approve(currentNetworkConfig.moxieBondingCurveInstance, 100 ether);
        // instance.buySharesFor(address(0xBc57373c9B99524f6300664e2602A0427A9ec0db), 100 ether,address(0), 0);
        // vm.stopPrank();
    }
}
