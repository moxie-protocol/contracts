import { task } from "hardhat/config";
import { BigNumber} from "@ethersproject/bignumber";

const SUBJECT_FACTORY_ADDRESS = '0x830ABa2522399E0EEE39bad3b6eE8778d4614B51'
const MOXIE_TOKEN_ADDRESS = '0x0788F73D9d912DcF358d2D815680b61864623419'

task("finalize", "Finalize Onboarding", async (taskArgs, hre) => {

    const buyAmount = BigNumber.from('1').mul(BigNumber.from(10).pow(18)).toString();

    const subjectFactory = await hre.ethers.getContractAt('SubjectFactory', SUBJECT_FACTORY_ADDRESS);

    const moxieToken = await hre.ethers.getContractAt("MoxieToken", MOXIE_TOKEN_ADDRESS);

    const [deployer, owner, minter, subject, subject1, subject2]  = await hre.ethers.getSigners();

    await moxieToken.connect(owner).approve(SUBJECT_FACTORY_ADDRESS, buyAmount);

    await subjectFactory.connect(owner).finalizeSubjectOnboarding(
        subject2.address,
        buyAmount,
        660000,
    )

});