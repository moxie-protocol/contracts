
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import MoxieToken from "./2_MoxieToken";
import ProtocolContractsProxy from "./5_ProtocolContractsProxy";

import StakingContracts from "./9_Staking";
import config from "../config/config.json";
import BondingCurve from "./11_UpgradeBondingCurve";
import MoxiePass from "./1_MoxiePass";

export default buildModule("UpgradeStaking", (m) => {
    const proxyAdminOwner = config.proxyAdminOwner;
    const proxyAdminOwnerAccount = m.getAccount(8);


    const deployer = m.getAccount(0);
    const owner = m.getAccount(1);
    const minter = m.getAccount(2);

    const { moxieToken } = m.useModule(MoxieToken);
    const { moxiePass } = m.useModule(MoxiePass);

    const { tokenManagerInstance } = m.useModule(ProtocolContractsProxy);
    const { moxieBondingCurveV2 } = m.useModule(BondingCurve);

    const stakingV2 = m.contract("Staking", [], { from: deployer, id: "stakingV2" });
    m.call(stakingV2, "initialize", [tokenManagerInstance, moxieBondingCurveV2, moxieToken, owner], { from: deployer, id: "initializeStakingV2MasterCopy" });


    const { stakingProxyAdmin, stakingInstance } = m.useModule(StakingContracts);

    m.call(stakingProxyAdmin, "upgradeAndCall", [stakingInstance, stakingV2, '0x'], {
        from: proxyAdminOwnerAccount,
        id: "stakingV2Upgrade"
    });

    return { stakingV2 , stakingProxyAdmin, stakingInstance };
});