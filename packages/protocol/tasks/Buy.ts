
import { task } from "hardhat/config";
import { BigNumber} from "@ethersproject/bignumber";

const MOXIE_BONDING_CURVE = '0xAE03AC8F00cD242f69f996BD06DE5Ab9363c20Ac'
const SUBJECT_ADDRESS = '0xdbDa8904eEdA849C70DBbDED4D3B22651aD57973';

task("buy", "buy from bonding curve ", async (taskArgs, hre) => {

    // const buyAmount = '40768889981216543721'; // subject tokens

    const [deployer, owner] = await hre.ethers.getSigners();

    // const easyAuction = await hre.ethers.getContractAt('MoxieBondingCurve', MOXIE_BONDING_CURVE);

    // const moxieToken = await hre.ethers.getContractAt("MoxieToken", "0xf86136AfB0fb72cdbd27d7Aea9e283725d6815a1");

    // await moxieToken.connect(owner).approve(MOXIE_BONDING_CURVE, buyAmount);

    // await easyAuction.connect(owner).buyShares(
    //     SUBJECT_ADDRESS,
    //     buyAmount,
    //     0
    // );

    const subjectToken = await hre.ethers.getContractAt('SubjectERC20', '0xe272372AB0469cE91Df79fe42f5E5dc24c31ff67');

    await subjectToken.connect(owner).transfer(owner.address, "1", {
        gasLimit: 1000000
    });
});