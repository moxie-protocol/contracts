
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import ProtocolContract from "./3_ProtocolContracts";
import MoxiePass from "./1_MoxiePass";
import MoxieToken from "./2_MoxieToken";
import config from "../config/config.json";
import EasyAuction from "./4_EasyAuction";

const protocolBuyFeePct = config.protocolBuyFeePctForBC; // 1%
const protocolSellFeePct = config.protocolSellFeePctForBC; // 2%
const subjectBuyFeePct = config.subjectBuyFeePctForBC; // 3%
const subjectSellFeePct = config.subjectSellFeePctForBC; // 4%

const feeInputBondingCurve = {
    protocolBuyFeePct,
    protocolSellFeePct,
    subjectBuyFeePct,
    subjectSellFeePct,
};

const feeInputSubjectFactory = {
    protocolFeePct: config.protocolFeePctForSF,
    subjectFeePct: config.subjectFeePctForSF
};

const AUCTION_DURATION = config.auctionDuration; // 2 sec block time so total 2 mins
const AUCTION_ORDER_CANCELLATION_DURATION = config.auctionOrderCancellationDuration; // 2 sec block time so total 2 mins

export default buildModule("ProtocolContractsProxy", (m) => {

    const proxyAdminOwner = config.proxyAdminOwner;

    const deployer = m.getAccount(0);
    const owner = m.getAccount(1);
    const feeBeneficiary = m.getAccount(3);

    const { moxiePass } = m.useModule(MoxiePass);
    const { moxieToken } = m.useModule(MoxieToken);
    const { easyAuction } = m.useModule(EasyAuction);
    const { subjectFactory, formula, vault, subjectERC20, moxiePassVerifier, tokenManager, moxieBondingCurve, } = m.useModule(ProtocolContract);


    const vaultCallData = m.encodeFunctionCall(vault, "initialize", [owner]);

    // deploy vault proxy
    const vaultProxy = m.contract("TransparentUpgradeableProxy", [
        vault,
        proxyAdminOwner,
        vaultCallData,
    ], {
        id: "vaultProxy",
        from: deployer
    });


    const vaultProxyAdminAddress = m.readEventArgument(
        vaultProxy,
        "AdminChanged",
        "newAdmin",
        { id: 'vaultProxyAdminAddress' }
    );

    const vaultProxyAdmin = m.contractAt("ProxyAdmin", vaultProxyAdminAddress, { id: 'vaultProxyAdmin' });

    const tokenManagerCallData = m.encodeFunctionCall(tokenManager, "initialize", [owner, subjectERC20]);

    // deploy token manager proxy
    const tokenManagerProxy = m.contract("TransparentUpgradeableProxy", [
        tokenManager,
        proxyAdminOwner,
        tokenManagerCallData,
    ], {
        id: "tokenManagerProxy",
        from: deployer
    });

    const tokenManagerProxyAdminAddress = m.readEventArgument(
        tokenManagerProxy,
        "AdminChanged",
        "newAdmin",
        { id: 'tokenManagerProxyAdminAddress' }
    );

    const tokenManagerProxyAdmin = m.contractAt("ProxyAdmin", tokenManagerProxyAdminAddress, { id: 'tokenManagerProxyAdmin' });


    // set moxie pass in moxie pass verifier 
    m.call(moxiePassVerifier, "setErc721ContractAddress", [moxiePass], { from: owner })

    // deploy subject factory
    const subjectFactoryProxy = m.contract("TransparentUpgradeableProxy", [
        subjectFactory,
        proxyAdminOwner,
        '0x',
    ], {
        id: "subjectFactoryProxy",
        from: deployer
    });


    const subjectFactoryProxyAdminAddress = m.readEventArgument(
        subjectFactoryProxy,
        "AdminChanged",
        "newAdmin",
        { id: 'subjectFactoryProxyAdminAddress' }
    );

    const subjectFactoryProxyAdmin = m.contractAt("ProxyAdmin", subjectFactoryProxyAdminAddress, { id: 'subjectFactoryProxyAdmin' });

    //
    const moxieBondingCurveProxyData = m.encodeFunctionCall(moxieBondingCurve, "initialize", [
        moxieToken,
        formula,
        owner,
        tokenManagerProxy,
        vaultProxy,
        feeInputBondingCurve,
        feeBeneficiary,
        subjectFactoryProxy
    ]);

    // deploy moxie bonding curve
    const moxieBondingCurveProxy = m.contract("TransparentUpgradeableProxy", [
        moxieBondingCurve,
        proxyAdminOwner,
        moxieBondingCurveProxyData,
    ], {
        id: "moxieBondingCurveProxy",
        from: deployer
    });

    const moxieBondingCurveProxyAdminAddress = m.readEventArgument(
        moxieBondingCurveProxy,
        "AdminChanged",
        "newAdmin",
        { id: 'moxieBondingCurveProxyAdminAddress', }
    );

    const moxieBondingCurveProxyAdmin = m.contractAt("ProxyAdmin", moxieBondingCurveProxyAdminAddress, { id: 'moxieBondingCurveProxyAdmin' });

    const subjectFactoryInstance = m.contractAt("SubjectFactory", subjectFactoryProxy, { id: 'subjectFactoryInstance' });

    // initialize subject factory
    m.call(subjectFactoryInstance, "initialize", [
        owner,
        tokenManagerProxy,
        moxieBondingCurveProxy,
        moxieToken,
        easyAuction,
        feeInputSubjectFactory,
        feeBeneficiary,
        AUCTION_DURATION,
        AUCTION_ORDER_CANCELLATION_DURATION
    ], { from: deployer, })

    m.call(easyAuction, "setSubjectFactory", [subjectFactoryProxy], { from: owner, id: "easyAuction_setSubjectFactory" });

    const moxieBondingCurveInstance = m.contractAt('MoxieBondingCurve', moxieBondingCurveProxy, { id: 'moxieBondingCurveInstance' });
    const vaultInstance = m.contractAt('Vault', vaultProxy, { id: 'vaultInstance' });
    const tokenManagerInstance = m.contractAt('TokenManager', tokenManagerProxy, { id: 'tokenManagerInstance' });

    return {
        vaultInstance,
        vaultProxyAdmin,
        tokenManagerInstance,
        tokenManagerProxyAdmin,
        subjectFactoryInstance,
        subjectFactoryProxyAdmin,
        moxieBondingCurveInstance,
        moxieBondingCurveProxyAdmin,
    }
});