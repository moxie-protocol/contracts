
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import ProtocolContract from "./ProtocolContracts";
import MoxiePass from "./MoxiePass";
import MoxieToken from "./MoxieToken";
import { id } from "ethers";

const protocolBuyFeePct = (1e16).toString(); // 1%
const protocolSellFeePct = (2 * 1e16).toString(); // 2%
const subjectBuyFeePct = (3 * 1e16).toString(); // 3%
const subjectSellFeePct = (4 * 1e16).toString(); // 4%

const feeInputBondingCurve = {
    protocolBuyFeePct,
    protocolSellFeePct,
    subjectBuyFeePct,
    subjectSellFeePct,
};

const feeInputSubjectFactory = {
    protocolFeePct: protocolBuyFeePct,
    subjectFeePct: subjectBuyFeePct
}

const AUCTION_DURATION = 60; // 2 sec block time so total 2 mins
const AUCTION_ORDER_CANCELLATION_DURATION = 60; // 2 sec block time so total 2 mins
export default buildModule("ProtocolContractsProxy", (m) => {

    const deployer = m.getAccount(0);
    const owner = m.getAccount(1);
    const minter = m.getAccount(2);
    const feeBeneficiary = m.getAccount(3);

    const { moxiePass } = m.useModule(MoxiePass);
    const { moxieToken } = m.useModule(MoxieToken);
    const { subjectFactory, formula, vault, subjectERC20, moxiePassVerifier, tokenManager, moxieBondingCurve, easyAuction } = m.useModule(ProtocolContract);


    const vaultCallData = m.encodeFunctionCall(vault, "initialize", [owner]);

    // deploy vault proxy
    const vaultProxy = m.contract("TransparentUpgradeableProxy", [
        vault,
        owner,
        vaultCallData,
    ], {
        id: "vaultProxy",
        from: deployer
    });

    const tokenManagerCallData = m.encodeFunctionCall(tokenManager, "initialize", [owner, subjectERC20]);

    // deploy token manager proxy
    const tokenManagerProxy = m.contract("TransparentUpgradeableProxy", [
        tokenManager,
        owner,
        tokenManagerCallData,
    ], {
        id: "tokenManagerProxy",
        from: deployer
    });


    // set moxie pass in moxie pass verifier 
    m.call(moxiePassVerifier, "setErc721ContractAddress", [moxiePass], { from: owner })

    // deploy subject factory
    const subjectFactoryProxy = m.contract("TransparentUpgradeableProxy", [
        subjectFactory,
        owner,
        '0x',
    ], {
        id: "subjectFactoryProxy",
        from: deployer
    });

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
        owner,
        moxieBondingCurveProxyData,
    ], {
        id: "moxieBondingCurveProxy",
        from: deployer
    });

    const factoryInstanceSubjectFactory = m.contractAt("SubjectFactory", subjectFactoryProxy);

    // initialize subject factory
    m.call(factoryInstanceSubjectFactory, "initialize", [
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


    m.call(easyAuction, "setSubjectFactory", [subjectFactoryProxy], {from: deployer, id: "easyAuction_setSubjectFactory"});

    return { vaultProxy, tokenManagerProxy, subjectFactoryProxy, moxieBondingCurveProxy, factoryInstanceSubjectFactory }

});