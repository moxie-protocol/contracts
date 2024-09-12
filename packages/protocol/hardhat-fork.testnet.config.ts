import hardhatConfig from "./hardhat.config";
import * as dotenv from "dotenv";

dotenv.config();
export default {
  ...hardhatConfig,
  networks: {
    ...hardhatConfig.networks,
    hardhat: {
      allowUnlimitedContractSize: false,
      forking: {
        url: process.env.TESTNET_RPC_URL || "",
        blockNumber: 15189429,
      },
      accounts: {
        mnemonic: process.env.MNEMONIC as string,
      },
    },
  },
};
