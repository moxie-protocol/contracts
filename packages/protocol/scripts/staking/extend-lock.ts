import { ethers } from "hardhat"
import { MOXIE_TOKEN, STAKING } from "./address"

const extendLock = async () => {
 console.log('Extends lock with index 0 for 2 minutes')
 const accounts = await ethers.getSigners()
 const staking = await ethers.getContractAt('Staking', STAKING)
 const user = accounts[10]
 const subject = "0x338fDD513Ed2eC7ee1249Ee286F967FC56492C78"
 const indexes = [0]
 // 2	_minReturnAmountAfterFee	uint256	1900000000000000000
 const lockPeriod = 60 * 2 // 2 minutes ,this lock period is set using set-new-lock-period.ts

 console.log(await staking.connect(user).extendLock(subject, indexes, lockPeriod))
}

extendLock()
 .then(() => process.exit(0))
 .catch((error) => {
  console.error(error)
  process.exit(1)
 })

// RUN : npx hardhat run scripts/staking/buy-and-lock.ts --network base-sepolia