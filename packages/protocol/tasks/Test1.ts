import { task } from "hardhat/config";
import { setup } from "./utils";
import { BigNumber} from "@ethersproject/bignumber";
import * as contracts from "./config/deployed_addresses.json";

const SUBJECT_FACTORY_ADDRESS = '0x3199219bda5dbC9ee45bb3DFad180be56A7ebfd0'


task("test1", "test1", async (taskArgs, hre) => {

   const {
    subjectFactory,
    beneficiary,
    easyAuctionVC,
    vestingContract,
    moxieToken,
    moxiePass,
   } = await setup(hre, 1);

   await vestingContract.connect(beneficiary).approveProtocol()

   const signers = await hre.ethers.getSigners();
   const subject_address = "0x3e0ea0e39dc5af19d5fd53b2628899b53ce3497b"
   const owner = signers[1];

   console.log('beneficiary.address', beneficiary.address)
   console.log('owner.address', owner.address)
   console.log('subject.address', subject_address)

   // To change as per your test
   const auctionInput = {
    name: 'fid-3761',
    symbol: 'fid-3761',
    initialSupply: BigNumber.from('1000').mul(BigNumber.from(10).pow(18)).toString(), // in moxie token
    minBuyAmount: BigNumber.from('500000').mul(BigNumber.from(10).pow(18)).toString(),// in moxie token
    minBiddingAmount: BigNumber.from('500').mul(BigNumber.from(10).pow(18)).toString(), // in subject token
    minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
    isAtomicClosureAllowed: false, // false can be hardcoded
    accessManagerContract: contracts["ProtocolContracts#MoxiePassVerifier"], //
    accessManagerContractData: '0x' //0x00 can be hardcoded
}

   // Initiate subject onboarding
   // await moxiePass.connect(owner).mint(subject_address, "uri");
   // await subjectFactory.connect(owner).initiateSubjectOnboarding(
   //    subject_address,
   //  auctionInput
   // ).then((tx: any) => {
   //    console.log(tx)
   // });

   // // Get the auction id from log of the above transaction
   // const auctionId = 18;
   // console.log('auctionId', auctionId)

   // place a bid
   // To change as per your test
   // const buyAmount = BigNumber.from('1000').mul(BigNumber.from(10).pow(18)); // subject
   // const sellAmount = BigNumber.from('500001').mul(BigNumber.from(10).pow(18)); // moxie
   
   // const queueStartElement =
   //    "0x0000000000000000000000000000000000000000000000000000000000000001";
   // await easyAuctionVC.connect(beneficiary).placeSellOrders(
   //    BigInt(auctionId),
   //    [buyAmount.toString()],
   //    [sellAmount.toString()],
   //    [queueStartElement],
   //    '0x'
   // ).then((tx: any) => {
   //    console.log(tx)
   // }).catch((err: any) => {
   //    console.log(err)
   //    });

   // Cancel Bid
   //  await easyAuctionVC
   //      .connect(beneficiary)
   //      .cancelSellOrders(auctionId, [
   //      encodeOrder({ sellAmount, buyAmount,  userId: BigNumber.from(4)}),
   //  ]);

   // // Finalize subject onboarding
   // const buyAmountFinalize = BigNumber.from('1').mul(BigNumber.from(10).pow(18)).toString();
   // await moxieToken.connect(owner).approve(SUBJECT_FACTORY_ADDRESS, buyAmountFinalize);
   
   // await subjectFactory.connect(owner).finalizeSubjectOnboarding(
   //    subject_address,
   //    buyAmountFinalize,
   //    660000
   // ).catch((err: any) => {
   //    console.log(err)
   //    });

   // Claim from participant order
   // buyAmount and sellAmount should be same as the bid placed
   // await easyAuctionVC.connect(beneficiary).claimFromParticipantOrder(
   //    BigInt(auctionId), [
   //       encodeOrder({
   //          buyAmount: BigNumber.from('500').mul(BigNumber.from(10).pow(18)),
   //           sellAmount: BigNumber.from('1284').mul(BigNumber.from(10).pow(18)),
   //           userId: BigNumber.from(4),
   //         }),
   //   ]
   // );

   const setupOutput = await setup(hre, 5);
   const moxieBondingCureVC2 = setupOutput.moxieBondingCurveVC;
   // Buy Shares
   // buyAmountBuyShares can be change as per your test
   // console.log('moxieBondingCureVC2', await moxieBondingCureVC2.getAddress())
   // await vestingContract.connect(beneficiary).approveSubjectToken(subject.address)
   // const buyAmountBuyShares = BigNumber.from('1000').mul(BigNumber.from(10).pow(18)); // subject tokens
   // await moxieBondingCureVC2.connect(beneficiary).buyShares(
   //    subject.address,
   //    buyAmountBuyShares.toString(),
   //    0
   // )

   // Sell shares
   // sellAmountShares will be same as the buyAmountBuyShares or less than that
   // const sellAmountShares = BigNumber.from('1000').mul(BigNumber.from(10).pow(18)); // subject tokens
   // console.log('vestingContract', await vestingContract.getAddress())
   // await vestingContract.connect(beneficiary).approveSubjectToken(subject.address)

   // await moxieBondingCureVC2.connect(beneficiary).sellShares(
   //    subject.address,
   //    sellAmountShares.toString(),
   //    0
   // )


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