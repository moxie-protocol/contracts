# token-distribution

### 1. Deploy a Mock Token

Below command to deploy mock Moxie token in testnet [base sepolia]

```
yarn hardhat deploy --tags mockMoxieToken --network  base-sepolia
```

### 2. Deploy a Token Manager contract

Deploy a Token Manager contract:

During this process the master copy of the MoxieTokenLockWallet will be deployed and used in the Manager.

```
yarn hardhat deploy --tags manager --network base-sepolia
```

### 3. Fund the manager with the amount we need to deploy contracts

The task will convert the amount passed in MOXIE to wei before calling the contracts.

```
yarn hardhat manager-deposit --amount <amount-in-moxie> --network base-sepolia
```

### 4. Deploy a number of Token Lock contracts using the Manager

The process to set up the CSV file is described in the [README](./README.md).

```
yarn hardhat create-token-locks --deploy-file <deploy-file.csv> --result-file <result-file.csv> --owner-address <owner-address> --network base-sepolia
```

### 5. Setup the Token Manager to allow default protocol functions

```
yarn hardhat manager-setup-auth --target-address <staking-address> --network base-sepolia
```
