import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  // defaultNetwork: "base-sepolia",
  mocha: {
    timeout: 100000000,
  },
};


export default config;
