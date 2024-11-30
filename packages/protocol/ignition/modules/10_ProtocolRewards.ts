
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import MoxieToken from "./2_MoxieToken";
import config from "../config/config.json";

export default buildModule("ProtocolRewards", (m) => {
    
    const proxyAdminOwner = config.proxyAdminOwner;

    const deployer = m.getAccount(0);
    const owner = m.getAccount(1);

    const { moxieToken } = m.useModule(MoxieToken);
    const protocolRewards = m.contract("ProtocolRewards", [], { from: deployer });

    
    m.call(protocolRewards, "initialize", [moxieToken, owner], { from: deployer, id: "initializeProtocolRewardMasterCopy" });

    const protocolRewardsCallData = m.encodeFunctionCall(protocolRewards, "initialize", [moxieToken,  owner]);

    const protocolRewardProxy = m.contract("TransparentUpgradeableProxy", [
        protocolRewards,
        proxyAdminOwner,
        protocolRewardsCallData,
    ], {
        id: "protocolRewardsProxy",
        from: deployer
    });

    const protocolRewardInstance = m.contractAt('ProtocolRewards', protocolRewardProxy, { id: 'protocolRewardsInstance' });

    return { protocolRewards, protocolRewardInstance, protocolRewardProxy };
});