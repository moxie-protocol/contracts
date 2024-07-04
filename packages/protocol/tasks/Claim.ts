
import { task } from "hardhat/config";
import EasyAuctionArtifact from "../test-artifact/easy-auction/artifacts/EasyAuction.json";
import addresses from '../ignition/deployments/testnet-v2/deployed_addresses.json'
import { BigNumber} from "@ethersproject/bignumber";

const AUCTION_ID = 1;

task("claim", "Claim from auction", async (taskArgs, hre) => {

    const easyAuction = await hre.ethers.getContractAtFromArtifact(EasyAuctionArtifact, addresses["EasyAuctionContracts#EasyAuction"]);;

    await easyAuction.claimFromParticipantOrder(AUCTION_ID, [
        encodeOrder({
            sellAmount: BigNumber.from("12"),
            buyAmount: BigNumber.from("700"),
            userId: BigNumber.from(2),
          }),
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