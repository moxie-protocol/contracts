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
        blockNumber: 13548244,
      },
      accounts: {
        mnemonic: process.env.MNEMONIC as string,
      },
    },
  },
};
