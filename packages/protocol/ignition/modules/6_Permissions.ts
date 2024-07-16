import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import ProtocolContractsProxy from "./5_ProtocolContractsProxy";
import MoxiePass from "./1_MoxiePass";
import EasyAuction from "./4_EasyAuction";
import config from "../config/config.json"

export default buildModule("Permissions", (m) => {

    const owner = m.getAccount(1);
    const minter = m.getAccount(2);

    const { moxiePass } = m.useModule(MoxiePass);
    const { easyAuction } = m.useModule(EasyAuction);
    const { vaultInstance, tokenManagerInstance, subjectFactoryInstance, moxieBondingCurveInstance } = m.useModule(ProtocolContractsProxy);

    m.call(moxiePass, "mint", [tokenManagerInstance, config.moxiePassURL], { from: minter, id: 'tokenManagerMoxiePass' });
    m.call(moxiePass, "mint", [moxieBondingCurveInstance, config.moxiePassURL], { from: minter, id: 'bondingCurveMoxiePass' });
    m.call(moxiePass, "mint", [subjectFactoryInstance, config.moxiePassURL], { from: minter, id: 'subjectFactoryMoxiePass' });
    m.call(moxiePass, "mint", [easyAuction, config.moxiePassURL], { from: minter, id: 'easyAuctionMoxiePass' });

    const transferRole = m.staticCall(vaultInstance, "TRANSFER_ROLE");
    const depositRole = m.staticCall(vaultInstance, "DEPOSIT_ROLE");
    const adminRole = m.staticCall(vaultInstance, "DEFAULT_ADMIN_ROLE");

    m.call(vaultInstance, 'grantRole', [transferRole, moxieBondingCurveInstance], { from: owner, id: 'transferRoleBondingCurve' });
    m.call(vaultInstance, 'grantRole', [depositRole, moxieBondingCurveInstance], { from: owner, id: 'depositRoleMoxieBondingCurve' });
    m.call(vaultInstance, 'grantRole', [depositRole, subjectFactoryInstance], { from: owner, id: 'depositRoleSubjectFactory' });

    const createRole = m.staticCall(tokenManagerInstance, "CREATE_ROLE");
    const mintRole = m.staticCall(tokenManagerInstance, "MINT_ROLE");
    const allowListRole = m.staticCall(tokenManagerInstance, "ALLOW_LIST_ROLE");

    m.call(tokenManagerInstance, 'grantRole', [createRole, subjectFactoryInstance], { from: owner, id: 'createRoleSubjectFactory' });
    m.call(tokenManagerInstance, 'grantRole', [mintRole, subjectFactoryInstance,], { from: owner, id: 'mintRoleSubjectFactory' });
    m.call(tokenManagerInstance, 'grantRole', [mintRole, moxieBondingCurveInstance,], { from: owner, id: 'mintRoleMoxieBondingCurve' });
    const allowListRoleOwner = m.call(tokenManagerInstance, 'grantRole', [allowListRole, owner,], { from: owner, id: 'allowListRoleOwner' });

    m.call(tokenManagerInstance, "addToTransferAllowList", [tokenManagerInstance], { from: owner, id: "tokenManagerInAllowList", after: [allowListRoleOwner] })
    m.call(tokenManagerInstance, "addToTransferAllowList", [easyAuction], { from: owner, id: "easyAuctionInAllowList", after: [allowListRoleOwner] })
    m.call(tokenManagerInstance, "addToTransferAllowList", [moxieBondingCurveInstance], { from: owner, id: "moxieBondingCurveInAllowList", after: [allowListRoleOwner] })
    m.call(tokenManagerInstance, "addToTransferAllowList", [subjectFactoryInstance], { from: owner, id: "subjectFactoryInAllowList", after: [allowListRoleOwner] })


    //provide admin role to multi-sig
    m.call(vaultInstance, 'grantRole', [adminRole, config.adminRoleBeneficiary], { from: owner, id: "vaultAdminBeneficiary" });
    m.call(tokenManagerInstance, 'grantRole', [adminRole, config.adminRoleBeneficiary], { from: owner, id: "tokenManagerAdminBeneficiary" });
    m.call(subjectFactoryInstance, 'grantRole', [adminRole, config.adminRoleBeneficiary], { from: owner, id: "subjectFactoryAdminBeneficiary" });
    m.call(moxieBondingCurveInstance, 'grantRole', [adminRole, config.adminRoleBeneficiary], { from: owner, id: "moxieBondingCurveAdminBeneficiary" });
    m.call(moxiePass, 'grantRole', [adminRole, config.adminRoleBeneficiary], { from: owner, id: "moxiePassAdminBeneficiary" });

    return {}

});