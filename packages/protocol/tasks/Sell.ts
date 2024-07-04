import { task } from "hardhat/config";

const MOXIE_BONDING_CURVE_ADDRESS = '0xc3216954C25d18a366A67A86c64C7db9c8D62e45';
const SUBJECT_ADDRESS = ''

task("sell", "Sell tokens", async (taskArgs, hre) => {

    const moxieBondingCurve = await hre.ethers.getContractAt("MoxieBondingCurve", MOXIE_BONDING_CURVE_ADDRESS);

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