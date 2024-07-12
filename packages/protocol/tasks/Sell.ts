import { task } from "hardhat/config";

const MOXIE_BONDING_CURVE = '0x0f0EcB17575c232077075EF9d78fC9afad808B4D'
const SUBJECT_ADDRESS = '0x3e0ea0e39dc5af19d5fd53b2628899b53ce3497b'

task("sell", "Sell tokens", async (taskArgs, hre) => {

    const vestingContract = await hre.ethers.getContractAt("MoxieBondingCurve", MOXIE_BONDING_CURVE);

    const [deployer, owner] = await hre.ethers.getSigners();

    // Get signer using a address
    await vestingContract
        .connect(owner)
        .sellShares(
        SUBJECT_ADDRESS,
        '57000000000000000000',
        0,
        {
            gasLimit: 1000000,
        }
    );

});