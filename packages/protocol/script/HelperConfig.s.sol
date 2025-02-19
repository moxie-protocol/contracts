// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;
import {Script} from "forge-std/Script.sol";
import {IMoxieBondingCurveV3} from "../contracts/interfaces/IMoxieBondingCurveV3.sol";
import {DeriveKeys} from "./DeriveKeys.s.sol";

contract HelperConfig is DeriveKeys {
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    // Local network state variables
    struct NetworkConfig {
        address poolManager;
        address moxieBondingCurveInstance;
        address uniswapDeployer;
        address moxieToken;
        address formula;
        address tokenManager;
        address vault;
        IMoxieBondingCurveV3.FeeInput feeInput;
        address feeBeneficiary;
        address subjectFactory;
        address moxieBondingCurveProxyAdminOwner;
        uint256 defaultGraduationMarketCap;
        address positionManager;
        address router;
    }

    NetworkConfig public currentNetworkConfig;
    mapping(uint256 chainId => NetworkConfig) public networkConfigs;

    constructor() {
        networkConfigs[84532] = NetworkConfig({
            poolManager: 0xf7F5aB3DcA35e17dE187b459159BC643853B3c67,
            moxieBondingCurveInstance: 0x56147e70A57012ade3003fe93a394BFC35d747e3,
            uniswapDeployer: 0x4e59b44847b379578588920cA78FbF26c0B4956C,
            moxieToken: 0x5D7cb10515D07a1726A30AffFFEDBE3cc048C412,
            formula: 0x49f0B03B91e07e7F173521f6B38b0CDaA7D5B724,
            tokenManager: 0xFd990aF1c711cC0fc46E66B22877B028aF7eF59C,
            vault: 0x3C1Fd0E625765A40fFd58adc4784603A07f5D05f,
            feeInput: IMoxieBondingCurveV3.FeeInput({
                protocolBuyFeePct: 0,
                protocolSellFeePct: 25000000000000000,
                subjectBuyFeePct: 0,
                subjectSellFeePct: 25000000000000000,
                swapFeeRatioProtocolPct: 0
            }),
            feeBeneficiary: 0x7F472aaa6492a07BFfbE98664A11f76615150584,
            subjectFactory: 0x85EF5592E533915706d16355807F0D2ed44Cf58F,
            moxieBondingCurveProxyAdminOwner: 0x73eB398583548ac0278656EF6c3805389fF46ccf,
            defaultGraduationMarketCap: 1000000000000000,
            positionManager: 0x0B32f74f8365d535783949E014B7754047B64e31,
            router: 0xe14A7950D57A4Ee635F69F61a669174F802E6201
        });
        currentNetworkConfig = networkConfigs[block.chainid];
    }
}
