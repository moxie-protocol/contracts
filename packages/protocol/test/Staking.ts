import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { SubjectERC20 as SubjectERC20Type } from "../typechain-types";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
// import {
//  getExpectedSellReturnAndFee,
//  getExpectedBuyAmountAndFee,
// } from "./utils";
const zeroAddress = "0x0000000000000000000000000000000000000000";
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
  const Staking = await hre.ethers.getContractFactory("Staking");
  const ProtocolRewards = await hre.ethers.getContractFactory("ProtocolRewards");

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
    ProtocolRewards
  };
};

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
      subject2,
      stakingAdmin,
      changeLockRole,
      pauseRole,
      orderReferrer,
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
      Staking,
      ProtocolRewards
    } = await getFactories();
    // moxie Token
    const moxieToken = await MoxieToken.connect(owner).deploy();

    // formula deployment
    const formula = await BancorFormula.deploy();

    // vault deployment
    const vaultInstance = await Vault.deploy({ from: deployer.address });

    await vaultInstance.connect(deployer).initialize(owner.address);
    // subject deployment
    const subjectErc20 = await SubjectERC20.deploy({ from: deployer.address });
    const subjectErc20Address = await subjectErc20.getAddress();

    // Moxie Pass
    const moxiePass = await MoxiePass.deploy(owner.address, minter.address);

    // moxie pass verifier
    const moxiePassVerifier = await MoxiePassVerifier.deploy(owner.address);
    await moxiePassVerifier
      .connect(owner)
      .setErc721ContractAddress(await moxiePass.getAddress());


    const tokenManager = await TokenManager.deploy({ from: deployer.address });
    await tokenManager
      .connect(deployer)
      .initialize(owner.address, subjectErc20Address);

    const lockTime = 60;
    // moxie Bonding curve
    const moxieBondingCurve = await MoxieBondingCurve.deploy();
    const staking = await Staking.deploy(
      { from: deployer.address },
    );


    await staking.connect(deployer).initialize(
      await tokenManager.getAddress(),
      await moxieBondingCurve.getAddress(),
      await moxieToken.getAddress(),
      stakingAdmin.address,
    )
    await staking.connect(stakingAdmin).grantRole(await staking.CHANGE_LOCK_DURATION(), changeLockRole.address);
    await staking
      .connect(stakingAdmin)
      .grantRole(await staking.PAUSE_ROLE(), pauseRole.address);
    await staking.connect(changeLockRole).setLockPeriod(lockTime, true)

    const stakingAddress = await staking.getAddress();
    const moxieTokenAddress = await moxieToken.getAddress();
    const formulaAddress = await formula.getAddress();
    const tokenManagerAddress = await tokenManager.getAddress();
    const vaultAddress = await vaultInstance.getAddress();
    const protocolBuyFeePct = (1e16).toString(); // 1%
    const protocolSellFeePct = (2 * 1e16).toString(); // 2%
    const subjectBuyFeePct = (3 * 1e16).toString(); // 3%
    const subjectSellFeePct = (4 * 1e16).toString(); // 4%

    const protocolRewards = await ProtocolRewards.deploy();
    await protocolRewards.initialize(moxieTokenAddress, owner);


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

    await moxieBondingCurve.connect(owner).grantRole(await moxieBondingCurve.UPDATE_PROTOCOL_REWARD_ROLE(), owner);
    await moxieBondingCurve.connect(owner).updateProtocolRewardAddress(await protocolRewards.getAddress());

    const referralFeeInput = {
      platformReferrerBuyFeePct: (10e16).toString(), //10%
      platformReferrerSellFeePct: (20e16).toString(), //20%,
      orderReferrerBuyFeePct: (30e16).toString(), //30%,
      orderReferrerSellFeePct: (40e16).toString() //40%
    };

    await moxieBondingCurve.connect(owner).grantRole(await moxieBondingCurve.UPDATE_FEES_ROLE(), owner);

    await moxieBondingCurve.connect(owner).updateReferralFee(
      referralFeeInput.platformReferrerBuyFeePct,
      referralFeeInput.platformReferrerSellFeePct,
      referralFeeInput.orderReferrerBuyFeePct,
      referralFeeInput.orderReferrerSellFeePct
    );


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
    await tokenManager
      .connect(subjectFactory)
      .create(subject2, "test2", "test2", initialSupply, passVerifierAddress);

    const subjectTokenAddress = await tokenManager.tokens(subject.address);
    const subjectToken = SubjectERC20.attach(
      subjectTokenAddress,
    ) as unknown as SubjectERC20Type;

    const subjectToken2Address = await tokenManager.tokens(subject2.address);
    const subjectToken2 = SubjectERC20.attach(
      subjectToken2Address,
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
        ethers.ZeroAddress
      );
    // first buyer
    await moxieToken
      .connect(buyer)
      .approve(moxieBondingCurveAddress, buyAmount);

    await moxiePass.connect(minter).mint(buyer.address, "uri");

    await moxieBondingCurve
      .connect(buyer)
      .buySharesFor(subject.address, buyAmount, buyer.address, 0);

    await moxieToken
      .connect(owner)
      .transfer(subjectFactory.address, initialReserve);
    await moxieToken
      .connect(subjectFactory)
      .approve(moxieBondingCurveAddress, initialReserve);

    await moxieBondingCurve
      .connect(subjectFactory)
      .initializeSubjectBondingCurve(
        subject2.address,
        reserveRatio,
        initialSupply,
        initialReserve,
        ethers.ZeroAddress
      );

    await moxieToken
      .connect(buyer)
      .approve(moxieBondingCurveAddress, buyAmount);

    await moxieBondingCurve
      .connect(buyer)
      .buySharesFor(subject2.address, buyAmount, buyer.address, 0);

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
      staking,
      lockTime,
      otherAccounts,
      subjectToken2,
      subjectToken2Address,
      subject2,
      stakingAdmin,
      changeLockRole,
      stakingAddress,
      pauseRole,
      orderReferrer,
      protocolRewards,
      referralFeeInput,
      PCT_BASE
    };
  };

  describe("deployment", () => {
    it("should initialise if already initialised", async () => {
      const { deployer, staking } = await loadFixture(deploy);
      await expect(staking.connect(deployer).initialize(
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
      )).to.be.revertedWithCustomError(staking, "InvalidInitialization");
    });
  });


  describe("validations", () => {
    it("should revert if invalid tokenmanager is set", async () => {
      const { deployer, moxieBondingCurve, moxieToken, stakingAdmin } =
        await loadFixture(deploy);
      const Staking = await hre.ethers.getContractFactory("Staking");
      const staking = await Staking.deploy(
        { from: deployer.address },
      );

      await expect(staking.connect(deployer).initialize(zeroAddress, await moxieBondingCurve.getAddress(), await moxieToken.getAddress(), stakingAdmin.address))
        .to.be.revertedWithCustomError(staking, "Staking_InvalidTokenManager");
    });

    it("should revert if invalid bonding curve is set", async () => {
      const { deployer, tokenManager, moxieToken, stakingAdmin } =
        await loadFixture(deploy);
      const Staking = await hre.ethers.getContractFactory("Staking");
      const staking = await Staking.deploy(
        { from: deployer.address },
      );

      await expect(staking.connect(deployer).initialize(await tokenManager.getAddress(), zeroAddress, await moxieToken.getAddress(), stakingAdmin.address))
        .to.be.revertedWithCustomError(staking, "Staking_InvalidMoxieBondingCurve");
    });

    it("should revert if invalid moxie token is set", async () => {
      const { deployer, tokenManager, moxieBondingCurve, stakingAdmin } =
        await loadFixture(deploy);
      const Staking = await hre.ethers.getContractFactory("Staking");
      const staking = await Staking.deploy(
        { from: deployer.address },
      );

      await expect(staking.connect(deployer).initialize(await tokenManager.getAddress(), await moxieBondingCurve.getAddress(), zeroAddress, stakingAdmin.address))
        .to.be.revertedWithCustomError(staking, "Staking_InvalidMoxieToken");
    });

    it("should revert if invalid staking admin is set", async () => {
      const { deployer, tokenManager, moxieBondingCurve, moxieToken } =
        await loadFixture(deploy);
      const Staking = await hre.ethers.getContractFactory("Staking");
      const staking = await Staking.deploy(
        { from: deployer.address },
      );

      await expect(staking.connect(deployer).initialize(await tokenManager.getAddress(), await moxieBondingCurve.getAddress(), await moxieToken.getAddress(), zeroAddress))
        .to.be.revertedWithCustomError(staking, "Staking_InvalidDefaultAdmin");
    });
  });

  describe("setLockPeriod", () => {
    it("should set the lock period", async () => {
      const { staking, changeLockRole, lockTime } = await loadFixture(deploy);
      const newLockTime = 100;
      await expect(staking.connect(changeLockRole).setLockPeriod(newLockTime, true))
        .to.emit(staking, "LockPeriodUpdated")
        .withArgs(newLockTime, true);
      const result = await staking.lockPeriodsInSec(newLockTime);
      expect(result).to.true;
      const result2 = await staking.lockPeriodsInSec(lockTime);
      expect(result2).to.true;
      await expect(staking.connect(changeLockRole).setLockPeriod(newLockTime, false))
        .to.emit(staking, "LockPeriodUpdated")
        .withArgs(newLockTime, false);

      const result3 = await staking.lockPeriodsInSec(newLockTime);
      expect(result3).to.false;
    });

    it("should revert if lockperiod is already set", async () => {
      const { staking, changeLockRole, lockTime } = await loadFixture(deploy);
      await expect(staking.connect(changeLockRole).setLockPeriod(lockTime, true))
        .to.be.revertedWithCustomError(staking, "Staking_LockPeriodAlreadySet");
    });
    it("should revert if not called by correct role", async () => {
      const { staking, stakingAdmin } = await loadFixture(deploy);
      const newLockTime = 100;

      await expect(
        staking.connect(stakingAdmin).setLockPeriod(newLockTime, true),
      ).to.be.revertedWithCustomError(
        staking,
        "AccessControlUnauthorizedAccount",
      );
    });
  });

  describe("depositAndLock", () => {

    it("should deposit and lock tokens", async () => {
      const {
        staking,
        buyer,
        subject,
        subjectToken,
        lockTime,
        stakingAddress,
      } = await loadFixture(deploy);
      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);

      const block = await hre.ethers.provider.getBlock('latest');

      const expectedUnlockTime = block!.timestamp + lockTime + 1;
      const balanceBefore = await subjectToken.balanceOf(stakingAddress);
      await expect(
        staking.connect(buyer).depositAndLock(subject, fanTokenBalance, lockTime),
      )
        .to.emit(staking, "Lock")
        .withArgs(
          buyer.address,
          subject.address,
          await subjectToken.getAddress(),
          0,
          fanTokenBalance,
          expectedUnlockTime,
          lockTime,
          ethers.ZeroAddress,
          0
        );
      const balanceAfter = await subjectToken.balanceOf(stakingAddress);
      const lockInfo = await staking.locks(0);

      expect(lockInfo.user).to.eq(buyer.address);
      expect(lockInfo.lockPeriodInSec).to.eq(lockTime);
      expect(lockInfo.amount).to.eq(fanTokenBalance);
      expect(lockInfo.subject).to.eq(subject.address);
      expect(lockInfo.subjectToken).to.eq(await subjectToken.getAddress());
      expect(lockInfo.unlockTimeInSec).to.eq(expectedUnlockTime);

      expect(balanceAfter - balanceBefore).to.eq(fanTokenBalance);
    });

    it("should allow multiple deposits", async () => {
      const { staking, buyer, subject, subjectToken, lockTime, stakingAddress } =
        await loadFixture(deploy);
      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      let block = await hre.ethers.provider.getBlock('latest');
      let expectedUnlockTime = block!.timestamp + lockTime + 1;
      const balanceBefore = await subjectToken.balanceOf(stakingAddress);
      const halfBalance = BigInt(fanTokenBalance) / BigInt(2);
      await expect(staking.connect(buyer).depositAndLock(subject, halfBalance, lockTime))
        .to.emit(staking, "Lock")
        .withArgs(
          buyer.address,
          subject.address,
          await subjectToken.getAddress(),
          0,
          halfBalance,
          expectedUnlockTime,
          lockTime,
          ethers.ZeroAddress,
          0
        );

      block = await hre.ethers.provider.getBlock('latest');
      expectedUnlockTime = block!.timestamp + lockTime + 1;
      await expect(staking.connect(buyer).depositAndLock(subject, halfBalance, lockTime))
        .to.emit(staking, "Lock")
        .withArgs(
          buyer.address,
          subject.address,
          await subjectToken.getAddress(),
          1,
          halfBalance,
          expectedUnlockTime,
          lockTime,
          ethers.ZeroAddress,
          0
        );
      const balanceAfter = await subjectToken.balanceOf(stakingAddress);

      expect(balanceAfter - balanceBefore).to.eq(2n * halfBalance);
    });

    it("should revert if amount is zero", async () => {
      const { staking, buyer, subject, subjectToken, lockTime } =
        await loadFixture(deploy);
      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      // get block number
      await expect(
        staking.connect(buyer).depositAndLock(subject, 0, lockTime),
      ).to.be.revertedWithCustomError(staking, "Staking_AmountShouldBeGreaterThanZero");
    });

    it("should revert if subject is invalid", async () => {
      const { staking, buyer, subjectToken, lockTime } =
        await loadFixture(deploy);
      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);

      await expect(
        staking.connect(buyer).depositAndLock(zeroAddress, "1", lockTime),
      ).to.be.revertedWithCustomError(staking, "Staking_InvalidSubject");
    });

    it("should revert if subject token not found", async () => {
      const { staking, buyer, lockTime } =
        await loadFixture(deploy);

      await expect(staking.connect(buyer).depositAndLock(buyer.address, 1, lockTime))
        .to.be.revertedWithCustomError(staking, "Staking_InvalidSubjectToken");
    });

    it("should revert if subject token allowance is insufficient", async () => {
      const { staking, buyer, subject, lockTime, subjectToken } =
        await loadFixture(deploy);

      await expect(staking.connect(buyer).depositAndLock(subject, 1, lockTime))
        .to.be.revertedWithCustomError(subjectToken, "ERC20InsufficientAllowance");
    });

    it("should revert if subject token balance is insufficient", async () => {
      const { staking, buyer, subject, lockTime, subjectToken } =
        await loadFixture(deploy);

      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);

      const depositAmount = BigInt(fanTokenBalance) + BigInt("1");
      await subjectToken.connect(buyer).approve(staking, depositAmount);

      await expect(staking.connect(buyer).depositAndLock(subject, depositAmount, lockTime))
        .to.be.revertedWithCustomError(subjectToken, "ERC20InsufficientBalance");
    });

    it("should revert if lock period is not allowed", async () => {
      const { staking, buyer, subject } =
        await loadFixture(deploy);

      const randomLockTime = 100;
      await expect(staking.connect(buyer).depositAndLock(subject, 1, randomLockTime))
        .to.be.revertedWithCustomError(staking, "Staking_InvalidLockPeriod");
    });

    it("should work with paused & unpause", async () => {
      const { staking, buyer, subject, subjectToken, lockTime, stakingAdmin, owner, pauseRole } =
        await loadFixture(deploy);
      await staking.connect(pauseRole).pause();
      await expect(staking.connect(buyer).depositAndLock(subject, 1, lockTime))
        .to.be.revertedWithCustomError(staking, "EnforcedPause");
      await staking.connect(pauseRole).unpause();

      await expect(staking.connect(buyer).depositAndLock(subject, 1, lockTime))
        .not.to.be.revertedWithCustomError(staking, "EnforcedPause");
    })
  });

  describe("depositAndLockFor", () => {

    it("should deposit and lock tokens for a beneficiary", async () => {
      const { staking, buyer, subject, subjectToken, lockTime, owner, stakingAddress } =
        await loadFixture(deploy);
      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);

      const block = await hre.ethers.provider.getBlock('latest');
      const balanceBefore = await subjectToken.balanceOf(stakingAddress);
      const expectedUnlockTime = block!.timestamp + lockTime + 1;
      await expect(
        staking.connect(buyer).depositAndLockFor(subject, fanTokenBalance, lockTime, owner.address),
      )
        .to.emit(staking, "Lock")
        .withArgs(
          owner.address,
          subject.address,
          await subjectToken.getAddress(),
          0,
          fanTokenBalance,
          expectedUnlockTime,
          lockTime,
          ethers.ZeroAddress,
          0
        );

      const lockInfo = await staking.locks(0);

      expect(lockInfo.user).to.eq(owner.address);
      expect(lockInfo.lockPeriodInSec).to.eq(lockTime);
      expect(lockInfo.amount).to.eq(fanTokenBalance);
      expect(lockInfo.subject).to.eq(subject.address);
      expect(lockInfo.subjectToken).to.eq(await subjectToken.getAddress());
      expect(lockInfo.unlockTimeInSec).to.eq(expectedUnlockTime);
      const balanceAfter = await subjectToken.balanceOf(stakingAddress);

      expect(balanceAfter - balanceBefore).to.eq(fanTokenBalance);
    });

    it("should allow multiple deposits for a beneficiary", async () => {
      const {
        staking,
        buyer,
        subject,
        subjectToken,
        lockTime,
        owner,
        stakingAddress,
      } = await loadFixture(deploy);
      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      let block = await hre.ethers.provider.getBlock('latest');
      let expectedUnlockTime = block!.timestamp + lockTime + 1;

      const balanceBefore = await subjectToken.balanceOf(stakingAddress);
      const halfBalance = BigInt(fanTokenBalance) / BigInt(2);
      await expect(staking.connect(buyer).depositAndLockFor(subject, halfBalance, lockTime, owner.address))
        .to.emit(staking, "Lock")
        .withArgs(
          owner.address,
          subject.address,
          await subjectToken.getAddress(),
          0,
          halfBalance,
          expectedUnlockTime,
          lockTime,
          ethers.ZeroAddress,
          0
        );

      block = await hre.ethers.provider.getBlock('latest');
      expectedUnlockTime = block!.timestamp + lockTime + 1;
      await expect(staking.connect(buyer).depositAndLockFor(subject, halfBalance, lockTime, owner.address))
        .to.emit(staking, "Lock")
        .withArgs(
          owner.address,
          subject.address,
          await subjectToken.getAddress(),
          1,
          halfBalance,
          expectedUnlockTime,
          lockTime,
          ethers.ZeroAddress,
          0
        );
      const balanceAfter = await subjectToken.balanceOf(stakingAddress);

      expect(balanceAfter - balanceBefore).to.eq(2n * halfBalance);
    });

    it("should revert if amount is zero", async () => {
      const { staking, buyer, subject, subjectToken, lockTime, owner } =
        await loadFixture(deploy);
      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      // get block number
      await expect(
        staking.connect(buyer).depositAndLockFor(subject, 0, lockTime, owner.address),
      ).to.be.revertedWithCustomError(staking, "Staking_AmountShouldBeGreaterThanZero");
    });

    it("should revert if subject is invalid", async () => {
      const { staking, buyer, subjectToken, lockTime, owner } =
        await loadFixture(deploy);
      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);

      await expect(
        staking.connect(buyer).depositAndLockFor(zeroAddress, "1", lockTime, owner.address),
      ).to.be.revertedWithCustomError(staking, "Staking_InvalidSubject");
    });

    it("should revert if subject token not found", async () => {
      const { staking, buyer, lockTime, owner } =
        await loadFixture(deploy);

      await expect(staking.connect(buyer).depositAndLockFor(buyer.address, 1, lockTime, owner.address))
        .to.be.revertedWithCustomError(staking, "Staking_InvalidSubjectToken");
    });

    it("should revert if subject token cannot be transferred", async () => {
      const { staking, buyer, subject, lockTime, subjectToken, owner } =
        await loadFixture(deploy);

      await expect(staking.connect(buyer).depositAndLockFor(subject, 1, lockTime, owner.address))
        .to.be.revertedWithCustomError(subjectToken, "ERC20InsufficientAllowance");
    });

    it("should revert if subject token balance is insufficient", async () => {
      const { staking, buyer, subject, lockTime, subjectToken, owner } =
        await loadFixture(deploy);

      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);

      const depositAmount = BigInt(fanTokenBalance) + BigInt("1");
      await subjectToken.connect(buyer).approve(staking, depositAmount);

      await expect(staking.connect(buyer).depositAndLockFor(subject, depositAmount, lockTime, owner.address))
        .to.be.revertedWithCustomError(subjectToken, "ERC20InsufficientBalance");
    });

    it("should revert if lock period is not allowed", async () => {
      const { staking, buyer, subject, owner } =
        await loadFixture(deploy);

      const randomLockTime = 100;
      await expect(staking.connect(buyer).depositAndLockFor(subject, 1, randomLockTime, owner.address))
        .to.be.revertedWithCustomError(staking, "Staking_InvalidLockPeriod");
    });

    it("should revert if paused & unpause", async () => {
      const { staking, buyer, subject, subjectToken, lockTime, stakingAdmin, owner, pauseRole } =
        await loadFixture(deploy);
      let tx = await staking.connect(pauseRole).pause();
      await expect(staking.connect(buyer).depositAndLockFor(subject, 1, lockTime, owner.address))
        .to.be.revertedWithCustomError(staking, "EnforcedPause");
      tx = await staking.connect(pauseRole).unpause();
      await expect(staking.connect(buyer).depositAndLockFor(subject, 1, lockTime, owner.address))
        .not.to.be.revertedWithCustomError(staking, "EnforcedPause");
    })

  });

  describe("depositAndLockMultiple", () => {
    it("should deposit and lock tokens", async () => {
      const {
        staking,
        buyer,
        subject,
        subjectToken,
        subject2,
        subjectToken2,
        lockTime,
        stakingAddress,
      } = await loadFixture(deploy);
      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      const fanTokenBalance2 = await subjectToken2.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      await subjectToken2.connect(buyer).approve(staking, fanTokenBalance2);

      const block = await hre.ethers.provider.getBlock('latest');
      const expectedUnlockTime = block!.timestamp + lockTime + 1;

      const balanceBefore1 = await subjectToken.balanceOf(stakingAddress);
      const balanceBefore2 = await subjectToken2.balanceOf(stakingAddress);
      // get block number
      await expect(
        staking.connect(buyer).depositAndLockMultiple([subject, subject2], [fanTokenBalance, fanTokenBalance2], lockTime),
      )
        .to.emit(staking, "Lock")
        .withArgs(
          buyer.address,
          subject.address,
          await subjectToken.getAddress(),
          0,
          fanTokenBalance,
          expectedUnlockTime,
          lockTime,
          ethers.ZeroAddress,
          0
        ).to.emit(staking, "Lock")
        .withArgs(
          buyer.address,
          subject2.address,
          await subjectToken2.getAddress(),
          1,
          fanTokenBalance2,
          expectedUnlockTime,
          lockTime,
          ethers.ZeroAddress,
          0
        );
      let lockInfo = await staking.locks(0);
      expect(lockInfo.unlockTimeInSec).to.eq(expectedUnlockTime);
      expect(lockInfo.lockPeriodInSec).to.eq(lockTime);
      expect(lockInfo.user).to.eq(buyer.address);
      expect(lockInfo.amount).to.eq(fanTokenBalance);
      expect(lockInfo.subject).to.eq(subject.address);
      expect(lockInfo.subjectToken).to.eq(await subjectToken.getAddress());

      lockInfo = await staking.locks(1)
      expect(lockInfo.unlockTimeInSec).to.eq(expectedUnlockTime);
      expect(lockInfo.lockPeriodInSec).to.eq(lockTime);
      expect(lockInfo.user).to.eq(buyer.address)
      expect(lockInfo.amount).to.eq(fanTokenBalance2);
      expect(lockInfo.subject).to.eq(subject2.address);
      expect(lockInfo.subjectToken).to.eq(await subjectToken2.getAddress());

      const balanceAfter1 = await subjectToken.balanceOf(stakingAddress);
      const balanceAfter2 = await subjectToken2.balanceOf(stakingAddress);

      expect(balanceAfter2 - balanceBefore2).to.eq(fanTokenBalance2);
      expect(balanceAfter1 - balanceBefore1).to.eq(fanTokenBalance);

    });

    it("should revert input passed are of incorrect length", async () => {
      const { staking, buyer, subject, subjectToken, subjectToken2, subject2, lockTime } =
        await loadFixture(deploy);
      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      const fanTokenBalance2 = await subjectToken2.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      await subjectToken2.connect(buyer).approve(staking, fanTokenBalance2);
      await expect(
        staking.connect(buyer).depositAndLockMultiple([subject, subject2], [fanTokenBalance], lockTime),
      ).to.be.revertedWithCustomError(staking, "Staking_InvalidInputLength");

      await expect(
        staking.connect(buyer).depositAndLockMultiple([subject], [fanTokenBalance, fanTokenBalance2], lockTime),
      ).to.be.revertedWithCustomError(staking, "Staking_InvalidInputLength");
    });

    it("should revert if amount is zero", async () => {
      const { staking, buyer, subject, subjectToken, lockTime } =
        await loadFixture(deploy);
      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      // get block number
      await expect(
        staking.connect(buyer).depositAndLockMultiple([subject], [0], lockTime),
      ).to.be.revertedWithCustomError(staking, "Staking_AmountShouldBeGreaterThanZero");
    });

    it("should revert if subject is invalid", async () => {
      const { staking, buyer, subjectToken, lockTime } =
        await loadFixture(deploy);
      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);

      await expect(
        staking.connect(buyer).depositAndLockMultiple([zeroAddress], [1], lockTime),
      ).to.be.revertedWithCustomError(staking, "Staking_InvalidSubject");
    });

    it("should revert if subject token not found", async () => {
      const { staking, buyer, lockTime } =
        await loadFixture(deploy);

      await expect(staking.connect(buyer).depositAndLockMultiple([buyer.address], [1], lockTime))
        .to.be.revertedWithCustomError(staking, "Staking_InvalidSubjectToken");
    });

    it("should revert if subject token allowance is insufficient", async () => {
      const { staking, buyer, subject, lockTime, subjectToken } =
        await loadFixture(deploy);

      await expect(staking.connect(buyer).depositAndLockMultiple([subject], [1], lockTime))
        .to.be.revertedWithCustomError(subjectToken, "ERC20InsufficientAllowance");
    });

    it("should revert if subject token balance is insufficient", async () => {
      const { staking, buyer, subject, lockTime, subjectToken } =
        await loadFixture(deploy);

      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);

      const depositAmount = BigInt(fanTokenBalance) + BigInt("1");
      await subjectToken.connect(buyer).approve(staking, depositAmount);

      await expect(staking.connect(buyer).depositAndLockMultiple([subject], [depositAmount], lockTime))
        .to.be.revertedWithCustomError(subjectToken, "ERC20InsufficientBalance");
    });


    it("should revert if lock period is not allowed", async () => {
      const { staking, buyer, subject } =
        await loadFixture(deploy);

      const randomLockTime = 100;
      await expect(staking.connect(buyer).depositAndLockMultiple([subject], [1], randomLockTime))
        .to.be.revertedWithCustomError(staking, "Staking_InvalidLockPeriod");
    });

    it("should revert if paused & unpause", async () => {
      const { staking, buyer, subject, subjectToken, lockTime, stakingAdmin, owner, pauseRole } =
        await loadFixture(deploy);
      let tx = await staking.connect(pauseRole).pause();
      await expect(staking.connect(buyer).depositAndLockMultiple([subject], [1], lockTime))
        .to.be.revertedWithCustomError(staking, "EnforcedPause");
      tx = await staking.connect(pauseRole).unpause();
      await expect(staking.connect(buyer).depositAndLockMultiple([subject], [1], lockTime))
        .not.to.be.revertedWithCustomError(staking, "EnforcedPause");
    })



  });

  describe("depositAndLockMultipleFor", () => {
    it("should deposit and lock tokens", async () => {
      const { staking, buyer, subject, subjectToken, subject2, subjectToken2, lockTime, owner, stakingAddress } =
        await loadFixture(deploy);
      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      const fanTokenBalance2 = await subjectToken2.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      await subjectToken2.connect(buyer).approve(staking, fanTokenBalance2);

      const block = await hre.ethers.provider.getBlock('latest');
      const expectedUnlockTime = block!.timestamp + lockTime + 1;

      const balanceBefore1 = await subjectToken.balanceOf(stakingAddress);
      const balanceBefore2 = await subjectToken2.balanceOf(stakingAddress);
      await expect(
        staking.connect(buyer).depositAndLockMultipleFor([subject, subject2], [fanTokenBalance, fanTokenBalance2], lockTime, owner.address),
      )
        .to.emit(staking, "Lock")
        .withArgs(
          owner.address,
          subject.address,
          await subjectToken.getAddress(),
          0,
          fanTokenBalance,
          expectedUnlockTime,
          lockTime,
          ethers.ZeroAddress,
          0
        ).to.emit(staking, "Lock")
        .withArgs(
          owner.address,
          subject2.address,
          await subjectToken2.getAddress(),
          1,
          fanTokenBalance2,
          expectedUnlockTime,
          lockTime,
          ethers.ZeroAddress,
          0
        );
      let lockInfo = await staking.locks(0);
      expect(lockInfo.unlockTimeInSec).to.eq(expectedUnlockTime);
      expect(lockInfo.lockPeriodInSec).to.eq(lockTime);
      expect(lockInfo.user).to.eq(owner.address);
      expect(lockInfo.amount).to.eq(fanTokenBalance);
      expect(lockInfo.subject).to.eq(subject.address);
      expect(lockInfo.subjectToken).to.eq(await subjectToken.getAddress());

      lockInfo = await staking.locks(1)
      expect(lockInfo.unlockTimeInSec).to.eq(expectedUnlockTime);
      expect(lockInfo.lockPeriodInSec).to.eq(lockTime);
      expect(lockInfo.user).to.eq(owner.address)
      expect(lockInfo.amount).to.eq(fanTokenBalance2);
      expect(lockInfo.subject).to.eq(subject2.address);
      expect(lockInfo.subjectToken).to.eq(await subjectToken2.getAddress());

      const balanceAfter1 = await subjectToken.balanceOf(stakingAddress);
      const balanceAfter2 = await subjectToken2.balanceOf(stakingAddress);

      expect(balanceAfter2 - balanceBefore2).to.eq(fanTokenBalance2);
      expect(balanceAfter1 - balanceBefore1).to.eq(fanTokenBalance);
    });

    it("should revert input passed are of incorrect length", async () => {
      const { staking, buyer, subject, subjectToken, subjectToken2, subject2, lockTime, owner } =
        await loadFixture(deploy);
      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      const fanTokenBalance2 = await subjectToken2.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      await subjectToken2.connect(buyer).approve(staking, fanTokenBalance2);
      await expect(
        staking.connect(buyer).depositAndLockMultipleFor([subject, subject2], [fanTokenBalance], lockTime, owner.address),
      ).to.be.revertedWithCustomError(staking, "Staking_InvalidInputLength");

      await expect(
        staking.connect(buyer).depositAndLockMultipleFor([subject], [fanTokenBalance, fanTokenBalance2], lockTime, owner.address),
      ).to.be.revertedWithCustomError(staking, "Staking_InvalidInputLength");
    });

    it("should revert if amount is zero", async () => {
      const { staking, buyer, subject, subjectToken, lockTime, owner } =
        await loadFixture(deploy);
      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      // get block number
      await expect(
        staking.connect(buyer).depositAndLockMultipleFor([subject], [0], lockTime, owner.address),
      ).to.be.revertedWithCustomError(staking, "Staking_AmountShouldBeGreaterThanZero");
    });

    it("should revert if subject is invalid", async () => {
      const { staking, buyer, subjectToken, lockTime, owner } =
        await loadFixture(deploy);
      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);

      await expect(
        staking.connect(buyer).depositAndLockMultipleFor([zeroAddress], [1], lockTime, owner.address),
      ).to.be.revertedWithCustomError(staking, "Staking_InvalidSubject");
    });

    it("should revert if subject token not found", async () => {
      const { staking, buyer, lockTime, owner } =
        await loadFixture(deploy);

      await expect(staking.connect(buyer).depositAndLockMultipleFor([buyer.address], [1], lockTime, owner.address))
        .to.be.revertedWithCustomError(staking, "Staking_InvalidSubjectToken");
    });

    it("should revert if subject token allowance is insufficient", async () => {
      const { staking, buyer, subject, lockTime, subjectToken, owner } =
        await loadFixture(deploy);

      await expect(staking.connect(buyer).depositAndLockMultipleFor([subject], [1], lockTime, owner.address))
        .to.be.revertedWithCustomError(subjectToken, "ERC20InsufficientAllowance");
    });

    it("should revert if subject token balance is insufficient", async () => {
      const { staking, buyer, subject, lockTime, subjectToken, owner } =
        await loadFixture(deploy);

      const fanTokenBalance = await subjectToken.balanceOf(buyer.address);

      const depositAmount = BigInt(fanTokenBalance) + BigInt("1");
      await subjectToken.connect(buyer).approve(staking, depositAmount);

      await expect(staking.connect(buyer).depositAndLockMultipleFor([subject], [depositAmount], lockTime, owner.address))
        .to.be.revertedWithCustomError(subjectToken, "ERC20InsufficientBalance");
    });


    it("should revert if lock period is not allowed", async () => {
      const { staking, buyer, subject, owner } =
        await loadFixture(deploy);

      const randomLockTime = 100;
      await expect(staking.connect(buyer).depositAndLockMultipleFor([subject], [1], randomLockTime, owner.address))
        .to.be.revertedWithCustomError(staking, "Staking_InvalidLockPeriod");
    });


    it("should work if paused & unpaused", async () => {
      const { staking, buyer, subject, subjectToken, lockTime, stakingAdmin, owner, pauseRole } =
        await loadFixture(deploy);
      let tx = await staking.connect(pauseRole).pause();
      await expect(staking.connect(buyer).depositAndLockMultipleFor([subject], [1], lockTime, owner.address))
        .to.be.revertedWithCustomError(staking, "EnforcedPause");
      tx = await staking.connect(pauseRole).unpause();
      await expect(staking.connect(buyer).depositAndLockMultipleFor([subject], [1], lockTime, owner.address))
        .not.to.be.revertedWithCustomError(staking, "EnforcedPause");

    })
  });

  describe("buyAndLock", () => {

    it("should buy and lock tokens", async () => {
      const {
        staking,
        subject,
        subjectToken,
        lockTime,
        owner,
        moxieToken,
        stakingAddress,
        moxieBondingCurve

      } = await loadFixture(deploy);
      const amt = (10e18).toString();

      const estimatedBuyAmount = await moxieBondingCurve.calculateTokensForBuy(subject.address, amt);
      await moxieToken.connect(owner).approve(stakingAddress, estimatedBuyAmount.moxieAmount_);

      const block = await hre.ethers.provider.getBlock('latest');

      const estimatedUnlockTime = block!.timestamp + lockTime + 1;

      const balanceBefore = await subjectToken.balanceOf(stakingAddress);
      await expect(
        staking.connect(owner).buyAndLock(subject.address, estimatedBuyAmount.moxieAmount_, 0, lockTime),
      )
        .to.emit(staking, "Lock")
        .withArgs(
          owner.address,
          subject.address,
          await subjectToken.getAddress(),
          0,
          amt,
          estimatedUnlockTime,
          lockTime,
          owner.address,
          estimatedBuyAmount.moxieAmount_
        );
      const lockInfo = await staking.locks(0);
      expect(lockInfo.unlockTimeInSec).to.eq(estimatedUnlockTime);
      expect(lockInfo.lockPeriodInSec).to.eq(lockTime);
      expect(lockInfo.user).to.eq(owner.address);
      expect(lockInfo.amount).to.eq(amt);
      expect(lockInfo.subject).to.eq(subject.address);
      expect(lockInfo.subjectToken).to.eq(await subjectToken.getAddress());

      const balanceAfter = await subjectToken.balanceOf(stakingAddress);
      expect(balanceAfter - balanceBefore).to.eq(amt);
    });

    it("should buy and lock tokens with order referrer", async () => {
      const {
        staking,
        subject,
        subjectToken,
        lockTime,
        owner,
        moxieToken,
        stakingAddress,
        moxieBondingCurve,
        orderReferrer,
        protocolRewards,
        referralFeeInput,
        PCT_BASE,
        feeInput
      } = await loadFixture(deploy);
      const amt = (10e18).toString();

      const estimatedBuyAmount = await moxieBondingCurve.calculateTokensForBuy(subject.address, amt);
      await moxieToken.connect(owner).approve(stakingAddress, estimatedBuyAmount.moxieAmount_);

      const block = await hre.ethers.provider.getBlock('latest');

      const estimatedUnlockTime = block!.timestamp + lockTime + 1;

      const balanceBefore = await subjectToken.balanceOf(stakingAddress);
      await expect(
        staking.connect(owner).buyAndLockV2(subject.address, estimatedBuyAmount.moxieAmount_, 0, lockTime, orderReferrer),
      )
        .to.emit(staking, "Lock")
        .withArgs(
          owner.address,
          subject.address,
          await subjectToken.getAddress(),
          0,
          amt,
          estimatedUnlockTime,
          lockTime,
          owner.address,
          estimatedBuyAmount.moxieAmount_
        );
      const lockInfo = await staking.locks(0);
      expect(lockInfo.unlockTimeInSec).to.eq(estimatedUnlockTime);
      expect(lockInfo.lockPeriodInSec).to.eq(lockTime);
      expect(lockInfo.user).to.eq(owner.address);
      expect(lockInfo.amount).to.eq(amt);
      expect(lockInfo.subject).to.eq(subject.address);
      expect(lockInfo.subjectToken).to.eq(await subjectToken.getAddress());

      const balanceAfter = await subjectToken.balanceOf(stakingAddress);
      expect(balanceAfter - balanceBefore).to.eq(amt);

      const orderReferrerAmount = BigInt(estimatedBuyAmount.moxieAmount_) * BigInt(feeInput.protocolBuyFeePct) * BigInt(referralFeeInput.orderReferrerBuyFeePct) / (PCT_BASE * PCT_BASE)
      expect(await protocolRewards.balanceOf(orderReferrer)).to.equal(
        orderReferrerAmount
      )
    });

    it("should revert with InvalidLockPeriod ", async () => {
      const { staking, buyer, subject, subjectToken } =
        await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      // get block number
      await expect(
        staking.connect(buyer).buyAndLock(subject, fanTokenBalance, 0, 100),
      ).to.be.revertedWithCustomError(staking, "Staking_InvalidLockPeriod");
    });

    it("should fail to buy and lock tokens with zero amount", async () => {
      const {
        staking,
        subject,
        lockTime,
        owner,
        moxieToken,
        stakingAddress,
        moxieBondingCurve

      } = await loadFixture(deploy);
      const amt = (10e18).toString();

      const estimatedBuyAmount = await moxieBondingCurve.calculateTokensForBuy(subject.address, amt);
      await moxieToken.connect(owner).approve(stakingAddress, estimatedBuyAmount.moxieAmount_);

      const block = await hre.ethers.provider.getBlock('latest');

      await expect(
        staking.connect(owner).buyAndLock(subject.address, 0, 0, lockTime),
      )
        .to.revertedWithCustomError(moxieBondingCurve, "MoxieBondingCurve_InvalidDepositAmount");
    });

    it("should fail to buy and lock token for invalid subject", async () => {
      const {
        staking,
        lockTime,
        owner,
        moxieToken,
        stakingAddress,
        moxieBondingCurve
      } = await loadFixture(deploy);
      const amt = (10e18).toString();

      await moxieToken.connect(owner).approve(stakingAddress, amt);
      await expect(
        staking.connect(owner).buyAndLock(zeroAddress, amt, 0, lockTime),
      )
        .to.revertedWithCustomError(moxieBondingCurve, "MoxieBondingCurve_InvalidSubject");
    })

    it("should fail to buy and lock tokens for insufficient allowance", async () => {
      const {
        staking,
        subject,
        lockTime,
        owner,
        moxieToken,

      } = await loadFixture(deploy);
      const amt = (10e18).toString();

      await expect(
        staking.connect(owner).buyAndLock(subject.address, amt, 0, lockTime),
      )
        .to.revertedWithCustomError(moxieToken, "ERC20InsufficientAllowance");
    });

    it("should fail to buy and lock tokens for insufficient balance", async () => {
      const {
        staking,
        subject,
        lockTime,
        moxieToken,
        stakingAddress,
        moxieBondingCurve,
        buyer

      } = await loadFixture(deploy);

      const amt = await moxieToken.balanceOf(buyer.address);

      const depositAmount = BigInt(amt) + BigInt("1");

      const estimatedBuyAmount = await moxieBondingCurve.calculateTokensForBuy(subject.address, amt);
      await moxieToken.connect(buyer).approve(stakingAddress, estimatedBuyAmount.moxieAmount_);

      await expect(
        staking.connect(buyer).buyAndLock(subject.address, depositAmount, 0, lockTime),
      )
        .to.revertedWithCustomError(moxieToken, "ERC20InsufficientBalance");
    });

    it("should work if paused & unpaused", async () => {
      const { staking, buyer, subject, moxieToken, lockTime, stakingAdmin, owner, pauseRole } =
        await loadFixture(deploy);
      let tx = await staking.connect(pauseRole).pause();
      const amt = await moxieToken.balanceOf(buyer.address);

      const depositAmount = BigInt(amt) + BigInt("1");
      await expect(staking.connect(buyer).buyAndLock(subject.address, depositAmount, 0, lockTime))
        .to.be.revertedWithCustomError(staking, "EnforcedPause");

      tx = await staking.connect(pauseRole).unpause();
      await expect(staking.connect(buyer).buyAndLock(subject.address, depositAmount, 0, lockTime))
        .not.to.be.revertedWithCustomError(staking, "EnforcedPause");
    })

  });

  describe("buyAndLockFor ", () => {

    it("should buy and lock tokens For beneficiary", async () => {
      const {
        staking,
        subject,
        subjectToken,
        lockTime,
        owner,
        moxieToken,
        moxieBondingCurve,
        buyer,
        stakingAddress
      } = await loadFixture(deploy);
      const amt = (10e18).toString();

      const estimatedBuyAmount = await moxieBondingCurve.calculateTokensForBuy(subject.address, amt);
      await moxieToken.connect(owner).approve(stakingAddress, estimatedBuyAmount.moxieAmount_);

      const block = await hre.ethers.provider.getBlock('latest');

      const balanceBefore = await subjectToken.balanceOf(stakingAddress);
      const estimatedUnlockTime = block!.timestamp + lockTime + 1;
      await expect(
        staking.connect(owner).buyAndLockFor(subject.address, estimatedBuyAmount.moxieAmount_, 0, lockTime, buyer.address),
      )
        .to.emit(staking, "Lock")
        .withArgs(
          buyer.address,
          subject.address,
          await subjectToken.getAddress(),
          0,
          amt,
          estimatedUnlockTime,
          lockTime,
          owner.address,
          estimatedBuyAmount.moxieAmount_
        );
      const lockInfo = await staking.locks(0);
      expect(lockInfo.unlockTimeInSec).to.eq(estimatedUnlockTime);
      expect(lockInfo.lockPeriodInSec).to.eq(lockTime);
      expect(lockInfo.user).to.eq(buyer.address);
      expect(lockInfo.amount).to.eq(amt);
      expect(lockInfo.subject).to.eq(subject.address);
      expect(lockInfo.subjectToken).to.eq(await subjectToken.getAddress());

      const balanceAfter = await subjectToken.balanceOf(stakingAddress);
      expect(balanceAfter - balanceBefore).to.eq(amt);
    });

    it("should buy and lock tokens For beneficiary with order referrer ", async () => {
      const {
        staking,
        subject,
        subjectToken,
        lockTime,
        owner,
        moxieToken,
        moxieBondingCurve,
        buyer,
        stakingAddress,
        orderReferrer,
        feeInput,
        referralFeeInput,
        protocolRewards,
        PCT_BASE
      } = await loadFixture(deploy);
      const amt = (10e18).toString();

      const estimatedBuyAmount = await moxieBondingCurve.calculateTokensForBuy(subject.address, amt);
      await moxieToken.connect(owner).approve(stakingAddress, estimatedBuyAmount.moxieAmount_);

      const block = await hre.ethers.provider.getBlock('latest');

      const balanceBefore = await subjectToken.balanceOf(stakingAddress);
      const estimatedUnlockTime = block!.timestamp + lockTime + 1;
      await expect(
        staking.connect(owner).buyAndLockForV2(subject.address, estimatedBuyAmount.moxieAmount_, 0, lockTime, buyer.address, orderReferrer),
      )
        .to.emit(staking, "Lock")
        .withArgs(
          buyer.address,
          subject.address,
          await subjectToken.getAddress(),
          0,
          amt,
          estimatedUnlockTime,
          lockTime,
          owner.address,
          estimatedBuyAmount.moxieAmount_
        );
      const lockInfo = await staking.locks(0);
      expect(lockInfo.unlockTimeInSec).to.eq(estimatedUnlockTime);
      expect(lockInfo.lockPeriodInSec).to.eq(lockTime);
      expect(lockInfo.user).to.eq(buyer.address);
      expect(lockInfo.amount).to.eq(amt);
      expect(lockInfo.subject).to.eq(subject.address);
      expect(lockInfo.subjectToken).to.eq(await subjectToken.getAddress());

      const balanceAfter = await subjectToken.balanceOf(stakingAddress);
      expect(balanceAfter - balanceBefore).to.eq(amt);

      const orderReferrerAmount = BigInt(estimatedBuyAmount.moxieAmount_) * BigInt(feeInput.protocolBuyFeePct) * BigInt(referralFeeInput.orderReferrerBuyFeePct) / (PCT_BASE * PCT_BASE)
      expect(await protocolRewards.balanceOf(orderReferrer)).to.equal(
        orderReferrerAmount
      )
    });

    it("should revert with InvalidLockPeriod ", async () => {
      const { staking, buyer, subject, subjectToken, owner } =
        await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      // get block number
      await expect(
        staking.connect(buyer).buyAndLockFor(subject, fanTokenBalance, 0, 100, owner.address),
      ).to.be.revertedWithCustomError(staking, "Staking_InvalidLockPeriod");
    });

    it("should fail to buy and lock tokens with zero amount", async () => {
      const {
        staking,
        subject,
        lockTime,
        owner,
        moxieToken,
        stakingAddress,
        moxieBondingCurve,
        buyer

      } = await loadFixture(deploy);
      const amt = (10e18).toString();

      const estimatedBuyAmount = await moxieBondingCurve.calculateTokensForBuy(subject.address, amt);
      await moxieToken.connect(owner).approve(stakingAddress, estimatedBuyAmount.moxieAmount_);

      const block = await hre.ethers.provider.getBlock('latest');

      await expect(
        staking.connect(owner).buyAndLockFor(subject.address, 0, 0, lockTime, buyer.address),
      )
        .to.revertedWithCustomError(moxieBondingCurve, "MoxieBondingCurve_InvalidDepositAmount");
    });

    it("should fail to buy and lock token for invalid subject", async () => {
      const {
        staking,
        lockTime,
        owner,
        moxieToken,
        stakingAddress,
        moxieBondingCurve,
        buyer
      } = await loadFixture(deploy);
      const amt = (10e18).toString();

      await moxieToken.connect(owner).approve(stakingAddress, amt);
      await expect(
        staking.connect(owner).buyAndLockFor(zeroAddress, amt, 0, lockTime, buyer.address),
      )
        .to.revertedWithCustomError(moxieBondingCurve, "MoxieBondingCurve_InvalidSubject");
    })

    it("should fail to buy and lock tokens for insufficient allowance", async () => {
      const {
        staking,
        subject,
        lockTime,
        owner,
        moxieToken,
        buyer

      } = await loadFixture(deploy);
      const amt = (10e18).toString();

      await expect(
        staking.connect(owner).buyAndLockFor(subject.address, amt, 0, lockTime, buyer.address),
      )
        .to.revertedWithCustomError(moxieToken, "ERC20InsufficientAllowance");
    });

    it("should fail to buy and lock tokens for insufficient balance", async () => {
      const {
        staking,
        subject,
        lockTime,
        owner,
        moxieToken,
        stakingAddress,
        moxieBondingCurve,
        buyer,

      } = await loadFixture(deploy);

      const amt = await moxieToken.balanceOf(buyer.address);

      const depositAmount = BigInt(amt) + BigInt("1");

      const estimatedBuyAmount = await moxieBondingCurve.calculateTokensForBuy(subject.address, amt);
      await moxieToken.connect(buyer).approve(stakingAddress, estimatedBuyAmount.moxieAmount_);

      await expect(
        staking.connect(buyer).buyAndLockFor(subject.address, depositAmount, 0, lockTime, owner.address),
      )
        .to.revertedWithCustomError(moxieToken, "ERC20InsufficientBalance");
    });

    it("should work if paused & unpaused", async () => {
      const { staking, buyer, subject, moxieToken, lockTime, stakingAdmin, owner, pauseRole } =
        await loadFixture(deploy);
      let tx = await staking.connect(pauseRole).pause();
      const amt = await moxieToken.balanceOf(buyer.address);

      const depositAmount = BigInt(amt) + BigInt("1");
      await expect(staking.connect(buyer).buyAndLockFor(subject.address, depositAmount, 0, lockTime, owner.address))
        .to.be.revertedWithCustomError(staking, "EnforcedPause");
      tx = await staking.connect(pauseRole).unpause();
      await expect(staking.connect(buyer).buyAndLockFor(subject.address, depositAmount, 0, lockTime, owner.address))
        .not.to.be.revertedWithCustomError(staking, "EnforcedPause");
    })

  });

  describe("buyAndLockMultiple", () => {

    it("should revert if lockduration is invalid", async () => {
      const { staking, buyer, owner, subject, subjectToken, subject2, subjectToken2 } =
        await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      let fanTokenBalance2 = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      await subjectToken2.connect(buyer).approve(staking, fanTokenBalance2);
      // get block number
      await expect(
        staking.connect(owner).buyAndLockMultiple([subject, subject2], [fanTokenBalance, fanTokenBalance2], [0, 0], 0),
      ).to.be.revertedWithCustomError(staking, "Staking_InvalidLockPeriod");
    });

    it("should revert with Staking_InvalidInputLength if param lengths doesnt match ", async () => {
      const { staking, buyer, subject, subjectToken, subject2, subjectToken2, lockTime } =
        await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      let fanTokenBalance2 = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      await subjectToken2.connect(buyer).approve(staking, fanTokenBalance2);
      // get block number
      await expect(
        staking.connect(buyer).buyAndLockMultiple([subject, subject2], [fanTokenBalance, fanTokenBalance2], [0], lockTime),
      ).to.be.revertedWithCustomError(staking, "Staking_InvalidInputLength");

      await expect(
        staking.connect(buyer).buyAndLockMultiple([subject], [fanTokenBalance, fanTokenBalance2], [0, 0], lockTime),
      ).to.be.revertedWithCustomError(staking, "Staking_InvalidInputLength");

      await expect(
        staking.connect(buyer).buyAndLockMultiple([subject, subject2], [fanTokenBalance], [0, 0], lockTime),
      ).to.be.revertedWithCustomError(staking, "Staking_InvalidInputLength");
    });

    it("should buy and lock tokens", async () => {
      const {
        staking,
        subject,
        subjectToken,
        subject2,
        subjectToken2,
        lockTime,
        owner,
        moxieToken,
        moxieBondingCurve,
        stakingAddress
      } = await loadFixture(deploy);

      const amt = (10e18).toString();

      const estimatedBuyAmountSubject1 = await moxieBondingCurve.calculateTokensForBuy(subject.address, amt);
      const estimatedBuyAmountSubject2 = await moxieBondingCurve.calculateTokensForBuy(subject2.address, amt);

      await moxieToken.connect(owner).approve(stakingAddress, estimatedBuyAmountSubject1.moxieAmount_ + estimatedBuyAmountSubject2.moxieAmount_);

      const block = await hre.ethers.provider.getBlock('latest');
      const estimatedUnlockTime = block!.timestamp + lockTime + 1;

      const balanceBefore1 = await subjectToken.balanceOf(stakingAddress);
      const balanceBefore2 = await subjectToken2.balanceOf(stakingAddress);
      await expect(
        staking.connect(owner).buyAndLockMultiple([subject, subject2], [estimatedBuyAmountSubject1.moxieAmount_, estimatedBuyAmountSubject2.moxieAmount_], [0, 0], lockTime),
      )
        .to.emit(staking, "Lock")
        .withArgs(
          owner.address,
          subject.address,
          await subjectToken.getAddress(),
          0,
          amt,
          estimatedUnlockTime,
          lockTime,
          owner.address,
          estimatedBuyAmountSubject1.moxieAmount_
        ).to.emit(staking, "Lock")
        .withArgs(
          owner.address,
          subject2.address,
          await subjectToken2.getAddress(),
          1,
          amt,
          estimatedUnlockTime,
          lockTime,
          owner.address,
          estimatedBuyAmountSubject2.moxieAmount_
        );
      let lockInfo = await staking.locks(0);
      let lockInfo2 = await staking.locks(1);

      expect(lockInfo.amount).to.eq(amt);
      expect(lockInfo.subject).to.eq(subject.address);
      expect(lockInfo.subjectToken).to.eq(await subjectToken.getAddress());
      expect(lockInfo.user).to.eq(owner.address);
      expect(lockInfo.unlockTimeInSec).to.eq(estimatedUnlockTime);
      expect(lockInfo.lockPeriodInSec).to.eq(lockTime);

      expect(lockInfo2.amount).to.eq(amt);
      expect(lockInfo2.subject).to.eq(subject2.address);
      expect(lockInfo2.subjectToken).to.eq(await subjectToken2.getAddress());
      expect(lockInfo2.user).to.eq(owner.address);
      expect(lockInfo2.unlockTimeInSec).to.eq(estimatedUnlockTime);
      expect(lockInfo2.lockPeriodInSec).to.eq(lockTime);

      const balanceAfter1 = await subjectToken.balanceOf(stakingAddress);
      const balanceAfter2 = await subjectToken2.balanceOf(stakingAddress);

      expect(balanceAfter1 - balanceBefore1).to.eq(amt);
      expect(balanceAfter2 - balanceBefore2).to.eq(amt);

    });
    it("should buy and lock tokens with order referrer ", async () => {
      const {
        staking,
        subject,
        subjectToken,
        subject2,
        subjectToken2,
        lockTime,
        owner,
        moxieToken,
        moxieBondingCurve,
        stakingAddress,
        orderReferrer,
        protocolRewards,
        feeInput,
        referralFeeInput,
        PCT_BASE
      } = await loadFixture(deploy);

      const amt = (10e18).toString();

      const estimatedBuyAmountSubject1 = await moxieBondingCurve.calculateTokensForBuy(subject.address, amt);
      const estimatedBuyAmountSubject2 = await moxieBondingCurve.calculateTokensForBuy(subject2.address, amt);

      await moxieToken.connect(owner).approve(stakingAddress, estimatedBuyAmountSubject1.moxieAmount_ + estimatedBuyAmountSubject2.moxieAmount_);

      const block = await hre.ethers.provider.getBlock('latest');
      const estimatedUnlockTime = block!.timestamp + lockTime + 1;

      const balanceBefore1 = await subjectToken.balanceOf(stakingAddress);
      const balanceBefore2 = await subjectToken2.balanceOf(stakingAddress);
      await expect(
        staking.connect(owner).buyAndLockMultipleV2(
          [subject, subject2],
          [estimatedBuyAmountSubject1.moxieAmount_, estimatedBuyAmountSubject2.moxieAmount_],
          [0, 0],
          lockTime,
          orderReferrer
        ),
      )
        .to.emit(staking, "Lock")
        .withArgs(
          owner.address,
          subject.address,
          await subjectToken.getAddress(),
          0,
          amt,
          estimatedUnlockTime,
          lockTime,
          owner.address,
          estimatedBuyAmountSubject1.moxieAmount_
        ).to.emit(staking, "Lock")
        .withArgs(
          owner.address,
          subject2.address,
          await subjectToken2.getAddress(),
          1,
          amt,
          estimatedUnlockTime,
          lockTime,
          owner.address,
          estimatedBuyAmountSubject2.moxieAmount_
        );
      let lockInfo = await staking.locks(0);
      let lockInfo2 = await staking.locks(1);

      expect(lockInfo.amount).to.eq(amt);
      expect(lockInfo.subject).to.eq(subject.address);
      expect(lockInfo.subjectToken).to.eq(await subjectToken.getAddress());
      expect(lockInfo.user).to.eq(owner.address);
      expect(lockInfo.unlockTimeInSec).to.eq(estimatedUnlockTime);
      expect(lockInfo.lockPeriodInSec).to.eq(lockTime);

      expect(lockInfo2.amount).to.eq(amt);
      expect(lockInfo2.subject).to.eq(subject2.address);
      expect(lockInfo2.subjectToken).to.eq(await subjectToken2.getAddress());
      expect(lockInfo2.user).to.eq(owner.address);
      expect(lockInfo2.unlockTimeInSec).to.eq(estimatedUnlockTime);
      expect(lockInfo2.lockPeriodInSec).to.eq(lockTime);

      const balanceAfter1 = await subjectToken.balanceOf(stakingAddress);
      const balanceAfter2 = await subjectToken2.balanceOf(stakingAddress);

      expect(balanceAfter1 - balanceBefore1).to.eq(amt);
      expect(balanceAfter2 - balanceBefore2).to.eq(amt);


      const totalMoxieAmount = estimatedBuyAmountSubject1.moxieAmount_ + estimatedBuyAmountSubject2.moxieAmount_;
      const orderReferrerAmount = BigInt(totalMoxieAmount) * BigInt(feeInput.protocolBuyFeePct) * BigInt(referralFeeInput.orderReferrerBuyFeePct) / (PCT_BASE * PCT_BASE)
      expect(await protocolRewards.balanceOf(orderReferrer)).to.equal(
        orderReferrerAmount
      )
    });

    it("should buy and lock tokens for zero deposit", async () => {
      const {
        staking,
        subject,
        subject2,
        lockTime,
        owner,
        moxieToken,
        moxieBondingCurve
      } = await loadFixture(deploy);
      const stakingAddress = await staking.getAddress();

      const amt = (10e18).toString();

      const estimatedBuyAmountSubject1 = await moxieBondingCurve.calculateTokensForBuy(subject.address, amt);
      const estimatedBuyAmountSubject2 = await moxieBondingCurve.calculateTokensForBuy(subject2.address, amt);

      await moxieToken.connect(owner).approve(stakingAddress, estimatedBuyAmountSubject1.moxieAmount_ + estimatedBuyAmountSubject2.moxieAmount_);

      await expect(
        staking.connect(owner).buyAndLockMultiple([subject, subject2], [0, estimatedBuyAmountSubject2.moxieAmount_], [0, 0], lockTime),
      ).to.revertedWithCustomError(moxieBondingCurve, "MoxieBondingCurve_InvalidDepositAmount");

    });

    it("should buy and lock tokens for invalid subject address", async () => {
      const {
        staking,
        subject,
        subject2,
        lockTime,
        owner,
        moxieToken,
        moxieBondingCurve
      } = await loadFixture(deploy);
      const stakingAddress = await staking.getAddress();

      const amt = (10e18).toString();

      const estimatedBuyAmountSubject1 = await moxieBondingCurve.calculateTokensForBuy(subject.address, amt);
      const estimatedBuyAmountSubject2 = await moxieBondingCurve.calculateTokensForBuy(subject2.address, amt);

      await moxieToken.connect(owner).approve(stakingAddress, estimatedBuyAmountSubject1.moxieAmount_ + estimatedBuyAmountSubject2.moxieAmount_);

      await expect(
        staking.connect(owner).buyAndLockMultiple([ethers.ZeroAddress, subject2], [0, estimatedBuyAmountSubject2.moxieAmount_], [0, 0], lockTime),
      ).to.revertedWithCustomError(moxieBondingCurve, "MoxieBondingCurve_InvalidSubject");

    });

    it("should buy and lock tokens for insufficient allowance", async () => {
      const {
        staking,
        subject2,
        lockTime,
        owner,
        moxieToken,
      } = await loadFixture(deploy);
      const stakingAddress = await staking.getAddress();

      await moxieToken.connect(owner).approve(stakingAddress, 0);

      await expect(
        staking.connect(owner).buyAndLockMultiple([ethers.ZeroAddress, subject2], [10, 10], [0, 0], lockTime),
      ).to.revertedWithCustomError(moxieToken, "ERC20InsufficientAllowance");

    });


    it("should buy and lock tokens for insufficient balance", async () => {
      const {
        staking,
        buyer,
        subject,
        subject2,
        lockTime,
        moxieToken,
        moxieBondingCurve
      } = await loadFixture(deploy);
      const stakingAddress = await staking.getAddress();

      const amt = (10e18).toString();


      const buyerBalance = await moxieToken.balanceOf(buyer.address);
      const totalDepositAmount = buyerBalance + BigInt(1);
      await moxieToken.connect(buyer).approve(stakingAddress, totalDepositAmount);

      await expect(
        staking.connect(buyer).buyAndLockMultiple([ethers.ZeroAddress, subject2], [buyerBalance, BigInt(1)], [0, 0], lockTime),
      ).to.revertedWithCustomError(moxieToken, "ERC20InsufficientBalance");

    });

    it("should work if paused & unpaused", async () => {
      const { staking, buyer, subject, subject2, moxieToken, lockTime, stakingAdmin, owner, pauseRole } =
        await loadFixture(deploy);
      let tx = await staking.connect(pauseRole).pause();
      const amt = await moxieToken.balanceOf(buyer.address);
      await expect(staking.connect(buyer).buyAndLockMultiple([ethers.ZeroAddress, subject2], [BigInt(1), BigInt(1)], [0, 0], lockTime))
        .to.be.revertedWithCustomError(staking, "EnforcedPause");
      tx = await staking.connect(pauseRole).unpause();
      await expect(staking.connect(buyer).buyAndLockMultiple([ethers.ZeroAddress, subject2], [BigInt(1), BigInt(1)], [0, 0], lockTime))
        .not.to.be.revertedWithCustomError(staking, "EnforcedPause");
    })
  });

  describe("buyAndLockMultipleFor", () => {

    it("should revert if lockduration is invalid", async () => {
      const { staking, buyer, owner, subject, subjectToken, subject2, subjectToken2 } =
        await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      let fanTokenBalance2 = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      await subjectToken2.connect(buyer).approve(staking, fanTokenBalance2);
      // get block number
      await expect(
        staking.connect(owner).buyAndLockMultipleFor([subject, subject2], [fanTokenBalance, fanTokenBalance2], [0, 0], 0, buyer.address),
      ).to.be.revertedWithCustomError(staking, "Staking_InvalidLockPeriod");
    });

    it("should revert with Staking_InvalidInputLength if param lengths doesnt match ", async () => {
      const { staking, buyer, subject, subjectToken, subject2, subjectToken2, lockTime } =
        await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      let fanTokenBalance2 = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      await subjectToken2.connect(buyer).approve(staking, fanTokenBalance2);
      // get block number
      await expect(
        staking.connect(buyer).buyAndLockMultipleFor([subject, subject2], [fanTokenBalance, fanTokenBalance2], [0], lockTime, buyer.address),
      ).to.be.revertedWithCustomError(staking, "Staking_InvalidInputLength");

      await expect(
        staking.connect(buyer).buyAndLockMultipleFor([subject], [fanTokenBalance, fanTokenBalance2], [0, 0], lockTime, buyer.address),
      ).to.be.revertedWithCustomError(staking, "Staking_InvalidInputLength");

      await expect(
        staking.connect(buyer).buyAndLockMultipleFor([subject, subject2], [fanTokenBalance], [0, 0], lockTime, buyer.address),
      ).to.be.revertedWithCustomError(staking, "Staking_InvalidInputLength");
    });

    it("should buy and lock tokens", async () => {
      const {
        staking,
        buyer,
        subject,
        subjectToken,
        subject2,
        subjectToken2,
        lockTime,
        owner,
        moxieToken,
        moxieBondingCurve,
        stakingAddress
      } = await loadFixture(deploy);

      const amt = (10e18).toString();

      const estimatedBuyAmountSubject1 = await moxieBondingCurve.calculateTokensForBuy(subject.address, amt);
      const estimatedBuyAmountSubject2 = await moxieBondingCurve.calculateTokensForBuy(subject2.address, amt);

      await moxieToken.connect(owner).approve(stakingAddress, estimatedBuyAmountSubject1.moxieAmount_ + estimatedBuyAmountSubject2.moxieAmount_);

      const balanceBefore1 = await subjectToken.balanceOf(stakingAddress);
      const balanceBefore2 = await subjectToken2.balanceOf(stakingAddress);
      const block = await hre.ethers.provider.getBlock('latest');
      const estimatedUnlockTime = block!.timestamp + lockTime + 1;
      await expect(
        staking.connect(owner).buyAndLockMultipleFor([subject, subject2], [estimatedBuyAmountSubject1.moxieAmount_, estimatedBuyAmountSubject2.moxieAmount_], [0, 0], lockTime, buyer.address),
      )
        .to.emit(staking, "Lock")
        .withArgs(
          buyer.address,
          subject.address,
          await subjectToken.getAddress(),
          0,
          amt,
          estimatedUnlockTime,
          lockTime,
          owner.address,
          estimatedBuyAmountSubject1.moxieAmount_
        ).to.emit(staking, "Lock")
        .withArgs(
          buyer.address,
          subject2.address,
          await subjectToken2.getAddress(),
          1,
          amt,
          estimatedUnlockTime,
          lockTime,
          owner.address,
          estimatedBuyAmountSubject2.moxieAmount_
        );
      let lockInfo = await staking.locks(0);
      let lockInfo2 = await staking.locks(1);

      expect(lockInfo.amount).to.eq(amt);
      expect(lockInfo.subject).to.eq(subject.address);
      expect(lockInfo.subjectToken).to.eq(await subjectToken.getAddress());
      expect(lockInfo.user).to.eq(buyer.address);
      expect(lockInfo.unlockTimeInSec).to.eq(estimatedUnlockTime);
      expect(lockInfo.lockPeriodInSec).to.eq(lockTime);

      expect(lockInfo2.amount).to.eq(amt);
      expect(lockInfo2.subject).to.eq(subject2.address);
      expect(lockInfo2.subjectToken).to.eq(await subjectToken2.getAddress());
      expect(lockInfo2.user).to.eq(buyer.address);
      expect(lockInfo2.unlockTimeInSec).to.eq(estimatedUnlockTime);
      expect(lockInfo2.lockPeriodInSec).to.eq(lockTime);

      const balanceAfter1 = await subjectToken.balanceOf(stakingAddress);
      const balanceAfter2 = await subjectToken2.balanceOf(stakingAddress);

      expect(balanceAfter1 - balanceBefore1).to.eq(amt);
      expect(balanceAfter2 - balanceBefore2).to.eq(amt);

    });

    it("should buy and lock tokens with order referrer", async () => {
      const {
        staking,
        buyer,
        subject,
        subjectToken,
        subject2,
        subjectToken2,
        lockTime,
        owner,
        moxieToken,
        moxieBondingCurve,
        stakingAddress,
        PCT_BASE,
        orderReferrer,
        feeInput,
        referralFeeInput,
        protocolRewards
      } = await loadFixture(deploy);

      const amt = (10e18).toString();

      const estimatedBuyAmountSubject1 = await moxieBondingCurve.calculateTokensForBuy(subject.address, amt);
      const estimatedBuyAmountSubject2 = await moxieBondingCurve.calculateTokensForBuy(subject2.address, amt);

      await moxieToken.connect(owner).approve(stakingAddress, estimatedBuyAmountSubject1.moxieAmount_ + estimatedBuyAmountSubject2.moxieAmount_);

      const balanceBefore1 = await subjectToken.balanceOf(stakingAddress);
      const balanceBefore2 = await subjectToken2.balanceOf(stakingAddress);
      const block = await hre.ethers.provider.getBlock('latest');
      const estimatedUnlockTime = block!.timestamp + lockTime + 1;
      await expect(
        staking.connect(owner).buyAndLockMultipleForV2(
          [subject, subject2],
          [estimatedBuyAmountSubject1.moxieAmount_,
          estimatedBuyAmountSubject2.moxieAmount_],
          [0, 0],
          lockTime,
          buyer.address,
          orderReferrer
        ),
      )
        .to.emit(staking, "Lock")
        .withArgs(
          buyer.address,
          subject.address,
          await subjectToken.getAddress(),
          0,
          amt,
          estimatedUnlockTime,
          lockTime,
          owner.address,
          estimatedBuyAmountSubject1.moxieAmount_
        ).to.emit(staking, "Lock")
        .withArgs(
          buyer.address,
          subject2.address,
          await subjectToken2.getAddress(),
          1,
          amt,
          estimatedUnlockTime,
          lockTime,
          owner.address,
          estimatedBuyAmountSubject2.moxieAmount_
        );
      let lockInfo = await staking.locks(0);
      let lockInfo2 = await staking.locks(1);

      expect(lockInfo.amount).to.eq(amt);
      expect(lockInfo.subject).to.eq(subject.address);
      expect(lockInfo.subjectToken).to.eq(await subjectToken.getAddress());
      expect(lockInfo.user).to.eq(buyer.address);
      expect(lockInfo.unlockTimeInSec).to.eq(estimatedUnlockTime);
      expect(lockInfo.lockPeriodInSec).to.eq(lockTime);

      expect(lockInfo2.amount).to.eq(amt);
      expect(lockInfo2.subject).to.eq(subject2.address);
      expect(lockInfo2.subjectToken).to.eq(await subjectToken2.getAddress());
      expect(lockInfo2.user).to.eq(buyer.address);
      expect(lockInfo2.unlockTimeInSec).to.eq(estimatedUnlockTime);
      expect(lockInfo2.lockPeriodInSec).to.eq(lockTime);

      const balanceAfter1 = await subjectToken.balanceOf(stakingAddress);
      const balanceAfter2 = await subjectToken2.balanceOf(stakingAddress);

      expect(balanceAfter1 - balanceBefore1).to.eq(amt);
      expect(balanceAfter2 - balanceBefore2).to.eq(amt);

      const totalMoxieAmount = estimatedBuyAmountSubject1.moxieAmount_ + estimatedBuyAmountSubject2.moxieAmount_;
      const orderReferrerAmount = BigInt(totalMoxieAmount) * BigInt(feeInput.protocolBuyFeePct) * BigInt(referralFeeInput.orderReferrerBuyFeePct) / (PCT_BASE * PCT_BASE)
      expect(await protocolRewards.balanceOf(orderReferrer)).to.equal(
        orderReferrerAmount
      )

    });

    it("should buy and lock tokens for zero deposit", async () => {
      const {
        staking,
        buyer,
        subject,
        subject2,
        lockTime,
        owner,
        moxieToken,
        moxieBondingCurve
      } = await loadFixture(deploy);
      const stakingAddress = await staking.getAddress();

      const amt = (10e18).toString();

      const estimatedBuyAmountSubject1 = await moxieBondingCurve.calculateTokensForBuy(subject.address, amt);
      const estimatedBuyAmountSubject2 = await moxieBondingCurve.calculateTokensForBuy(subject2.address, amt);

      await moxieToken.connect(owner).approve(stakingAddress, estimatedBuyAmountSubject1.moxieAmount_ + estimatedBuyAmountSubject2.moxieAmount_);

      await expect(
        staking.connect(owner).buyAndLockMultipleFor([subject, subject2], [0, estimatedBuyAmountSubject2.moxieAmount_], [0, 0], lockTime, buyer.address),
      ).to.revertedWithCustomError(moxieBondingCurve, "MoxieBondingCurve_InvalidDepositAmount");

    });

    it("should buy and lock tokens for invalid subject address", async () => {
      const {
        staking,
        buyer,
        subject,
        subject2,
        lockTime,
        owner,
        moxieToken,
        moxieBondingCurve
      } = await loadFixture(deploy);
      const stakingAddress = await staking.getAddress();

      const amt = (10e18).toString();

      const estimatedBuyAmountSubject1 = await moxieBondingCurve.calculateTokensForBuy(subject.address, amt);
      const estimatedBuyAmountSubject2 = await moxieBondingCurve.calculateTokensForBuy(subject2.address, amt);

      await moxieToken.connect(owner).approve(stakingAddress, estimatedBuyAmountSubject1.moxieAmount_ + estimatedBuyAmountSubject2.moxieAmount_);

      await expect(
        staking.connect(owner).buyAndLockMultipleFor([ethers.ZeroAddress, subject2], [0, estimatedBuyAmountSubject2.moxieAmount_], [0, 0], lockTime, buyer.address),
      ).to.revertedWithCustomError(moxieBondingCurve, "MoxieBondingCurve_InvalidSubject");

    });

    it("should buy and lock tokens for insufficient allowance", async () => {
      const {
        staking,
        subject2,
        lockTime,
        owner,
        moxieToken,
        buyer,
      } = await loadFixture(deploy);
      const stakingAddress = await staking.getAddress();

      await moxieToken.connect(owner).approve(stakingAddress, 0);

      await expect(
        staking.connect(owner).buyAndLockMultipleFor([ethers.ZeroAddress, subject2], [10, 10], [0, 0], lockTime, buyer.address),
      ).to.revertedWithCustomError(moxieToken, "ERC20InsufficientAllowance");

    });


    it("should buy and lock tokens for insufficient balance", async () => {
      const {
        staking,
        buyer,
        subject2,
        lockTime,
        moxieToken,
      } = await loadFixture(deploy);
      const stakingAddress = await staking.getAddress();


      const buyerBalance = await moxieToken.balanceOf(buyer.address);
      const totalDepositAmount = buyerBalance + BigInt(1);
      await moxieToken.connect(buyer).approve(stakingAddress, totalDepositAmount);

      await expect(
        staking.connect(buyer).buyAndLockMultipleFor([ethers.ZeroAddress, subject2], [buyerBalance, BigInt(1)], [0, 0], lockTime, buyer.address),
      ).to.revertedWithCustomError(moxieToken, "ERC20InsufficientBalance");

    });

    it("should work if paused & unpaused", async () => {
      const { staking, buyer, subject, subject2, moxieToken, lockTime, stakingAdmin, owner, pauseRole } =
        await loadFixture(deploy);
      let tx = await staking.connect(pauseRole).pause();
      const amt = await moxieToken.balanceOf(buyer.address);

      await expect(staking.connect(buyer).buyAndLockMultipleFor([ethers.ZeroAddress, subject2], [BigInt(1), BigInt(1)], [0, 0], lockTime, buyer.address))
        .to.be.revertedWithCustomError(staking, "EnforcedPause");
      tx = await staking.connect(pauseRole).unpause();
      await expect(staking.connect(buyer).buyAndLockMultipleFor([ethers.ZeroAddress, subject2], [BigInt(1), BigInt(1)], [0, 0], lockTime, buyer.address))
        .not.to.be.revertedWithCustomError(staking, "EnforcedPause");
    })
  });

  describe("withdraw", () => {

    it("should withdraw multiple locks", async () => {
      const { staking, buyer, subject, subjectToken, lockTime, stakingAddress } =
        await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);

      // making 5 deposits
      const depositAmount = BigInt(1e18);
      for (let i = 0; i < 5; i++) {
        await staking
          .connect(buyer)
          .depositAndLock(subject, depositAmount.toString(), lockTime);
      }

      const stakingBalance = await subjectToken.balanceOf(stakingAddress)
      const balanceAfterDeposit = await subjectToken.balanceOf(buyer.address);
      let lastLockInfo = await staking.locks(4);
      // move time to unlock time
      await time.increaseTo(lastLockInfo.unlockTimeInSec + 1n);
      await expect(staking.connect(buyer).withdraw(subject.address, [0, 1, 2, 3, 4]), subject.address)
        .to.emit(staking, "Withdraw")
        .withArgs(
          buyer.address,
          subject.address,
          await subjectToken.getAddress(),
          [0, 1, 2, 3, 4],
          (depositAmount * 5n).toString(),
        );

      const balanceAfterWithdraw = await subjectToken.balanceOf(buyer.address);
      const stakingBalanceAfterWithdraw = await subjectToken.balanceOf(stakingAddress);
      const totalDepositAmount = depositAmount * 5n;
      expect(balanceAfterWithdraw).to.eq(BigInt(balanceAfterDeposit) + BigInt(totalDepositAmount));

      expect(stakingBalanceAfterWithdraw).to.eq(BigInt(stakingBalance) - BigInt(totalDepositAmount));

    });


    it("should revert with duplicate indexes", async () => {
      const { staking, buyer, subject, subjectToken, lockTime, owner } = await loadFixture(deploy);

      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);


      const depositAmount = BigInt(1e18);
      await staking
        .connect(buyer)
        .depositAndLock(subject, depositAmount.toString(), lockTime);

      const lastLockInfo = await staking.locks(0);
      // move time to unlock time
      await time.increaseTo(lastLockInfo.unlockTimeInSec + 1n);
      await expect(
        staking.connect(buyer).withdraw(subject.address, [0, 0]),
      ).to.be.revertedWithCustomError(staking, "Staking_SubjectsDoesNotMatch");
    });


    it("should revert with EmptyIndexes", async () => {
      const { staking, owner, subject } = await loadFixture(deploy);

      await expect(
        staking.connect(owner).withdraw(subject.address, []),
      ).to.be.revertedWithCustomError(staking, "Staking_EmptyIndexes");
    });

    it("should revert if indexes doesn't exist", async () => {
      const { staking, owner, subject } = await loadFixture(deploy);

      await expect(
        staking.connect(owner).withdraw(subject.address, [100]),
      ).to.be.revertedWithCustomError(staking, "Staking_SubjectsDoesNotMatch");
    });

    it("should revert if subjects are different", async () => {
      const {
        staking,
        buyer,
        subject,
        subjectToken,
        lockTime,
        subject2,
        subjectToken2,
      } = await loadFixture(deploy);
      const stakeAmount = BigInt(1e18);
      // let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      // let fanTokenBalance2 = await subjectToken2.balanceOf(buyer.address);

      await subjectToken
        .connect(buyer)
        .approve(await staking.getAddress(), stakeAmount);
      await subjectToken2
        .connect(buyer)
        .approve(await staking.getAddress(), stakeAmount);

      // making 5 deposits
      await staking
        .connect(buyer)
        .depositAndLock(subject, stakeAmount.toString(), lockTime);

      await staking
        .connect(buyer)
        .depositAndLock(subject2, stakeAmount.toString(), lockTime);

      let lastLockInfo = await staking.locks(1);
      // move time to unlock time
      await time.increaseTo(lastLockInfo.unlockTimeInSec + 1n);
      await expect(staking.connect(buyer).withdraw(subject.address, [0, 1]))
        .to.be.revertedWithCustomError(staking, "Staking_SubjectsDoesNotMatch")
        .withArgs(1);
    });

    it("should revert if lock not expired", async () => {
      const {
        staking,
        buyer,
        subject,
        subjectToken,
        lockTime,
      } = await loadFixture(deploy);
      const stakeAmount = BigInt(1e18);

      await subjectToken
        .connect(buyer)
        .approve(await staking.getAddress(), (stakeAmount * 2n).toString());

      await staking
        .connect(buyer)
        .depositAndLock(subject, stakeAmount.toString(), lockTime);
      // pass 5 seconds
      await time.increase(5);
      await staking
        .connect(buyer)
        .depositAndLock(subject, stakeAmount.toString(), lockTime);
      let lockInfo = await staking.locks(0);
      // move time to unlock time
      await time.increaseTo(lockInfo.unlockTimeInSec);
      let firstLockInfo = await staking.locks(1);
      await expect(staking.connect(buyer).withdraw(subject.address, [0, 1]))
        .to.be.revertedWithCustomError(staking, "Staking_LockNotExpired")
        .withArgs(1, anyValue, firstLockInfo.unlockTimeInSec);
    });

    it("should revert if owner is not same", async () => {
      // have to whitelist for withdraw as well
      const {
        staking,
        buyer,
        subject,
        subjectToken,
        lockTime,
      } = await loadFixture(deploy);
      const stakeAmount = BigInt(1e18);

      await subjectToken
        .connect(buyer)
        .approve(await staking.getAddress(), (stakeAmount * 2n).toString());

      // making 5 deposits
      await staking
        .connect(buyer)
        .depositAndLock(subject, stakeAmount.toString(), lockTime);

      let lockInfo = await staking.locks(0);
      // move time to unlock time
      await time.increaseTo(lockInfo.unlockTimeInSec + 5n);
      await expect(
        staking.connect(subject).withdraw(subject.address, [0]),
      ).to.be.revertedWithCustomError(staking, "Staking_NotOwner");
    });

    it("should work if paused & unpaused", async () => {
      const { staking, buyer, subject, subject2, moxieToken, lockTime, stakingAdmin, owner, pauseRole } =
        await loadFixture(deploy);
      let tx = await staking.connect(pauseRole).pause();
      await expect(staking.connect(buyer).withdraw(subject.address, [0]))
        .to.be.revertedWithCustomError(staking, "EnforcedPause");
      tx = await staking.connect(pauseRole).unpause();
      await expect(staking.connect(buyer).withdraw(subject.address, [0]))
        .not.to.be.revertedWithCustomError(staking, "EnforcedPause");
    })
  });

  describe("getTotalStakedAmount", () => {
    it("should return total staked amount", async () => {
      const { staking, buyer, subject, subjectToken, lockTime } =
        await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      // get block number

      // making 5 deposits
      const depositAmount = BigInt(1e18);
      for (let i = 0; i < 5; i++) {
        await staking
          .connect(buyer)
          .depositAndLock(subject, depositAmount.toString(), lockTime);
      }

      let totalStaked = await staking.getTotalStakedAmount(
        buyer.address,
        await subject.getAddress(),
        [0, 1, 2, 3, 4],
      );
      expect(totalStaked).to.eq(depositAmount * 5n);
    });

    it("should revert if subject passed is zero address", async () => {
      const { staking, buyer, subject, subjectToken, lockTime } =
        await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      // get block number

      // making 5 deposits
      const depositAmount = BigInt(1e18);

      await staking
        .connect(buyer)
        .depositAndLock(subject, depositAmount.toString(), lockTime);

      await expect(
        staking.getTotalStakedAmount(buyer.address, zeroAddress, [0]),
      ).to.be.revertedWithCustomError(staking, "Staking_SubjectsDoesNotMatch").withArgs(0);
    });

    it("should revert trying to fetch incorrect user's total staked amount", async () => {
      const { staking, buyer, subject } =
        await loadFixture(deploy);

      await expect(
        staking.getTotalStakedAmount(
          buyer.address,
          await subject.getAddress(),
          [0],
        ),
      )
        .to.be.revertedWithCustomError(staking, "Staking_NotSameUser")
        .withArgs(0);
    });
  });

  describe("extendLock", () => {
    it("should revert with index is empty", async () => {
      const { staking, buyer, subject, lockTime } =
        await loadFixture(deploy);
      await expect(staking.connect(buyer).extendLock(subject, [], lockTime))
        .to.be.revertedWithCustomError(staking, "Staking_EmptyIndexes")
    });

    it("should revert if lockduration is invalid", async () => {
      const { staking, buyer, subject } =
        await loadFixture(deploy);
      await expect(staking.connect(buyer).extendLock(subject, [0], 0))
        .to.be.revertedWithCustomError(staking, "Staking_InvalidLockPeriod")
    });

    it("should revert with Staking_NotOwner,since owner who called doesnt have the passed locked index", async () => {
      const {
        staking,
        buyer,
        subject,
        subjectToken,
        lockTime,
        buyer2,
      } = await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      const depositAmount = BigInt(1e18);
      await staking
        .connect(buyer)
        .depositAndLock(subject, depositAmount.toString(), lockTime);
      // forward time to unlock time
      let lockInfo = await staking.locks(0);
      await time.increaseTo(lockInfo.unlockTimeInSec + 1n);
      await expect(staking.connect(buyer2).extendLock(subject.address, [0], lockTime))
        .to.be.revertedWithCustomError(staking, "Staking_NotOwner")
        .withArgs(0);
    });
    it("should revert with Staking_InvalidSubject", async () => {
      const {
        staking,
        buyer,
        subject,
        subjectToken,
        lockTime,
      } = await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      const depositAmount = BigInt(1e18);
      await staking
        .connect(buyer)
        .depositAndLock(subject, depositAmount.toString(), lockTime);
      // forward time to unlock time
      let lockInfo = await staking.locks(0);
      await time.increaseTo(lockInfo.unlockTimeInSec + 1n);
      await expect(staking.connect(buyer).extendLock(zeroAddress, [0], lockTime))
        .to.be.revertedWithCustomError(staking, "Staking_InvalidSubject")
    })

    it("should revert with LockNotExpired", async () => {
      const {
        staking,
        buyer,
        subject,
        subjectToken,
        lockTime,
      } = await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      const depositAmount = BigInt(1e18);
      await staking
        .connect(buyer)
        .depositAndLock(subject, depositAmount.toString(), lockTime);
      await expect(staking.connect(buyer).extendLock(subject.address, [0], lockTime))
        .to.be.revertedWithCustomError(staking, "Staking_LockNotExpired")
        .withArgs(0, anyValue, anyValue);
    })

    it("should extend lock", async () => {
      const { staking, buyer, subject, subjectToken, lockTime } =
        await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      const depositAmount = BigInt("500000000000000000");
      for (let i = 0; i < 5; i++) {
        await staking
          .connect(buyer)
          .depositAndLock(subject, depositAmount.toString(), lockTime);
      }
      // forward time to unlock time
      let lockInfo = await staking.locks(4);
      await time.increaseTo(lockInfo.unlockTimeInSec + 1n);

      const currentBlock = await hre.ethers.provider.getBlock('latest');
      const expectedUnlockTime = currentBlock!.timestamp + lockTime + 1;
      await expect(staking.connect(buyer).extendLock(subject.address, [0, 1, 2, 3, 4], lockTime))
        .to.emit(staking, "LockExtended")
        .withArgs(buyer, subject, subjectToken, [0, 1, 2, 3, 4], depositAmount * 5n).to.emit(staking, "Lock").withArgs(
          buyer.address,
          subject.address,
          await subjectToken.getAddress(),
          5,
          depositAmount * 5n,
          anyValue,
          lockTime,
          ethers.ZeroAddress,
          0
        )

      const newlockInfo = await staking.locks(5);

      expect(newlockInfo.amount).to.eq(depositAmount * 5n);
      expect(newlockInfo.subject).to.eq(subject.address);
      expect(newlockInfo.subjectToken).to.eq(await subjectToken.getAddress());
      expect(newlockInfo.user).to.eq(buyer.address);
      expect(newlockInfo.unlockTimeInSec).to.eq(expectedUnlockTime);
      expect(newlockInfo.lockPeriodInSec).to.eq(lockTime);
    });

    it("should revert with duplicate indexes", async () => {
      const { staking, buyer, subject, subjectToken, lockTime } =
        await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      const depositAmount = BigInt(1e18);

      await staking
        .connect(buyer)
        .depositAndLock(subject, depositAmount.toString(), lockTime);

      // forward time to unlock time
      let lockInfo = await staking.locks(0);
      await time.increaseTo(lockInfo.unlockTimeInSec + 1n);

      await expect(staking.connect(buyer).extendLock(subject.address, [0, 0], lockTime))
        .to.be.revertedWithCustomError(staking, "Staking_SubjectsDoesNotMatch")
    });
  });

  describe("extendLockFor", () => {
    it("should revert with index is empty", async () => {
      const { staking, buyer, owner, subject, lockTime } =
        await loadFixture(deploy);
      await expect(staking.connect(buyer).extendLockFor(subject, [], lockTime, owner.address))
        .to.be.revertedWithCustomError(staking, "Staking_EmptyIndexes")
    });

    it("should revert if lockduration is invalid", async () => {
      const { staking, buyer, owner, subject } =
        await loadFixture(deploy);
      await expect(staking.connect(buyer).extendLockFor(subject, [0], 0, owner.address))
        .to.be.revertedWithCustomError(staking, "Staking_InvalidLockPeriod")
    });

    it("should revert with Staking_NotOwner,since owner who called doesnt have the passed locked index", async () => {
      const {
        staking,
        buyer,
        subject,
        subjectToken,
        lockTime,
        buyer2,
      } = await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      const depositAmount = BigInt(1e18);
      await staking
        .connect(buyer)
        .depositAndLockFor(subject, depositAmount.toString(), lockTime, buyer.address);
      // forward time to unlock time
      let lockInfo = await staking.locks(0);
      await time.increaseTo(lockInfo.unlockTimeInSec + 1n);
      await expect(staking.connect(buyer2).extendLockFor(subject.address, [0], lockTime, buyer.address))
        .to.be.revertedWithCustomError(staking, "Staking_NotOwner")
        .withArgs(0);
    });
    it("should revert with Staking_InvalidSubject", async () => {
      const {
        staking,
        buyer,
        subject,
        subjectToken,
        lockTime,
      } = await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      const depositAmount = BigInt(1e18);
      await staking
        .connect(buyer)
        .depositAndLock(subject, depositAmount.toString(), lockTime);
      // forward time to unlock time
      let lockInfo = await staking.locks(0);
      await time.increaseTo(lockInfo.unlockTimeInSec + 1n);
      await expect(staking.connect(buyer).extendLockFor(zeroAddress, [0], lockTime, buyer.address))
        .to.be.revertedWithCustomError(staking, "Staking_InvalidSubject")
    })

    it("should revert with LockNotExpired", async () => {
      const {
        staking,
        buyer,
        owner,
        subject,
        subjectToken,
        lockTime,
      } = await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      const depositAmount = BigInt(1e18);
      await staking
        .connect(buyer)
        .depositAndLock(subject, depositAmount.toString(), lockTime);
      await expect(staking.connect(buyer).extendLockFor(subject.address, [0], lockTime, owner.address))
        .to.be.revertedWithCustomError(staking, "Staking_LockNotExpired")
        .withArgs(0, anyValue, anyValue);
    })
    it("should extend lock", async () => {
      const { staking, buyer, owner, subject, subjectToken, lockTime } =
        await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      const depositAmount = BigInt("500000000000000000");
      for (let i = 0; i < 5; i++) {
        await staking
          .connect(buyer)
          .depositAndLock(subject, depositAmount.toString(), lockTime);
      }
      // forward time to unlock time
      let lockInfo = await staking.locks(4);
      await time.increaseTo(lockInfo.unlockTimeInSec + 1n);
      const currentBlock = await hre.ethers.provider.getBlock('latest');
      const expectedUnlockTime = currentBlock!.timestamp + lockTime + 1;
      await expect(staking.connect(buyer).extendLockFor(subject.address, [0, 1, 2, 3, 4], lockTime, owner.address))
        .to.emit(staking, "LockExtended")
        .withArgs(buyer, subject, subjectToken, [0, 1, 2, 3, 4], depositAmount * 5n).to.emit(staking, "Lock").withArgs(
          owner.address,
          subject.address,
          await subjectToken.getAddress(),
          5,
          depositAmount * 5n,
          anyValue,
          lockTime,
          ethers.ZeroAddress,
          0
        );


      const newlockInfo = await staking.locks(5);

      expect(newlockInfo.amount).to.eq(depositAmount * 5n);
      expect(newlockInfo.subject).to.eq(subject.address);
      expect(newlockInfo.subjectToken).to.eq(await subjectToken.getAddress());
      expect(newlockInfo.user).to.eq(owner.address);
      expect(newlockInfo.unlockTimeInSec).to.eq(expectedUnlockTime);
      expect(newlockInfo.lockPeriodInSec).to.eq(lockTime);

    });
  });

  describe("lockCount", () => {
    it("should return lock count", async () => {
      const { staking, buyer, subject, subjectToken, lockTime } =
        await loadFixture(deploy);
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      const depositAmount = BigInt(1e18);
      for (let i = 0; i < 5; i++) {
        await staking
          .connect(buyer)
          .depositAndLock(subject, depositAmount.toString(), lockTime);
      }
      let lockCount = await staking.lockCount();
      expect(lockCount).to.eq(5);
    });
  });

});
