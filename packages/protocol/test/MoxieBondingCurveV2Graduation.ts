import hre, { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { HDNodeWallet } from "ethers";
import { expect } from "chai";
import { IERC20 } from "../typechain-types";

describe("MoxieBondingCurveV2Graduation", () => {
  const PCT_BASE = BigInt(10 ** 18);
  const deploy = async () => {
    const [
      deployer,
      owner,
      feeBeneficiary,
      minter,
      subjectFactory,
      buyer,
      seller,
      buyer2,
      seller2,
      platformReferrer,
      orderReferrer,
    ] = await ethers.getSigners();

    const MoxieToken = await hre.ethers.getContractFactory("MoxieToken");
    const BancorFormula = await hre.ethers.getContractFactory("BancorFormula");
    const Vault = await hre.ethers.getContractFactory("Vault");
    const FakeDonator = await hre.ethers.getContractFactory("FakeDonator");
    const SubjectERC20 = await hre.ethers.getContractFactory("SubjectERC20");

    const MoxiePass = await hre.ethers.getContractFactory("MoxiePass");
    const MoxiePassVerifier = await hre.ethers.getContractFactory(
      "MockMoxiePassVerifier",
    );
    const TokenManager = await hre.ethers.getContractFactory("TokenManager");

    const MoxieBondingCurve = await hre.ethers.getContractFactory(
      "MoxieBondingCurveV2",
    );

    const ProtocolRewards =
      await hre.ethers.getContractFactory("ProtocolRewards");

    // moxie Token
    const moxieToken = await MoxieToken.connect(owner).deploy();

    // formula deployment
    const formula = await BancorFormula.deploy();

    // vault deployment
    const vaultInstance = await Vault.deploy({ from: deployer.address });

    await vaultInstance.connect(deployer).initialize(owner.address);
    // subject deployment
    const subjectErc20 = await SubjectERC20.deploy({
      from: deployer.address,
    });

    // Moxie Pass
    const moxiePass = await MoxiePass.deploy(owner.address, minter.address);

    // moxie pass verifier
    const moxiePassVerifier = await MoxiePassVerifier.deploy(owner.address);
    await moxiePassVerifier
      .connect(owner)
      .setErc721ContractAddress(await moxiePass.getAddress());

    //subjectErc20
    const subjectErc20Address = await subjectErc20.getAddress();

    const tokenManager = await TokenManager.deploy({
      from: deployer.address,
    });
    await tokenManager
      .connect(deployer)
      .initialize(owner.address, subjectErc20Address);

    // moxie Bonding curve
    const moxieBondingCurve = await MoxieBondingCurve.deploy();

    const protocolRewards = await ProtocolRewards.deploy();

    const moxieTokenAddress = await moxieToken.getAddress();
    const formulaAddress = await formula.getAddress();
    const tokenManagerAddress = await tokenManager.getAddress();
    const vaultAddress = await vaultInstance.getAddress();
    const protocolBuyFeePct = (1e16).toString(); // 1%
    const protocolSellFeePct = (2 * 1e16).toString(); // 2%
    const subjectBuyFeePct = (3 * 1e16).toString(); // 3%
    const subjectSellFeePct = (4 * 1e16).toString(); // 4%

    await protocolRewards.initialize(moxieTokenAddress, owner);

    const feeInput = {
      protocolBuyFeePct,
      protocolSellFeePct,
      subjectBuyFeePct,
      subjectSellFeePct,
      // initialized to 50% later
      swapFeeRatioProtocolPct: 0,
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

    const UniswapDeployer =
      await hre.ethers.getContractFactory("UniswapDeployer");
    const uniswapDeployer = await UniswapDeployer.deploy();
    await uniswapDeployer.deployAll();

    const poolManager = await uniswapDeployer.poolManager();
    const fakeDonator = await FakeDonator.deploy(poolManager);

    await moxiePass.connect(minter).mint(await uniswapDeployer.poolManager(), "url");
    await moxiePass.connect(minter).mint(await fakeDonator.getAddress(), "url");
    await moxiePass.connect(minter).mint(await uniswapDeployer.positionManager(), "url");
    await moxiePass.connect(minter).mint(await uniswapDeployer.universalRouter(), "url");

    const GraduationHook =
      await hre.ethers.getContractFactory("GraduationHook");
    const graduationConstructorArgs = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address"],
      [
        await uniswapDeployer.poolManager(),
        await moxieBondingCurve.getAddress(),
      ],
    );

    const [graduationHookAddress, salt] = await uniswapDeployer.mineHookAddress(
      await uniswapDeployer.getAddress(),
      // after initialize hook flag
      4096,
      GraduationHook.bytecode,
      graduationConstructorArgs,
    );

    await uniswapDeployer.deployHook(
      GraduationHook.bytecode,
      graduationConstructorArgs,
      salt,
    );

    await moxieBondingCurve.reinitialize(
      ethers.MaxUint256 / BigInt("1000000000000000000"),
      graduationHookAddress,
      await uniswapDeployer.positionManager(),
      await uniswapDeployer.universalRouter(),
      // 50%
      ethers.parseEther("0.5"),
    );

    await moxieBondingCurve
      .connect(owner)
      .grantRole(await moxieBondingCurve.UPDATE_PROTOCOL_REWARD_ROLE(), owner);
    await moxieBondingCurve
      .connect(owner)
      .updateProtocolRewardAddress(await protocolRewards.getAddress());
    await moxieBondingCurve
      .connect(owner)
      .grantRole(
        await moxieBondingCurve.UPDATE_GRADUATION_MARKET_CAP_ROLE(),
        owner,
      );

    await moxiePass.connect(minter).mint(owner.address, "uri");
    await moxiePass.connect(minter).mint(deployer.address, "uri");
    await moxiePass.connect(minter).mint(subjectFactory.address, "uri");
    await moxiePass
      .connect(minter)
      .mint(await moxieBondingCurve.getAddress(), "uri");
    await moxiePass
      .connect(minter)
      .mint(await tokenManager.getAddress(), "uri");

    const initialSupply = ethers.parseEther("10");
    const initialReserve = ethers.parseEther("10000");

    await tokenManager
      .connect(owner)
      .grantRole(await tokenManager.CREATE_ROLE(), subjectFactory.address);
    const passVerifierAddress = await moxiePassVerifier.getAddress();

    let subjectLower: undefined | HDNodeWallet;
    let subjectHigher: undefined | HDNodeWallet;

    while (!subjectLower || !subjectHigher) {
      let tmpSubject = ethers.Wallet.createRandom();
      await tokenManager
        .connect(subjectFactory)
        .create(tmpSubject, "test", "test", initialSupply, passVerifierAddress);

      const tmpSubjectTokenAddress = await tokenManager.tokens(
        tmpSubject.address,
      );
      if (tmpSubjectTokenAddress < moxieTokenAddress) {
        subjectLower = tmpSubject;
      } else if (tmpSubjectTokenAddress > moxieTokenAddress) {
        subjectHigher = tmpSubject;
      }
    }

    await moxiePass.connect(minter).mint(subjectLower.address, "uri");
    await moxiePass.connect(minter).mint(subjectHigher.address, "uri");

    const moxieBondingCurveAddress = await moxieBondingCurve.getAddress();

    const subjectTokenAddressLower = await tokenManager.tokens(
      subjectLower!.address,
    );
    const subjectTokenLower = SubjectERC20.attach(
      subjectTokenAddressLower,
    ) as IERC20;

    const subjectTokenAddressHigher = await tokenManager.tokens(
      subjectHigher!.address,
    );
    const subjectTokenHigher = SubjectERC20.attach(
      subjectTokenAddressHigher,
    ) as IERC20;

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

    const referralFeeInput = {
      platformReferrerBuyFeePct: (10e16).toString(), //10%
      platformReferrerSellFeePct: (20e16).toString(), //20%,
      orderReferrerBuyFeePct: (30e16).toString(), //30%,
      orderReferrerSellFeePct: (40e16).toString(), //40%
    };

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
      subjectErc20,
      moxieTokenAddress,
      formulaAddress,
      tokenManagerAddress,
      vaultAddress,
      feeInput,
      subjectLower,
      subjectHigher,
      moxieBondingCurveAddress,
      subjectTokenLower,
      subjectTokenHigher,
      initialSupply,
      initialReserve,
      subjectTokenAddressLower,
      subjectTokenAddressHigher,
      buyer,
      seller,
      buyer2,
      seller2,
      PCT_BASE,
      protocolRewards,
      platformReferrer,
      orderReferrer,
      referralFeeInput,
      graduationHookAddress,
      uniswapDeployer,
      GraduationHook,
      fakeDonator,
    };
  };

  // this function buys shares with a predefined amount of moxie tokens
  // by setting the graduation market cap after this function it's possible to test the graduation for tokens that already surpassed the graduation market cap
  const setupForGraduation = async (
    deployment: any,
    reserveRatio: number,
    buyAmount: bigint,
    lower: boolean,
  ) => {
    const {
      moxieBondingCurve,
      subjectFactory,
      moxieToken,
      moxieBondingCurveAddress,
      initialReserve,
      initialSupply,
      subjectTokenAddress,
      buyer,
      owner,
      moxiePass,
      minter,
    } = deployment;

    const subject = lower ? deployment.subjectLower : deployment.subjectHigher;
    await moxieToken
      .connect(subjectFactory)
      .approve(moxieBondingCurveAddress, initialReserve);

    expect(
      await moxieBondingCurve
        .connect(subjectFactory)
        .initializeSubjectBondingCurve(
          subject.address,
          reserveRatio,
          initialSupply,
          initialReserve,
          ethers.ZeroAddress,
        ),
    )
      .to.emit(moxieBondingCurve, "BondingCurveInitialized")
      .withArgs(
        subject.address,
        subjectTokenAddress,
        initialSupply,
        initialReserve,
        reserveRatio,
      );

    // fund buyer
    await moxieToken
      .connect(owner)
      .transfer(buyer.address, ethers.parseEther("10000"));

    await moxiePass.connect(minter).mint(buyer.address, "url");

    await moxieToken
      .connect(owner)
      .approve(moxieBondingCurveAddress, ethers.MaxUint256);
    await expect(
      moxieBondingCurve
        .connect(owner)
        .buyShares(subject.address, buyAmount, 0),
    ).to.emit(moxieBondingCurve, "SubjectSharePurchased");

    await moxieToken
      .connect(buyer)
      .approve(moxieBondingCurveAddress, ethers.MaxUint256);
  };

  // graduation market cap 100 million moxie tokens
  const graduationMarketCap = ethers.parseEther("100000000");
  const PPM = BigInt(10 ** 6);
  const reserveRatios = [800000, 660000, 550000, 400000]; 
  const graduationReserve = (ratio: number) => {
    return (graduationMarketCap * BigInt(ratio)) / PPM;
  };

  const amountWithFee = (deployment: any, amount: bigint) => {
    return amount * PCT_BASE / (PCT_BASE - BigInt(deployment.protocolBuyFeePct) - BigInt(deployment.subjectBuyFeePct));
  }

  describe("Upgrade", () => {
    it("should not be able to call reinitialize again", async () => {
      const d = await loadFixture(deploy);
      await expect(d.moxieBondingCurve.connect(d.owner).reinitialize(
        ethers.MaxUint256 / BigInt("1000000000000000000"),
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        0
      )).to.be.revertedWithCustomError(d.moxieBondingCurve, "InvalidInitialization");
    });
  });

  describe("Graduation", () => {
    const testSubjects = [
      { name: "subjectLower", lower: true },
      { name: "subjectUpper", lower: false }
    ];

    testSubjects.forEach(({ name, lower }) => {
      describe(`with ${name}`, () => {
        it("should be able to graduate", async () => {
          let remainderForGraduation = ethers.parseEther("10");
          let remainderForSwap = ethers.parseEther("100");
          for (const reserveRatio of reserveRatios) {
            const d = await loadFixture(deploy);
            await d.moxieBondingCurve
              .connect(d.owner)
              .updateGraduationMarketCap(reserveRatio, graduationMarketCap);
            
            await setupForGraduation(
              d,
              reserveRatio,
              amountWithFee(d, graduationReserve(reserveRatio) - remainderForGraduation - d.initialReserve),
              lower,
            );

            const subject = lower ? d.subjectLower : d.subjectHigher;
            
            await expect(
              d.moxieBondingCurve
                .connect(d.buyer)
                .buyShares(
                  subject.address,
                  amountWithFee(d, remainderForGraduation) + remainderForSwap,
                  0,
                ),
            ).to.emit(d.moxieBondingCurve, "SubjectGraduated");
            
            expect(await d.moxieBondingCurve.subjectGraduated(subject.address)).to.be.true;
          }
        });

        it("should revert if subject already graduated", async () => {
          for (const reserveRatio of reserveRatios) {
            const d = await loadFixture(deploy);
            
            await d.moxieBondingCurve
              .connect(d.owner)
              .updateGraduationMarketCap(reserveRatio, graduationMarketCap);
            
            await setupForGraduation(
              d,
              reserveRatio,
              amountWithFee(d, graduationReserve(reserveRatio)),
              lower
            );

            const subject = lower ? d.subjectLower : d.subjectHigher;
            
            await expect(
              d.moxieBondingCurve.connect(d.buyer).graduateSubject(subject.address)
            ).to.be.revertedWithCustomError(
              d.moxieBondingCurve,
              "MoxieBondingCurve_SubjectAlreadyGraduated"
            );
          }
        });

        it("should revert if reserves below graduation threshold", async () => {
          for (const reserveRatio of reserveRatios) {
            const d = await loadFixture(deploy);
            
            await d.moxieBondingCurve
              .connect(d.owner)
              .updateGraduationMarketCap(reserveRatio, graduationMarketCap);
            
            await setupForGraduation(
              d,
              reserveRatio,
              amountWithFee(d, graduationReserve(reserveRatio) / 2n),
              lower
            );

            const subject = lower ? d.subjectLower : d.subjectHigher;
            
            await expect(
              d.moxieBondingCurve.connect(d.buyer).graduateSubject(subject.address)
            ).to.be.revertedWithCustomError(
              d.moxieBondingCurve,
              "MoxieBondingCurve_SubjectNotReadyForGraduation"
            );
          }
        });
      });
    });
  });

  describe("updateDefaultGraduationMarketCap", () => {
    it("should update default graduation market cap", async () => {
      const d = await loadFixture(deploy);
      const newMarketCap = ethers.parseEther("200000000"); // 200 million
      const currentMarketCap = ethers.MaxUint256 / BigInt("1000000000000000000"); 
      
      await expect(
        d.moxieBondingCurve
          .connect(d.owner)
          .updateDefaultGraduationMarketCap(newMarketCap)
      )
        .to.emit(d.moxieBondingCurve, "DefaultGraduationMarketCapUpdated")
        .withArgs(currentMarketCap, newMarketCap);

        // Verify the new value is set
        expect(await d.moxieBondingCurve.graduationMarketCap(reserveRatios[0])).to.equal(newMarketCap);
    });

    it("should revert if caller doesn't have UPDATE_GRADUATION_MARKET_CAP_ROLE", async () => {
      const d = await loadFixture(deploy);
      const newMarketCap = ethers.parseEther("200000000");

      await expect(
        d.moxieBondingCurve
          .connect(d.buyer)
          .updateDefaultGraduationMarketCap(newMarketCap)
      ).to.be.revertedWithCustomError(
        d.moxieBondingCurve,
        "AccessControlUnauthorizedAccount"
      );
    });
  });

  describe("updateGraduationMarketCap", () => {
    it("should update graduation market cap for specific reserve ratio", async () => {
      const d = await loadFixture(deploy);
      const reserveRatio = reserveRatios[0];
      const newMarketCap = ethers.parseEther("200000000"); 
      const oldMarketCap = await d.moxieBondingCurve.graduationMarketCap(reserveRatio);
      
      await expect(
        d.moxieBondingCurve
          .connect(d.owner)
          .updateGraduationMarketCap(reserveRatio, newMarketCap)
      )
        .to.emit(d.moxieBondingCurve, "GraduationMarketCapUpdated")
        .withArgs(reserveRatio, oldMarketCap, newMarketCap, false);

      expect(await d.moxieBondingCurve.graduationMarketCap(reserveRatio)).to.equal(newMarketCap);
    });

    it("should reset to default when setting to zero", async () => {
      const d = await loadFixture(deploy);
      const reserveRatio = reserveRatios[0];
      const defaultMarketCap = ethers.MaxUint256 / BigInt("1000000000000000000");
      
      const customMarketCap = ethers.parseEther("200000000");
      await d.moxieBondingCurve
        .connect(d.owner)
        .updateGraduationMarketCap(reserveRatio, customMarketCap);

      await expect(
        d.moxieBondingCurve
          .connect(d.owner)
          .updateGraduationMarketCap(reserveRatio, 0)
      )
        .to.emit(d.moxieBondingCurve, "GraduationMarketCapUpdated")
        .withArgs(reserveRatio, customMarketCap, defaultMarketCap, true);

      expect(await d.moxieBondingCurve.graduationMarketCap(reserveRatio)).to.equal(defaultMarketCap);
    });

    it("should revert if caller doesn't have UPDATE_GRADUATION_MARKET_CAP_ROLE", async () => {
      const d = await loadFixture(deploy);
      const newMarketCap = ethers.parseEther("200000000");

      await expect(
        d.moxieBondingCurve
          .connect(d.buyer)
          .updateGraduationMarketCap(reserveRatios[0], newMarketCap)
      ).to.be.revertedWithCustomError(
        d.moxieBondingCurve,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("should call _graduateSubject when reserves exceed market cap", async () => {
      const d = await loadFixture(deploy);
      const reserveRatio = 800000;
      const initialMarketCap = ethers.parseEther("100000000");
      const reducedMarketCap = ethers.parseEther("50000000"); 
      
      await d.moxieBondingCurve
        .connect(d.owner)
        .updateGraduationMarketCap(reserveRatio, initialMarketCap);

      const requiredReserve = (initialMarketCap * BigInt(reserveRatio)) / BigInt(10 ** 6);
      
      const buyAmount = amountWithFee(d, requiredReserve - d.initialReserve - ethers.parseEther("1000"));
      await setupForGraduation(d, reserveRatio, buyAmount, true);

      await d.moxieBondingCurve
        .connect(d.owner)
        .updateGraduationMarketCap(reserveRatio, reducedMarketCap);

      await expect(
        d.moxieBondingCurve
          .connect(d.owner)
          .graduateSubject(d.subjectLower.address)
      ).to.emit(d.moxieBondingCurve, "SubjectGraduated");
    });
  });

  describe("Slippage Check", () => {
    it("should revert if slippage exceeds limit during swap", async () => {
      const d = await loadFixture(deploy);
      const reserveRatio = 800000;
      const graduationMarketCap = ethers.parseEther("100000000");

      await d.moxieBondingCurve
        .connect(d.owner)
        .updateGraduationMarketCap(reserveRatio, graduationMarketCap);

      const requiredReserve = (graduationMarketCap * BigInt(reserveRatio)) / BigInt(10 ** 6);

      const buyAmount = amountWithFee(d, requiredReserve - d.initialReserve - ethers.parseEther("1000"));
      await setupForGraduation(d, reserveRatio, buyAmount, true);

      const subject = d.subjectLower;
      const minAmountOut = ethers.parseEther("1000000");
      await expect(
        d.moxieBondingCurve
          .connect(d.buyer)
          .buyShares(
            subject.address,
            amountWithFee(d, ethers.parseEther("2000")),
            minAmountOut
          )
      ).to.be.reverted;
    });
  });

  describe("Swap Operations", () => {
    const testSubjects = [
      { name: "subjectLower", lower: true },
      { name: "subjectHigher", lower: false }
    ];

    const swapAmounts = [
      ethers.parseEther("100"),
      ethers.parseEther("500"),
      ethers.parseEther("1000")
    ];
    const reducedMarketCap = ethers.parseEther("50000000");

    testSubjects.forEach(({ name, lower }) => {
      describe(`with ${name}`, () => {
        reserveRatios.forEach((reserveRatio) => {
          describe(`with reserve ratio ${reserveRatio}`, () => {
            swapAmounts.forEach((swapAmount) => {
              it(`should correctly process buy swap for amount ${swapAmount}`, async () => {
                const d = await loadFixture(deploy);
                const initialMarketCap = ethers.parseEther("100000000");

                await d.moxieBondingCurve
                  .connect(d.owner)
                  .updateGraduationMarketCap(reserveRatio, initialMarketCap);

                const requiredReserve = (initialMarketCap * BigInt(reserveRatio)) / BigInt(10 ** 6);
                const buyAmount = amountWithFee(d, requiredReserve - d.initialReserve - ethers.parseEther("1000"));
                await setupForGraduation(d, reserveRatio, buyAmount, lower);

                await d.moxieBondingCurve
                .connect(d.owner)
                .updateGraduationMarketCap(reserveRatio, reducedMarketCap);

              await expect(
                d.moxieBondingCurve
                  .connect(d.owner)
                  .graduateSubject(lower ? d.subjectLower.address : d.subjectHigher.address)
              ).to.emit(d.moxieBondingCurve, "SubjectGraduated");

                const subjectToken = lower ? d.subjectTokenLower : d.subjectTokenHigher;
                const subjectAddress = lower ? d.subjectLower.address : d.subjectHigher.address;
                const initialMoxieBalance = await d.moxieToken.balanceOf(d.buyer.address);
                const initialSubjectBalance = await subjectToken.balanceOf(d.buyer.address);
                await d.moxieToken
                  .connect(d.buyer)
                  .approve(await d.moxieBondingCurve.getAddress(), swapAmount);

                await expect(
                  d.moxieBondingCurve
                    .connect(d.buyer)
                    .swap(subjectAddress, true, swapAmount, 0)
                ).to.emit(d.moxieBondingCurve, "Swap");

                const postSwapMoxieBalance = await d.moxieToken.balanceOf(d.buyer.address);
                const postSwapSubjectBalance = await subjectToken.balanceOf(d.buyer.address);

                expect(initialMoxieBalance - postSwapMoxieBalance).to.be.approximately(
                  swapAmount,
                  1,
                  "Moxie balance not reduced by swap amount"
                );
                expect(postSwapSubjectBalance - initialSubjectBalance).to.be.gt(
                  0,
                  "Subject balance not increased after buy swap"
                );
              });

              it(`should correctly process sell swap for amount ${swapAmount}`, async () => {
                const d = await loadFixture(deploy);
                const initialMarketCap = ethers.parseEther("100000000");
                const subjectToken = lower ? d.subjectTokenLower : d.subjectTokenHigher;
                const subjectAddress = lower ? d.subjectLower.address : d.subjectHigher.address;

                await d.moxieBondingCurve
                  .connect(d.owner)
                  .updateGraduationMarketCap(reserveRatio, initialMarketCap);

                const requiredReserve = (initialMarketCap * BigInt(reserveRatio)) / BigInt(10 ** 6);
                const buyAmount = amountWithFee(d, requiredReserve - d.initialReserve - ethers.parseEther("1000"));
                await setupForGraduation(d, reserveRatio, buyAmount, lower);

                await d.moxieBondingCurve
                .connect(d.owner)
                .updateGraduationMarketCap(reserveRatio, reducedMarketCap);

              await expect(
                d.moxieBondingCurve
                  .connect(d.owner)
                  .graduateSubject(lower ? d.subjectLower.address : d.subjectHigher.address)
              ).to.emit(d.moxieBondingCurve, "SubjectGraduated");
              
                await d.moxieToken
                  .connect(d.buyer)
                  .approve(await d.moxieBondingCurve.getAddress(), swapAmount);

                await d.moxieBondingCurve
                  .connect(d.buyer)
                  .swap(subjectAddress, true, swapAmount, 0);

                const initialMoxieBalance = await d.moxieToken.balanceOf(d.buyer.address);
                const initialSubjectBalance = await subjectToken.balanceOf(d.buyer.address);

                await subjectToken
                  .connect(d.buyer)
                  .approve(await d.moxieBondingCurve.getAddress(), initialSubjectBalance);

                await expect(
                  d.moxieBondingCurve
                    .connect(d.buyer)
                    .swap(subjectAddress, false, initialSubjectBalance, 0)
                ).to.emit(d.moxieBondingCurve, "Swap");

                const postSwapMoxieBalance = await d.moxieToken.balanceOf(d.buyer.address);
                const postSwapSubjectBalance = await subjectToken.balanceOf(d.buyer.address);

                expect(postSwapMoxieBalance - initialMoxieBalance).to.be.gt(
                  0,
                  "Moxie balance not increased after sell swap"
                );
                expect(postSwapSubjectBalance).to.equal(
                  0,
                  "All subject tokens were sold"
                );
              });
            });
          });
        });
      });
    });
  });

  describe("Fee Distribution with Different Configurations", () => {
    const testSubjects = [
      { name: "subjectLower", lower: true },
      { name: "subjectHigher", lower: false }
    ];

    testSubjects.forEach(({ name, lower }) => {
      describe(`with ${name}`, () => {
        reserveRatios.forEach((reserveRatio) => {
          it(`should distribute swap fees correctly with reserve ratio ${reserveRatio}`, async () => {
            const d = await loadFixture(deploy);
                const donationAmount = ethers.parseEther("100");
                const initialMarketCap = ethers.parseEther("100000000");
                const reducedMarketCap = ethers.parseEther("50000000");

                await d.moxieBondingCurve
                  .connect(d.owner)
                  .updateGraduationMarketCap(reserveRatio, initialMarketCap);

                const requiredReserve = (initialMarketCap * BigInt(reserveRatio)) / BigInt(10 ** 6);
                const buyAmount = amountWithFee(d, requiredReserve - d.initialReserve - ethers.parseEther("1000"));
                await setupForGraduation(d, reserveRatio, buyAmount, lower);

                await d.moxieBondingCurve
                  .connect(d.owner)
                  .updateGraduationMarketCap(reserveRatio, reducedMarketCap);

                await expect(
                  d.moxieBondingCurve
                    .connect(d.owner)
                    .graduateSubject(lower ? d.subjectLower.address : d.subjectHigher.address)
                ).to.emit(d.moxieBondingCurve, "SubjectGraduated");
                const subjectToken = lower ? d.subjectTokenLower : d.subjectTokenHigher;
                await d.moxieToken.transfer(await d.fakeDonator.getAddress(), donationAmount);
                await subjectToken.connect(d.owner).transfer(await d.fakeDonator.getAddress(), donationAmount);
                await d.fakeDonator.connect(d.owner).donate(
                  d.graduationHookAddress,
                  await d.moxieToken.getAddress(),
                  lower ? d.subjectTokenAddressLower : d.subjectTokenAddressHigher
                );

                const protocolRewardsMoxieBalanceBefore = await d.moxieToken.balanceOf(d.protocolRewards);
                const poolManager = await d.uniswapDeployer.poolManager();
                const poolManagerMoxieBalanceBefore = await d.moxieToken.balanceOf(poolManager);
                const subjectSupplyBefore = await subjectToken.totalSupply();
                await d.moxieBondingCurve
                  .connect(d.owner)
                  .distributeSwapFee(
                    lower ? d.subjectLower.address : d.subjectHigher.address,
                  );
                const subjectSupplyAfter = await subjectToken.totalSupply();
                const poolManagerMoxieBalanceAfter = await d.moxieToken.balanceOf(poolManager);
                const protocolRewardMoxieBalanceAfter = await d.moxieToken.balanceOf(d.protocolRewards);
                expect(subjectSupplyBefore - subjectSupplyAfter).to.approximately(
                  donationAmount,
                  1,
                  "did not burn fees"
              );
                expect(poolManagerMoxieBalanceBefore - poolManagerMoxieBalanceAfter).to.approximately(
                  donationAmount,
                  1,
                  "did not transfer moxie"
                );
                expect(protocolRewardMoxieBalanceAfter - protocolRewardsMoxieBalanceBefore).to.approximately(
                  donationAmount,
                  1,
                  "did not transfer moxie"
                );
          });
        });
      });
    });
  });
});