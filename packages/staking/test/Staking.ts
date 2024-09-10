import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { SubjectERC20 as SubjectERC20Type } from "../typechain-types";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs"
// import {
//  getExpectedSellReturnAndFee,
//  getExpectedBuyAmountAndFee,
// } from "./utils";


const getFactories = async () => {
 const MoxieToken = await hre.ethers.getContractFactory("MoxieToken");
 const BancorFormula = await hre.ethers.getContractFactory("BancorFormula");
 const Vault = await hre.ethers.getContractFactory("Vault");
 const SubjectERC20 = await hre.ethers.getContractFactory("SubjectERC20");
 const MoxiePass = await hre.ethers.getContractFactory("MoxiePass");
 const MoxiePassVerifier = await hre.ethers.getContractFactory(
  "MockMoxiePassVerifier",
 );
 const TokenManager = await hre.ethers.getContractFactory("TokenManager");
 const MoxieBondingCurve =
  await hre.ethers.getContractFactory("MoxieBondingCurve");
 const Staking =
  await hre.ethers.getContractFactory("Staking");
 return {
  MoxieToken,
  BancorFormula,
  Vault,
  SubjectERC20,
  MoxiePass,
  MoxiePassVerifier,
  TokenManager,
  MoxieBondingCurve,
  Staking,
 };

}

