// import { ethers } from "ethers";
import { ethers } from "hardhat"
const { Interface } = ethers;
const TOKEN_LOCK_WALLET = "0xb6ca234e277656bc8a9cff1d30cd4ccefa32d7a5"

const vestingBuyAndLock = async () => {
 const [deployer, owner] = await ethers.getSigners()
 const tokenLockWallet = await ethers.getContractAt("IMoxieTokenLockWallet", TOKEN_LOCK_WALLET)
 const subject = "0x2f51A3A2ed6589649B9D55d50c5D8a41f06b7Cf6"
 // SHOULD APPROVE THE TOKEN LOCK WALLET TO SPEND THE MOXIE TOKENS
 // console.log(await tokenLockWallet.connect(owner).approveProtocol())
 const calldata = getWithdrawCalldata(subject, ["30"]);

 // HERE we're trying to evoke the withdraw function from the tokenLockWallet contract(fallback method)
 console.log(await owner.sendTransaction({
  to: TOKEN_LOCK_WALLET,
  value: 0,
  data: calldata,
 }))
}

vestingBuyAndLock()
 .then(() => process.exit(0))
 .catch((error) => {
  console.error(error)
  process.exit(1)
 })



// 3. withdraw
export const getWithdrawCalldata = (_subject: string, _indexes: string[]): string => {
 const abi = ["function withdraw(address _subject, uint256[] memory _indexes)"];
 const iface = new Interface(abi);
 return iface.encodeFunctionData("withdraw", [_subject, _indexes]);
}
