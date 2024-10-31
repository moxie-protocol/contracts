<div align="center">
  <a align="center" href="https://moxie.xyz" target="_blank">
    <img src="./assets/logo.avif" alt="code snippets" height=50/>
  </a>
  <h1 align="center">Moxie Smart Contracts</h1>
</div>

This repository contains the official source code for the Moxie smart contracts.

## Table Of Contents

- [Table Of Contents](#table-of-contents)
- [Pre-requisites](#pre-requisites)
- [Local Setup](#local-setup)
- [Contract Deployment](#contract-deployment)
- [Audit](#audit)
- [License](#license)

## Pre-requisites

- [Yarn v4.2.2](https://yarnpkg.com/getting-started/install)

## Local Setup

- Install the dependencies for all the contract project under this repository by simply running the following command:

```sh
yarn
```

- Compile Contracts
  
```sh
yarn compile
```

- Run tests
```sh
yarn test
```
- Calculate test coverage
  
```sh
yarn coverage
  ```

## Contract Deployment

For contract deployment guide, you can follow the guide in each project's README below:
- [Protocol](./packages/protocol/README.md)
- [Token Distribution](./packages/token-distribution/DEPLOYMENT.md)

## Audit 

This solidity code was audited by code4rena. 

- **Protocol Contracts** Audit report can be found [here](./audit//C4-Moxie-2024-06._Protocolpdf.pdf).
- **Token Distribution** Audit report can be found [here](./audit//C4-Moxie-2024-07_Token_Distribution.pdf).

## License

[GNU General Public License v3.0](./LICENSE)
