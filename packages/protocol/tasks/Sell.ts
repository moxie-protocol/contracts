import { task } from "hardhat/config";

const MOXIE_BONDING_CURVE = '0xAE03AC8F00cD242f69f996BD06DE5Ab9363c20Ac'
const SUBJECT_ADDRESS = '0xdbDa8904eEdA849C70DBbDED4D3B22651aD57973';

task("sell", "Sell tokens", async (taskArgs, hre) => {

    const vestingContract = await hre.ethers.getContractAt("MoxieBondingCurve", MOXIE_BONDING_CURVE);

    const [deployer, owner] = await hre.ethers.getSigners();

    const subjectToken = await hre.ethers.getContractAt('SubjectERC20', '0xe272372AB0469cE91Df79fe42f5E5dc24c31ff67');

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