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
  AlreadyBoughtVesting,
  AlreadyBoughtSubjectToken,
  AlreadyBoughtVestingBeneficiary,
  AlreadyBoughtSubject,
  AlreadyBoughtVestingManager,
  AlreadyBoughtVestingManagerOwner
} from "./testnet.json";
import { getDepositAndLockCalldata, getApproveCalldata } from "./Utils";
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

    // deploy the Staking contract
    const staking = await Staking.deploy({ from: deployer.address });
    await staking
      .connect(deployer)
      .initialize(
        await tokenManager.getAddress(),
        await moxieBondingCurve.getAddress(),
        await moxieToken.getAddress(),
        stakingAdmin.address,
      );
    await staking
      .connect(stakingAdmin)
      .grantRole(await staking.CHANGE_LOCK_DURATION(), changeLockRole.address);
    await staking.connect(changeLockRole).setLockPeriod(lockTime, true);
    // mint moxie pass to staking contract
    const stakingAddress = await staking.getAddress();
    await mintMoxiePass(await staking.getAddress(), moxiePass);
    // addTokenDestination to vesting manager
    // const vestingManager = await ethers.getContractAt("IMoxieTokenLockManager", AlreadyBoughtVestingManager)
    // const ownerOfManager = await actAs(AlreadyBoughtVestingManagerOwner)
    // await vestingManager.connect(ownerOfManager).addTokenDestination(await staking.getAddress())
    // setAuthFunctionCallMany to tokenLockManager ,with signatures (deposit,buy ,extend & withdraw)
    // const sigs = ["depositAndLock(address,uint256,uint256)", "buyAndLock(address,uint256,uint256,uint256)"]
    // await vestingManager.connect(ownerOfManager).setAuthFunctionCallMany(sigs, await staking.getAddress())
    // initialize (address _tokenManager, address _moxieBondingCurve, address _moxieToken, address _defaultAdmin)
    // call approveProtocol() from tokenLockWallet



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

  describe("setLockPeriod", () => {
    it("should set the lock period", async () => {
      const { staking, changeLockRole, lockTime } = await loadFixture(deploy);
      const newLockTime = 100;
      await expect(
        staking.connect(changeLockRole).setLockPeriod(newLockTime, true),
      )
        .to.emit(staking, "LockPeriodUpdated")
        .withArgs(newLockTime, true);
      const result = await staking.lockPeriods(newLockTime);
      expect(result).to.true;
      const result2 = await staking.lockPeriods(lockTime);
      expect(result2).to.true;
      await expect(
        staking.connect(changeLockRole).setLockPeriod(newLockTime, false),
      )
        .to.emit(staking, "LockPeriodUpdated")
        .withArgs(newLockTime, false);

      const result3 = await staking.lockPeriods(newLockTime);
      expect(result3).to.false;
    });

    it("should revert if lockperiod is already set", async () => {
      const { staking, changeLockRole, lockTime } = await loadFixture(deploy);
      await expect(
        staking.connect(changeLockRole).setLockPeriod(lockTime, true),
      ).to.be.revertedWithCustomError(staking, "Staking_LockPeriodAlreadySet");
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
    it("should deposit and lock tokens and withdraw", async () => {
      const { staking, lockTime } = await loadFixture(deploy);
      const subjectOwner = await actAs(SubjectTokenHolder);
      await setNativeToken(subjectOwner.address, BigInt(1e18));
      const subjectToken = await getERC20(SubjectToken);
      let fanTokenBalance = await subjectToken.balanceOf(subjectOwner.address);
      await subjectToken
        .connect(subjectOwner)
        .approve(staking, fanTokenBalance);
      await expect(
        staking
          .connect(subjectOwner)
          .depositAndLock(Subject, fanTokenBalance, lockTime),
      )
        .to.emit(staking, "Lock")
        .withArgs(
          subjectOwner.address,
          Subject,
          SubjectToken,
          0,
          fanTokenBalance,
          anyValue,
          lockTime,
        );
      let lockInfo = await staking.locks(0);
      expect(lockInfo.amount).to.eq(fanTokenBalance);
      expect(lockInfo.subject).to.eq(Subject);
      expect(lockInfo.subjectToken).to.eq(SubjectToken);
      expect(lockInfo.amount).to.eq(fanTokenBalance);
      let currentBalance = await subjectToken.balanceOf(subjectOwner.address);
      expect(currentBalance).to.eq(0);
      await time.increaseTo(lockInfo.unlockTime + 1n);

      await expect(staking.connect(subjectOwner).withdraw([0], Subject))
        .to.emit(staking, "Withdraw")
        .withArgs(
          subjectOwner.address,
          Subject,
          SubjectToken,
          [0],
          fanTokenBalance,
        );
    });

    it("vesting -> should deposit and lock tokens and withdraw", async () => {
      const { staking, lockTime, tokenManager } = await loadFixture(deploy);
      const subjectToken = await getERC20(AlreadyBoughtSubjectToken);

      // getting amount locked in vesting contract
      const balance = await subjectToken.balanceOf(AlreadyBoughtVesting);
      // to deposit this amount in staking contract
      // 1. get calldata
      const calldata = getDepositAndLockCalldata(
        AlreadyBoughtSubject,
        balance,
        lockTime,
      );
      // 2. add addTokenDestination to vesting manager
      // 3. call approveProtocol() on vesting manager
      // 4. authorize function signature and contract address
      const sig = "depositAndLock(address,uint256,uint256)"
      const vestingManager = await ethers.getContractAt("IMoxieTokenLockManager", AlreadyBoughtVestingManager)
      const ownerOfManager = await actAs(AlreadyBoughtVestingManagerOwner)

      console.log("staking address::", await staking.getAddress())
      let tx = await vestingManager.connect(ownerOfManager).setAuthFunctionCall(sig, await staking.getAddress())
      let resp = await tx.wait()
      console.log(resp!.logs)
      // 3. call the function
      const user = await actAs(AlreadyBoughtVestingBeneficiary);
      await setNativeToken(user.address, BigInt(1e18));
      await subjectToken.connect(user).approve(AlreadyBoughtVesting, balance);
      await setNativeToken(user.address, BigInt(1e18));

      const approvalCalldata = await getApproveCalldata(
        await staking.getAddress(),
        balance,
      )
      console.log("approval:", await user.sendTransaction({
        to: AlreadyBoughtVesting,
        value: 0,
        data: approvalCalldata,
      }))
      console.log("deposit:", await user.sendTransaction({
        to: AlreadyBoughtVesting,
        value: 0,
        data: calldata,
      }))
      // console.log(await vesting.connect(user).call(calldata))

      // const subjectOwner = await actAs(SubjectTokenHolder);
      // await setNativeToken(subjectOwner.address, BigInt(1e18));
      // const subjectToken = await getERC20(SubjectToken);
      // let fanTokenBalance = await subjectToken.balanceOf(subjectOwner.address);
      // await subjectToken
      //   .connect(subjectOwner)
      //   .approve(staking, fanTokenBalance);
      // await expect(
      //   staking.connect(subjectOwner).depositAndLock(Subject, fanTokenBalance),
      // )
      //   .to.emit(staking, "Lock")
      //   .withArgs(
      //     subjectOwner.address,
      //     Subject,
      //     SubjectToken,
      //     0,
      //     fanTokenBalance,
      //     anyValue,
      //     lockTime
      //   );
      // let lockInfo = await staking.locks(0);
      // expect(lockInfo.amount).to.eq(fanTokenBalance);
      // expect(lockInfo.subject).to.eq(Subject);
      // expect(lockInfo.subjectToken).to.eq(SubjectToken);
      // expect(lockInfo.amount).to.eq(fanTokenBalance);
      // let currentBalance = await subjectToken.balanceOf(subjectOwner.address);
      // expect(currentBalance).to.eq(0);
      // await time.increaseTo(lockInfo.unlockTime + 1n);

      // await expect(staking.connect(subjectOwner).withdraw([0], Subject))
      //   .to.emit(staking, "Withdraw")
      //   .withArgs(
      //     subjectOwner.address,
      //     Subject,
      //     SubjectToken,
      //     [0],
      //     fanTokenBalance,
      //   );
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
        lockTime,
      } = await loadFixture(deploy);
      const stakingAddress = await staking.getAddress();

      const moxieTokenHolder = await actAs(MoxieTokenHolder);

      // await moxieToken.connect(moxieTokenHolder).transfer(SubjectTokenHolder, amt);

      const subjectTokenHolder = await actAs(SubjectTokenHolder);
      await setNativeToken(SubjectTokenHolder, BigInt(1e18));

      const balance = await moxieToken.balanceOf(SubjectTokenHolder);
      await moxieToken
        .connect(subjectTokenHolder)
        .approve(stakingAddress, balance);
      await expect(
        staking
          .connect(subjectTokenHolder)
          .buyAndLock(Subject, balance, 0, lockTime),
      )
        .to.emit(staking, "Lock")
        .withArgs(
          SubjectTokenHolder,
          Subject,
          SubjectToken,
          0,
          anyValue,
          anyValue,
          lockTime,
        );
      let lockInfo = await staking.locks(0);
      const subjectToken = await getERC20(SubjectToken);

      let oldOwnerBalance = await subjectToken.balanceOf(
        subjectTokenHolder.address,
      );
      await time.increaseTo(lockInfo.unlockTime);

      await expect(staking.connect(subjectTokenHolder).withdraw([0], Subject))
        .to.emit(staking, "Withdraw")
        .withArgs(
          subjectTokenHolder.address,
          Subject,
          SubjectToken,
          [0],
          anyValue,
        );
      let newOwnerBalance = await subjectToken.balanceOf(
        subjectTokenHolder.address,
      );

      expect(newOwnerBalance - oldOwnerBalance).to.eq(lockInfo.amount);
      let newLockinfo = await staking.locks(0);
      expect(newLockinfo.amount).to.eq(0);
      expect(newLockinfo.unlockTime).to.eq(0);
      expect(newLockinfo.subject).to.eq(zeroAddress);
      expect(newLockinfo.subjectToken).to.eq(zeroAddress);
      expect(newLockinfo.user).to.eq(zeroAddress);
    });
  });
});
