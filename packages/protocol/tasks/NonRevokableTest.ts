import { task } from "hardhat/config";
import { setup } from "./utils";
import { BigNumber } from "@ethersproject/bignumber";
import * as contracts from "./config/deployed_addresses.json";
import { AbiCoder } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

let defaultAbiCoder = new AbiCoder();
const SUBJECT_FACTORY_ADDRESS = "0x3199219bda5dbC9ee45bb3DFad180be56A7ebfd0";

task("nonRevokableTest", "test1", async (taskArgs, hre) => {
  const {
    subjectFactory,
    beneficiary,
    easyAuctionVC,
    vestingContract,
    moxieToken,
    moxiePass,
    moxieBondingCurveVC,
  } = await setup(hre, 15);
  // console.log("vestingContract", await vestingContract.getAddress());
  // await vestingContract.connect(beneficiary).approveProtocol();

  const signers = await hre.ethers.getSigners();

  const subject = signers[17];
  const owner = signers[1];
  try {
    await vestingContract.connect(owner).revoke();
  } catch (e) {
    // @ts-ignore
    console.log(e.message);
    // @ts-ignore
    console.log(e.data);
  }

  console.log("beneficiary.address", beneficiary.address);
  console.log("owner.address", owner.address);
  console.log("subject.address", subject.address);

  // try {
  //   await vestingContract.connect(beneficiary).withdrawSurplus("100");
  // } catch (e) {
  //   // @ts-ignore
  //   console.log(e.message);
  //   // @ts-ignore
  //   console.log(e.data);
  // }
  // To change as per your test
  // const auctionInput = {
  //   name: "fid-18",
  //   symbol: "fid-18",
  //   initialSupply: BigNumber.from("1000")
  //     .mul(BigNumber.from(10).pow(18))
  //     .toString(), // in moxie token
  //   minBuyAmount: BigNumber.from("2")
  //     .mul(BigNumber.from(10).pow(18))
  //     .toString(), // in moxie token
  //   minBiddingAmount: BigNumber.from("2")
  //     .mul(BigNumber.from(10).pow(18))
  //     .toString(), // in subject token
  //   minFundingThreshold: "0", // amount of auction funding in moxie token below which auction will be cancelled.
  //   isAtomicClosureAllowed: false, // false can be hardcoded
  //   accessManagerContract: contracts["ProtocolContracts#MoxiePassVerifier"], //
  //   accessManagerContractData: "0x", //0x00 can be hardcoded
  // };

  // // Initiate subject onboarding
  // let moxieMintResponse = await moxiePass
  //   .connect(owner)
  //   .mint(subject.address, "uri");
  // let mintReceipt = await moxieMintResponse.wait();
  // console.log("mintReceipt", mintReceipt);

  // console.log("subjectFactory", await subjectFactory.getAddress());
  // try {
  //   let initalizeResponse = await subjectFactory
  //     .connect(owner)
  //     .initiateSubjectOnboarding(subject.address, auctionInput);

  //   let initalizeReceipt = await initalizeResponse.wait();
  //   console.log("initalizeReceipt", initalizeReceipt!.hash);
  //   await GetAuctionIdFromInitializedHash(hre, initalizeReceipt!.hash);
  // } catch (e) {
  //   // @ts-ignore
  //   console.log(e.message);
  //   // @ts-ignore
  //   console.log(e.data);
  // }

  // // Get the auction id from log of the above transaction
  // const auctionId = 14;
  // console.log("auctionId", auctionId);

  // // place a bid
  // // To change as per your test
  // const buyAmount = BigNumber.from("900").mul(BigNumber.from(10).pow(18)); // subject
  // const sellAmount = BigNumber.from("1000").mul(BigNumber.from(10).pow(18)); // moxie

  // const queueStartElement =
  //   "0x0000000000000000000000000000000000000000000000000000000000000001";
  // try {
  //   let placeSellOrdersResp = await easyAuctionVC
  //     .connect(beneficiary)
  //     .placeSellOrders(
  //       BigInt(auctionId),
  //       [buyAmount.toString()],
  //       [sellAmount.toString()],
  //       [queueStartElement],
  //       "0x",
  //     );
  //   console.log("placeSellOrdersResp", placeSellOrdersResp);
  // } catch (e) {
  //   // @ts-ignore
  //   console.log(e.message);
  //   // @ts-ignore
  //   console.log(e.data);
  // }

  // const player2 = await setup(hre, 16);
  // console.log("player2.beneficiary", player2.beneficiary.address);

  // place a bid with second player`
  // To change as per your test
  // const buyAmount = BigNumber.from("5").mul(BigNumber.from(10).pow(18)); // subject
  // const sellAmount = BigNumber.from("1000").mul(BigNumber.from(10).pow(18)); // moxie

  // const queueStartElement =
  //   "0x0000000000000000000000000000000000000000000000000000000000000001";

  // console.log(
  //   "player2.easyAuctionVC",
  //   await player2.easyAuctionVC.getAddress(),
  // );
  // await vestingContract.connect(player2.beneficiary).approveProtocol();
  // try {
  //   let placeSellOrdersResp = await player2.easyAuctionVC
  //     .connect(player2.beneficiary)
  //     .placeSellOrders(
  //       BigInt(auctionId),
  //       [buyAmount.toString()],
  //       [sellAmount.toString()],
  //       [queueStartElement],
  //       "0x",
  //     );
  //   console.log("placeSellOrdersResp", placeSellOrdersResp);
  // } catch (e) {
  //   // @ts-ignore
  //   console.log(e.message);
  //   // @ts-ignore
  //   console.log(e.data);
  // }
  // // Finalize subject onboarding
  // const buyAmountFinalize = BigNumber.from("1")
  //   .mul(BigNumber.from(10).pow(18))
  //   .toString();

  // const buyAmountFinalize = BigNumber.from("1")
  //   .mul(BigNumber.from(10).pow(18))
  //   .toString(); // moxie
  // await moxieToken
  //   .connect(owner)
  //   .approve(await subjectFactory.getAddress(), buyAmountFinalize);
  // console.log("buyAmountFinalize", buyAmountFinalize);
  // console.log("subjectFactory", await subjectFactory.getAddress());
  // try {
  //   let finalizeReceipt = await subjectFactory
  //     .connect(owner)
  //     .finalizeSubjectOnboarding(subject.address, buyAmountFinalize, 660000);
  //   let txResp = await finalizeReceipt.wait();
  //   console.log("txResp", txResp);
  // } catch (e) {
  //   console.log("finalizeSubjectOnboarding error");
  //   // @ts-ignore
  //   console.log(e.message);
  //   // @ts-ignore
  //   console.log(e.data);
  // }

  // Claim from participant order
  // buyAmount and sellAmount should be same as the bid placed
  // try {
  //   let tx = await easyAuctionVC
  //     .connect(beneficiary)
  //     .claimFromParticipantOrder(BigInt(auctionId), [
  //       encodeOrder({
  //         buyAmount: BigNumber.from("5").mul(BigNumber.from(10).pow(18)),
  //         sellAmount: BigNumber.from("1000").mul(BigNumber.from(10).pow(18)),
  //         userId: BigNumber.from(5),
  //       }),
  //     ]);
  //   console.log("claimFromParticipantOrder receipt", tx);
  // } catch (e) {
  //   console.log("claimFromParticipantOrder error");
  //   // @ts-ignore
  //   console.log(e.message);
  //   // @ts-ignore
  //   console.log(e.data);
  // }

  // const setupOutput = await setup(hre, 15);
  // Buy Shares
  // buyAmountBuyShares can be change as per your test
  // console.log("moxieBondingCureVC2", await moxieBondingCureVC2.getAddress());
  // const buyAmountBuyShares = BigNumber.from("7").mul(
  //   BigNumber.from(10).pow(18),
  // ); // subject tokens
  // await moxieBondingCureVC2
  //   .connect(beneficiary)
  //   .buyShares(subject.address, buyAmountBuyShares.toString(), 0);

  // Sell shares
  // sellAmountShares will be same as the buyAmountBuyShares or less than that
  // const sellAmountShares = BigNumber.from("1000").mul(
  //   BigNumber.from(10).pow(18),
  // ); // subject tokens
  // console.log("vestingContract", await vestingContract.getAddress());
  // try {
  //   await vestingContract
  //     .connect(beneficiary)
  //     .approveSubjectToken(subject.address);
  // } catch (e) {
  //   console.log("approveSubjectToken error");
  //   // @ts-ignore
  //   console.log(e.message);
  //   // @ts-ignore
  //   console.log(e.data);
  // }

  // try {
  //   await moxieBondingCurveVC
  //     .connect(beneficiary)
  //     .sellShares(subject.address, sellAmountShares.toString(), 0);
  // } catch (e) {
  //   console.log("sellShares error");
  //   // @ts-ignore
  //   console.log(e.message);
  //   // @ts-ignore
  //   console.log(e.data);
  // }
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

export const GetAuctionIdFromInitializedHash = async (
  hre: HardhatRuntimeEnvironment,
  hash: string,
) => {
  let response = await hre.ethers.provider.send("eth_getTransactionReceipt", [
    hash,
  ]);
  for (let i = 0; i < response.logs.length; i++) {
    if (
      "0x6fe3c8bc2a001eda7bcb9594360771389b00cd33722aa178cc817bd906120eaf" ==
      response.logs[i].topics[0]
    ) {
      let decodedEvent = defaultAbiCoder.decode(
        ["address", "address", "uint256", "address", "uint256", "uint256"],
        response.logs[i].data,
      );
      console.log("decodedEvent", decodedEvent);
    }
  }
};
