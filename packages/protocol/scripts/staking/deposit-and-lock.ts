import { ethers } from "hardhat"
import { STAKING } from "./address"

const depositAndLock = async () => {
 const subject = "0x338fDD513Ed2eC7ee1249Ee286F967FC56492C78"
 const subjectToken = "0xb4d00a5bfea5ec43c062f7eb046b923240cefa76"
 const accounts = await ethers.getSigners()
 const user = accounts[10] // 0xb4eb48a9753edf57b66f488564f83295f0a3e158

 const depositAmount = ethers.parseEther("5") // 5*10^18 fan tokens
 console.log("This script is to deposit and lock")
 const staking = await ethers.getContractAt('Staking', STAKING)
 const lockPeriod = 60 * 2 // 2 minutes
 console.log(`Depositing ${depositAmount} fan tokens and locking for 2 minutes`)

 // !!! IF YOU ARE BUYING AND LOCKING,APPROVE THE STAKING CONTRACT TO SPEND THE FAN TOKENS
 const fanToken = await ethers.getContractAt('IERC20Metadata', subjectToken)
 console.log(await fanToken.connect(user).approve(STAKING, depositAmount))
 console.log(await staking.connect(user).depositAndLock(subject, depositAmount, lockPeriod))
}

depositAndLock()
 .then(() => process.exit(0))
 .catch((error) => {
  console.error(error)
  process.exit(1)
 })

// RUN : npx hardhat run scripts/staking/deposit-and-lock.ts --network base-sepolia
// https://sepolia.basescan.org/tx/0x7939f6439a3e57b62e3cfaaa2d3bf21355d75462116227739c8cf938017e3253

// DATA FETCHED USING
// protocol-analytics-testnet subgraph
// query MyQuery {
//  users(where: { id: "0xb4eb48a9753edf57b66f488564f83295f0a3e158" }) {
//   id
//     portfolio {
//    balance
//       subjectToken {
//     id
//     name
//         subject {
//      id
//     }
//    }
//       orders {
//     id
//    }
//   }
//  }
// }