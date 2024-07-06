import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";
import "@nomicfoundation/hardhat-ignition-ethers";
import "@nomicfoundation/hardhat-verify";

// import "../protocol/tasks/Bid"
// import "../protocol/tasks/Buy"
// import "../protocol/tasks/Claim"
// import "../protocol/tasks/Sell"

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    baseSepolia: {
      url: "https://base-sepolia.g.alchemy.com/v2/i6YmQlhGMZZa_tgeXHKJ0hpwp83WnRn9",
      accounts: {
        mnemonic: process.env.MNEMONIC || "",
      },
      gasPrice: 1000000000,

    },
    base: {
      url: "https://base-mainnet.g.alchemy.com/v2/AK6P82Lkusq61QjRmbLbq-GBIw4Y6NzW",
    }
  }
  , etherscan: {
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
