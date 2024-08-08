import { task } from "hardhat/config";

const MOXIE_BONDING_CURVE = ''
const SUBJECT_ADDRESS = '';

task("sell", "Sell tokens", async (taskArgs, hre) => {

    const vestingContract = await hre.ethers.getContractAt("MoxieBondingCurve", MOXIE_BONDING_CURVE);

    const [deployer, owner] = await hre.ethers.getSigners();

    const subjectToken = await hre.ethers.getContractAt('SubjectERC20', '');

    await subjectToken.connect(owner).approve(MOXIE_BONDING_CURVE, "2000000000000000000");

    // Get signer using a address
    await vestingContract
        .connect(owner)
        .sellShares(
        SUBJECT_ADDRESS,
        '2000000000000000000',
        0
    );

});
