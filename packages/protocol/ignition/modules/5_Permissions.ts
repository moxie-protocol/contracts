import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import ProtocolContractsProxy from "./4_ProtocolContractsProxy";
import MoxiePass from "./1_MoxiePass";
import ProtocolContracts from "./3_ProtocolContracts";

export default buildModule("Permissions", (m) => {

    const owner = m.getAccount(1);
    const minter = m.getAccount(2);

    const { moxiePass } = m.useModule(MoxiePass);
    const { easyAuction } = m.useModule(ProtocolContracts);
    const { vaultInstance, tokenManagerInstance, subjectFactoryInstance, moxieBondingCurveInstance } = m.useModule(ProtocolContractsProxy);

    m.call(moxiePass, "mint", [tokenManagerInstance, "url"], { from: minter, id: 'tokenManagerMoxiePass' });
    m.call(moxiePass, "mint", [moxieBondingCurveInstance, "url"], { from: minter, id: 'bondingCurveMoxiePass' });
    m.call(moxiePass, "mint", [subjectFactoryInstance, "url"], { from: minter, id: 'subjectFactoryMoxiePass' });
    m.call(moxiePass, "mint", [easyAuction, "url"], { from: minter, id: 'easyAuctionMoxiePass' });

    const transferRole = m.staticCall(vaultInstance, "TRANSFER_ROLE");
    const depositRole = m.staticCall(vaultInstance, "DEPOSIT_ROLE");

    m.call(vaultInstance, 'grantRole', [transferRole, moxieBondingCurveInstance], { from: owner, id: 'transferRoleBondingCurve' });
    m.call(vaultInstance, 'grantRole', [depositRole, moxieBondingCurveInstance], { from: owner, id: 'depositRoleMoxieBondingCurve' });
    m.call(vaultInstance, 'grantRole', [depositRole, subjectFactoryInstance], { from: owner, id: 'depositRoleSubjectFactory' });

    const createRole = m.staticCall(tokenManagerInstance, "CREATE_ROLE");
    const mintRole = m.staticCall(tokenManagerInstance, "MINT_ROLE");

    m.call(tokenManagerInstance, 'grantRole', [createRole, subjectFactoryInstance], { from: owner, id: 'createRoleSubjectFactory' });
    m.call(tokenManagerInstance, 'grantRole', [mintRole, subjectFactoryInstance,], { from: owner, id: 'mintRoleSubjectFactory' });
    m.call(tokenManagerInstance, 'grantRole', [mintRole, moxieBondingCurveInstance,], { from: owner, id: 'mintRoleMoxieBondingCurve' });

    return {}

});