import { task } from "hardhat/config";
import EasyAuctionArtifact from "../test-artifact/easy-auction/artifacts/EasyAuction.json";
import { EasyAuction } from "../test-artifact/easy-auction/typechain/EasyAuction";

const VESTING_CONTRACT_ADDRESS = ''
const AUCTION_ID = 0;

task("bid", "BId in auction", async (taskArgs, hre) => {

    const buyAmount = '0'; // subject
    const sellAmount = '0' // moxie
    const [bidder] = await hre.ethers.getSigners();

    const easyAuction = await hre.ethers.getContractAtFromArtifact(EasyAuctionArtifact, VESTING_CONTRACT_ADDRESS) as unknown as EasyAuction

    const queueStartElement =
                "0x0000000000000000000000000000000000000000000000000000000000000001";
    await easyAuction.connect(bidder).placeSellOrders(
        AUCTION_ID,
        [buyAmount],
        [sellAmount],
        [queueStartElement],
        '0x'
    );
});