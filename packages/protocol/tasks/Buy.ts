
import { task } from "hardhat/config";
import EasyAuctionArtifact from "../test-artifact/easy-auction/artifacts/EasyAuction.json";
import { EasyAuction } from "../test-artifact/easy-auction/typechain/EasyAuction";

const VESTING_CONTRACT_ADDRESS = ''
const SUBJECT_ADDRESS = '';

task("buy", "buy from bonding curve ", async (taskArgs, hre) => {

    const buyAmount = '0'; // subject
    const depositAmount = '';

    const [buyer] = await hre.ethers.getSigners();

    const easyAuction = await hre.ethers.getContractAt('MoxieBondingCurve', VESTING_CONTRACT_ADDRESS);

    await easyAuction.connect(buyer).buyShares(
        SUBJECT_ADDRESS,
        depositAmount,
        buyer.address,
        0
    );
});