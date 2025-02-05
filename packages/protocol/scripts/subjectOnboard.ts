import { ethers } from "hardhat"

const onboardSubject = async () => {
 const signers = await ethers.getSigners()
 const subjectFactory = await ethers.getContractAt("SubjectFactory", "0x48B0928EE0B5BEA036Bcd82174F49282a3d80Eff")

 const onboardinROle = await subjectFactory.ONBOARDING_ROLE()
 console.log(onboardinROle)
 // give onboarding role to the first signer
 let tx = await subjectFactory.connect(signers[1]).grantRole(onboardinROle, signers[1].address)
 await tx.wait()
 console.log(tx)

 // const hasRole = await subjectFactory.hasRole(onboardinROle, signers[0].address)

 // console.log(hasRole)
 const auctionInput = {
  name: 'fid-3761',
  symbol: 'fid-3761',
  initialSupply: '1000',
  minBuyAmount: '1000',// in moxie token
  minBiddingAmount: '1000', // in subject token
  minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
  isAtomicClosureAllowed: false, // false can be hardcoded
  accessManagerContract: "0xb797baA5080fe51207f0551B914F93283F720645", //
  accessManagerContractData: '0x' //0x00 can be hardcoded

 };
 tx = await subjectFactory.connect(signers[1]).initiateSubjectOnboarding(
  signers[4].address,
  auctionInput,
  ethers.ZeroAddress

 )
 await tx.wait()

 console.log(tx)

}

onboardSubject().catch(console.error)