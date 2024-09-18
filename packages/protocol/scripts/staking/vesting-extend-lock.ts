// import { ethers } from "ethers";
import { ethers } from "hardhat"
const { Interface } = ethers;
const TOKEN_LOCK_WALLET = "0xb6ca234e277656bc8a9cff1d30cd4ccefa32d7a5"

const extendLock = async () => {
 const [deployer, owner] = await ethers.getSigners()
 const subject = "0x2f51A3A2ed6589649B9D55d50c5D8a41f06b7Cf6"
 const lockPeriod = 60 * 2
 console.log(`extending lock`)
 const calldata = getExtendLockCalldata(subject, ["29"], lockPeriod.toString());

 // HERE we're trying to evoke the depositAndLock function from the tokenLockWallet contract(fallback method)
 console.log(await owner.sendTransaction({
  to: TOKEN_LOCK_WALLET,
  value: 0,
  data: calldata,
 }))
}

extendLock()
 .then(() => process.exit(0))
 .catch((error) => {
  console.error(error)
  process.exit(1)
 })


// {
//  "data": {
//   "tokenLockWallets": [
//    {
//     "id": "0xb6ca234e277656bc8a9cff1d30cd4ccefa32d7a5",
//     "beneficiary": "0x9313ede439fc91852d4fd8f753c5569255286790",
//     "managedAmount": "35000000000000000000000"
//    }
//   ]
//  }
// }


// 4. extendLock
export const getExtendLockCalldata = (_subject: string, _indexes: string[], _lockPeriod: string): string => {
 const abi = ["function extendLock(address _subject, uint256[] memory _indexes, uint256 _lockPeriodInSec)"];
 const iface = new Interface(abi);
 return iface.encodeFunctionData("extendLock", [_subject, _indexes, _lockPeriod]);
}