describe("Staking", () => {
 const deploy = async () => {
  const [
   deployer,
   owner,
   feeBeneficiary,
   minter,
   subjectFactory,
   subject,
   buyer,
   seller,
   buyer2,
   seller2,
   ...otherAccounts
  ] = await ethers.getSigners();
  const {
   MoxieToken,
   BancorFormula,
   Vault,
   SubjectERC20,
   MoxiePass,
   MoxiePassVerifier,
   TokenManager,
   MoxieBondingCurve,
   Staking } = await getFactories();
  // moxie Token
  const moxieToken = await MoxieToken.connect(owner).deploy();

  // formula deployment
  const formula = await BancorFormula.deploy();

  // vault deployment
  const vaultInstance = await Vault.deploy({ from: deployer.address });

  await vaultInstance.connect(deployer).initialize(owner.address);
  // subject deployment
  const subjectErc20 = await SubjectERC20.deploy({ from: deployer.address });

  // Moxie Pass
  const moxiePass = await MoxiePass.deploy(owner.address, minter.address);

  // moxie pass verifier
  const moxiePassVerifier = await MoxiePassVerifier.deploy(owner.address);
  await moxiePassVerifier
   .connect(owner)
   .setErc721ContractAddress(await moxiePass.getAddress());

  //subjectErc20
  const subjectErc20Address = await subjectErc20.getAddress();

  const tokenManager = await TokenManager.deploy({ from: deployer.address });
  await tokenManager
   .connect(deployer)
   .initialize(owner.address, subjectErc20Address);


  const lockTime = 60;
  // moxie Bonding curve
  const moxieBondingCurve = await MoxieBondingCurve.deploy();
  const staking = await Staking
   .deploy(
    await tokenManager.getAddress(),
    await moxieBondingCurve.getAddress(),
    await moxieToken.getAddress(),
    lockTime
    , { from: deployer.address });
  await staking.connect(deployer).initialize(owner.address);

  const stakingAddress = await staking.getAddress();
  const moxieTokenAddress = await moxieToken.getAddress();
  const formulaAddress = await formula.getAddress();
  const tokenManagerAddress = await tokenManager.getAddress();
  const vaultAddress = await vaultInstance.getAddress();
  const protocolBuyFeePct = (1e16).toString(); // 1%
  const protocolSellFeePct = (2 * 1e16).toString(); // 2%
  const subjectBuyFeePct = (3 * 1e16).toString(); // 3%
  const subjectSellFeePct = (4 * 1e16).toString(); // 4%

  const feeInput = {
   protocolBuyFeePct,
   protocolSellFeePct,
   subjectBuyFeePct,
   subjectSellFeePct,
  };

  await moxieBondingCurve.initialize(
   moxieTokenAddress,
   formulaAddress,
   owner.address,
   tokenManagerAddress,
   vaultAddress,
   feeInput,
   feeBeneficiary.address,
   subjectFactory.address,
  );
  const moxieBondingCurveAddress = await moxieBondingCurve.getAddress();

  await moxiePass.connect(minter).mint(owner.address, "uri");
  await moxiePass.connect(minter).mint(subject.address, "uri");
  await moxiePass.connect(minter).mint(deployer.address, "uri");
  await moxiePass.connect(minter).mint(subjectFactory.address, "uri");
  await moxiePass.connect(minter).mint(moxieBondingCurveAddress, "uri");
  await moxiePass.connect(minter).mint(tokenManagerAddress, "uri");
  await moxiePass.connect(minter).mint(stakingAddress, "uri");


  const reserveRatio = 660000;
  const initialSupply = "10000000000000000000000";
  const initialReserve = "10000000000000000000000";

  await tokenManager
   .connect(owner)
   .grantRole(await tokenManager.CREATE_ROLE(), subjectFactory.address);
  const passVerifierAddress = await moxiePassVerifier.getAddress();
  await tokenManager
   .connect(subjectFactory)
   .create(subject, "test", "test", initialSupply, passVerifierAddress);

  const subjectTokenAddress = await tokenManager.tokens(subject.address);
  const subjectToken = SubjectERC20.attach(
   subjectTokenAddress,
  ) as unknown as SubjectERC20Type;

  await moxieToken
   .connect(owner)
   .transfer(subjectFactory.address, initialReserve);

  // allow bonding curve to mint tokens
  await tokenManager
   .connect(owner)
   .grantRole(await tokenManager.MINT_ROLE(), moxieBondingCurveAddress);

  // allow transfer role to moxie bonding curve
  await vaultInstance
   .connect(owner)
   .grantRole(await vaultInstance.TRANSFER_ROLE(), moxieBondingCurveAddress);

  await vaultInstance
   .connect(owner)
   .grantRole(await vaultInstance.DEPOSIT_ROLE(), moxieBondingCurveAddress);
  // sending buyer & buyer2 some moxie tokens
  await moxieToken
   .connect(owner)
   .transfer(buyer.address, (1 * 1e20).toString());

  const buyAmount = (1 * 1e19).toString();

  await moxieToken
   .connect(subjectFactory)
   .approve(moxieBondingCurveAddress, initialReserve);

  await moxieBondingCurve
   .connect(subjectFactory)
   .initializeSubjectBondingCurve(
    subject.address,
    reserveRatio,
    initialSupply,
    initialReserve,
   )
  // first buyer
  await moxieToken
   .connect(buyer)
   .approve(moxieBondingCurveAddress, buyAmount);


  await moxiePass.connect(minter).mint(buyer.address, "uri");

  await moxieBondingCurve
   .connect(buyer)
   .buySharesFor(subject.address, buyAmount, buyer.address, 0)


  await moxieToken
   .connect(owner)
   .transfer(buyer2.address, (1 * 1e20).toString());
  const PCT_BASE = BigInt(10 ** 18);


  return {
   owner,
   minter,
   deployer,
   feeBeneficiary,
   moxieToken,
   formula,
   vaultInstance,
   tokenManager,
   moxiePassVerifier,
   moxiePass,
   moxieBondingCurve,
   protocolBuyFeePct,
   protocolSellFeePct,
   subjectBuyFeePct,
   subjectSellFeePct,
   subjectFactory,
   moxieTokenAddress,
   formulaAddress,
   tokenManagerAddress,
   vaultAddress,
   feeInput,
   subject,
   moxieBondingCurveAddress,
   subjectToken,
   initialSupply,
   initialReserve,
   reserveRatio,
   subjectTokenAddress,
   buyer,
   seller,
   buyer2,
   seller2,
   PCT_BASE,
   staking,
   lockTime,
   otherAccounts,
  };
 };
 describe("GetLockPeriod", () => {
  it("should return the lock period", async () => {
   const { staking, lockTime } = await deploy();
   const result = await staking.getLockPeriod();
   expect(result).to.eq(lockTime);
  });
 })

 describe('depositAndLock', () => {
  it('should deposit and lock tokens', async () => {
   const { staking, buyer, subject, subjectToken, initialSupply, lockTime } = await deploy();
   let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
   await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
   // get block number
   const latestBlock = await hre.ethers.provider.getBlock("latest")
   await expect(staking.connect(buyer).depositAndLock(subject, fanTokenBalance)).to.emit(staking, 'Deposit').withArgs(
    buyer.address,
    subject.address, await subjectToken.getAddress(), 0, fanTokenBalance, anyValue);
   let lockInfo = await staking.getLockInfo(0)
   expect(lockInfo.amount).to.eq(fanTokenBalance);
   expect(lockInfo.subject).to.eq(subject.address);
   expect(lockInfo.subjectToken).to.eq(await subjectToken.getAddress());
   expect(lockInfo.amount).to.eq(fanTokenBalance);
  })
 })


});
