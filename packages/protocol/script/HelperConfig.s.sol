// SPDX-License-Identifier: GPL-3.0-or-later
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
        // address uniswapDeployer;
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
        address deterministicDeploymentProxy;
    }

    NetworkConfig public currentNetworkConfig;
    address public currentOwner;
    address public graduationHook;
    mapping(uint256 chainId => NetworkConfig) public networkConfigs;

    constructor() {
        networkConfigs[84532] = NetworkConfig({
            poolManager: 0xf7F5aB3DcA35e17dE187b459159BC643853B3c67,
            moxieBondingCurveInstance: 0x56147e70A57012ade3003fe93a394BFC35d747e3,
            // uniswapDeployer: 0x4e59b44847b379578588920cA78FbF26c0B4956C,
            moxieToken: 0x5D7cb10515D07a1726A30AffFFEDBE3cc048C412,
            formula: 0x49f0B03B91e07e7F173521f6B38b0CDaA7D5B724,
            tokenManager: 0xFd990aF1c711cC0fc46E66B22877B028aF7eF59C,
            vault: 0x3C1Fd0E625765A40fFd58adc4784603A07f5D05f,
            feeInput: IMoxieBondingCurveV3.FeeInput({
                protocolBuyFeePct: 0,
                protocolSellFeePct: 25000000000000000,
                subjectBuyFeePct: 0,
                subjectSellFeePct: 25000000000000000,
                swapFeeRatioProtocolPct: 500000000000000000
            }),
            feeBeneficiary: 0x7F472aaa6492a07BFfbE98664A11f76615150584,
            subjectFactory: 0x85EF5592E533915706d16355807F0D2ed44Cf58F,
            moxieBondingCurveProxyAdminOwner: 0x73eB398583548ac0278656EF6c3805389fF46ccf,
            defaultGraduationMarketCap: 100000000000000000000000,
            positionManager: 0x0B32f74f8365d535783949E014B7754047B64e31,
            router: 0xe14A7950D57A4Ee635F69F61a669174F802E6201,
            deterministicDeploymentProxy: 0x4e59b44847b379578588920cA78FbF26c0B4956C
        });

        networkConfigs[8453] = NetworkConfig({
            poolManager: 0x498581fF718922c3f8e6A244956aF099B2652b2b,
            moxieBondingCurveInstance: 0x373065e66B32a1C428aa14698dFa99BA7199B55E,
            moxieToken: 0x8C9037D1Ef5c6D1f6816278C7AAF5491d24CD527,
            formula: 0xF9d6271C1F47fEd7eA72edbe5A24dD06609F1547,
            tokenManager: 0xFfeACE4541276aC65c4e433B7fC63cdA32b30470,
            vault: 0x58708f65BacdF5040eac739cf01299fA756a1154,
            feeInput: IMoxieBondingCurveV3.FeeInput({
                protocolBuyFeePct: 5000000000000000,
                protocolSellFeePct: 5000000000000000,
                subjectBuyFeePct: 5000000000000000,
                subjectSellFeePct: 5000000000000000,
                swapFeeRatioProtocolPct: 500000000000000000
            }),
            feeBeneficiary: 0x7F472aaa6492a07BFfbE98664A11f76615150584,
            subjectFactory: 0xE87330564E49f86ECd8F9f764445e464a60453B0,
            moxieBondingCurveProxyAdminOwner: 0x7631884b5F0A8cB67CBc4B8B008fb00CDf2BeD76,
            defaultGraduationMarketCap: 25000000000000000000000000,
            positionManager: 0x7C5f5A4bBd8fD63184577525326123B519429bDc,
            router: 0x6fF5693b99212Da76ad316178A184AB56D299b43,
            deterministicDeploymentProxy: 0x4e59b44847b379578588920cA78FbF26c0B4956C
        });

        currentNetworkConfig = networkConfigs[block.chainid];
        if (block.chainid == 84532) {
            currentOwner = 0x9313eDE439fC91852D4Fd8f753C5569255286790;
            graduationHook = 0x0a1AB444Ecd911E9A3ACFdfa13a22037958C9000;
        } else if (block.chainid == 8453) {
            currentOwner = 0x96feEd3b3071ebe641C2eCa422C6f57fd9EE4BbC; // TODO: confirm this owner
            graduationHook = 0xC5a48B447f01E9ce3EDe71e4c1c2038C38bd9000;
        }
    }
}
