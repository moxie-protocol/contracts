import { task } from "hardhat/config";

const VESTING_CONTRACT_ADDRESS = ''
const SUBJECT_ADDRESS = ''

task("sell", "Sell tokens", async (taskArgs, hre) => {

    const moxieBondingCurve = await hre.ethers.getContractAt("MoxieBondingCurve", VESTING_CONTRACT_ADDRESS);

    // Get signer using a address
    const seller = await hre.ethers.getSigner("0x00d620DEF6Ccb76C92dBFC87bC2bebaB7637eC53");
    moxieBondingCurve
        .connect(seller)
        .sellShares(
        SUBJECT_ADDRESS,
        'totalSellAmountSeller1',
        seller.address,
        0,
    );

});