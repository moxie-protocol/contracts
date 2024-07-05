import { task } from "hardhat/config";
import EasyAuctionArtifact from "../test-artifact/easy-auction/artifacts/EasyAuction.json";
import { EasyAuction } from "../test-artifact/easy-auction/typechain/EasyAuction";
import { BigNumber} from "@ethersproject/bignumber";

const VESTING_CONTRACT_ADDRESS = '0xe2b1B4749896D3ACbdBaE20b7e2B3106a6F0F7E1'
// const EASY_AUCTION_ADDRESS = '0x64f1a4538844167560c5E8712472828634BA0Efb'
const AUCTION_ID = 5;

task("bid", "BId in auction", async (taskArgs, hre) => {

    const buyAmount = BigNumber.from('101').mul(BigNumber.from(10).pow(18)); // subject
    const sellAmount = BigNumber.from('111').mul(BigNumber.from(10).pow(18)); // moxie
    // price 101/175 = 0.57714285714
    // price 175/101 = 1.73267326733

    const [bidder] = await hre.ethers.getSigners();

    const easyAuction = await hre.ethers.getContractAtFromArtifact(EasyAuctionArtifact, VESTING_CONTRACT_ADDRESS) as unknown as EasyAuction

    console.log(buyAmount.toString())
    console.log(sellAmount.toString())

    const queueStartElement =
                "0x0000000000000000000000000000000000000000000000000000000000000001";
    await easyAuction.connect(bidder).placeSellOrders(
        AUCTION_ID,
        [buyAmount.toString()],
        [sellAmount.toString()],
        [queueStartElement],
        '0x'
    );
});