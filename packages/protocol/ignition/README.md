
### Steps to deploy

1. npx hardhat ignition deploy ignition/modules/1_MoxiePass.ts --network base-sepolia --deployment-id testnet
2. npx hardhat ignition deploy ignition/modules/2_MoxieToken.ts --network base-sepolia --deployment-id testnet
3. npx hardhat ignition deploy ignition/modules/3_ProtocolContracts.ts  --network base-sepolia --deployment-id testnet
4. npx hardhat ignition verify testnet --network base-sepolia
5. npx hardhat ignition deploy ignition/modules/4_EasyAuction.ts --network base-sepolia --deployment-id testnet
6. npx hardhat ignition deploy ignition/modules/5_ProtocolContractsProxy.ts --network base-sepolia --deployment-id testnet
7. npx hardhat ignition deploy ignition/modules/6_Permissions.ts --network base-sepolia --deployment-id testnet
8. npx hardhat ignition deploy ignition/modules/7_TokenLockManager.ts --network base-sepolia --deployment-id testnet
9. npx hardhat ignition deploy ignition/modules/8_TransferOwnership.ts --network base-sepolia --deployment-id testnet
10. npx hardhat ignition deploy ignition/modules/9_Staking.ts --network base-sepolia --deployment-id testnet
11. npx hardhat ignition verify testnet --network base-sepolia




Wiping - to remove old deployments from journal
npx hardhat ignition wipe testnet Staking#stakingInAllowList
npx hardhat ignition wipe testnet Staking#stakingInstance
npx hardhat ignition wipe testnet Staking#stakingProxy
npx hardhat ignition wipe testnet Staking#initializeStakingMasterCopy
npx hardhat ignition wipe testnet Staking#encodeFunctionCall(Staking#Staking.initialize)   
npx hardhat ignition wipe testnet Staking#Staking   