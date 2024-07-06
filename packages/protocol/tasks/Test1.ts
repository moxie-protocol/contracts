import { task } from "hardhat/config";
import { setup } from "./utils";
import { BigNumber} from "@ethersproject/bignumber";
import * as contracts from "./config/deployed_addresses.json";


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

   const subject = signers[12];
   const owner = signers[1];

   console.log('beneficiary.address', beneficiary.address)
   console.log('owner.address', owner.address)
   console.log('subject.address', subject.address)

   const auctionInput = {
    name: 'fid-3761',
    symbol: 'fid-3761',
    initialSupply: BigNumber.from('1000').mul(BigNumber.from(10).pow(18)).toString(), // in moxie token
    minBuyAmount: BigNumber.from('2').mul(BigNumber.from(10).pow(18)).toString(),// in moxie token
    minBiddingAmount: BigNumber.from('2').mul(BigNumber.from(10).pow(18)).toString(), // in subject token
    minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
    isAtomicClosureAllowed: false, // false can be hardcoded
    accessManagerContract: contracts["ProtocolContracts#MoxiePassVerifier"], //
    accessManagerContractData: '0x' //0x00 can be hardcoded
}

   // Initiate subject onboarding
   // await moxiePass.connect(owner).mint(subject.address, "uri");
   // const auctionId  = await subjectFactory.connect(owner).initiateSubjectOnboarding(
   //  subject.address,
   //  auctionInput
   // ).then((tx: any) => {
   //    console.log(tx)
   // });

   const auctionId = 8;
   console.log('auctionId', auctionId)

   // place a bid
   // const buyAmount = BigNumber.from('5').mul(BigNumber.from(10).pow(18)); // subject
   // const sellAmount = BigNumber.from('7').mul(BigNumber.from(10).pow(18)); // moxie
   
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

   // Finalize subject onboarding
   // const buyAmountFinalize = BigNumber.from('1').mul(BigNumber.from(10).pow(18)).toString();
   // await moxieToken.connect(owner).approve('0x3199219bda5dbC9ee45bb3DFad180be56A7ebfd0', buyAmountFinalize);
   
   // await subjectFactory.connect(owner).finalizeSubjectOnboarding(
   //    subject.address,
   //    buyAmountFinalize,
   //    660000
   // ).catch((err: any) => {
   //    console.log(err)
   //    });

   // Claim from participant order
   // await easyAuctionVC.connect(beneficiary).claimFromParticipantOrder(
   //    BigInt(auctionId), [
   //       encodeOrder({
   //          buyAmount: BigNumber.from('5').mul(BigNumber.from(10).pow(18)),
   //           sellAmount: BigNumber.from('7').mul(BigNumber.from(10).pow(18)),
   //           userId: BigNumber.from(3),
   //         }),
   //   ]
   // );

   const setupOutput = await setup(hre, 1);
   const moxieBondingCureVC2 = setupOutput.moxieBondingCurveVC;
   // Buy Shares
   // console.log('moxieBondingCureVC2', await moxieBondingCureVC2.getAddress())
   // const buyAmountBuyShares = BigNumber.from('7').mul(BigNumber.from(10).pow(18)); // subject tokens
   // await moxieBondingCureVC2.connect(beneficiary).buyShares(
   //    subject.address,
   //    buyAmountBuyShares.toString(),
   //    0
   // )

   // Sell shares
   const sellAmountShares = BigNumber.from('7').mul(BigNumber.from(10).pow(18)); // subject tokens
   console.log('vestingContract', await vestingContract.getAddress())
   await vestingContract.connect(beneficiary).approveSubjectToken(subject.address)

   await moxieBondingCureVC2.connect(beneficiary).sellShares(
      subject.address,
      sellAmountShares.toString(),
      0
   )


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