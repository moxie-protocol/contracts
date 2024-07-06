import EasyAuctionArtifact from "../test-artifact/easy-auction/artifacts/EasyAuction.json";
import VestingContractArtifact from "../test-artifact/vesting/MoxieTokenLockWallet.json";

import { EasyAuction } from "../test-artifact/easy-auction/typechain/EasyAuction";
import * as vestingContracts from "./config/vesting.json";
import * as contracts from "./config/deployed_addresses.json";
import { MoxieBondingCurve, MoxiePass, MoxieToken, SubjectFactory, TokenManager } from "../typechain-types";
import { MoxieTokenLockWallet } from "../test-artifact/vesting/MoxieTokenLockWallet";

export const setup = async (hre: any, beneficiaryIndex: number): Promise< {
    easyAuctionVC: EasyAuction,
    beneficiary: any,
    vestingContractAddress: string,
    moxieBondingCurveVC: MoxieBondingCurve,
    moxieBondingCurve: MoxieBondingCurve,
    subjectFactory: SubjectFactory,
    tokenManager: TokenManager,
    moxieToken: MoxieToken,
    moxiePass: MoxiePass,
    vestingContract: MoxieTokenLockWallet
}> => {
    const signers = await hre.ethers.getSigners();

    const beneficiary = signers[beneficiaryIndex];
    const vestingContractAddresses = JSON.parse(JSON.stringify(vestingContracts));
    const vestingContractAddress = vestingContractAddresses[beneficiary.address];
    const easyAuctionVC = await hre.ethers.getContractAtFromArtifact(EasyAuctionArtifact, vestingContractAddress) as unknown as EasyAuction
    const moxieBondingCurveVC = await hre.ethers.getContractAt("MoxieBondingCurve", vestingContractAddress);


    const moxieBondingCurve = await hre.ethers.getContractAt("MoxieBondingCurve", contracts["ProtocolContractsProxy#moxieBondingCurveProxy"]);
    const subjectFactory = await hre.ethers.getContractAt("SubjectFactory", contracts["ProtocolContractsProxy#subjectFactoryProxy"]);
    const tokenManager = await hre.ethers.getContractAt("TokenManager", contracts["ProtocolContractsProxy#tokenManagerProxy"]);

    const moxieToken = await hre.ethers.getContractAt("MoxieToken", contracts["MoxieToken#MoxieToken"]);
    const moxiePass = await hre.ethers.getContractAt("MoxiePass", contracts["MoxiePass#MoxiePass"]);
    const vestingContract = await hre.ethers.getContractAtFromArtifact(VestingContractArtifact, vestingContractAddress) as unknown as MoxieTokenLockWallet

    return {
        easyAuctionVC,
        beneficiary,
        vestingContractAddress,
        moxieBondingCurveVC,
        moxieBondingCurve,
        subjectFactory,
        tokenManager,
        moxieToken,
        moxiePass,
        vestingContract
    }

}