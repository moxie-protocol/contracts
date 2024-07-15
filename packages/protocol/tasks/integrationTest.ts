
import { task } from "hardhat/config";
import { BigNumber} from "@ethersproject/bignumber";
import * as contracts from "./config/deployed_addresses.json";
import * as task_data from "./config/integrationTest.json";
import { AbiCoder, MaxUint256 } from "ethers";
import EasyAuctionArtifact from "../test-artifact/easy-auction/artifacts/EasyAuction.json";
import { EasyAuction } from "../test-artifact/easy-auction/typechain/EasyAuction";

let defaultAbiCoder = new AbiCoder();



task("integrationTest", "integrationTest", async (taskArgs, hre) => {

    let auctionId = "";

    // Get addresses
    const subjectAddress = task_data.subjectAddress;

    // Get or Create signers
    const signers = await hre.ethers.getSigners();
    const owner = signers[1];

    // Setup contract objects
    const moxiePass = await hre.ethers.getContractAt("MoxiePass", contracts["MoxiePass#MoxiePass"]);
    const subjectFactory = await hre.ethers.getContractAt("SubjectFactory", contracts["ProtocolContractsProxy#subjectFactoryProxy"]);
    const moxieToken = await hre.ethers.getContractAt("MoxieToken", contracts["MoxieToken#MoxieToken"]);
    const moxieBondingCurve = await hre.ethers.getContractAt("MoxieBondingCurve", contracts["ProtocolContractsProxy#moxieBondingCurveProxy"]);
    const tokenManager = await hre.ethers.getContractAt("TokenManager", contracts["ProtocolContractsProxy#tokenManagerProxy"]);
    const subjectTokenAddress = await tokenManager.tokens(subjectAddress);
    const subjectToken = await hre.ethers.getContractAt("SubjectERC20", subjectTokenAddress);


    // onbaord subject if isOnboarding is true
    const isOnboarding = task_data.isOnboarding;
    if (isOnboarding) {

        // Get auction input
        const auctionInput = task_data.auctionInput;
        // Convert auction input to BigNumber
        auctionInput.initialSupply = BigNumber.from(auctionInput.initialSupply).mul(BigNumber.from(10).pow(18)).toString();
        auctionInput.minBuyAmount = BigNumber.from(auctionInput.minBuyAmount).mul(BigNumber.from(10).pow(18)).toString();
        auctionInput.minBiddingAmount = BigNumber.from(auctionInput.minBiddingAmount).mul(BigNumber.from(10).pow(18)).toString();

        // Onboard subject
        await moxiePass.connect(owner).mint(subjectAddress, "uri");
        const tx = await subjectFactory.connect(owner).initiateSubjectOnboarding(subjectAddress, auctionInput);

        // Wait for the transaction to be mined
        const receipt = await tx.wait();

        // Extract the auctionId from the event
        let response = await hre.ethers.provider.send("eth_getTransactionReceipt", [
            receipt?.hash,
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
            auctionId = decodedEvent[5].toString();
            console.log('auctionId', auctionId)
            }
        }

    } else {
        auctionId = task_data.auctionId;
    }

    // Place a bid if bids are present in the task_data
    if (task_data.isPlaceBid) {
        const bids = task_data.bids;
        for (let i = 0; i < bids.length; i++) {
            const bidder = signers[parseInt(bids[i].bidderIndex)]
            // Print the bidder address
            console.log('bidder.address', bidder.address)

            // Send moxie to the bidder
            const transferAmount = BigNumber.from(bids[i].sellAmount).mul(BigNumber.from(10).pow(18));
            await moxieToken.connect(owner).transfer(bidder.address, transferAmount.toString());

            // Give allowance
            await moxieToken.connect(bidder).approve(contracts["EasyAuctionContracts#EasyAuction"], transferAmount.toString());

            const easyAuction = await hre.ethers.getContractAtFromArtifact(EasyAuctionArtifact, contracts["EasyAuctionContracts#EasyAuction"]) as unknown as EasyAuction

            const buyAmount = BigNumber.from(bids[i].buyAmount).mul(BigNumber.from(10).pow(18));
            const sellAmount = BigNumber.from(bids[i].sellAmount).mul(BigNumber.from(10).pow(18));
            
            const queueStartElement =
                "0x0000000000000000000000000000000000000000000000000000000000000001";
            await easyAuction.connect(bidder).placeSellOrders(
                BigInt(auctionId),
                [buyAmount.toString()],
                [sellAmount.toString()],
                [queueStartElement],
                '0x',
            );

        }
    }

    // Cancel Bid
    if (task_data.isCancelBid) {
        const cancelBids = task_data.cancelBids;
        for (let i = 0; i < cancelBids.length; i++) {

            const bidder = signers[parseInt(cancelBids[i].bidderIndex)]
            // Print the bidder address
            console.log('bidder.address', bidder.address)

            const easyAuction = await hre.ethers.getContractAtFromArtifact(EasyAuctionArtifact, contracts["EasyAuctionContracts#EasyAuction"]) as unknown as EasyAuction

            const buyAmount = BigNumber.from(cancelBids[i].buyAmount).mul(BigNumber.from(10).pow(18));
            const sellAmount = BigNumber.from(cancelBids[i].sellAmount).mul(BigNumber.from(10).pow(18));

            await easyAuction
                .connect(bidder)
                .cancelSellOrders(auctionId, [
                encodeOrder({ sellAmount, buyAmount,  userId: BigNumber.from(4)}),
            ]);

        }
    }

    // Finalize onboarding
    if (task_data.finalizeOnboarding) {
        const buyAmountFinalize = BigNumber.from(task_data.finalizeAmount).mul(BigNumber.from(10).pow(18)).toString();
        await moxieToken.connect(owner).approve(contracts["ProtocolContractsProxy#subjectFactoryProxy"], buyAmountFinalize);
        
        await subjectFactory.connect(owner).finalizeSubjectOnboarding(
            task_data.subjectAddress,
            buyAmountFinalize,
            parseInt(task_data.reserveRatio),
        );
    }

    // Claim from participant order
    if (task_data.isClaim) {
        const claimTokens = task_data.claimTokens;
        for (let i = 0; i < claimTokens.length; i++) {

            const bidder = signers[parseInt(claimTokens[i].bidderIndex)]
            // Print the bidder address
            console.log('bidder.address', bidder.address)

            const easyAuction = await hre.ethers.getContractAtFromArtifact(EasyAuctionArtifact, contracts["EasyAuctionContracts#EasyAuction"]) as unknown as EasyAuction

            const buyAmount = BigNumber.from(claimTokens[i].buyAmount).mul(BigNumber.from(10).pow(18));
            const sellAmount = BigNumber.from(claimTokens[i].sellAmount).mul(BigNumber.from(10).pow(18));

            await easyAuction.connect(bidder).claimFromParticipantOrder(
                BigInt(auctionId), [
                   encodeOrder({
                      buyAmount: buyAmount,
                       sellAmount: sellAmount,
                       userId: BigNumber.from(await getUserId(bidder.address)),
                    }),
                ]
            );

        }
    }

    // Buy Shares
    if (task_data.isBuyShares) {
        const buyShares = task_data.buyShares;
        for (let i = 0; i < buyShares.length; i++) {

            const bidder = signers[parseInt(buyShares[i].bidderIndex)]
            // Print the bidder address
            console.log('bidder.address', bidder.address)

            const buyAmountBuyShares = BigNumber.from(buyShares[i].buyAmount).mul(BigNumber.from(10).pow(18));
            // Give allowance
            await moxieToken.connect(bidder).approve(contracts["ProtocolContractsProxy#moxieBondingCurveProxy"], buyAmountBuyShares.toString());

            await moxieBondingCurve.connect(bidder).buyShares(
                task_data.subjectAddress,
                buyAmountBuyShares.toString(),
                0,
            )

        }
    }

    // Sell shares
    if (task_data.isSellShares) {
        const sellShares = task_data.sellShares;
        for (let i = 0; i < sellShares.length; i++) {

            const seller = signers[parseInt(sellShares[i].sellerIndex)]
            // Print the bidder address
            console.log('bidder.address', seller.address)

            const sellAmountShares = BigNumber.from(sellShares[i].sellAmount).mul(BigNumber.from(10).pow(18));
            // Give allowance
            await subjectToken.connect(seller).approve(contracts["ProtocolContractsProxy#moxieBondingCurveProxy"], MaxUint256);

            await moxieBondingCurve.connect(seller).sellShares(
                task_data.subjectAddress,
                sellAmountShares.toString(),
                0,
            )

        }
    }

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

 async function getUserId(address:string) {
    const query = `
    {
      users(where: { address_in: ["${address}"] }) {
        id
        address
      }
    }
  `;

    const response = await fetch('https://api.studio.thegraph.com/proxy/27864/auction/v3.4.3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
  
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
  
    const responseBody = await response.json();
    return responseBody.data.users[0].id;
  }