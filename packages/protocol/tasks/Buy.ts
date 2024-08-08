
import { task } from "hardhat/config";
import { BigNumber} from "@ethersproject/bignumber";

const MOXIE_BONDING_CURVE = ''
const SUBJECT_ADDRESS = '';

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

    const subjectToken = await hre.ethers.getContractAt('SubjectERC20', '');

    await subjectToken.connect(owner).transfer(owner.address, "1", {
        gasLimit: 1000000
    });
});
