import { ethers } from "hardhat"
import { STAKING } from "./address"

const withdraw = async () => {

 const subject = "0x338fDD513Ed2eC7ee1249Ee286F967FC56492C78"

 console.log("This script is to withdraw")
 const accounts = await ethers.getSigners()
 const user = accounts[10] // 0xb4eb48a9753edf57b66f488564f83295f0a3e158
 const staking = await ethers.getContractAt('Staking', STAKING)
 console.log(await staking.connect(user).withdraw(subject, [1]))
}


withdraw()
 .then(() => process.exit(0))
 .catch((error) => {
  console.error(error)
  process.exit(1)
 })