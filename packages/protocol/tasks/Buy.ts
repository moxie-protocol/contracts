
import { task } from "hardhat/config";
import { BigNumber} from "@ethersproject/bignumber";

const MOXIE_BONDING_CURVE = '0x0f0EcB17575c232077075EF9d78fC9afad808B4D'
const SUBJECT_ADDRESS = '0x3e0ea0e39dc5af19d5fd53b2628899b53ce3497b';

task("buy", "buy from bonding curve ", async (taskArgs, hre) => {

    const buyAmount = BigNumber.from('7591555').mul(BigNumber.from(10).pow(18)); // subject tokens

    const [deployer, owner] = await hre.ethers.getSigners();

    const easyAuction = await hre.ethers.getContractAt('MoxieBondingCurve', MOXIE_BONDING_CURVE);

    const moxieToken = await hre.ethers.getContractAt("MoxieToken", "0xf80945Fc1436b0aE8b86c8835f09870dEEAf03d5");

    await moxieToken.connect(owner).approve(MOXIE_BONDING_CURVE, buyAmount.toString());

    await easyAuction.connect(owner).buyShares(
        SUBJECT_ADDRESS,
        buyAmount.toString(),
        0
    );
});