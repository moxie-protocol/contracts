import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";
import "@nomicfoundation/hardhat-ignition-ethers";
import "@nomicfoundation/hardhat-verify";

import "../protocol/tasks/Bid"
import "../protocol/tasks/Buy"
import "../protocol/tasks/Claim"
import "../protocol/tasks/Sell"
import "../protocol/tasks/OnboardSubject"
import "./tasks/AssignOnboardingRole"
import "./tasks/CancelBid"
import "./tasks/Finalize"

const config: HardhatUserConfig = {
  solidity: "0.8.24",
 
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