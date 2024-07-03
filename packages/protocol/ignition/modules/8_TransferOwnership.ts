import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import ProtocolContractsProxy from "./5_ProtocolContractsProxy";
import MoxiePass from "./1_MoxiePass";
import EasyAuction from "./4_EasyAuction";
import config from "../config/config.json"

export default buildModule("Permissions", (m) => {

    const owner = m.getAccount(1);

    const { moxiePass } = m.useModule(MoxiePass);
    const { easyAuction } = m.useModule(EasyAuction);
    const { vaultInstance, tokenManagerInstance, subjectFactoryInstance, moxieBondingCurveInstance } = m.useModule(ProtocolContractsProxy);

    const adminRole = m.staticCall(vaultInstance, "DEFAULT_ADMIN_ROLE");

    //revoke admin role from current owner
    m.call(vaultInstance, 'revokeRole', [adminRole, owner], { from: owner, id: "revokeVaultOwner" });
    m.call(tokenManagerInstance, 'revokeRole', [adminRole, owner], { from: owner, id: "revokeTokenManagerOwner" });
    m.call(subjectFactoryInstance, 'revokeRole', [adminRole, owner], { from: owner, id: "revokeSubjectFactoryOwner" });
    m.call(moxieBondingCurveInstance, 'revokeRole', [adminRole, owner], { from: owner, id: "revokeMoxieBondingCurvetOwner" });
    m.call(moxiePass, 'revokeRole', [adminRole, owner], { from: owner, id: "revokeMoxiePassOwner" });
    m.call(easyAuction, "transferOwnership", [config.adminRoleBeneficiary], { from: owner, id:"easyAuctionTransferOwnership" })

    return {}
});