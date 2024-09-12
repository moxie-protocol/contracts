import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers, network } from "hardhat";
import {
  MoxiePass,
  SubjectERC20 as SubjectERC20Type,
} from "../typechain-types";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import {
  MoxieToken as MoxieTokenAddress,
  MoxiePass as MoxiePassAddress,
  TokenManager as TokenManagerAddress,
  MoxieBondingCurve as MoxieBondingCurveAddress,
  MoxiePassMinterAddress,
  SubjectTokenHolder,
  SubjectToken,
  Subject,
  MoxieTokenHolder,
} from "./testnet.json";
// import {
//  getExpectedSellReturnAndFee,
//  getExpectedBuyAmountAndFee,
// } from "./utils";
const zeroAddress = "0x0000000000000000000000000000000000000000";

const mintMoxiePass = async (address: string, moxiePass: MoxiePass) => {
  const moxiePassMinter = await actAs(MoxiePassMinterAddress);
  await moxiePass.connect(moxiePassMinter).mint(address, "uri");
  await stopActAs(MoxiePassMinterAddress);
};

const actAs = async (address: string) => {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });
  return await ethers.getSigner(address);
};
const stopActAs = async (address: string) => {
  await network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [address],
  });
};

const setNativeToken = async (address: string, amount: bigint) => {
  // convert amount to hex
  let amt = "0x" + amount.toString(16);
  await network.provider.send("hardhat_setBalance", [address, amt]);
};

const getERC20 = async (address: string) => {
  return await ethers.getContractAt("IERC20Metadata", address);
};

const getDeployedContracts = async () => {
  const tokenManager = await hre.ethers.getContractAt(
    "contracts/interfaces/ITokenManager.sol:ITokenManager",
    TokenManagerAddress,
  );
  const moxieToken = await ethers.getContractAt(
    "IERC20Metadata",
    MoxieTokenAddress,
  );

  const moxieBondingCurve = await ethers.getContractAt(
    "contracts/interfaces/IMoxieBondingCurve.sol:IMoxieBondingCurve",
    MoxieBondingCurveAddress,
  );
  const moxiePass = await ethers.getContractAt("MoxiePass", MoxiePassAddress);

  return {
    tokenManager,
    moxieBondingCurve,
    moxieToken,
    moxiePass,
  };
};

