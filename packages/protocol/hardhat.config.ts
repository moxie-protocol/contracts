import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";
import "@nomicfoundation/hardhat-ignition-ethers";
import "@nomicfoundation/hardhat-verify";
import { config } from "dotenv";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    baseSepolia: {
      url: "https://base-sepolia.g.alchemy.com/v2/<ALCHEMY_API_KEY>",
      accounts: {
        mnemonic: process.env.MNEMONIC as string,
      },
    },
    base: {
      url: "https://base-mainnet.g.alchemy.com/v2/<ALCHEMY_API_KEY>",
      accounts: {
        mnemonic: process.env.MNEMONIC as string,
      },
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY as string,
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532.,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        },
      }
    ]
  }
};


export default config;