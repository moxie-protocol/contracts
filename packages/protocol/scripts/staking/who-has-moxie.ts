import { ethers } from "hardhat"
import { MOXIE_TOKEN } from "./address";

const whoHasMoxie = async () => {
 console.log("this script is to check who has moxie, which can be used to buy & lock later")
 const accounts = await ethers.getSigners()
 const moxieToken = await ethers.getContractAt(
  "IERC20Metadata",
  MOXIE_TOKEN,
 );
 console.log(`Checking ...`)

 for (let i = 0; i < accounts.length; i++) {
  const account = accounts[i]
  console.log(`Checking ${i} ${account.address}`)
  const balance = await moxieToken.balanceOf(account.address)
  console.log(`${i} ${account.address} has ${balance.toString()} moxie`)
 }

}


whoHasMoxie()
 .then(() => process.exit(0))
 .catch((error) => {
  console.error(error)
  process.exit(1)
 })