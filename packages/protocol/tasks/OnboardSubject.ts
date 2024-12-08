import { task } from "hardhat/config";
import { BigNumber} from "@ethersproject/bignumber";

const SUBJECT_FACTORY_ADDRESS = ''
const MOXIE_PASS = ''
const MOXIE_PASS_VERIFIER_ADDRESS = ''

task("onboard", "Onboard Subject", async (taskArgs, hre) => {

    const subjectFactory = await hre.ethers.getContractAt('SubjectFactory', SUBJECT_FACTORY_ADDRESS);
    const moxiePass = await hre.ethers.getContractAt('MoxiePass', MOXIE_PASS);

    const [deployer, owner, minter, subject, subject1, subject2]  = await hre.ethers.getSigners();

    await moxiePass.connect(minter).mint('', "uri");

    const auctionInput = {
        name: 'fid-3761',
        symbol: 'fid-3761',
        initialSupply: BigNumber.from('1000').mul(BigNumber.from(10).pow(18)).toString(), // in moxie token
        minBuyAmount: BigNumber.from('1000').mul(BigNumber.from(10).pow(18)).toString(),// in moxie token
        minBiddingAmount: BigNumber.from('100').mul(BigNumber.from(10).pow(18)).toString(), // in subject token
        minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
        isAtomicClosureAllowed: false, // false can be hardcoded
        accessManagerContract: MOXIE_PASS_VERIFIER_ADDRESS, //
        accessManagerContractData: '0x' //0x00 can be hardcoded
    }

    await subjectFactory.connect(owner).initiateSubjectOnboarding(
        subject2.address,
        auctionInput,
    )

});
