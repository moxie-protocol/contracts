import { task } from "hardhat/config";
import { setup } from "./utils";
import { BigNumber} from "@ethersproject/bignumber";
import * as contracts from "./config/deployed_addresses.json";


task("test1", "test1", async (taskArgs, hre) => {

   const {
    subjectFactory,
    beneficiary,
    easyAuctionVC,
    moxieBondingCurveVC,
    vestingContract
   } = await setup(hre, 2);

// //    vestingContract.connect(beneficiary).approveSubjectToken()
//    const signers = await hre.ethers.getSigners();

//    const owner = signers[1];

//    const auctionInput = {
//     name: 'fid-3761',
//     symbol: 'fid-3761',
//     initialSupply: BigNumber.from('1000').mul(BigNumber.from(10).pow(18)).toString(), // in moxie token
//     minBuyAmount: BigNumber.from('1000').mul(BigNumber.from(10).pow(18)).toString(),// in moxie token
//     minBiddingAmount: BigNumber.from('100').mul(BigNumber.from(10).pow(18)).toString(), // in subject token
//     minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
//     isAtomicClosureAllowed: false, // false can be hardcoded
//     accessManagerContract: contracts["ProtocolContracts#MoxiePassVerifier"], //
//     accessManagerContractData: '0x' //0x00 can be hardcoded
// }

//    const subject = signers[5];

//    const auctionId  = await subjectFactory.connect(owner).initiateSubjectOnboarding(
//     subject.address,
//     auctionInput
//    );

   

//    await easyAuctionVC.placeSellOrders(
//     auctionId,
//     [],
//     [
//     ]
//    );

//    await subjectFactory.connect(owner).finalizeSubjectOnboarding();

//    await easyAuctionVC.claimFromParticipantOrder();

//    const {
//     beneficiary: beneficiary2
//     easyAuctionVC: easyAuctionVCForBidder2,
//     moxieBondingCureVC: moxieBondingCureVC2
//    } = await setup(hre, 3);

//    moxieBondingCureVC2.buyShares()

//    await moxieBondingCurveVC.sellShares();


});