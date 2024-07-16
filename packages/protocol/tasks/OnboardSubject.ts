import { task } from "hardhat/config";
import { BigNumber} from "@ethersproject/bignumber";

const SUBJECT_FACTORY_ADDRESS = '0x0b34EB0DE7977b1d3e7facD449b92a0Fe5772A40'
const MOXIE_PASS = '0xA63D5a914F575F8Fe8832A2A9Fcb4A2d875Db2Ef'
const MOXIE_PASS_VERIFIER_ADDRESS = '0x6BCF68EBc21f0b5Cb62C60F5900E95c7fAB2DE50'

task("onboard", "Onboard Subject", async (taskArgs, hre) => {

    const subjectFactory = await hre.ethers.getContractAt('SubjectFactory', SUBJECT_FACTORY_ADDRESS);
    const moxiePass = await hre.ethers.getContractAt('MoxiePass', MOXIE_PASS);

    const [deployer, owner, minter, subject, subject1, subject2]  = await hre.ethers.getSigners();

    // await moxiePass.connect(minter).mint('0x45b19Bafb4c035056E4a2Fe8667545a89C2E44a7', "uri");

    // console.log(subject2.address)

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

    console.log(auctionInput)

    await subjectFactory.connect(owner).grantRole(await subjectFactory.UPDATE_AUCTION_ROLE(), owner.address)

    // Change auctionTime to 15 minutes
    await subjectFactory.connect(owner).updateAuctionTime(600, 599);

    // await subjectFactory.connect(owner).initiateSubjectOnboarding(
    //     subject2.address,
    //     auctionInput,
    // )

});