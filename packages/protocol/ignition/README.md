
### Steps to deploy

1. npx hardhat ignition deploy ignition/modules/1_MoxiePass.ts --network baseSepolia --deployment-id testnet
2. npx hardhat ignition deploy ignition/modules/2_MoxieToken.ts --network baseSepolia --deployment-id testnet
3. npx hardhat ignition deploy ignition/modules/3_ProtocolContracts.ts  --network baseSepolia --deployment-id testnet
4. npx hardhat ignition verify testnet --network baseSepolia
5. npx hardhat ignition deploy ignition/modules/4_EasyAuction.ts --network baseSepolia --deployment-id testnet
6. npx hardhat ignition deploy ignition/modules/5_ProtocolContractsProxy.ts --network baseSepolia --deployment-id testnet
7. npx hardhat ignition deploy ignition/modules/6_Permissions.ts --network baseSepolia --deployment-id testnet
8. npx hardhat ignition deploy ignition/modules/7_TokenLockManager.ts --network baseSepolia --deployment-id testnet
9. npx hardhat ignition deploy ignition/modules/8_TransferOwnership.ts --network baseSepolia --deployment-id testnet
10. npx hardhat ignition deploy ignition/modules/9_Staking.ts --network baseSepolia --deployment-id testnet
11. npx hardhat ignition verify testnet --network baseSepolia