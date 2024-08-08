import { task } from "hardhat/config";
import { setup } from "./utils";


task("owner-roles", "test1", async (taskArgs, hre) => {

   const {
    subjectFactory,
    moxieBondingCurve,
    moxieToken,
    moxiePass

   } = await setup(hre, 1);


   const signers = await hre.ethers.getSigners();

   const owner = signers[1];

   await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
   await subjectFactory.connect(owner).grantRole(await subjectFactory.UPDATE_AUCTION_ROLE(), owner.address);

   await moxiePass.connect(owner).grantRole(await moxiePass.MINTER_ROLE(), owner.address);
   
});