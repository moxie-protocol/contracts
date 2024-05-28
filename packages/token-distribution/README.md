

# Moxie Token Lock

This repository contains a number of contracts that will support the locking of tokens of participants under different schedules.
An important premise is that participants with locked tokens can perform a number of restricted actions in the protocol with their tokens.

## Contracts

### MoxieTokenLock

The contract lock manages a number of tokens deposited into the contract to ensure that they can only be released under certain time conditions.

This contract implements a release scheduled based on periods where tokens are released in steps after each period ends. It can be configured with one period in which case it works like a plain TimeLock.
It also supports revocation by the contract owner to be used for vesting schedules.

The contract supports receiving extra funds over the managed tokens that can be withdrawn by the beneficiary at any time.

A releaseStartTime parameter is included to override the default release schedule and perform the first release on the configured time. After that initial release it will continue with the default schedule.

### MoxieTokenLockWallet

This contract is built on top of the base **MoxieTokenLock** functionality. It allows the use of locked funds only when authorized function calls are issued to the contract. 
It works by "forwarding" authorized function calls to predefined target contracts in the Moxie protocol.

The idea is that supporters with locked tokens can participate in the protocol but disallow any release before the vesting/lock schedule.
The function calls allowed are queried to the **MoxieTokenLockManager**, this way the same configuration can be shared for all the created lock wallet contracts.

Locked tokens must only leave this contract under the locking rules and by the beneficiary calling release(). Tokens used in the protocol need to get back to this contract when sold /withdrawn.

Some users can profit by participating in the protocol through their locked tokens, if they withdraw them from the protocol back to the lock contract, they should be able to withdraw those surplus funds out of the contract.

The following functions signatures will be authorized for use:

```
### Target

- Bonding curve contract address
- Auction contract address


### Function Signatures


```

### MoxieTokenLockManager

Contract that works as a factory of **MoxieTokenLockWallet** contracts. It manages the function calls authorized to be called on any MoxieTokenWallet and also holds addresses of our protocol contracts configured as targets.

The Manager supports creating TokenLock contracts based on a mastercopy bytecode using a Minimal Proxy to save gas. It also do so with CREATE2 to have reproducible addresses, this way any future to be deployed contract address can be passed to beneficiaries before actual deployment.

For convenience, the Manager will also fund the created contract with the amount of each contract's managed tokens.


## Operations

For detailed instructions about deploying the manager or the transfer tools, check out [DEPLOYMENT.md](./DEPLOYMENT.md).

### Deploying new vesting locks

**1) Check configuration**

Ensure the .env file contains the MNEMONIC you are going to use for the deployment. Please refer below keys for reference.

```
MNEMONIC=
ETHERSCAN_API_KEY=
INFURA_KEY=
```

**2) Create the deployment file**

The file must be have CSV format in placed in the `/tasks` folder with the following header:
```
beneficiary,managedAmount,startTime,endTime,periods,revocable,releaseStartTime,vestingCliffTime
... line 1
... line 2
... N
```

- **beneficiary** Address of the beneficiary of locked tokens.
- **managedAmount** Amount of tokens to be managed by the lock contract.
- **startTime** Start time of the release schedule.
- **endTime** End time of the release schedule.
- **periods** Number of periods between start time and end time.
- **revocable** Whether the contract is revocable. Should be 1 for `Enabled` or 2 for 1 `Disable`. Setting this to 0 for `NotSet` will cause the transaction to fail with error `Must set a revocability option`.
- **releaseStartTime** Override time for when the releases start.
- **vestingCliffTime** Time the cliff vests, 0 if no cliff

You can define one line per contract. Keep the header in the file.

In addition to that, create an empty file in the `/tasks` folder to store the results of the deployed contracts.

**2) Deposit funds in the Manager**

You need to deposit enough funds in the Manager to be able to use for the deployments. When you run the `create-token-locks` command it will always check that the Manager has enough tokens to cover for the sum of vesting amount.

```
yarn hardhat manager-deposit --amount <amount> --network <network>
```

- **amount** is a string and it can have 18 decimals. For example 1000.12

- **network** depends on the `hardhat.config` but most of the times will be sepolia or mainnet.

**3) Deploy the contracts**

```
yarn hardhat create-token-locks --network <network> \
    --deploy-file <deploy-file> \
    --result-file <result-file> \
    --owner-address <owner-address> \
    --dry-run (Flag) \
    --tx-builder (Flag) \
    --tx-builder-template <tx-builder-template> (Optional)
```

- **network** depends on the hardhat.config but most of the times will be rinkeby or mainnet.

- **deploy-file** file name under `/ops` that contains the contracts to deploy.

- **result-file** file with the results of deployments.

- **owner-address** address to use as owner of the vesting contracts. The owner can revoke the contract if revocable.

- **dry-run** Get the deterministic contract addresses but do not deploy.

- **tx-builder** Output transaction batch in JSON format, compatible with Gnosis Safe transaction builder. Does not deploy contracts.

- **tx-builder-template** File to use as a template for the transaction builder.

## Copyright

Licensed under the [MIT license](LICENSE.md).