import { task } from "hardhat/config";
import EasyAuctionArtifact from "../test-artifact/easy-auction/artifacts/EasyAuction.json";
import { EasyAuction } from "../test-artifact/easy-auction/typechain/EasyAuction";
import { BigNumber} from "@ethersproject/bignumber";

const EASY_AUCTION_ADDRESS = '0x28E8A1817Af21d39d6820Fd930FDE618e03d4d8d'
const MOXIE_BONDING_CURVE = "0x0f0EcB17575c232077075EF9d78fC9afad808B4D"
const AUCTION_ID = 19;

task("bid", "BId in auction", async (taskArgs, hre) => {

    const buyAmount = BigNumber.from('1000').mul(BigNumber.from(10).pow(18)); // subject
    const sellAmount = BigNumber.from('500001').mul(BigNumber.from(10).pow(18)); // moxie

    const [deployer, owner] = await hre.ethers.getSigners();

    const easyAuction = await hre.ethers.getContractAtFromArtifact(EasyAuctionArtifact, EASY_AUCTION_ADDRESS) as unknown as EasyAuction

    console.log(buyAmount.toString())
    console.log(sellAmount.toString())

    const moxieToken = await hre.ethers.getContractAt("MoxieToken", "0xf80945Fc1436b0aE8b86c8835f09870dEEAf03d5");

    await moxieToken.connect(owner).approve(MOXIE_BONDING_CURVE, sellAmount.toString());

    // const queueStartElement =
    //             "0x0000000000000000000000000000000000000000000000000000000000000001";
    // await easyAuction.connect(owner).placeSellOrders(
    //     AUCTION_ID,
    //     [buyAmount.toString()],
    //     [sellAmount.toString()],
    //     [queueStartElement],
    //     '0x'
    // );
});