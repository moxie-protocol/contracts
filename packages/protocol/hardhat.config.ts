import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";
import "@nomicfoundation/hardhat-ignition-ethers";
import "@nomicfoundation/hardhat-verify";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";
import "hardhat-contract-sizer";

dotenv.config();

const config: HardhatUserConfig = {
  // To fix replacement transaction underpriced

  // ignition: {
  //   blockPollingInterval: 1_000,
  //   timeBeforeBumpingFees: 3 * 60 * 1_000,
  //   maxFeeBumps: 4,
  //   requiredConfirmations: 5,
  // },
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
    },
  },
  networks: {
    hardhat: {
      // uniswap deployer contract used during testing is too large
      allowUnlimitedContractSize: true,
      // increase gas limit to be able to mine hook address
      blockGasLimit: 1000000000000
    },
    "base-sepolia": {
      url: `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY as string}`,
      accounts: {
        mnemonic: process.env.MNEMONIC as string,
      },
      // To fix replacement transaction underpriced
      // ignition: {
      //   maxPriorityFeePerGas: BigInt(2200000),
      // },
    },
    base: {
      url: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY as string}`,
      accounts: {
        mnemonic: process.env.MNEMONIC as string,
      },
    },
    hyperevm: {
      url: process.env.HYPEREVM_RPC_URL ?? "https://rpc.hyperliquid.xyz/evm",
      chainId: 999,
      accounts: {
        mnemonic: process.env.MNEMONIC as string,
      },
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY as string,
    customChains: [
      {
        network: "base-sepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
    ],
  },
};

export default config;
