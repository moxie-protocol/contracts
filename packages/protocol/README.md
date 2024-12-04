# Protocol Contract Deployment

First, create a `.env` file and add the following environment variables:

```sh
# .env file
MNEMONIC=
ETHERSCAN_API_KEY=
```

In order to ensure that your deployment works fine, make sure that you provide some ETH to your deployment wallet. If you're deploying on a testnet, then you can also get some test ETH from existing faucets.

Before deployment, compile all the contract with the following command:

```sh
yarn compile
```

Then, to deploy all the contract using the deployment scripts, run the command below and specify the chain to deploy with the deployment ID you would like to assign:

```sh
npx hardhat ignition deploy ignition/modules/1_MoxiePass.ts --network <CHAIN> --deployment-id <DEPLOYMENT_ID> && \
npx hardhat ignition deploy ignition/modules/2_MoxieToken.ts --network <CHAIN> --deployment-id <DEPLOYMENT_ID> && \
npx hardhat ignition deploy ignition/modules/3_ProtocolContracts.ts  --network <CHAIN> --deployment-id <DEPLOYMENT_ID> && \
npx hardhat ignition verify testnet-v3 --network <CHAIN>
npx hardhat ignition deploy ignition/modules/4_EasyAuction.ts --network <CHAIN> --deployment-id <DEPLOYMENT_ID> && \
npx hardhat ignition deploy ignition/modules/5_ProtocolContractsProxy.ts --network <CHAIN> --deployment-id <DEPLOYMENT_ID> && \
npx hardhat ignition deploy ignition/modules/6_Permissions.ts --network <CHAIN> --deployment-id <DEPLOYMENT_ID> && \
npx hardhat ignition deploy ignition/modules/7_TokenLockManager.ts --network <CHAIN> --deployment-id <DEPLOYMENT_ID>
```

Once all the contract is successfully deployed, you can verify the contracts using the Etherscan API key you provided in the environment variables by the command below:

```sh
npx hardhat ignition verify <DEPLOYMENT_ID>
```