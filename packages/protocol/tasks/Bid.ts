import { task } from "hardhat/config";
import EasyAuctionArtifact from "../test-artifact/easy-auction/artifacts/EasyAuction.json";
import addresses from '../ignition/deployments/testnet-v2/deployed_addresses.json'

const VESTING_CONTRACT_ADDRESS = '';
const AUCTION_ID = 1;

task("bid", "BId in auction", async (taskArgs, hre) => {

    const easyAuction = await hre.ethers.getContractAtFromArtifact(EasyAuctionArtifact, addresses["EasyAuctionContracts#EasyAuction"]);;

});