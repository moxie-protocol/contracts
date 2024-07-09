import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import ProtocolContractsProxy from "./5_ProtocolContractsProxy";

export default buildModule("UpgradeMoxieBondingCurve_1", (m) => {

    const deployer = m.getAccount(0);
    const proxyAdminOwner = m.getAccount(8);

    const moxieBondingCurveV2 = m.contract("MoxieBondingCurveV2", [], { from: deployer })

    const { moxieBondingCurveProxyAdmin, moxieBondingCurveInstance } = m.useModule(ProtocolContractsProxy);

    m.call(moxieBondingCurveProxyAdmin, "upgradeAndCall", [moxieBondingCurveInstance, moxieBondingCurveV2, '0x'], {
        from: proxyAdminOwner,
    });

    return { moxieBondingCurveV2 }

});