describe("Staking", () => {
  const deploy = async () => {
    const [
      deployer,
      owner,
      feeBeneficiary,
      minter,
      stakingAdmin,
      changeLockRole,
      ...otherAccounts
    ] = await ethers.getSigners();
    const { tokenManager, moxieBondingCurve, moxieToken, moxiePass } =
      await getDeployedContracts();
    const Staking = await hre.ethers.getContractFactory("Staking");
    const lockTime = 60;
    const moxieBondingCurveAddress = await moxieBondingCurve.getAddress();

    const staking = await Staking.deploy(
      await tokenManager.getAddress(),
      moxieBondingCurveAddress,
      await moxieToken.getAddress(),
      lockTime,
      stakingAdmin.address,
      changeLockRole.address,
      { from: deployer.address },
    );

    await mintMoxiePass(await staking.getAddress(), moxiePass);
    return {
      owner,
      minter,
      deployer,
      feeBeneficiary,
      moxieToken,
      moxieBondingCurveAddress,
      staking,
      lockTime,
      otherAccounts,
      stakingAdmin,
      changeLockRole,
      tokenManager,
    };
  };

  describe("setChangeLockDurationRole", () => {
    it("should set CHANGE_LOCK_DURATION role", async () => {
      const { staking, stakingAdmin } = await loadFixture(deploy);
      await staking
        .connect(stakingAdmin)
        .setChangeLockDurationRole(stakingAdmin.address);
    });

    it("should revert if not called by correct role", async () => {
      const { staking, changeLockRole } = await loadFixture(deploy);
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
      const { staking, lockTime } = await loadFixture(deploy);
      const result = await staking.getLockPeriod();
      expect(result).to.eq(lockTime);
    });
  });

  describe("setLockPeriod", () => {
    it("should set the lock period", async () => {
      const { staking, changeLockRole } = await loadFixture(deploy);
      const newLockTime = 100;
      await expect(staking.connect(changeLockRole).setLockPeriod(newLockTime))
        .to.emit(staking, "LockPeriodUpdated")
        .withArgs(newLockTime);
      const result = await staking.getLockPeriod();
      expect(result).to.eq(newLockTime);
    });
    it("should revert if not called by correct role", async () => {
      const { staking, stakingAdmin } = await loadFixture(deploy);
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
    it("should deposit and lock tokens and withdraw", async () => {
      const { staking } = await loadFixture(deploy);
      const subjectOwner = await actAs(SubjectTokenHolder);
      await setNativeToken(subjectOwner.address, BigInt(1e18));
      const subjectToken = await getERC20(SubjectToken);
      let fanTokenBalance = await subjectToken.balanceOf(subjectOwner.address);
      await subjectToken
        .connect(subjectOwner)
        .approve(staking, fanTokenBalance);
      await expect(
        staking.connect(subjectOwner).depositAndLock(Subject, fanTokenBalance),
      )
        .to.emit(staking, "Lock")
        .withArgs(
          subjectOwner.address,
          Subject,
          SubjectToken,
          0,
          fanTokenBalance,
          anyValue,
        );
      let lockInfo = await staking.getLockInfo(0);
      expect(lockInfo.amount).to.eq(fanTokenBalance);
      expect(lockInfo.subject).to.eq(Subject);
      expect(lockInfo.subjectToken).to.eq(SubjectToken);
      expect(lockInfo.amount).to.eq(fanTokenBalance);
      let currentBalance = await subjectToken.balanceOf(subjectOwner.address);
      expect(currentBalance).to.eq(0);
      await time.increaseTo(lockInfo.unlockTime + 1n);

      await expect(staking.connect(subjectOwner).withdraw([0]))
        .to.emit(staking, "Withdraw")
        .withArgs(
          subjectOwner.address,
          Subject,
          SubjectToken,
          [0],
          fanTokenBalance,
        );
    });

    // it("should revert if amount is zero", async () => {
    //   const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
    //     await loadFixture(deploy);
    //   let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
    //   await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
    //   // get block number
    //   await expect(
    //     staking.connect(buyer).depositAndLock(subject, 0),
    //   ).to.be.revertedWithCustomError(staking, "AmountShouldBeGreaterThanZero");
    // });

    // it("should revert if subject is invalid", async () => {
    //   const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
    //     await loadFixture(deploy);
    //   // let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
    //   // await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
    //   // get block number
    //   await expect(
    //     staking.connect(buyer).depositAndLock(zeroAddress, "1"),
    //   ).to.be.revertedWithCustomError(staking, "InvalidSubjectToken");
    // });
  });

  describe("buyAndLock", () => {
    it("should buy and lock tokens & withdraw", async () => {
      const {
        staking,

        owner,
        moxieToken,
      } = await loadFixture(deploy);
      const amt = (1e18).toString();
      const stakingAddress = await staking.getAddress();
      const moxieTokenHolder = await actAs(MoxieTokenHolder);

      await moxieToken.connect(moxieTokenHolder).approve(stakingAddress, amt);

      await expect(
        staking
          .connect(moxieTokenHolder)
          .buyAndLock(await subject.getAddress(), amt, 0),
      )
        .to.emit(staking, "Lock")
        .withArgs(owner.address, Subject, SubjectToken, 0, anyValue, anyValue);
      let lockInfo = await staking.getLockInfo(0);
      console.log(lockInfo);
      // let oldOwnerBalance = await subjectToken.balanceOf(owner.address);
      // await time.increaseTo(lockInfo.unlockTime);

      // await expect(staking.connect(owner).withdraw([0]))
      //   .to.emit(staking, "Withdraw")
      //   .withArgs(
      //     owner.address,
      //     subject.address,
      //     await subjectToken.getAddress(),
      //     [0],
      //     lockInfo.amount,
      //   );
      // let newOwnerBalance = await subjectToken.balanceOf(owner.address);

      // expect(newOwnerBalance - oldOwnerBalance).to.eq(lockInfo.amount);
      // let newLockinfo = await staking.getLockInfo(0);
      // expect(newLockinfo.amount).to.eq(0);
      // expect(newLockinfo.unlockTime).to.eq(0);
      // expect(newLockinfo.subject).to.eq(zeroAddress);
      // expect(newLockinfo.subjectToken).to.eq(zeroAddress);
      // expect(newLockinfo.user).to.eq(zeroAddress);
    });
  });

  // describe("withdraw", () => {
  //   it("should revert with EmptyIndexes", async () => {
  //     const { staking, owner } = await loadFixture(deploy);

  //     await expect(
  //       staking.connect(owner).withdraw([]),
  //     ).to.be.revertedWithCustomError(staking, "EmptyIndexes");
  //   });

  //   it("should withdraw multiple locks", async () => {
  //     const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
  //       await loadFixture(deploy);
  //     let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
  //     await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
  //     // get block number

  //     // making 5 deposits
  //     const depositAmount = BigInt(1e18);
  //     for (let i = 0; i < 5; i++) {
  //       await staking
  //         .connect(buyer)
  //         .depositAndLock(subject, depositAmount.toString());
  //     }
  //     let balanceAfterDeposit = await subjectToken.balanceOf(buyer.address);
  //     let lastLockInfo = await staking.getLockInfo(4);
  //     // move time to unlock time
  //     await time.increaseTo(lastLockInfo.unlockTime + 1n);
  //     await expect(staking.connect(buyer).withdraw([0, 1, 2, 3, 4]))
  //       .to.emit(staking, "Withdraw")
  //       .withArgs(
  //         buyer.address,
  //         subject.address,
  //         await subjectToken.getAddress(),
  //         [0, 1, 2, 3, 4],
  //         (depositAmount * 5n).toString(),
  //       );
  //   });

  //   it("should revert if subjects are different", async () => {
  //     const {
  //       staking,
  //       buyer,
  //       subject,
  //       subjectToken,
  //       initialSupply,
  //       lockTime,
  //       subject2,
  //       subjectToken2,
  //     } = await loadFixture(deploy);
  //     const stakeAmount = BigInt(1e18);
  //     // let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
  //     // let fanTokenBalance2 = await subjectToken2.balanceOf(buyer.address);

  //     await subjectToken
  //       .connect(buyer)
  //       .approve(await staking.getAddress(), stakeAmount);
  //     await subjectToken2
  //       .connect(buyer)
  //       .approve(await staking.getAddress(), stakeAmount);

  //     // making 5 deposits
  //     await staking
  //       .connect(buyer)
  //       .depositAndLock(subject, stakeAmount.toString());

  //     await staking
  //       .connect(buyer)
  //       .depositAndLock(subject2, stakeAmount.toString());

  //     let lastLockInfo = await staking.getLockInfo(1);
  //     // move time to unlock time
  //     await time.increaseTo(lastLockInfo.unlockTime + 1n);
  //     await expect(staking.connect(buyer).withdraw([0, 1]))
  //       .to.be.revertedWithCustomError(staking, "SubjectsDoesntMatch")
  //       .withArgs(1);
  //   });

  //   it("should revert if lock not expired", async () => {
  //     const {
  //       staking,
  //       buyer,
  //       subject,
  //       subjectToken,
  //       initialSupply,
  //       lockTime,
  //       subject2,
  //       subjectToken2,
  //     } = await loadFixture(deploy);
  //     const stakeAmount = BigInt(1e18);
  //     // let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
  //     // let fanTokenBalance2 = await subjectToken2.balanceOf(buyer.address);

  //     await subjectToken
  //       .connect(buyer)
  //       .approve(await staking.getAddress(), (stakeAmount * 2n).toString());

  //     // making 5 deposits
  //     await staking
  //       .connect(buyer)
  //       .depositAndLock(subject, stakeAmount.toString());
  //     // pass 5 seconds
  //     await time.increase(5);
  //     await staking
  //       .connect(buyer)
  //       .depositAndLock(subject, stakeAmount.toString());
  //     let lockInfo = await staking.getLockInfo(0);
  //     // move time to unlock time
  //     await time.increaseTo(lockInfo.unlockTime);
  //     let firstLockInfo = await staking.getLockInfo(1);
  //     await expect(staking.connect(buyer).withdraw([0, 1]))
  //       .to.be.revertedWithCustomError(staking, "LockNotExpired")
  //       .withArgs(1, anyValue, firstLockInfo.unlockTime);
  //   });

  //   it("should revert if owner is not same", async () => {
  //     // have to whitelist for withdraw as well
  //     const {
  //       staking,
  //       buyer,
  //       subject,
  //       subjectToken,
  //       initialSupply,
  //       lockTime,
  //       subject2,
  //       subjectToken2,
  //     } = await loadFixture(deploy);
  //     const stakeAmount = BigInt(1e18);
  //     // let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
  //     // let fanTokenBalance2 = await subjectToken2.balanceOf(buyer.address);

  //     await subjectToken
  //       .connect(buyer)
  //       .approve(await staking.getAddress(), (stakeAmount * 2n).toString());

  //     // making 5 deposits
  //     await staking
  //       .connect(buyer)
  //       .depositAndLock(subject, stakeAmount.toString());

  //     let lockInfo = await staking.getLockInfo(0);
  //     // move time to unlock time
  //     await time.increaseTo(lockInfo.unlockTime + 5n);
  //     await expect(
  //       staking.connect(subject).withdraw([0]),
  //     ).to.be.revertedWithCustomError(staking, "NotOwner");
  //   });
  // });

  // describe("getTotalStakedAmount", () => {
  //   it("should return total staked amount", async () => {
  //     const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
  //       await loadFixture(deploy);
  //     let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
  //     await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
  //     // get block number

  //     // making 5 deposits
  //     const depositAmount = BigInt(1e18);
  //     for (let i = 0; i < 5; i++) {
  //       await staking
  //         .connect(buyer)
  //         .depositAndLock(subject, depositAmount.toString());
  //     }

  //     let totalStaked = await staking.getTotalStakedAmount(
  //       buyer.address,
  //       await subject.getAddress(),
  //       [0, 1, 2, 3, 4],
  //     );
  //     expect(totalStaked).to.eq(depositAmount * 5n);
  //   });

  //   it("should revert if subject passed is invalid", async () => {
  //     const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
  //       await loadFixture(deploy);
  //     let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
  //     await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
  //     // get block number

  //     // making 5 deposits
  //     const depositAmount = BigInt(1e18);

  //     await staking
  //       .connect(buyer)
  //       .depositAndLock(subject, depositAmount.toString());

  //     await expect(
  //       staking.getTotalStakedAmount(buyer.address, zeroAddress, [0]),
  //     ).to.be.revertedWithCustomError(staking, "InvalidSubjectToken");
  //   });

  //   it("should revert trying to fetch incorrect user's total staked amount", async () => {
  //     const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
  //       await loadFixture(deploy);

  //     await expect(
  //       staking.getTotalStakedAmount(
  //         buyer.address,
  //         await subject.getAddress(),
  //         [0],
  //       ),
  //     )
  //       .to.be.revertedWithCustomError(staking, "NotSameUser")
  //       .withArgs(0);
  //   });
  // });

  // describe("extendLock", () => {
  //   it("should revert with invalidIndex,since index does not exist", async () => {
  //     const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
  //       await loadFixture(deploy);
  //     await expect(staking.connect(buyer).extendLock([10]))
  //       .to.be.revertedWithCustomError(staking, "InvalidIndex")
  //       .withArgs(10);
  //   });

  //   it("should revert with NotSameUser,since owner who called doesnt have the passed locked index", async () => {
  //     const {
  //       staking,
  //       buyer,
  //       subject,
  //       subjectToken,
  //       initialSupply,
  //       lockTime,
  //       buyer2,
  //     } = await loadFixture(deploy);
  //     let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
  //     await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
  //     const depositAmount = BigInt(1e18);
  //     await staking
  //       .connect(buyer)
  //       .depositAndLock(subject, depositAmount.toString());

  //     await expect(staking.connect(buyer2).extendLock([0]))
  //       .to.be.revertedWithCustomError(staking, "NotSameUser")
  //       .withArgs(0);
  //   });

  //   it("should extend lock", async () => {
  //     const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
  //       await loadFixture(deploy);
  //     let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
  //     await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
  //     const depositAmount = BigInt(1e18);
  //     for (let i = 0; i < 5; i++) {
  //       await staking
  //         .connect(buyer)
  //         .depositAndLock(subject, depositAmount.toString());
  //     }

  //     await expect(staking.connect(buyer).extendLock([0, 1, 2, 3, 4]))
  //       .to.emit(staking, "LockExtended")
  //       .withArgs([0, 1, 2, 3, 4]);
  //   });
  // });

  // describe("getLockCount", () => {
  //   it("should return lock count", async () => {
  //     const { staking, buyer, subject, subjectToken, initialSupply, lockTime } =
  //       await loadFixture(deploy);
  //     let fanTokenBalance = await subjectToken.balanceOf(buyer.address);
  //     await subjectToken.connect(buyer).approve(staking, fanTokenBalance);
  //     const depositAmount = BigInt(1e18);
  //     for (let i = 0; i < 5; i++) {
  //       await staking
  //         .connect(buyer)
  //         .depositAndLock(subject, depositAmount.toString());
  //     }
  //     let lockCount = await staking.getLockCount();
  //     expect(lockCount).to.eq(5);
  //   });
  // });
});
