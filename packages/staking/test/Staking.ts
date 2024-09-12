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

    //subjectErc20

    const tokenManager = await TokenManager.deploy({ from: deployer.address });
    await tokenManager
      .connect(deployer)
      .initialize(owner.address, subjectErc20Address);

    const lockTime = 60;
    // moxie Bonding curve
    const moxieBondingCurve = await MoxieBondingCurve.deploy();
    const staking = await Staking.deploy(
      await tokenManager.getAddress(),
      await moxieBondingCurve.getAddress(),
      await moxieToken.getAddress(),
      lockTime,
      stakingAdmin.address,
      changeLockRole.address,
      { from: deployer.address },
    );

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
    };
  };

  describe("setChangeLockDurationRole", () => {
    it("should set CHANGE_LOCK_DURATION role", async () => {
      const { staking, stakingAdmin } = await deploy();
      await staking
        .connect(stakingAdmin)
        .setChangeLockDurationRole(stakingAdmin.address);
    });

    it("should revert if not called by correct role", async () => {
      const { staking, changeLockRole } = await deploy();
      await expect(
        staking
          .connect(changeLockRole)
          .setChangeLockDurationRole(changeLockRole.address),
      ).to.be.revertedWithCustomError(
        staking,
        "AccessControlUnauthorizedAccount",
      );
    });
  });
  describe("getLockPeriod", () => {
    it("should return the lock period", async () => {
      const { staking, lockTime } = await deploy();
      const result = await staking.getLockPeriod();
      expect(result).to.eq(lockTime);
    });
  });

  describe("setLockPeriod", () => {
    it("should set the lock period", async () => {
      const { staking, changeLockRole } = await deploy();
      const newLockTime = 100;
      await expect(staking.connect(changeLockRole).setLockPeriod(newLockTime))
        .to.emit(staking, "LockPeriodUpdated")
        .withArgs(newLockTime);
      const result = await staking.getLockPeriod();
      expect(result).to.eq(newLockTime);
    });
    it("should revert if not called by correct role", async () => {
      const { staking, stakingAdmin } = await deploy();
      const newLockTime = 100;

      await expect(
        staking.connect(stakingAdmin).setLockPeriod(newLockTime),
      ).to.be.revertedWithCustomError(
        staking,
        "AccessControlUnauthorizedAccount",
      );
    });
  });

  describe("depositAndLock", () => {
    it("should deposit and lock tokens", async () => {
      const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
        await deploy();
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      // get block number
      await expect(
        staking.connect(buyer).depositAndLock(subject, fanTokenBalance),
      )
        .to.emit(staking, "Lock")
        .withArgs(
          buyer.address,
          subject.address,
          await subjectToken.getAddress(),
          0,
          fanTokenBalance,
          anyValue,
        );
      let lockInfo = await staking.getLockInfo(0);
      expect(lockInfo.amount).to.eq(fanTokenBalance);
      expect(lockInfo.subject).to.eq(subject.address);
      expect(lockInfo.subjectToken).to.eq(await subjectToken.getAddress());
      expect(lockInfo.amount).to.eq(fanTokenBalance);
    });

    it("should revert if amount is zero", async () => {
      const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
        await deploy();
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      // get block number
      await expect(
        staking.connect(buyer).depositAndLock(subject, 0),
      ).to.be.revertedWithCustomError(staking, "AmountShouldBeGreaterThanZero");
    });

    it("should revert if subject is invalid", async () => {
      const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
        await deploy();
      // let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      // await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      // get block number
      await expect(
        staking.connect(buyer).depositAndLock(zeroAddress, "1"),
      ).to.be.revertedWithCustomError(staking, "InvalidSubjectToken");
    });
  });

  describe("buyAndLock", () => {
    it("should buy and lock tokens & withdraw", async () => {
      const {
        staking,
        buyer,
        subject,
        subjectToken,
        initialSupply,
        lockTime,
        owner,
        moxieToken,
        moxieBondingCurveAddress,
      } = await deploy();
      const amt = (1e18).toString();
      const stakingAddress = await staking.getAddress();

      await moxieToken.connect(owner).approve(stakingAddress, amt);

      await expect(
        staking.connect(owner).buyAndLock(await subject.getAddress(), amt, 0),
      )
        .to.emit(staking, "Lock")
        .withArgs(
          owner.address,
          subject.address,
          await subjectToken.getAddress(),
          0,
          anyValue,
          anyValue,
        );
      let lockInfo = await staking.getLockInfo(0);

      let oldOwnerBalance = await subjectToken.balanceOf(owner.address);
      await time.increaseTo(lockInfo.unlockTime);

      await expect(staking.connect(owner).withdraw([0]))
        .to.emit(staking, "Withdraw")
        .withArgs(
          owner.address,
          subject.address,
          await subjectToken.getAddress(),
          [0],
          lockInfo.amount,
        );
      let newOwnerBalance = await subjectToken.balanceOf(owner.address);

      expect(newOwnerBalance - oldOwnerBalance).to.eq(lockInfo.amount);
      let newLockinfo = await staking.getLockInfo(0);
      expect(newLockinfo.amount).to.eq(0);
      expect(newLockinfo.unlockTime).to.eq(0);
      expect(newLockinfo.subject).to.eq(zeroAddress);
      expect(newLockinfo.subjectToken).to.eq(zeroAddress);
      expect(newLockinfo.user).to.eq(zeroAddress);
    });
  });

  describe("withdraw", () => {
    it("should revert with EmptyIndexes", async () => {
      const { staking, owner } = await deploy();

      await expect(
        staking.connect(owner).withdraw([]),
      ).to.be.revertedWithCustomError(staking, "EmptyIndexes");
    });

    it("should withdraw multiple locks", async () => {
      const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
        await deploy();
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      // get block number

      // making 5 deposits
      const depositAmount = BigInt(1e18);
      for (let i = 0; i < 5; i++) {
        await staking
          .connect(buyer)
          .depositAndLock(subject, depositAmount.toString());
      }
      let balanceAfterDeposit = await subjectToken.balanceOf(buyer.address);
      let lastLockInfo = await staking.getLockInfo(4);
      // move time to unlock time
      await time.increaseTo(lastLockInfo.unlockTime + 1n);
      await expect(staking.connect(buyer).withdraw([0, 1, 2, 3, 4]))
        .to.emit(staking, "Withdraw")
        .withArgs(
          buyer.address,
          subject.address,
          await subjectToken.getAddress(),
          [0, 1, 2, 3, 4],
          (depositAmount * 5n).toString(),
        );
    });

    it("should revert if subjects are different", async () => {
      const {
        staking,
        buyer,
        subject,
        subjectToken,
        initialSupply,
        lockTime,
        subject2,
        subjectToken2,
      } = await deploy();
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
        .depositAndLock(subject, stakeAmount.toString());

      await staking
        .connect(buyer)
        .depositAndLock(subject2, stakeAmount.toString());

      let lastLockInfo = await staking.getLockInfo(1);
      // move time to unlock time
      await time.increaseTo(lastLockInfo.unlockTime + 1n);
      await expect(staking.connect(buyer).withdraw([0, 1]))
        .to.be.revertedWithCustomError(staking, "SubjectsDoesntMatch")
        .withArgs(1);
    });

    it("should revert if lock not expired", async () => {
      const {
        staking,
        buyer,
        subject,
        subjectToken,
        initialSupply,
        lockTime,
        subject2,
        subjectToken2,
      } = await deploy();
      const stakeAmount = BigInt(1e18);
      // let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      // let fanTokenBalance2 = await subjectToken2.balanceOf(buyer.address);

      await subjectToken
        .connect(buyer)
        .approve(await staking.getAddress(), (stakeAmount * 2n).toString());

      // making 5 deposits
      await staking
        .connect(buyer)
        .depositAndLock(subject, stakeAmount.toString());
      // pass 5 seconds
      await time.increase(5);
      await staking
        .connect(buyer)
        .depositAndLock(subject, stakeAmount.toString());
      let lockInfo = await staking.getLockInfo(0);
      // move time to unlock time
      await time.increaseTo(lockInfo.unlockTime);
      let firstLockInfo = await staking.getLockInfo(1);
      await expect(staking.connect(buyer).withdraw([0, 1]))
        .to.be.revertedWithCustomError(staking, "LockNotExpired")
        .withArgs(1, anyValue, firstLockInfo.unlockTime);
    });

    it("should revert if owner is not same", async () => {
      // have to whitelist for withdraw as well
      const {
        staking,
        buyer,
        subject,
        subjectToken,
        initialSupply,
        lockTime,
        subject2,
        subjectToken2,
      } = await deploy();
      const stakeAmount = BigInt(1e18);
      // let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      // let fanTokenBalance2 = await subjectToken2.balanceOf(buyer.address);

      await subjectToken
        .connect(buyer)
        .approve(await staking.getAddress(), (stakeAmount * 2n).toString());

      // making 5 deposits
      await staking
        .connect(buyer)
        .depositAndLock(subject, stakeAmount.toString());

      let lockInfo = await staking.getLockInfo(0);
      // move time to unlock time
      await time.increaseTo(lockInfo.unlockTime + 5n);
      await expect(
        staking.connect(subject).withdraw([0]),
      ).to.be.revertedWithCustomError(staking, "NotOwner");
    });
  });

  describe("getTotalStakedAmount", () => {
    it("should return total staked amount", async () => {
      const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
        await deploy();
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      // get block number

      // making 5 deposits
      const depositAmount = BigInt(1e18);
      for (let i = 0; i < 5; i++) {
        await staking
          .connect(buyer)
          .depositAndLock(subject, depositAmount.toString());
      }

      let totalStaked = await staking.getTotalStakedAmount(
        buyer.address,
        await subject.getAddress(),
        [0, 1, 2, 3, 4],
      );
      expect(totalStaked).to.eq(depositAmount * 5n);
    });

    it("should revert if subject passed is invalid", async () => {
      const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
        await deploy();
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      // get block number

      // making 5 deposits
      const depositAmount = BigInt(1e18);

      await staking
        .connect(buyer)
        .depositAndLock(subject, depositAmount.toString());

      await expect(
        staking.getTotalStakedAmount(buyer.address, zeroAddress, [0]),
      ).to.be.revertedWithCustomError(staking, "InvalidSubjectToken");
    });

    it("should revert trying to fetch incorrect user's total staked amount", async () => {
      const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
        await deploy();

      await expect(
        staking.getTotalStakedAmount(
          buyer.address,
          await subject.getAddress(),
          [0],
        ),
      )
        .to.be.revertedWithCustomError(staking, "NotSameUser")
        .withArgs(0);
    });
  });

  describe("extendLock", () => {
    it("should revert with invalidIndex,since index does not exist", async () => {
      const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
        await deploy();
      await expect(staking.connect(buyer).extendLock([10]))
        .to.be.revertedWithCustomError(staking, "InvalidIndex")
        .withArgs(10);
    });

    it("should revert with NotSameUser,since owner who called doesnt have the passed locked index", async () => {
      const {
        staking,
        buyer,
        subject,
        subjectToken,
        initialSupply,
        lockTime,
        buyer2,
      } = await deploy();
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      const depositAmount = BigInt(1e18);
      await staking
        .connect(buyer)
        .depositAndLock(subject, depositAmount.toString());

      await expect(staking.connect(buyer2).extendLock([0]))
        .to.be.revertedWithCustomError(staking, "NotSameUser")
        .withArgs(0);
    });

    it("should extend lock", async () => {
      const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
        await deploy();
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      const depositAmount = BigInt(1e18);
      for (let i = 0; i < 5; i++) {
        await staking
          .connect(buyer)
          .depositAndLock(subject, depositAmount.toString());
      }

      await expect(staking.connect(buyer).extendLock([0, 1, 2, 3, 4]))
        .to.emit(staking, "LockExtended")
        .withArgs([0, 1, 2, 3, 4]);
    });
  });

  describe("getLockCount", () => {
    it("should return lock count", async () => {
      const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
        await deploy();
      let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
      await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
      const depositAmount = BigInt(1e18);
      for (let i = 0; i < 5; i++) {
        await staking
          .connect(buyer)
          .depositAndLock(subject, depositAmount.toString());
      }
      let lockCount = await staking.getLockCount();
      expect(lockCount).to.eq(5);
    });
  });
});
