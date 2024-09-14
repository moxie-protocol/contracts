import hre, { ethers, network } from "hardhat";
import { STAKING } from "./address";

const setNewLockPeriod = async () => {

 console.log('This script is to set new lock period')

 const [deployer, owner] = await ethers.getSigners()

 const staking = await ethers.getContractAt('Staking', STAKING)

 const newLockPeriod = 60 * 2 // 2 minutes

 console.log(`Setting new lock period to ${newLockPeriod}`)

 console.log(await staking.connect(owner).setLockPeriod(newLockPeriod, true))
}

setNewLockPeriod()
 .then(() => process.exit(0))
 .catch((error) => {
  console.error(error)
  process.exit(1)
 })

// RUN : npx hardhat run scripts/staking/set-new-lock-period.ts --network base-sepolia