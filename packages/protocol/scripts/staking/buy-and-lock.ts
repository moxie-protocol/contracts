import { ethers } from "hardhat"
import { MOXIE_TOKEN, STAKING } from "./address"

const buyAndLock = async () => {
 console.log('This script is to buy and lock')
 const accounts = await ethers.getSigners()
 const staking = await ethers.getContractAt('Staking', STAKING)
 const moxieToken = await ethers.getContractAt('IERC20Metadata', MOXIE_TOKEN)

 const user = accounts[10]

 const amount = ethers.parseEther("5")
 const subject = "0x2f51A3A2ed6589649B9D55d50c5D8a41f06b7Cf6"
 // 2	_minReturnAmountAfterFee	uint256	1900000000000000000

 const lockPeriod = 60 * 2 // 2 minutes ,this lock period is set using set-new-lock-period.ts
 console.log(`Buying ${amount} moxie and locking for ${lockPeriod} seconds`)

 // !!! IF YOU ARE BUYING AND LOCKING,APPROVE THE STAKING CONTRACT TO SPEND THE MOXIE TOKENS
 console.log(await moxieToken.connect(user).approve(STAKING, amount))
 console.log(await staking.connect(user).buyAndLock(subject, amount, 0, lockPeriod))
}

buyAndLock()
 .then(() => process.exit(0))
 .catch((error) => {
  console.error(error)
  process.exit(1)
 })

// RUN : npx hardhat run scripts/staking/buy-and-lock.ts --network base-sepolia