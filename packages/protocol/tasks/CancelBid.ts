import { task } from "hardhat/config";
import EasyAuctionArtifact from "../test-artifact/easy-auction/artifacts/EasyAuction.json";
import { EasyAuction } from "../test-artifact/easy-auction/typechain/EasyAuction";
import { BigNumber} from "@ethersproject/bignumber";

const VESTING_CONTRACT_ADDRESS = ''
const AUCTION_ID = 3;
const USER_ID = '3';

task("cancel", "BId in auction", async (taskArgs, hre) => {

    const buyAmount = BigNumber.from('699').mul(BigNumber.from(10).pow(18)); // subject
    const sellAmount = BigNumber.from('700').mul(BigNumber.from(10).pow(18)); // moxie

    const [bidder] = await hre.ethers.getSigners();

    const easyAuction = await hre.ethers.getContractAtFromArtifact(EasyAuctionArtifact, VESTING_CONTRACT_ADDRESS) as unknown as EasyAuction

    console.log(buyAmount.toString())
    console.log(sellAmount.toString())

    const queueStartElement =
                "0x0000000000000000000000000000000000000000000000000000000000000001";
    await easyAuction
        .connect(bidder)
        .cancelSellOrders(AUCTION_ID, [
        encodeOrder({ sellAmount, buyAmount,  userId: BigNumber.from(USER_ID)}),
    ]);
});

export function encodeOrder(order: Order): string {
    return (
      "0x" +
      order.userId.toHexString().slice(2).padStart(16, "0") +
      order.buyAmount.toHexString().slice(2).padStart(24, "0") +
      order.sellAmount.toHexString().slice(2).padStart(24, "0")
    );
}

export interface Order {
    sellAmount: BigNumber;
    buyAmount: BigNumber;
    userId: BigNumber;
}
