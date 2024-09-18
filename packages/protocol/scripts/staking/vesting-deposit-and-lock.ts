// import { ethers } from "ethers";
import { ethers } from "hardhat";
const { Interface } = ethers;
const TOKEN_LOCK_WALLET = "0xb6ca234e277656bc8a9cff1d30cd4ccefa32d7a5";

const vestingDepositAndLock = async () => {
  const [deployer, owner] = await ethers.getSigners();
  const tokenLockWallet = await ethers.getContractAt(
    "IMoxieTokenLockWallet",
    TOKEN_LOCK_WALLET,
  );
  const subject = "0x2f51A3A2ed6589649B9D55d50c5D8a41f06b7Cf6";
  const amount = "3479005757600083068";
  const lockPeriod = 60 * 2;
  console.log(`Buying ${amount} moxie and locking for ${lockPeriod} seconds`);
  // SHOULD APPROVE THE TOKEN LOCK WALLET TO SPEND SUBJECT TOKEN, ONE TIME
  console.log(
    await tokenLockWallet.connect(owner).approveSubjectToken(subject),
  );
  const calldata = getDepositAndLockCalldata(
    subject,
    amount,
    lockPeriod.toString(),
  );

  // HERE we're trying to evoke the depositAndLock function from the tokenLockWallet contract(fallback method)
  console.log(
    await owner.sendTransaction({
      to: TOKEN_LOCK_WALLET,
      value: 0,
      data: calldata,
    }),
  );
};

vestingDepositAndLock()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

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

// 1. depositAndLock
export const getDepositAndLockCalldata = (
  _subject: string,
  _amount: string,
  _lockPeriod: string,
): string => {
  const abi = [
    "function depositAndLock(address _subject, uint256 _amount, uint256 _lockPeriodInSec)",
  ];
  const iface = new Interface(abi);
  return iface.encodeFunctionData("depositAndLock", [
    _subject,
    _amount,
    _lockPeriod,
  ]);
};
