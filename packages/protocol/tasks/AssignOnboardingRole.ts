import { task } from "hardhat/config";

const SUBJECT_FACTORY_ADDRESS = '0x830ABa2522399E0EEE39bad3b6eE8778d4614B51'

task("onboardrole", "Assign Onboard role", async (taskArgs, hre) => {

    const subjectFactory = await hre.ethers.getContractAt('SubjectFactory', SUBJECT_FACTORY_ADDRESS);

    const [deployer, owner, minter]  = await hre.ethers.getSigners();

    await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address)

});