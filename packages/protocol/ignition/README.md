
### Steps to deploy

1. npx hardhat ignition deploy ignition/modules/1_MoxiePass.ts --network baseSepolia --deployment-id testnet-v2
2. npx hardhat ignition deploy ignition/modules/2_MoxieToken.ts --network baseSepolia --deployment-id testnet-v2
3. npx hardhat ignition deploy ignition/modules/3_ProtocolContracts.ts  --network baseSepolia --deployment-id testnet-v2
4. npx hardhat ignition verify testnet-v2 --network baseSepolia
5. npx hardhat ignition deploy ignition/modules/4_EasyAuction.ts --network baseSepolia --deployment-id testnet-v2
6. npx hardhat ignition deploy ignition/modules/5_ProtocolContractsProxy.ts --network baseSepolia --deployment-id testnet-v2
7. npx hardhat ignition deploy ignition/modules/6_Permissions.ts --network baseSepolia --deployment-id testnet-v2