
import { task } from "hardhat/config";
import EasyAuctionArtifact from "../test-artifact/easy-auction/artifacts/EasyAuction.json";
import { BigNumber} from "@ethersproject/bignumber";

const AUCTION_ID = 5;
const VESTING_CONTRACT_ADDRESS = '0xe2b1B4749896D3ACbdBaE20b7e2B3106a6F0F7E1'

task("claim", "Claim from auction", async (taskArgs, hre) => {

    const easyAuction = await hre.ethers.getContractAtFromArtifact(EasyAuctionArtifact, VESTING_CONTRACT_ADDRESS);;

    await easyAuction.claimFromParticipantOrder(AUCTION_ID, [
        encodeOrder({
            sellAmount: BigNumber.from('111').mul(BigNumber.from(10).pow(18)),
            buyAmount: BigNumber.from('101').mul(BigNumber.from(10).pow(18)),
            userId: BigNumber.from(3),
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