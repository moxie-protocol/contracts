import { task } from "hardhat/config";

const VESTING_CONTRACT_ADDRESS = '0xe2b1B4749896D3ACbdBaE20b7e2B3106a6F0F7E1'
const SUBJECT_TOKEN_ADDRESS = '0xbBD10f0cCa43031BFF10bfA2B0E59E0810b548C9';
const BONDING_CURVE_ADDRESS = '0x2196DBaF2782612A0437659c1F7516322E90DA61'
const SUBJECT_ADDRESS = '0x228e3113F2966DBDDa362c9742baC127a27b3f62'

task("sell", "Sell tokens", async (taskArgs, hre) => {

    const vestingContract = await hre.ethers.getContractAt("MoxieBondingCurve", VESTING_CONTRACT_ADDRESS);

    const [seller] = await hre.ethers.getSigners();

    // await subjectToken.connect(seller).approve(BONDING_CURVE_ADDRESS, '1000000000000000000000000000000')

    // Get signer using a address
    await vestingContract
        .connect(seller)
        .sellShares(
        SUBJECT_ADDRESS,
        '57000000000000000000',
        0,
    );

});