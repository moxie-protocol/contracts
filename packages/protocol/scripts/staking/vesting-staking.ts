import { ethers } from "hardhat";
import { MOXIE_TOKEN_LOCK_MANAGER, STAKING } from "./address";

const sigs = [
  "depositAndLock(address,uint256,uint256)",
  "depositAndLockFor(address,uint256,uint256,address)",
  "buyAndLock(address,uint256,uint256,uint256)",
  "buyAndLockFor(address,uint256,uint256,uint256,address)",
  "withdraw(address,uint256[])",
  "extendLock(address,uint256[],uint256)",
  "extendLockFor(address,uint256[],uint256,address)",
];
const main = async () => {
  console.log("This script is to enable vesting contracts to use staking");
  const [deployer, owner] = await ethers.getSigners();

  const moxieTokenLockManager = await ethers.getContractAt(
    "IMoxieTokenLockManager",
    MOXIE_TOKEN_LOCK_MANAGER,
  );
  await moxieTokenLockManager
    .connect(owner)
    .addSubjectTokenDestination(STAKING);
  await moxieTokenLockManager.connect(owner).addTokenDestination(STAKING);

  let addresses = Array(sigs.length).fill(STAKING);
  await moxieTokenLockManager
    .connect(owner)
    .setAuthFunctionCallMany(sigs, addresses);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
