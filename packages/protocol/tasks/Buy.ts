
import { task } from "hardhat/config";
import { BigNumber} from "@ethersproject/bignumber";

const VESTING_CONTRACT_ADDRESS = '0x0f0EcB17575c232077075EF9d78fC9afad808B4D'
const SUBJECT_ADDRESS = '0x228e3113F2966DBDDa362c9742baC127a27b3f62';

task("buy", "buy from bonding curve ", async (taskArgs, hre) => {

    const buyAmount = BigNumber.from('1000').mul(BigNumber.from(10).pow(18)); // subject tokens

    const [buyer] = await hre.ethers.getSigners();

    const easyAuction = await hre.ethers.getContractAt('MoxieBondingCurve', VESTING_CONTRACT_ADDRESS);

    await easyAuction.connect(buyer).buyShares(
        SUBJECT_ADDRESS,
        buyAmount.toString(),
        0
    );
});