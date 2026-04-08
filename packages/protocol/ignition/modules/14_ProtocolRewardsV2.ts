import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import config from "../config/config.json";

const REQUIRED_DEPLOY_ENV = ["REWARD_TOKEN_ADDRESS", "MNEMONIC"] as const;

function requireEnv(keys: readonly string[]): void {
    const missing = keys.filter((k) => !process.env[k]?.trim());
    if (missing.length > 0) {
        throw new Error(
            `ProtocolRewardsV2 deploy requires env: ${missing.join(", ")}. Set them before running ignition deploy.`
        );
    }
}

requireEnv(REQUIRED_DEPLOY_ENV);

export default buildModule("ProtocolRewardsV2", (m) => {
    const proxyAdminOwner = config.proxyAdminOwner;

    const deployer = m.getAccount(0);
    const owner = m.getAccount(1);

    const rewardTokenAddress = process.env.REWARD_TOKEN_ADDRESS!.trim();
    const protocolRewardsV2 = m.contract("ProtocolRewardsV2", [], { from: deployer });


    m.call(protocolRewardsV2, "initialize", [rewardTokenAddress, owner], { from: deployer, id: "initializeProtocolRewardMasterCopy" });

    const protocolRewardsCallData = m.encodeFunctionCall(protocolRewardsV2, "initialize", [rewardTokenAddress, owner]);

    const protocolRewardV2Proxy = m.contract("TransparentUpgradeableProxy", [
        protocolRewardsV2,
        proxyAdminOwner,
        protocolRewardsCallData,
    ], {
        id: "protocolRewardsV2Proxy",
        from: deployer
    });


    const protocolRewardV2AdminAddress = m.readEventArgument(
        protocolRewardV2Proxy,
        "AdminChanged",
        "newAdmin",
        { id: 'protocolRewardV2ProxyAdminAddress' }
    );

    const protocolRewardsV2ProxyAdmin = m.contractAt("ProxyAdmin", protocolRewardV2AdminAddress, { id: 'protocolRewardsV2ProxyAdmin' });

    const protocolRewardV2Instance = m.contractAt('ProtocolRewardsV2', protocolRewardV2Proxy, { id: 'protocolRewardsV2Instance' });

    return {  protocolRewardsV2, protocolRewardV2Instance,  protocolRewardV2Proxy,  protocolRewardsV2ProxyAdmin };
});


// 10. npx hardhat ignition deploy ignition/modules/14_ProtocolRewardsV2.ts --network base-sepolia --deployment-id testnet-v2