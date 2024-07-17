import { task } from "hardhat/config";
import { BigNumber} from "@ethersproject/bignumber";

const SUBJECT_FACTORY_ADDRESS = '0x0b34EB0DE7977b1d3e7facD449b92a0Fe5772A40'
const MOXIE_TOKEN_ADDRESS = '0xf86136AfB0fb72cdbd27d7Aea9e283725d6815a1'

task("finalize", "Finalize Onboarding", async (taskArgs, hre) => {

    const buyAmount = BigNumber.from('1').mul(BigNumber.from(10).pow(18)).toString();

    const subjectFactory = await hre.ethers.getContractAt('SubjectFactory', SUBJECT_FACTORY_ADDRESS);

    const moxieToken = await hre.ethers.getContractAt("MoxieToken", MOXIE_TOKEN_ADDRESS);

    const [deployer, owner, minter, subject, subject1, subject2]  = await hre.ethers.getSigners();

    await moxieToken.connect(owner).approve(SUBJECT_FACTORY_ADDRESS, buyAmount);

    await subjectFactory.connect(owner).finalizeSubjectOnboarding(
        "0xdbDa8904eEdA849C70DBbDED4D3B22651aD57973",
        buyAmount,
        660000,
    )

});