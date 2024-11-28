import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers, upgrades } from "hardhat";
import type { SubjectERC20 as SubjectERC20Type } from "../typechain-types";
import {
  getExpectedSellReturnAndFee,
  getExpectedBuyAmountAndFee,
} from "./Utils";

describe("MoxieBondingCurve", () => {
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
      platformReferrer,
      orderReferrer,
    ] = await ethers.getSigners();

    const MoxieToken = await hre.ethers.getContractFactory("MoxieToken");
    const BancorFormula = await hre.ethers.getContractFactory("BancorFormula");
    const Vault = await hre.ethers.getContractFactory("Vault");
    const SubjectERC20 = await hre.ethers.getContractFactory("SubjectERC20");

    const MoxiePass = await hre.ethers.getContractFactory("MoxiePass");
    const MoxiePassVerifier = await hre.ethers.getContractFactory(
      "MockMoxiePassVerifier",
    );
    const TokenManager = await hre.ethers.getContractFactory("TokenManager");

    const MoxieBondingCurveLegacyV1 = await hre.ethers.getContractFactory(
      "MoxieBondingCurveLegacyV1",
    );
    const MoxieBondingCurve =
      await hre.ethers.getContractFactory("MoxieBondingCurve");

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
    // add back legacy import
    const moxieBondingCurveLegacyV1 = await upgrades.deployProxy(
      MoxieBondingCurveLegacyV1,
      [],
      {
        initializer: false,
      },
    );

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
    };

    await moxieBondingCurveLegacyV1.initialize(
      moxieTokenAddress,
      formulaAddress,
      owner.address,
      tokenManagerAddress,
      vaultAddress,
      feeInput,
      feeBeneficiary.address,
      subjectFactory.address,
    );

    // upgrade Moxie Bonding curve contracts
    const moxieBondingCurve = await upgrades.upgradeProxy(
      await moxieBondingCurveLegacyV1.getAddress(),
      MoxieBondingCurve,
    );

    await moxieBondingCurve
      .connect(owner)
      .grantRole(await moxieBondingCurve.UPDATE_PROTOCOL_REWARD_ROLE(), owner);
    await moxieBondingCurve
      .connect(owner)
      .updateProtocolRewardAddress(await protocolRewards.getAddress());

    await moxiePass.connect(minter).mint(owner.address, "uri");
    await moxiePass.connect(minter).mint(subject.address, "uri");
    await moxiePass.connect(minter).mint(deployer.address, "uri");
    await moxiePass.connect(minter).mint(subjectFactory.address, "uri");
    await moxiePass
      .connect(minter)
      .mint(await moxieBondingCurve.getAddress(), "uri");
    await moxiePass
      .connect(minter)
      .mint(await tokenManager.getAddress(), "uri");

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

    const moxieBondingCurveAddress = await moxieBondingCurve.getAddress();

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

    const PCT_BASE = BigInt(10 ** 18);

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
      protocolRewards,
      platformReferrer,
      orderReferrer,
      referralFeeInput,
    };
  };

  describe("Deployment", () => {
    it("verify deployment", async () => {
      const {
        feeBeneficiary,
        moxieToken,
        formula,
        vaultInstance,
        tokenManager,
        moxieBondingCurve,
        protocolBuyFeePct,
        protocolSellFeePct,
        subjectBuyFeePct,
        subjectSellFeePct,
        subjectFactory,
        owner,
      } = await loadFixture(deploy);

      expect(await moxieBondingCurve.token()).equal(
        await moxieToken.getAddress(),
      );
      expect(await moxieBondingCurve.formula()).equal(
        await formula.getAddress(),
      );
      expect(await moxieBondingCurve.tokenManager()).equal(
        await tokenManager.getAddress(),
      );
      expect(await moxieBondingCurve.vault()).equal(
        await vaultInstance.getAddress(),
      );
      expect(await moxieBondingCurve.protocolBuyFeePct()).equal(
        protocolBuyFeePct,
      );
      expect(await moxieBondingCurve.protocolSellFeePct()).equal(
        protocolSellFeePct,
      );
      expect(await moxieBondingCurve.subjectBuyFeePct()).equal(
        subjectBuyFeePct,
      );
      expect(await moxieBondingCurve.subjectSellFeePct()).eq(subjectSellFeePct);
      expect(await moxieBondingCurve.feeBeneficiary()).equal(
        feeBeneficiary.address,
      );
      expect(await moxieBondingCurve.subjectFactory()).equal(
        subjectFactory.address,
      );
      expect(
        await moxieBondingCurve.hasRole(
          await moxieBondingCurve.DEFAULT_ADMIN_ROLE(),
          owner.address,
        ),
      ).to.be.true;
    });

    it("should fail on initialization if already initialized", async () => {
      const {
        feeBeneficiary,
        owner,
        moxieBondingCurve,
        subjectFactory,
        moxieTokenAddress,
        formulaAddress,
        tokenManagerAddress,
        vaultAddress,
        feeInput,
      } = await loadFixture(deploy);

      await expect(
        moxieBondingCurve.initialize(
          moxieTokenAddress,
          formulaAddress,
          owner.address,
          tokenManagerAddress,
          vaultAddress,
          feeInput,
          feeBeneficiary.address,
          subjectFactory.address,
        ),
      ).to.revertedWithCustomError(moxieBondingCurve, "InvalidInitialization");
    });

    it("it should fail for invalid token", async () => {
      const {
        feeBeneficiary,
        owner,
        subjectFactory,
        formulaAddress,
        tokenManagerAddress,
        vaultAddress,
        feeInput,
      } = await loadFixture(deploy);

      const MoxieBondingCurve =
        await hre.ethers.getContractFactory("MoxieBondingCurve");

      const moxieBondingCurve = await MoxieBondingCurve.deploy();

      await expect(
        moxieBondingCurve.initialize(
          ethers.ZeroAddress,
          formulaAddress,
          owner.address,
          tokenManagerAddress,
          vaultAddress,
          feeInput,
          feeBeneficiary.address,
          subjectFactory.address,
        ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidToken",
      );
    });
    it("it should fail for invalid formula", async () => {
      const {
        feeBeneficiary,
        owner,
        subjectFactory,
        moxieTokenAddress,
        tokenManagerAddress,
        vaultAddress,
        feeInput,
      } = await loadFixture(deploy);

      const MoxieBondingCurve =
        await hre.ethers.getContractFactory("MoxieBondingCurve");

      const moxieBondingCurve = await MoxieBondingCurve.deploy();

      await expect(
        moxieBondingCurve.initialize(
          moxieTokenAddress,
          ethers.ZeroAddress,
          owner.address,
          tokenManagerAddress,
          vaultAddress,
          feeInput,
          feeBeneficiary.address,
          subjectFactory.address,
        ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidFormula",
      );
    });

    it("it should fail for invalid owner", async () => {
      const {
        feeBeneficiary,
        subjectFactory,
        moxieTokenAddress,
        formulaAddress,
        tokenManagerAddress,
        vaultAddress,
        feeInput,
      } = await loadFixture(deploy);

      const MoxieBondingCurve =
        await hre.ethers.getContractFactory("MoxieBondingCurve");

      const moxieBondingCurve = await MoxieBondingCurve.deploy();

      await expect(
        moxieBondingCurve.initialize(
          moxieTokenAddress,
          formulaAddress,
          ethers.ZeroAddress,
          tokenManagerAddress,
          vaultAddress,
          feeInput,
          feeBeneficiary.address,
          subjectFactory.address,
        ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidOwner",
      );
    });

    it("it should fail for invalid token manager", async () => {
      const {
        feeBeneficiary,
        owner,
        subjectFactory,
        moxieTokenAddress,
        formulaAddress,
        vaultAddress,
        feeInput,
      } = await loadFixture(deploy);

      const MoxieBondingCurve =
        await hre.ethers.getContractFactory("MoxieBondingCurve");

      const moxieBondingCurve = await MoxieBondingCurve.deploy();

      await expect(
        moxieBondingCurve.initialize(
          moxieTokenAddress,
          formulaAddress,
          owner.address,
          ethers.ZeroAddress,
          vaultAddress,
          feeInput,
          feeBeneficiary.address,
          subjectFactory.address,
        ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidTokenManager",
      );
    });

    it("it should fail for invalid vault", async () => {
      const {
        feeBeneficiary,
        owner,
        subjectFactory,
        moxieTokenAddress,
        formulaAddress,
        tokenManagerAddress,
        feeInput,
      } = await loadFixture(deploy);

      const MoxieBondingCurve =
        await hre.ethers.getContractFactory("MoxieBondingCurve");

      const moxieBondingCurve = await MoxieBondingCurve.deploy();

      await expect(
        moxieBondingCurve.initialize(
          moxieTokenAddress,
          formulaAddress,
          owner.address,
          tokenManagerAddress,
          ethers.ZeroAddress,
          feeInput,
          feeBeneficiary.address,
          subjectFactory.address,
        ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidVault",
      );
    });

    it("it should fail for invalid fee beneficiary", async () => {
      const {
        owner,
        subjectFactory,
        moxieTokenAddress,
        formulaAddress,
        tokenManagerAddress,
        feeInput,
        vaultAddress,
      } = await loadFixture(deploy);

      const MoxieBondingCurve =
        await hre.ethers.getContractFactory("MoxieBondingCurve");

      const moxieBondingCurve = await MoxieBondingCurve.deploy();

      await expect(
        moxieBondingCurve.initialize(
          moxieTokenAddress,
          formulaAddress,
          owner.address,
          tokenManagerAddress,
          vaultAddress,
          feeInput,
          ethers.ZeroAddress,
          subjectFactory.address,
        ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidBeneficiary",
      );
    });

    it("it should fail for invalid subject factory", async () => {
      const {
        feeBeneficiary,
        owner,
        moxieTokenAddress,
        formulaAddress,
        tokenManagerAddress,
        feeInput,
        vaultAddress,
      } = await loadFixture(deploy);

      const MoxieBondingCurve =
        await hre.ethers.getContractFactory("MoxieBondingCurve");

      const moxieBondingCurve = await MoxieBondingCurve.deploy();

      await expect(
        moxieBondingCurve.initialize(
          moxieTokenAddress,
          formulaAddress,
          owner.address,
          tokenManagerAddress,
          vaultAddress,
          feeInput,
          feeBeneficiary.address,
          ethers.ZeroAddress,
        ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidSubjectFactory",
      );
    });

    it("should fail of invalid protocolBuyFeePct", async () => {
      const {
        feeBeneficiary,
        owner,
        moxieTokenAddress,
        formulaAddress,
        tokenManagerAddress,
        feeInput,
        vaultAddress,
        subjectFactory,
      } = await loadFixture(deploy);

      const MoxieBondingCurve =
        await hre.ethers.getContractFactory("MoxieBondingCurve");

      const moxieBondingCurve = await MoxieBondingCurve.deploy();

      const protocolBuyFeePct = (1e19).toString();
      const newFeeInput = {
        ...feeInput,
        protocolBuyFeePct,
      };

      await expect(
        moxieBondingCurve.initialize(
          moxieTokenAddress,
          formulaAddress,
          owner.address,
          tokenManagerAddress,
          vaultAddress,
          newFeeInput,
          feeBeneficiary.address,
          subjectFactory.address,
        ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidFeePercentage",
      );
    });

    it("should fail of invalid protocolSellFeePct", async () => {
      const {
        feeBeneficiary,
        owner,
        moxieTokenAddress,
        formulaAddress,
        tokenManagerAddress,
        feeInput,
        vaultAddress,
        subjectFactory,
      } = await loadFixture(deploy);

      const MoxieBondingCurve =
        await hre.ethers.getContractFactory("MoxieBondingCurve");

      const moxieBondingCurve = await MoxieBondingCurve.deploy();

      const protocolSellFeePct = (1e19).toString();
      const newFeeInput = {
        ...feeInput,
        protocolSellFeePct,
      };

      await expect(
        moxieBondingCurve.initialize(
          moxieTokenAddress,
          formulaAddress,
          owner.address,
          tokenManagerAddress,
          vaultAddress,
          newFeeInput,
          feeBeneficiary.address,
          subjectFactory.address,
        ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidFeePercentage",
      );
    });

    it("should fail of invalid subjectBuyFeePct", async () => {
      const {
        feeBeneficiary,
        owner,
        moxieTokenAddress,
        formulaAddress,
        tokenManagerAddress,
        feeInput,
        vaultAddress,
        subjectFactory,
      } = await loadFixture(deploy);

      const MoxieBondingCurve =
        await hre.ethers.getContractFactory("MoxieBondingCurve");

      const moxieBondingCurve = await MoxieBondingCurve.deploy();

      const subjectBuyFeePct = (1e19).toString();
      const newFeeInput = {
        ...feeInput,
        subjectBuyFeePct,
      };

      await expect(
        moxieBondingCurve.initialize(
          moxieTokenAddress,
          formulaAddress,
          owner.address,
          tokenManagerAddress,
          vaultAddress,
          newFeeInput,
          feeBeneficiary.address,
          subjectFactory.address,
        ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidFeePercentage",
      );
    });

    it("should fail of invalid subjectSellFeePct", async () => {
      const {
        feeBeneficiary,
        owner,
        moxieTokenAddress,
        formulaAddress,
        tokenManagerAddress,
        feeInput,
        vaultAddress,
        subjectFactory,
      } = await loadFixture(deploy);

      const MoxieBondingCurve =
        await hre.ethers.getContractFactory("MoxieBondingCurve");

      const moxieBondingCurve = await MoxieBondingCurve.deploy();

      const subjectSellFeePct = (1e19).toString();
      const newFeeInput = {
        ...feeInput,
        subjectSellFeePct,
      };

      await expect(
        moxieBondingCurve.initialize(
          moxieTokenAddress,
          formulaAddress,
          owner.address,
          tokenManagerAddress,
          vaultAddress,
          newFeeInput,
          feeBeneficiary.address,
          subjectFactory.address,
        ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidFeePercentage",
      );
    });
  });

  describe("initializeSubjectBondingCurve", () => {
    it("should initialize subject", async () => {
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        moxieToken,
        moxieBondingCurveAddress,
        initialReserve,
        initialSupply,
        reserveRatio,
        vaultInstance,
        subjectTokenAddress,
        moxieTokenAddress,
      } = await loadFixture(deploy);

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

      expect(await moxieBondingCurve.reserveRatio(subject.address)).equal(
        reserveRatio,
      );
      expect(
        await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress),
      ).equal(initialReserve);
    });

    it("should fail to initialize subject if already initialized", async () => {
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        moxieToken,
        moxieBondingCurveAddress,
        initialReserve,
        initialSupply,
        reserveRatio,
        vaultInstance,
        subjectTokenAddress,
        moxieTokenAddress,
      } = await loadFixture(deploy);

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

      expect(await moxieBondingCurve.reserveRatio(subject.address)).equal(
        reserveRatio,
      );
      expect(
        await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress),
      ).equal(initialReserve);

      await expect(
        moxieBondingCurve
          .connect(subjectFactory)
          .initializeSubjectBondingCurve(
            subject.address,
            reserveRatio,
            initialSupply,
            initialReserve,
            ethers.ZeroAddress,
          ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_SubjectAlreadyInitialized",
      );
    });

    it("should fail to initialize subject for insufficient allowance for reserve fund from caller", async () => {
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        moxieToken,
        initialReserve,
        initialSupply,
        reserveRatio,
      } = await loadFixture(deploy);

      await expect(
        moxieBondingCurve
          .connect(subjectFactory)
          .initializeSubjectBondingCurve(
            subject.address,
            reserveRatio,
            initialSupply,
            initialReserve,
            ethers.ZeroAddress,
          ),
      ).to.revertedWithCustomError(moxieToken, "ERC20InsufficientAllowance");
    });

    it("should fail to initialize subject for insufficient balance for reserve fund from caller", async () => {
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        moxieToken,
        moxieBondingCurveAddress,
        initialReserve,
        initialSupply,
        reserveRatio,
        owner,
      } = await loadFixture(deploy);

      await moxieToken
        .connect(subjectFactory)
        .approve(moxieBondingCurveAddress, initialReserve);

      await moxieToken.connect(subjectFactory).transfer(owner.address, 10000);

      await expect(
        moxieBondingCurve
          .connect(subjectFactory)
          .initializeSubjectBondingCurve(
            subject.address,
            reserveRatio,
            initialSupply,
            initialReserve,
            ethers.ZeroAddress,
          ),
      ).to.revertedWithCustomError(moxieToken, "ERC20InsufficientBalance");
    });

    it("should fail to initialize for zero subject", async () => {
      const {
        moxieBondingCurve,
        subjectFactory,
        moxieToken,
        moxieBondingCurveAddress,
        initialReserve,
        initialSupply,
        reserveRatio,
        owner,
      } = await loadFixture(deploy);

      await moxieToken
        .connect(subjectFactory)
        .approve(moxieBondingCurveAddress, initialReserve);

      await moxieToken.connect(subjectFactory).transfer(owner.address, 10000);

      await expect(
        moxieBondingCurve
          .connect(subjectFactory)
          .initializeSubjectBondingCurve(
            ethers.ZeroAddress,
            reserveRatio,
            initialSupply,
            initialReserve,
            ethers.ZeroAddress,
          ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidSubject",
      );
    });

    it("should fail to initialize if caller is not subject factory", async () => {
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        moxieToken,
        moxieBondingCurveAddress,
        initialReserve,
        initialSupply,
        reserveRatio,
        owner,
      } = await loadFixture(deploy);

      await moxieToken
        .connect(subjectFactory)
        .approve(moxieBondingCurveAddress, initialReserve);

      await moxieToken.connect(subjectFactory).transfer(owner.address, 10000);

      await expect(
        moxieBondingCurve
          .connect(owner)
          .initializeSubjectBondingCurve(
            subject.address,
            reserveRatio,
            initialSupply,
            initialReserve,
            ethers.ZeroAddress,
          ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_OnlySubjectFactory",
      );
    });

    it("should fail to initialize for invalid reserve ratio", async () => {
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        moxieToken,
        moxieBondingCurveAddress,
        initialReserve,
        initialSupply,
        owner,
      } = await loadFixture(deploy);

      await moxieToken
        .connect(subjectFactory)
        .approve(moxieBondingCurveAddress, initialReserve);

      await moxieToken.connect(subjectFactory).transfer(owner.address, 10000);

      await expect(
        moxieBondingCurve
          .connect(subjectFactory)
          .initializeSubjectBondingCurve(
            subject.address,
            20000000,
            initialSupply,
            initialReserve,
            ethers.ZeroAddress,
          ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidReserveRation",
      );
    });

    it("should fail to initialize for invalid initial supply", async () => {
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        moxieToken,
        moxieBondingCurveAddress,
        initialReserve,
        reserveRatio,
        owner,
      } = await loadFixture(deploy);

      await moxieToken
        .connect(subjectFactory)
        .approve(moxieBondingCurveAddress, initialReserve);

      await moxieToken.connect(subjectFactory).transfer(owner.address, 10000);

      const initialSupply = "100";
      await expect(
        moxieBondingCurve
          .connect(subjectFactory)
          .initializeSubjectBondingCurve(
            subject.address,
            reserveRatio,
            initialSupply,
            initialReserve,
            ethers.ZeroAddress,
          ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidSubjectSupply",
      );
    });

    it("should fail to initialize for invalid subject token", async () => {
      const {
        moxieBondingCurve,
        subjectFactory,
        moxieToken,
        moxieBondingCurveAddress,
        initialReserve,
        reserveRatio,
        owner,
        initialSupply,
      } = await loadFixture(deploy);

      await moxieToken
        .connect(subjectFactory)
        .approve(moxieBondingCurveAddress, initialReserve);

      await moxieToken.connect(subjectFactory).transfer(owner.address, 10000);

      await expect(
        moxieBondingCurve
          .connect(subjectFactory)
          .initializeSubjectBondingCurve(
            owner.address,
            reserveRatio,
            initialSupply,
            initialReserve,
            ethers.ZeroAddress,
          ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidSubjectToken",
      );
    });

    it("should fail to initialize subject when contract is paused", async () => {
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        initialReserve,
        initialSupply,
        reserveRatio,
        owner,
        deployer,
      } = await loadFixture(deploy);

      await moxieBondingCurve
        .connect(owner)
        .grantRole(await moxieBondingCurve.PAUSE_ROLE(), deployer.address);
      await moxieBondingCurve.connect(deployer).pause();

      await expect(
        moxieBondingCurve
          .connect(subjectFactory)
          .initializeSubjectBondingCurve(
            subject.address,
            reserveRatio,
            initialSupply,
            initialReserve,
            ethers.ZeroAddress,
          ),
      ).to.revertedWithCustomError(moxieBondingCurve, "EnforcedPause");
    });
  });

  describe("buy subject token shares for beneficiary", () => {
    const setupBuy = async (deployment: any) => {
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        moxieToken,
        moxieBondingCurveAddress,
        initialReserve,
        initialSupply,
        reserveRatio,
        subjectTokenAddress,
        buyer,
        buyer2,
        owner,
      } = deployment;

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
        .transfer(buyer.address, (1 * 1e20).toString());
      await moxieToken
        .connect(owner)
        .transfer(buyer2.address, (1 * 1e20).toString());
    };

    it("should be able to buy subject token", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        reserveRatio,
        subjectTokenAddress,
        buyer,
        moxiePass,
        minter,
        moxieTokenAddress,
        formula,
        subjectToken,
        vaultInstance,
        feeInput,
        PCT_BASE,
        feeBeneficiary,
        buyer2,
        protocolRewards,
      } = deployment;

      await setupBuy(deployment);

      const buyAmount = (1 * 1e19).toString();

      const supply = await subjectToken.totalSupply();
      const reserveBeforeBuy = await vaultInstance.balanceOf(
        subjectTokenAddress,
        moxieTokenAddress,
      );

      const { expectedShares, protocolFee, subjectFee } =
        await getExpectedBuyAmountAndFee(
          subjectToken,
          vaultInstance,
          subjectTokenAddress,
          moxieTokenAddress,
          formula,
          reserveRatio,
          feeInput,
          PCT_BASE,
          BigInt(buyAmount),
        );

      const effectiveBuyAmount = BigInt(buyAmount) - protocolFee - subjectFee;

      // first buyer
      await moxieToken
        .connect(buyer)
        .approve(moxieBondingCurveAddress, buyAmount);

      await moxiePass.connect(minter).mint(buyer.address, "uri");

      await expect(
        moxieBondingCurve
          .connect(buyer)
          .buySharesFor(subject.address, buyAmount, buyer.address, 0),
      )
        .to.emit(moxieBondingCurve, "SubjectSharePurchased")
        .withArgs(
          subject.address,
          moxieTokenAddress,
          buyAmount,
          buyer.address,
          subjectTokenAddress,
          expectedShares,
          buyer.address,
        );

      expect(await subjectToken.balanceOf(buyer.address)).equal(expectedShares);
      expect(await protocolRewards.balanceOf(feeBeneficiary.address)).equal(
        protocolFee,
      );
      expect(await protocolRewards.balanceOf(subject.address)).equal(
        subjectFee,
      );
      expect(
        await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress),
      ).equal(BigInt(reserveBeforeBuy) + effectiveBuyAmount);
      expect(await subjectToken.totalSupply()).equal(supply + expectedShares);

      // second buyer
      await moxieToken
        .connect(buyer2)
        .approve(moxieBondingCurveAddress, buyAmount);

      await moxiePass.connect(minter).mint(buyer2.address, "uri");

      const reserveBeforeBuy2 = await vaultInstance.balanceOf(
        subjectTokenAddress,
        moxieTokenAddress,
      );

      const {
        expectedShares: expectedShares2,
        protocolFee: protocolFee2,
        subjectFee: subjectFee2,
      } = await getExpectedBuyAmountAndFee(
        subjectToken,
        vaultInstance,
        subjectTokenAddress,
        moxieTokenAddress,
        formula,
        reserveRatio,
        feeInput,
        PCT_BASE,
        BigInt(buyAmount),
      );
      const effectiveBuyAmount2 = BigInt(buyAmount) - protocolFee - subjectFee;

      await expect(
        moxieBondingCurve
          .connect(buyer2)
          .buySharesFor(subject.address, buyAmount, buyer2.address, 0),
      )
        .to.emit(moxieBondingCurve, "SubjectSharePurchased")
        .withArgs(
          subject.address,
          moxieTokenAddress,
          buyAmount,
          buyer2.address,
          subjectTokenAddress,
          expectedShares2,
          buyer2.address,
        );

      expect(await subjectToken.balanceOf(buyer2.address)).equal(
        expectedShares2,
      );
      expect(await protocolRewards.balanceOf(feeBeneficiary.address)).equal(
        protocolFee + protocolFee2,
      );
      expect(await protocolRewards.balanceOf(subject.address)).equal(
        subjectFee + subjectFee2,
      );
      expect(
        await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress),
      ).equal(BigInt(reserveBeforeBuy2) + effectiveBuyAmount2);

      //also make sure second buyer should get less shares than first buyer for same given buy amount
      expect(expectedShares2).to.be.lessThan(expectedShares);
    });

    it("should be able to buy subject token with zero address as beneficiary", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        reserveRatio,
        subjectTokenAddress,
        buyer,
        moxiePass,
        minter,
        moxieTokenAddress,
        formula,
        subjectToken,
        vaultInstance,
        feeInput,
        PCT_BASE,
        feeBeneficiary,
        protocolRewards,
      } = deployment;

      await setupBuy(deployment);

      const buyAmount = (1 * 1e19).toString();

      const supply = await subjectToken.totalSupply();
      const reserveBeforeBuy = await vaultInstance.balanceOf(
        subjectTokenAddress,
        moxieTokenAddress,
      );

      const { expectedShares, protocolFee, subjectFee } =
        await getExpectedBuyAmountAndFee(
          subjectToken,
          vaultInstance,
          subjectTokenAddress,
          moxieTokenAddress,
          formula,
          reserveRatio,
          feeInput,
          PCT_BASE,
          BigInt(buyAmount),
        );

      const effectiveBuyAmount = BigInt(buyAmount) - protocolFee - subjectFee;

      // first buyer
      await moxieToken
        .connect(buyer)
        .approve(moxieBondingCurveAddress, buyAmount);

      await moxiePass.connect(minter).mint(buyer.address, "uri");

      await expect(
        moxieBondingCurve
          .connect(buyer)
          .buySharesFor(subject.address, buyAmount, ethers.ZeroAddress, 0),
      )
        .to.emit(moxieBondingCurve, "SubjectSharePurchased")
        .withArgs(
          subject.address,
          moxieTokenAddress,
          buyAmount,
          buyer.address,
          subjectTokenAddress,
          expectedShares,
          ethers.ZeroAddress,
        );

      expect(await protocolRewards.balanceOf(feeBeneficiary.address)).equal(
        protocolFee,
      );
      expect(await protocolRewards.balanceOf(subject.address)).equal(
        subjectFee,
      );
      expect(
        await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress),
      ).equal(BigInt(reserveBeforeBuy) + effectiveBuyAmount);
      //supply shouldn't change & buyer shouldn't get subject tokens
      expect(await subjectToken.totalSupply()).equal(supply);
      expect(await subjectToken.balanceOf(buyer.address)).equal(0);
    });

    it("should not be able to buy for zero subject address", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        moxieToken,
        moxieBondingCurveAddress,
        buyer,
        moxiePass,
        minter,
      } = deployment;

      await setupBuy(deployment);

      const buyAmount = (1 * 1e19).toString();

      // first buyer
      await moxieToken
        .connect(buyer)
        .approve(moxieBondingCurveAddress, buyAmount);

      await moxiePass.connect(minter).mint(buyer.address, "uri");

      await expect(
        moxieBondingCurve
          .connect(buyer)
          .buySharesFor(ethers.ZeroAddress, buyAmount, buyer.address, 0),
      ).revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidSubject",
      );
    });

    it("should not be able to buy for zero deposit amount", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        buyer,
        moxiePass,
        minter,
      } = deployment;

      await setupBuy(deployment);

      const buyAmount = (1 * 1e19).toString();

      await moxieToken
        .connect(buyer)
        .approve(moxieBondingCurveAddress, buyAmount);

      await moxiePass.connect(minter).mint(buyer.address, "uri");

      await expect(
        moxieBondingCurve
          .connect(buyer)
          .buySharesFor(subject.address, 0, buyer.address, 0),
      ).revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidDepositAmount",
      );
    });

    it("should not be able to buy for non initialized subject", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        moxieToken,
        moxieBondingCurveAddress,
        buyer,
        moxiePass,
        owner,
        minter,
      } = deployment;

      await setupBuy(deployment);

      const buyAmount = (1 * 1e19).toString();

      moxieToken.connect(buyer).approve(moxieBondingCurveAddress, buyAmount);

      await moxiePass.connect(minter).mint(buyer.address, "uri");

      await expect(
        moxieBondingCurve
          .connect(buyer)
          .buySharesFor(owner.address, buyAmount, buyer.address, 0),
      ).revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_SubjectNotInitialized",
      );
    });

    it("should revert if buy subject token is less than _minReturnAmountAfterFee", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        reserveRatio,
        subjectTokenAddress,
        buyer,
        moxiePass,
        minter,
        moxieTokenAddress,
        formula,
        subjectToken,
        vaultInstance,
        feeInput,
        PCT_BASE,
      } = deployment;

      await setupBuy(deployment);

      const buyAmount = (1 * 1e19).toString();

      const supply = await subjectToken.totalSupply();
      const reserveBeforeBuy = await vaultInstance.balanceOf(
        subjectTokenAddress,
        moxieTokenAddress,
      );

      const protocolFee =
        (BigInt(feeInput.protocolBuyFeePct) * BigInt(buyAmount)) /
        BigInt(PCT_BASE);
      const subjectFee =
        (BigInt(feeInput.subjectBuyFeePct) * BigInt(buyAmount)) /
        BigInt(PCT_BASE);

      const effectiveBuyAmount = BigInt(buyAmount) - protocolFee - subjectFee;

      const expectedShares = await formula.calculatePurchaseReturn(
        supply,
        reserveBeforeBuy,
        reserveRatio,
        effectiveBuyAmount,
      );

      // first buyer
      await moxieToken
        .connect(buyer)
        .approve(moxieBondingCurveAddress, buyAmount);

      await moxiePass.connect(minter).mint(buyer.address, "uri");

      await expect(
        moxieBondingCurve
          .connect(buyer)
          .buySharesFor(
            subject.address,
            buyAmount,
            buyer.address,
            expectedShares + BigInt(10),
          ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_SlippageExceedsLimit",
      );
    });

    it("should revert if tokens cannot be transferred from buyer due to  low/no approval ", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        reserveRatio,
        subjectTokenAddress,
        buyer,
        moxiePass,
        minter,
        moxieTokenAddress,
        formula,
        subjectToken,
        vaultInstance,
        feeInput,
        PCT_BASE,
      } = deployment;

      await setupBuy(deployment);

      const buyAmount = (1 * 1e19).toString();

      const supply = await subjectToken.totalSupply();
      const reserveBeforeBuy = await vaultInstance.balanceOf(
        subjectTokenAddress,
        moxieTokenAddress,
      );

      const protocolFee =
        (BigInt(feeInput.protocolBuyFeePct) * BigInt(buyAmount)) /
        BigInt(PCT_BASE);
      const subjectFee =
        (BigInt(feeInput.subjectBuyFeePct) * BigInt(buyAmount)) /
        BigInt(PCT_BASE);

      const effectiveBuyAmount = BigInt(buyAmount) - protocolFee - subjectFee;

      const expectedShares = await formula.calculatePurchaseReturn(
        supply,
        reserveBeforeBuy,
        reserveRatio,
        effectiveBuyAmount,
      );

      await moxiePass.connect(minter).mint(buyer.address, "uri");

      await expect(
        moxieBondingCurve
          .connect(buyer)
          .buySharesFor(
            subject.address,
            buyAmount,
            buyer.address,
            expectedShares,
          ),
      ).to.revertedWithCustomError(moxieToken, "ERC20InsufficientAllowance");
    });

    it("should revert if tokens cannot be transferred from buyer due to insufficient funds ", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        reserveRatio,
        subjectTokenAddress,
        buyer,
        moxiePass,
        minter,
        moxieTokenAddress,
        formula,
        subjectToken,
        vaultInstance,
        feeInput,
        PCT_BASE,
      } = deployment;

      await setupBuy(deployment);

      const buyAmount = (1 * 1e19).toString();

      const supply = await subjectToken.totalSupply();
      const reserveBeforeBuy = await vaultInstance.balanceOf(
        subjectTokenAddress,
        moxieTokenAddress,
      );

      const protocolFee =
        (BigInt(feeInput.protocolBuyFeePct) * BigInt(buyAmount)) /
        BigInt(PCT_BASE);
      const subjectFee =
        (BigInt(feeInput.subjectBuyFeePct) * BigInt(buyAmount)) /
        BigInt(PCT_BASE);

      const effectiveBuyAmount = BigInt(buyAmount) - protocolFee - subjectFee;

      const expectedShares = await formula.calculatePurchaseReturn(
        supply,
        reserveBeforeBuy,
        reserveRatio,
        effectiveBuyAmount,
      );

      await moxiePass.connect(minter).mint(buyer.address, "uri");

      await moxieToken
        .connect(buyer)
        .approve(moxieBondingCurveAddress, buyAmount);

      await moxieToken
        .connect(buyer)
        .burn(await moxieToken.balanceOf(buyer.address));

      await expect(
        moxieBondingCurve
          .connect(buyer)
          .buySharesFor(
            subject.address,
            buyAmount,
            buyer.address,
            expectedShares,
          ),
      ).to.revertedWithCustomError(moxieToken, "ERC20InsufficientBalance");
    });

    it("should not able able to buy when contract is paused", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        buyer,
        moxiePass,
        owner,
        minter,
        deployer,
      } = deployment;

      await setupBuy(deployment);

      const buyAmount = (1 * 1e19).toString();

      await moxieBondingCurve
        .connect(owner)
        .grantRole(await moxieBondingCurve.PAUSE_ROLE(), deployer.address);
      await moxieBondingCurve.connect(deployer).pause();
      await moxieToken
        .connect(buyer)
        .approve(moxieBondingCurveAddress, buyAmount);

      await moxiePass.connect(minter).mint(buyer.address, "uri");

      await expect(
        moxieBondingCurve
          .connect(buyer)
          .buySharesFor(subject.address, buyAmount, buyer.address, 0),
      ).revertedWithCustomError(moxieBondingCurve, "EnforcedPause");
    });
  });

  describe("buy subject token shares", () => {
    const setupBuy = async (deployment: any) => {
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        moxieToken,
        moxieBondingCurveAddress,
        initialReserve,
        initialSupply,
        reserveRatio,
        subjectTokenAddress,
        buyer,
        buyer2,
        owner,
      } = deployment;

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
        .transfer(buyer.address, (1 * 1e20).toString());
      await moxieToken
        .connect(owner)
        .transfer(buyer2.address, (1 * 1e20).toString());
    };

    it("should be able to buy subject token", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        reserveRatio,
        subjectTokenAddress,
        buyer,
        moxiePass,
        minter,
        moxieTokenAddress,
        formula,
        subjectToken,
        vaultInstance,
        feeInput,
        PCT_BASE,
        feeBeneficiary,
        buyer2,
        protocolRewards,
      } = deployment;

      await setupBuy(deployment);

      const buyAmount = (1 * 1e19).toString();

      const supply = await subjectToken.totalSupply();
      const reserveBeforeBuy = await vaultInstance.balanceOf(
        subjectTokenAddress,
        moxieTokenAddress,
      );

      const { expectedShares, protocolFee, subjectFee } =
        await getExpectedBuyAmountAndFee(
          subjectToken,
          vaultInstance,
          subjectTokenAddress,
          moxieTokenAddress,
          formula,
          reserveRatio,
          feeInput,
          PCT_BASE,
          BigInt(buyAmount),
        );

      const effectiveBuyAmount = BigInt(buyAmount) - protocolFee - subjectFee;

      // first buyer
      await moxieToken
        .connect(buyer)
        .approve(moxieBondingCurveAddress, buyAmount);

      await moxiePass.connect(minter).mint(buyer.address, "uri");

      await expect(
        moxieBondingCurve
          .connect(buyer)
          .buyShares(subject.address, buyAmount, 0),
      )
        .to.emit(moxieBondingCurve, "SubjectSharePurchased")
        .withArgs(
          subject.address,
          moxieTokenAddress,
          buyAmount,
          buyer.address,
          subjectTokenAddress,
          expectedShares,
          buyer.address,
        );

      expect(await subjectToken.balanceOf(buyer.address)).equal(expectedShares);
      expect(await protocolRewards.balanceOf(feeBeneficiary.address)).equal(
        protocolFee,
      );
      expect(await protocolRewards.balanceOf(subject.address)).equal(
        subjectFee,
      );
      expect(
        await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress),
      ).equal(BigInt(reserveBeforeBuy) + effectiveBuyAmount);
      expect(await subjectToken.totalSupply()).equal(supply + expectedShares);

      // second buyer
      await moxieToken
        .connect(buyer2)
        .approve(moxieBondingCurveAddress, buyAmount);

      await moxiePass.connect(minter).mint(buyer2.address, "uri");

      const reserveBeforeBuy2 = await vaultInstance.balanceOf(
        subjectTokenAddress,
        moxieTokenAddress,
      );

      const {
        expectedShares: expectedShares2,
        protocolFee: protocolFee2,
        subjectFee: subjectFee2,
      } = await getExpectedBuyAmountAndFee(
        subjectToken,
        vaultInstance,
        subjectTokenAddress,
        moxieTokenAddress,
        formula,
        reserveRatio,
        feeInput,
        PCT_BASE,
        BigInt(buyAmount),
      );
      const effectiveBuyAmount2 = BigInt(buyAmount) - protocolFee - subjectFee;

      await expect(
        moxieBondingCurve
          .connect(buyer2)
          .buyShares(subject.address, buyAmount, 0),
      )
        .to.emit(moxieBondingCurve, "SubjectSharePurchased")
        .withArgs(
          subject.address,
          moxieTokenAddress,
          buyAmount,
          buyer2.address,
          subjectTokenAddress,
          expectedShares2,
          buyer2.address,
        );

      expect(await subjectToken.balanceOf(buyer2.address)).equal(
        expectedShares2,
      );
      expect(await protocolRewards.balanceOf(feeBeneficiary.address)).equal(
        protocolFee + protocolFee2,
      );
      expect(await protocolRewards.balanceOf(subject.address)).equal(
        subjectFee + subjectFee2,
      );
      expect(
        await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress),
      ).equal(BigInt(reserveBeforeBuy2) + effectiveBuyAmount2);

      //also make sure second buyer should get less shares than first buyer for same given buy amount
      expect(expectedShares2).to.be.lessThan(expectedShares);
    });

    it("should not be able to buy for zero subject address", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        moxieToken,
        moxieBondingCurveAddress,
        buyer,
        moxiePass,
        minter,
      } = deployment;

      await setupBuy(deployment);

      const buyAmount = (1 * 1e19).toString();

      // first buyer
      await moxieToken
        .connect(buyer)
        .approve(moxieBondingCurveAddress, buyAmount);

      await moxiePass.connect(minter).mint(buyer.address, "uri");

      await expect(
        moxieBondingCurve
          .connect(buyer)
          .buyShares(ethers.ZeroAddress, buyAmount, 0),
      ).revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidSubject",
      );
    });

    it("should not be able to buy for zero deposit amount", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        buyer,
        moxiePass,
        minter,
      } = deployment;

      await setupBuy(deployment);

      const buyAmount = (1 * 1e19).toString();

      await moxieToken
        .connect(buyer)
        .approve(moxieBondingCurveAddress, buyAmount);

      await moxiePass.connect(minter).mint(buyer.address, "uri");

      await expect(
        moxieBondingCurve.connect(buyer).buyShares(subject.address, 0, 0),
      ).revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidDepositAmount",
      );
    });

    it("should not be able to buy for non initialized subject", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        moxieToken,
        moxieBondingCurveAddress,
        buyer,
        moxiePass,
        owner,
        minter,
      } = deployment;

      await setupBuy(deployment);

      const buyAmount = (1 * 1e19).toString();

      moxieToken.connect(buyer).approve(moxieBondingCurveAddress, buyAmount);

      await moxiePass.connect(minter).mint(buyer.address, "uri");

      await expect(
        moxieBondingCurve.connect(buyer).buyShares(owner.address, buyAmount, 0),
      ).revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_SubjectNotInitialized",
      );
    });

    it("should revert if buy subject token is less than _minReturnAmountAfterFee", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        reserveRatio,
        subjectTokenAddress,
        buyer,
        moxiePass,
        minter,
        moxieTokenAddress,
        formula,
        subjectToken,
        vaultInstance,
        feeInput,
        PCT_BASE,
      } = deployment;

      await setupBuy(deployment);

      const buyAmount = (1 * 1e19).toString();

      const supply = await subjectToken.totalSupply();
      const reserveBeforeBuy = await vaultInstance.balanceOf(
        subjectTokenAddress,
        moxieTokenAddress,
      );

      const protocolFee =
        (BigInt(feeInput.protocolBuyFeePct) * BigInt(buyAmount)) /
        BigInt(PCT_BASE);
      const subjectFee =
        (BigInt(feeInput.subjectBuyFeePct) * BigInt(buyAmount)) /
        BigInt(PCT_BASE);

      const effectiveBuyAmount = BigInt(buyAmount) - protocolFee - subjectFee;

      const expectedShares = await formula.calculatePurchaseReturn(
        supply,
        reserveBeforeBuy,
        reserveRatio,
        effectiveBuyAmount,
      );

      // first buyer
      await moxieToken
        .connect(buyer)
        .approve(moxieBondingCurveAddress, buyAmount);

      await moxiePass.connect(minter).mint(buyer.address, "uri");

      await expect(
        moxieBondingCurve
          .connect(buyer)
          .buyShares(subject.address, buyAmount, expectedShares + BigInt(10)),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_SlippageExceedsLimit",
      );
    });

    it("should revert if tokens cannot be transferred from buyer due to  low/no approval ", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        reserveRatio,
        subjectTokenAddress,
        buyer,
        moxiePass,
        minter,
        moxieTokenAddress,
        formula,
        subjectToken,
        vaultInstance,
        feeInput,
        PCT_BASE,
      } = deployment;

      await setupBuy(deployment);

      const buyAmount = (1 * 1e19).toString();

      const supply = await subjectToken.totalSupply();
      const reserveBeforeBuy = await vaultInstance.balanceOf(
        subjectTokenAddress,
        moxieTokenAddress,
      );

      const protocolFee =
        (BigInt(feeInput.protocolBuyFeePct) * BigInt(buyAmount)) /
        BigInt(PCT_BASE);
      const subjectFee =
        (BigInt(feeInput.subjectBuyFeePct) * BigInt(buyAmount)) /
        BigInt(PCT_BASE);

      const effectiveBuyAmount = BigInt(buyAmount) - protocolFee - subjectFee;

      const expectedShares = await formula.calculatePurchaseReturn(
        supply,
        reserveBeforeBuy,
        reserveRatio,
        effectiveBuyAmount,
      );

      await moxiePass.connect(minter).mint(buyer.address, "uri");

      await expect(
        moxieBondingCurve
          .connect(buyer)
          .buyShares(subject.address, buyAmount, expectedShares),
      ).to.revertedWithCustomError(moxieToken, "ERC20InsufficientAllowance");
    });

    it("should revert if tokens cannot be transferred from buyer due to insufficient funds ", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        reserveRatio,
        subjectTokenAddress,
        buyer,
        moxiePass,
        minter,
        moxieTokenAddress,
        formula,
        subjectToken,
        vaultInstance,
        feeInput,
        PCT_BASE,
      } = deployment;

      await setupBuy(deployment);

      const buyAmount = (1 * 1e19).toString();

      const supply = await subjectToken.totalSupply();
      const reserveBeforeBuy = await vaultInstance.balanceOf(
        subjectTokenAddress,
        moxieTokenAddress,
      );

      const protocolFee =
        (BigInt(feeInput.protocolBuyFeePct) * BigInt(buyAmount)) /
        BigInt(PCT_BASE);
      const subjectFee =
        (BigInt(feeInput.subjectBuyFeePct) * BigInt(buyAmount)) /
        BigInt(PCT_BASE);

      const effectiveBuyAmount = BigInt(buyAmount) - protocolFee - subjectFee;

      const expectedShares = await formula.calculatePurchaseReturn(
        supply,
        reserveBeforeBuy,
        reserveRatio,
        effectiveBuyAmount,
      );

      await moxiePass.connect(minter).mint(buyer.address, "uri");

      await moxieToken
        .connect(buyer)
        .approve(moxieBondingCurveAddress, buyAmount);

      await moxieToken
        .connect(buyer)
        .burn(await moxieToken.balanceOf(buyer.address));

      await expect(
        moxieBondingCurve
          .connect(buyer)
          .buyShares(subject.address, buyAmount, expectedShares),
      ).to.revertedWithCustomError(moxieToken, "ERC20InsufficientBalance");
    });

    it("should not able able to buy when contract is paused", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        buyer,
        moxiePass,
        owner,
        minter,
        deployer,
      } = deployment;

      await setupBuy(deployment);

      const buyAmount = (1 * 1e19).toString();

      await moxieBondingCurve
        .connect(owner)
        .grantRole(await moxieBondingCurve.PAUSE_ROLE(), deployer.address);
      await moxieBondingCurve.connect(deployer).pause();
      await moxieToken
        .connect(buyer)
        .approve(moxieBondingCurveAddress, buyAmount);

      await moxiePass.connect(minter).mint(buyer.address, "uri");

      await expect(
        moxieBondingCurve
          .connect(buyer)
          .buyShares(subject.address, buyAmount, 0),
      ).revertedWithCustomError(moxieBondingCurve, "EnforcedPause");
    });
  });

  describe("sell subject token shares for beneficiary", () => {
    const setupSell = async (deployment: any) => {
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        moxieToken,
        moxieBondingCurveAddress,
        initialReserve,
        initialSupply,
        reserveRatio,
        subjectTokenAddress,
        seller,
        seller2,
        owner,
        moxiePass,
        minter,
      } = deployment;

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
        .transfer(seller.address, (1 * 1e20).toString());
      await moxieToken
        .connect(owner)
        .transfer(seller2.address, (1 * 1e20).toString());

      const buyAmount = (1 * 1e19).toString();

      await moxiePass.connect(minter).mint(seller.address, "url");
      await moxiePass.connect(minter).mint(seller2.address, "url");

      await moxieToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, buyAmount);
      await expect(
        moxieBondingCurve
          .connect(seller)
          .buySharesFor(subject.address, buyAmount, seller.address, 0),
      ).to.emit(moxieBondingCurve, "SubjectSharePurchased");

      await moxieToken
        .connect(seller2)
        .approve(moxieBondingCurveAddress, buyAmount);
      await expect(
        moxieBondingCurve
          .connect(seller2)
          .buySharesFor(subject.address, buyAmount, seller2.address, 0),
      ).to.emit(moxieBondingCurve, "SubjectSharePurchased");
    };

    it("should be able to sell subject token", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        reserveRatio,
        subjectTokenAddress,
        moxieTokenAddress,
        formula,
        subjectToken,
        vaultInstance,
        feeInput,
        PCT_BASE,
        feeBeneficiary,
        seller,
        seller2,
        protocolRewards,
      } = deployment;

      await setupSell(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );
      const totalSellAmountSeller2 = await subjectToken.balanceOf(
        seller2.address,
      );

      // seller 1
      const { returnAmount, protocolFee, subjectFee } =
        await getExpectedSellReturnAndFee(
          subjectToken,
          vaultInstance,
          subjectTokenAddress,
          moxieTokenAddress,
          formula,
          reserveRatio,
          feeInput,
          PCT_BASE,
          totalSellAmountSeller1,
        );

      const expectedReturn = returnAmount - protocolFee - subjectFee;

      await subjectToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller1);

      const sellerPreviousMoxieBalance = await moxieToken.balanceOf(
        seller.address,
      );
      const feeBeneficiaryPreviousMoxieBalance =
        await protocolRewards.balanceOf(feeBeneficiary.address);
      const subjectBeneficiaryPreviousMoxieBalance =
        await protocolRewards.balanceOf(subject.address);
      await expect(
        moxieBondingCurve
          .connect(seller)
          .sellSharesFor(
            subject.address,
            totalSellAmountSeller1,
            seller.address,
            0,
          ),
      )
        .to.emit(moxieBondingCurve, "SubjectShareSold")
        .withArgs(
          subject.address,
          subjectTokenAddress,
          totalSellAmountSeller1,
          seller.address,
          moxieTokenAddress,
          expectedReturn,
          seller.address,
        );

      //verify fund transfers
      expect(await moxieToken.balanceOf(seller.address)).to.equal(
        BigInt(sellerPreviousMoxieBalance) + expectedReturn,
      );
      expect(await protocolRewards.balanceOf(feeBeneficiary.address)).to.equal(
        BigInt(feeBeneficiaryPreviousMoxieBalance) + protocolFee,
      );
      expect(await protocolRewards.balanceOf(subject.address)).to.equal(
        BigInt(subjectBeneficiaryPreviousMoxieBalance) + subjectFee,
      );

      // seller 2
      await subjectToken
        .connect(seller2)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller2);

      const {
        returnAmount: returnAmount2,
        protocolFee: protocolFee2,
        subjectFee: subjectFee2,
      } = await getExpectedSellReturnAndFee(
        subjectToken,
        vaultInstance,
        subjectTokenAddress,
        moxieTokenAddress,
        formula,
        reserveRatio,
        feeInput,
        PCT_BASE,
        totalSellAmountSeller2,
      );

      const expectedReturn2 = returnAmount2 - protocolFee2 - subjectFee2;

      const previousMoxieBalanceSeller2 = await moxieToken.balanceOf(
        seller2.address,
      );
      const feeBeneficiaryPreviousMoxieBalance2 =
        await protocolRewards.balanceOf(feeBeneficiary.address);
      const subjectBeneficiaryPreviousMoxieBalance2 =
        await protocolRewards.balanceOf(subject.address);

      await expect(
        moxieBondingCurve
          .connect(seller2)
          .sellSharesFor(
            subject.address,
            totalSellAmountSeller2,
            seller2.address,
            0,
          ),
      )
        .to.emit(moxieBondingCurve, "SubjectShareSold")
        .withArgs(
          subject.address,
          subjectTokenAddress,
          totalSellAmountSeller2,
          seller2.address,
          moxieTokenAddress,
          expectedReturn2,
          seller2.address,
        );

      //verify fund transfers
      expect(await moxieToken.balanceOf(seller2.address)).to.equal(
        BigInt(previousMoxieBalanceSeller2) + expectedReturn2,
      );
      expect(await protocolRewards.balanceOf(feeBeneficiary.address)).to.equal(
        BigInt(feeBeneficiaryPreviousMoxieBalance2) + protocolFee2,
      );
      expect(await protocolRewards.balanceOf(subject.address)).to.equal(
        BigInt(subjectBeneficiaryPreviousMoxieBalance2) + subjectFee2,
      );
    });

    it("should be able to sell all subject token till supply is 0 ", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        moxieBondingCurveAddress,
        initialSupply,
        reserveRatio,
        subjectTokenAddress,
        moxieTokenAddress,
        formula,
        subjectToken,
        vaultInstance,
        feeInput,
        PCT_BASE,
        seller,
        seller2,
      } = deployment;

      await setupSell(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );
      const totalSellAmountSeller2 = await subjectToken.balanceOf(
        seller2.address,
      );

      // seller 1
      const { returnAmount, protocolFee, subjectFee } =
        await getExpectedSellReturnAndFee(
          subjectToken,
          vaultInstance,
          subjectTokenAddress,
          moxieTokenAddress,
          formula,
          reserveRatio,
          feeInput,
          PCT_BASE,
          totalSellAmountSeller1,
        );

      const expectedReturn = returnAmount - protocolFee - subjectFee;

      await subjectToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller1);

      await expect(
        moxieBondingCurve
          .connect(seller)
          .sellSharesFor(
            subject.address,
            totalSellAmountSeller1,
            seller.address,
            0,
          ),
      )
        .to.emit(moxieBondingCurve, "SubjectShareSold")
        .withArgs(
          subject.address,
          subjectTokenAddress,
          totalSellAmountSeller1,
          seller.address,
          moxieTokenAddress,
          expectedReturn,
          seller.address,
        );

      // seller 2
      await subjectToken
        .connect(seller2)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller2);

      const {
        returnAmount: returnAmount2,
        protocolFee: protocolFee2,
        subjectFee: subjectFee2,
      } = await getExpectedSellReturnAndFee(
        subjectToken,
        vaultInstance,
        subjectTokenAddress,
        moxieTokenAddress,
        formula,
        reserveRatio,
        feeInput,
        PCT_BASE,
        totalSellAmountSeller2,
      );

      const expectedReturn2 = returnAmount2 - protocolFee2 - subjectFee2;

      await expect(
        moxieBondingCurve
          .connect(seller2)
          .sellSharesFor(
            subject.address,
            totalSellAmountSeller2,
            seller2.address,
            0,
          ),
      )
        .to.emit(moxieBondingCurve, "SubjectShareSold")
        .withArgs(
          subject.address,
          subjectTokenAddress,
          totalSellAmountSeller2,
          seller2.address,
          moxieTokenAddress,
          expectedReturn2,
          seller2.address,
        );

      // iniitial onboarding supply sell
      await subjectToken
        .connect(subjectFactory)
        .approve(moxieBondingCurveAddress, initialSupply);

      await expect(
        moxieBondingCurve
          .connect(subjectFactory)
          .sellSharesFor(
            subject.address,
            initialSupply,
            subjectFactory.address,
            0,
          ),
      ).to.emit(moxieBondingCurve, "SubjectShareSold");

      //check vault balance & totoal supply is 0
      expect(
        await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress),
      ).to.equal(0);
      expect(await subjectToken.totalSupply()).to.equal(0);
      expect(await subjectToken.balanceOf(seller.address)).to.equal(0);
      expect(await subjectToken.balanceOf(seller2.address)).to.equal(0);
    });

    it("should revert for zero subject", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        moxieBondingCurveAddress,
        subjectToken,
        seller,
      } = deployment;

      await setupSell(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );

      await subjectToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller1);

      await expect(
        moxieBondingCurve
          .connect(seller)
          .sellSharesFor(
            ethers.ZeroAddress,
            totalSellAmountSeller1,
            seller.address,
            0,
          ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidSubject",
      );
    });

    it("should revert for zero sell amount", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieBondingCurveAddress,
        subjectToken,
        seller,
      } = deployment;

      await setupSell(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );

      await subjectToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller1);

      await expect(
        moxieBondingCurve
          .connect(seller)
          .sellSharesFor(subject.address, 0, seller.address, 0),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidSellAmount",
      );
    });

    it("should revert when invalid subject ", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        moxieBondingCurveAddress,
        owner,
        subjectToken,
        seller,
      } = deployment;

      await setupSell(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );

      await subjectToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller1);

      await expect(
        moxieBondingCurve
          .connect(seller)
          .sellSharesFor(
            owner.address,
            totalSellAmountSeller1,
            seller.address,
            0,
          ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_SubjectNotInitialized",
      );
    });

    it("should revert when seller didnot approve for  subject tokens ", async () => {
      const deployment = await loadFixture(deploy);
      const { moxieBondingCurve, subject, subjectToken, seller } = deployment;

      await setupSell(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );

      await expect(
        moxieBondingCurve
          .connect(seller)
          .sellSharesFor(
            subject.address,
            totalSellAmountSeller1,
            seller.address,
            0,
          ),
      ).to.revertedWithCustomError(subjectToken, "ERC20InsufficientAllowance");
    });

    it("should revert when seller has insufficient funds ", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieBondingCurveAddress,
        owner,
        subjectToken,
        seller,
      } = deployment;

      await setupSell(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );

      await subjectToken
        .connect(owner)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller1);

      await expect(
        moxieBondingCurve
          .connect(owner)
          .sellSharesFor(
            subject.address,
            totalSellAmountSeller1,
            owner.address,
            0,
          ),
      ).to.revertedWithCustomError(subjectToken, "ERC20InsufficientBalance");
    });

    it("should not allow sell when contract is paused", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieBondingCurveAddress,
        owner,
        subjectToken,
        seller,
        deployer,
      } = deployment;

      await setupSell(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );

      await moxieBondingCurve
        .connect(owner)
        .grantRole(await moxieBondingCurve.PAUSE_ROLE(), deployer.address);
      await moxieBondingCurve.connect(deployer).pause();

      await subjectToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller1);

      await expect(
        moxieBondingCurve
          .connect(seller)
          .sellSharesFor(
            subject.address,
            totalSellAmountSeller1,
            seller.address,
            0,
          ),
      ).to.revertedWithCustomError(moxieBondingCurve, "EnforcedPause");
    });
  });

  describe("sell subject token shares", () => {
    const setupSell = async (deployment: any) => {
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        moxieToken,
        moxieBondingCurveAddress,
        initialReserve,
        initialSupply,
        reserveRatio,
        subjectTokenAddress,
        seller,
        seller2,
        owner,
        moxiePass,
        minter,
      } = deployment;

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
        .transfer(seller.address, (1 * 1e20).toString());
      await moxieToken
        .connect(owner)
        .transfer(seller2.address, (1 * 1e20).toString());

      const buyAmount = (1 * 1e19).toString();

      await moxiePass.connect(minter).mint(seller.address, "url");
      await moxiePass.connect(minter).mint(seller2.address, "url");

      await moxieToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, buyAmount);
      await expect(
        moxieBondingCurve
          .connect(seller)
          .buySharesFor(subject.address, buyAmount, seller.address, 0),
      ).to.emit(moxieBondingCurve, "SubjectSharePurchased");

      await moxieToken
        .connect(seller2)
        .approve(moxieBondingCurveAddress, buyAmount);
      await expect(
        moxieBondingCurve
          .connect(seller2)
          .buySharesFor(subject.address, buyAmount, seller2.address, 0),
      ).to.emit(moxieBondingCurve, "SubjectSharePurchased");
    };

    it("should be able to sell subject token", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        reserveRatio,
        subjectTokenAddress,
        moxieTokenAddress,
        formula,
        subjectToken,
        vaultInstance,
        feeInput,
        PCT_BASE,
        feeBeneficiary,
        seller,
        protocolRewards,
        seller2,
      } = deployment;

      await setupSell(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );
      const totalSellAmountSeller2 = await subjectToken.balanceOf(
        seller2.address,
      );

      // seller 1
      const { returnAmount, protocolFee, subjectFee } =
        await getExpectedSellReturnAndFee(
          subjectToken,
          vaultInstance,
          subjectTokenAddress,
          moxieTokenAddress,
          formula,
          reserveRatio,
          feeInput,
          PCT_BASE,
          totalSellAmountSeller1,
        );

      const expectedReturn = returnAmount - protocolFee - subjectFee;

      await subjectToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller1);

      const sellerPreviousMoxieBalance = await moxieToken.balanceOf(
        seller.address,
      );
      const feeBeneficiaryPreviousMoxieBalance =
        await protocolRewards.balanceOf(feeBeneficiary.address);
      const subjectBeneficiaryPreviousMoxieBalance =
        await protocolRewards.balanceOf(subject.address);
      await expect(
        moxieBondingCurve
          .connect(seller)
          .sellShares(subject.address, totalSellAmountSeller1, 0),
      )
        .to.emit(moxieBondingCurve, "SubjectShareSold")
        .withArgs(
          subject.address,
          subjectTokenAddress,
          totalSellAmountSeller1,
          seller.address,
          moxieTokenAddress,
          expectedReturn,
          seller.address,
        );

      //verify fund transfers
      expect(await moxieToken.balanceOf(seller.address)).to.equal(
        BigInt(sellerPreviousMoxieBalance) + expectedReturn,
      );
      expect(await protocolRewards.balanceOf(feeBeneficiary.address)).to.equal(
        BigInt(feeBeneficiaryPreviousMoxieBalance) + protocolFee,
      );
      expect(await protocolRewards.balanceOf(subject.address)).to.equal(
        BigInt(subjectBeneficiaryPreviousMoxieBalance) + subjectFee,
      );

      // seller 2
      await subjectToken
        .connect(seller2)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller2);

      const {
        returnAmount: returnAmount2,
        protocolFee: protocolFee2,
        subjectFee: subjectFee2,
      } = await getExpectedSellReturnAndFee(
        subjectToken,
        vaultInstance,
        subjectTokenAddress,
        moxieTokenAddress,
        formula,
        reserveRatio,
        feeInput,
        PCT_BASE,
        totalSellAmountSeller2,
      );

      const expectedReturn2 = returnAmount2 - protocolFee2 - subjectFee2;

      const previousMoxieBalanceSeller2 = await moxieToken.balanceOf(
        seller2.address,
      );
      const feeBeneficiaryPreviousMoxieBalance2 =
        await protocolRewards.balanceOf(feeBeneficiary.address);
      const subjectBeneficiaryPreviousMoxieBalance2 =
        await protocolRewards.balanceOf(subject.address);

      await expect(
        moxieBondingCurve
          .connect(seller2)
          .sellShares(subject.address, totalSellAmountSeller2, 0),
      )
        .to.emit(moxieBondingCurve, "SubjectShareSold")
        .withArgs(
          subject.address,
          subjectTokenAddress,
          totalSellAmountSeller2,
          seller2.address,
          moxieTokenAddress,
          expectedReturn2,
          seller2.address,
        );

      //verify fund transfers
      expect(await moxieToken.balanceOf(seller2.address)).to.equal(
        BigInt(previousMoxieBalanceSeller2) + expectedReturn2,
      );
      expect(await protocolRewards.balanceOf(feeBeneficiary.address)).to.equal(
        BigInt(feeBeneficiaryPreviousMoxieBalance2) + protocolFee2,
      );
      expect(await protocolRewards.balanceOf(subject.address)).to.equal(
        BigInt(subjectBeneficiaryPreviousMoxieBalance2) + subjectFee2,
      );
    });

    it("should be able to sell all subject token till supply is 0 ", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        moxieBondingCurveAddress,
        initialSupply,
        reserveRatio,
        subjectTokenAddress,
        moxieTokenAddress,
        formula,
        subjectToken,
        vaultInstance,
        feeInput,
        PCT_BASE,
        seller,
        seller2,
      } = deployment;

      await setupSell(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );
      const totalSellAmountSeller2 = await subjectToken.balanceOf(
        seller2.address,
      );

      // seller 1
      const { returnAmount, protocolFee, subjectFee } =
        await getExpectedSellReturnAndFee(
          subjectToken,
          vaultInstance,
          subjectTokenAddress,
          moxieTokenAddress,
          formula,
          reserveRatio,
          feeInput,
          PCT_BASE,
          totalSellAmountSeller1,
        );

      const expectedReturn = returnAmount - protocolFee - subjectFee;

      await subjectToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller1);

      await expect(
        moxieBondingCurve
          .connect(seller)
          .sellShares(subject.address, totalSellAmountSeller1, 0),
      )
        .to.emit(moxieBondingCurve, "SubjectShareSold")
        .withArgs(
          subject.address,
          subjectTokenAddress,
          totalSellAmountSeller1,
          seller.address,
          moxieTokenAddress,
          expectedReturn,
          seller.address,
        );

      // seller 2
      await subjectToken
        .connect(seller2)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller2);

      const {
        returnAmount: returnAmount2,
        protocolFee: protocolFee2,
        subjectFee: subjectFee2,
      } = await getExpectedSellReturnAndFee(
        subjectToken,
        vaultInstance,
        subjectTokenAddress,
        moxieTokenAddress,
        formula,
        reserveRatio,
        feeInput,
        PCT_BASE,
        totalSellAmountSeller2,
      );

      const expectedReturn2 = returnAmount2 - protocolFee2 - subjectFee2;

      await expect(
        moxieBondingCurve
          .connect(seller2)
          .sellShares(subject.address, totalSellAmountSeller2, 0),
      )
        .to.emit(moxieBondingCurve, "SubjectShareSold")
        .withArgs(
          subject.address,
          subjectTokenAddress,
          totalSellAmountSeller2,
          seller2.address,
          moxieTokenAddress,
          expectedReturn2,
          seller2.address,
        );

      // iniitial onboarding supply sell
      await subjectToken
        .connect(subjectFactory)
        .approve(moxieBondingCurveAddress, initialSupply);

      await expect(
        moxieBondingCurve
          .connect(subjectFactory)
          .sellShares(subject.address, initialSupply, 0),
      ).to.emit(moxieBondingCurve, "SubjectShareSold");

      //check vault balance & totoal supply is 0
      expect(
        await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress),
      ).to.equal(0);
      expect(await subjectToken.totalSupply()).to.equal(0);
      expect(await subjectToken.balanceOf(seller.address)).to.equal(0);
      expect(await subjectToken.balanceOf(seller2.address)).to.equal(0);
    });

    it("should revert for zero subject", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        moxieBondingCurveAddress,
        subjectToken,
        seller,
      } = deployment;

      await setupSell(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );

      await subjectToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller1);

      await expect(
        moxieBondingCurve
          .connect(seller)
          .sellShares(ethers.ZeroAddress, totalSellAmountSeller1, 0),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidSubject",
      );
    });

    it("should revert for zero sell amount", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieBondingCurveAddress,
        subjectToken,
        seller,
      } = deployment;

      await setupSell(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );

      await subjectToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller1);

      await expect(
        moxieBondingCurve.connect(seller).sellShares(subject.address, 0, 0),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidSellAmount",
      );
    });

    it("should revert when invalid subject ", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        moxieBondingCurveAddress,
        owner,
        subjectToken,
        seller,
      } = deployment;

      await setupSell(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );

      await subjectToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller1);

      await expect(
        moxieBondingCurve
          .connect(seller)
          .sellShares(owner.address, totalSellAmountSeller1, 0),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_SubjectNotInitialized",
      );
    });

    it("should revert when seller didnot approve for  subject tokens ", async () => {
      const deployment = await loadFixture(deploy);
      const { moxieBondingCurve, subject, subjectToken, seller } = deployment;

      await setupSell(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );

      await expect(
        moxieBondingCurve
          .connect(seller)
          .sellShares(subject.address, totalSellAmountSeller1, 0),
      ).to.revertedWithCustomError(subjectToken, "ERC20InsufficientAllowance");
    });

    it("should revert when seller has insufficient funds ", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieBondingCurveAddress,
        owner,
        subjectToken,
        seller,
      } = deployment;

      await setupSell(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );

      await subjectToken
        .connect(owner)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller1);

      await expect(
        moxieBondingCurve
          .connect(owner)
          .sellShares(subject.address, totalSellAmountSeller1, 0),
      ).to.revertedWithCustomError(subjectToken, "ERC20InsufficientBalance");
    });

    it("should not allow sell when contract is paused", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieBondingCurveAddress,
        owner,
        subjectToken,
        seller,
        deployer,
      } = deployment;

      await setupSell(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );

      await moxieBondingCurve
        .connect(owner)
        .grantRole(await moxieBondingCurve.PAUSE_ROLE(), deployer.address);
      await moxieBondingCurve.connect(deployer).pause();

      await subjectToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller1);

      await expect(
        moxieBondingCurve
          .connect(seller)
          .sellShares(subject.address, totalSellAmountSeller1, 0),
      ).to.revertedWithCustomError(moxieBondingCurve, "EnforcedPause");
    });
  });

  describe("update fee", () => {
    it("should be able to update fee", async () => {
      const { owner, moxieBondingCurve, deployer } = await loadFixture(deploy);

      await moxieBondingCurve
        .connect(owner)
        .grantRole(
          await moxieBondingCurve.UPDATE_FEES_ROLE(),
          deployer.address,
        );

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

      await expect(moxieBondingCurve.connect(deployer).updateFees(feeInput))
        .to.emit(moxieBondingCurve, "UpdateFees")
        .withArgs(
          feeInput.protocolBuyFeePct,
          feeInput.protocolSellFeePct,
          feeInput.subjectBuyFeePct,
          feeInput.subjectSellFeePct,
        );
    });

    it("should not be able to update fee without permission", async () => {
      const { moxieBondingCurve, deployer } = await loadFixture(deploy);

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

      await expect(moxieBondingCurve.connect(deployer).updateFees(feeInput))
        .to.revertedWithCustomError(
          moxieBondingCurve,
          "AccessControlUnauthorizedAccount",
        )
        .withArgs(deployer.address, await moxieBondingCurve.UPDATE_FEES_ROLE());
    });

    it("should fail of invalid protocolBuyFeePct", async () => {
      const { owner, moxieBondingCurve, deployer } = await loadFixture(deploy);

      await moxieBondingCurve
        .connect(owner)
        .grantRole(
          await moxieBondingCurve.UPDATE_FEES_ROLE(),
          deployer.address,
        );

      const protocolBuyFeePct = (1e19).toString(); // 1%
      const protocolSellFeePct = (2 * 1e16).toString(); // 2%
      const subjectBuyFeePct = (3 * 1e16).toString(); // 3%
      const subjectSellFeePct = (4 * 1e16).toString(); // 4%

      const feeInput = {
        protocolBuyFeePct,
        protocolSellFeePct,
        subjectBuyFeePct,
        subjectSellFeePct,
      };

      await expect(
        moxieBondingCurve.connect(deployer).updateFees(feeInput),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidFeePercentage",
      );
    });

    it("should fail of invalid protocolSellFeePct", async () => {
      const { owner, moxieBondingCurve, deployer } = await loadFixture(deploy);

      await moxieBondingCurve
        .connect(owner)
        .grantRole(
          await moxieBondingCurve.UPDATE_FEES_ROLE(),
          deployer.address,
        );

      const protocolBuyFeePct = (1e16).toString(); // 1%
      const protocolSellFeePct = (2 * 1e19).toString(); // 2%
      const subjectBuyFeePct = (3 * 1e16).toString(); // 3%
      const subjectSellFeePct = (4 * 1e16).toString(); // 4%

      const feeInput = {
        protocolBuyFeePct,
        protocolSellFeePct,
        subjectBuyFeePct,
        subjectSellFeePct,
      };

      await expect(
        moxieBondingCurve.connect(deployer).updateFees(feeInput),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidFeePercentage",
      );
    });

    it("should fail of invalid subjectBuyFeePct", async () => {
      const { owner, moxieBondingCurve, deployer } = await loadFixture(deploy);

      await moxieBondingCurve
        .connect(owner)
        .grantRole(
          await moxieBondingCurve.UPDATE_FEES_ROLE(),
          deployer.address,
        );

      const protocolBuyFeePct = (1e16).toString(); // 1%
      const protocolSellFeePct = (2 * 1e16).toString(); // 2%
      const subjectBuyFeePct = (3 * 1e19).toString(); // 3%
      const subjectSellFeePct = (4 * 1e16).toString(); // 4%

      const feeInput = {
        protocolBuyFeePct,
        protocolSellFeePct,
        subjectBuyFeePct,
        subjectSellFeePct,
      };

      await expect(
        moxieBondingCurve.connect(deployer).updateFees(feeInput),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidFeePercentage",
      );
    });

    it("should fail of invalid subjectSellFeePct", async () => {
      const { owner, moxieBondingCurve, deployer } = await loadFixture(deploy);

      await moxieBondingCurve
        .connect(owner)
        .grantRole(
          await moxieBondingCurve.UPDATE_FEES_ROLE(),
          deployer.address,
        );

      const protocolBuyFeePct = (1e16).toString(); // 1%
      const protocolSellFeePct = (2 * 1e16).toString(); // 2%
      const subjectBuyFeePct = (3 * 1e16).toString(); // 3%
      const subjectSellFeePct = (4 * 1e19).toString(); // 4%

      const feeInput = {
        protocolBuyFeePct,
        protocolSellFeePct,
        subjectBuyFeePct,
        subjectSellFeePct,
      };

      await expect(
        moxieBondingCurve.connect(deployer).updateFees(feeInput),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidFeePercentage",
      );
    });
  });

  describe("update Formula", () => {
    it("should update formula ", async () => {
      const { owner, moxieBondingCurve, deployer } = await loadFixture(deploy);

      await moxieBondingCurve
        .connect(owner)
        .grantRole(
          await moxieBondingCurve.UPDATE_FORMULA_ROLE(),
          deployer.address,
        );

      const randomAddress = owner.address;
      expect(
        await moxieBondingCurve.connect(deployer).updateFormula(randomAddress),
      )
        .to.emit(moxieBondingCurve, "UpdateFormula")
        .withArgs(randomAddress);
    });

    it("should not update formula without permission", async () => {
      const { owner, moxieBondingCurve, deployer } = await loadFixture(deploy);

      const randomAddress = owner.address;
      await expect(
        moxieBondingCurve.connect(deployer).updateFormula(randomAddress),
      )
        .to.revertedWithCustomError(
          moxieBondingCurve,
          "AccessControlUnauthorizedAccount",
        )
        .withArgs(
          deployer.address,
          await moxieBondingCurve.UPDATE_FORMULA_ROLE(),
        );
    });

    it("should throw error when zero address is passed as formula", async () => {
      const { owner, moxieBondingCurve, deployer } = await loadFixture(deploy);

      await moxieBondingCurve
        .connect(owner)
        .grantRole(
          await moxieBondingCurve.UPDATE_FORMULA_ROLE(),
          deployer.address,
        );
      await expect(
        moxieBondingCurve.connect(deployer).updateFormula(ethers.ZeroAddress),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidFormula",
      );
    });
  });

  describe("update Beneficiary", () => {
    it("should update beneficiary ", async () => {
      const { owner, moxieBondingCurve, deployer } = await loadFixture(deploy);

      await moxieBondingCurve
        .connect(owner)
        .grantRole(
          await moxieBondingCurve.UPDATE_BENEFICIARY_ROLE(),
          deployer.address,
        );

      const randomAddress = owner.address;
      expect(
        await moxieBondingCurve
          .connect(deployer)
          .updateFeeBeneficiary(randomAddress),
      )
        .to.emit(moxieBondingCurve, "UpdateBeneficiary")
        .withArgs(randomAddress);
    });

    it("should not update beneficiary without permission", async () => {
      const { owner, moxieBondingCurve, deployer } = await loadFixture(deploy);

      const randomAddress = owner.address;
      await expect(
        moxieBondingCurve.connect(deployer).updateFeeBeneficiary(randomAddress),
      )
        .to.revertedWithCustomError(
          moxieBondingCurve,
          "AccessControlUnauthorizedAccount",
        )
        .withArgs(
          deployer.address,
          await moxieBondingCurve.UPDATE_BENEFICIARY_ROLE(),
        );
    });

    it("should throw error when zero address is passed as beneficiary", async () => {
      const { owner, moxieBondingCurve, deployer } = await loadFixture(deploy);

      await moxieBondingCurve
        .connect(owner)
        .grantRole(
          await moxieBondingCurve.UPDATE_BENEFICIARY_ROLE(),
          deployer.address,
        );
      await expect(
        moxieBondingCurve
          .connect(deployer)
          .updateFeeBeneficiary(ethers.ZeroAddress),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidBeneficiary",
      );
    });
  });

  describe("calculateTokensForBuy ", () => {
    const setupBuy = async (deployment: any) => {
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        moxieToken,
        moxieBondingCurveAddress,
        initialReserve,
        initialSupply,
        reserveRatio,
        subjectTokenAddress,
        buyer,
        buyer2,
        owner,
      } = deployment;

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
        .transfer(buyer.address, (1 * 1e20).toString());
      await moxieToken
        .connect(owner)
        .transfer(buyer2.address, (1 * 1e20).toString());
    };

    it("estimate moxie amount require for given subject token", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        reserveRatio,
        subjectTokenAddress,
        moxieTokenAddress,
        formula,
        subjectToken,
        vaultInstance,
        feeInput,
        PCT_BASE,
      } = deployment;

      await setupBuy(deployment);

      const buyAmount = (1 * 1e19).toString();

      const { expectedShares, protocolFee, subjectFee } =
        await getExpectedBuyAmountAndFee(
          subjectToken,
          vaultInstance,
          subjectTokenAddress,
          moxieTokenAddress,
          formula,
          reserveRatio,
          feeInput,
          PCT_BASE,
          BigInt(buyAmount),
        );

      const estimate = await moxieBondingCurve.calculateTokensForBuy(
        subject,
        expectedShares,
      );

      expect(estimate.moxieAmount_).to.equal(buyAmount);
      expect(estimate.protocolFee_).to.equal(protocolFee);
      expect(estimate.subjectFee_).to.equal(subjectFee);
    });

    it("should fail estimate for zero subject", async () => {
      const deployment = await loadFixture(deploy);
      const { moxieBondingCurve } = deployment;

      await expect(
        moxieBondingCurve.calculateTokensForBuy(ethers.ZeroAddress, "100"),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidSubject",
      );
    });

    it("should fail estimate for invalid subject address", async () => {
      const deployment = await loadFixture(deploy);
      const { moxieBondingCurve, buyer } = deployment;

      await expect(
        moxieBondingCurve.calculateTokensForBuy(buyer.address, "100"),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_SubjectNotInitialized",
      );
    });

    it("should fail estimate for zero amount", async () => {
      const deployment = await loadFixture(deploy);
      const { moxieBondingCurve, subject } = deployment;

      await expect(
        moxieBondingCurve.calculateTokensForBuy(subject.address, "0"),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidAmount",
      );
    });
  });

  describe("calculateTokensForSell", () => {
    const setupSell = async (deployment: any) => {
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        moxieToken,
        moxieBondingCurveAddress,
        initialReserve,
        initialSupply,
        reserveRatio,
        subjectTokenAddress,
        seller,
        seller2,
        owner,
        moxiePass,
        minter,
      } = deployment;

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
        .transfer(seller.address, (1 * 1e20).toString());
      await moxieToken
        .connect(owner)
        .transfer(seller2.address, (1 * 1e20).toString());

      const buyAmount = (1 * 1e19).toString();

      await moxiePass.connect(minter).mint(seller.address, "url");
      await moxiePass.connect(minter).mint(seller2.address, "url");

      await moxieToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, buyAmount);
      await expect(
        moxieBondingCurve
          .connect(seller)
          .buySharesFor(subject.address, buyAmount, seller.address, 0),
      ).to.emit(moxieBondingCurve, "SubjectSharePurchased");

      await moxieToken
        .connect(seller2)
        .approve(moxieBondingCurveAddress, buyAmount);
      await expect(
        moxieBondingCurve
          .connect(seller2)
          .buySharesFor(subject.address, buyAmount, seller2.address, 0),
      ).to.emit(moxieBondingCurve, "SubjectSharePurchased");
    };

    it("should be able to sell subject token", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        reserveRatio,
        subjectTokenAddress,
        moxieTokenAddress,
        formula,
        subjectToken,
        vaultInstance,
        feeInput,
        PCT_BASE,
        seller,
      } = deployment;

      await setupSell(deployment);

      const sellAmount = await subjectToken.balanceOf(seller.address);

      // seller 1
      const { returnAmount, protocolFee, subjectFee } =
        await getExpectedSellReturnAndFee(
          subjectToken,
          vaultInstance,
          subjectTokenAddress,
          moxieTokenAddress,
          formula,
          reserveRatio,
          feeInput,
          PCT_BASE,
          sellAmount,
        );

      const expectedReturn = returnAmount - protocolFee - subjectFee;

      const estimate = await moxieBondingCurve.calculateTokensForSell(
        subject,
        sellAmount,
      );

      expect(estimate.moxieAmount_).to.equal(expectedReturn);
      expect(estimate.protocolFee_).to.equal(protocolFee);
      expect(estimate.subjectFee_).to.equal(subjectFee);
    });

    it("should fail estimate for zero subject", async () => {
      const deployment = await loadFixture(deploy);
      const { moxieBondingCurve } = deployment;

      await expect(
        moxieBondingCurve.calculateTokensForSell(ethers.ZeroAddress, "100"),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidSubject",
      );
    });

    it("should fail estimate for invalid subject address", async () => {
      const deployment = await loadFixture(deploy);
      const { moxieBondingCurve, buyer } = deployment;

      await expect(
        moxieBondingCurve.calculateTokensForSell(buyer.address, "100"),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_SubjectNotInitialized",
      );
    });

    it("should fail estimate for zero amount", async () => {
      const deployment = await loadFixture(deploy);
      const { moxieBondingCurve, subject } = deployment;

      await expect(
        moxieBondingCurve.calculateTokensForSell(subject.address, "0"),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidAmount",
      );
    });
  });

  describe("platformReferrer & orderReferrer for buy side ", () => {
    const setupBuyV2 = async (deployment: any) => {
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        moxieToken,
        moxieBondingCurveAddress,
        initialReserve,
        initialSupply,
        reserveRatio,
        subjectTokenAddress,
        buyer,
        buyer2,
        owner,
        platformReferrer,
        moxiePass,
        minter,
        referralFeeInput,
      } = deployment;

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
            platformReferrer,
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

      await moxieBondingCurve
        .connect(owner)
        .grantRole(await moxieBondingCurve.UPDATE_FEES_ROLE(), owner);

      await moxieBondingCurve
        .connect(owner)
        .updateReferralFee(
          referralFeeInput.platformReferrerBuyFeePct,
          referralFeeInput.platformReferrerSellFeePct,
          referralFeeInput.orderReferrerBuyFeePct,
          referralFeeInput.orderReferrerSellFeePct,
        );
      // fund buyer
      await moxieToken
        .connect(owner)
        .transfer(buyer.address, (1 * 1e20).toString());
      await moxieToken
        .connect(owner)
        .transfer(buyer2.address, (1 * 1e20).toString());

      await moxiePass.connect(minter).mint(buyer.address, "uri");
      await moxiePass.connect(minter).mint(buyer2.address, "uri");
    };

    it("should onboard subject with platform referrer", async () => {
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        moxieToken,
        moxieBondingCurveAddress,
        initialReserve,
        initialSupply,
        reserveRatio,
        vaultInstance,
        subjectTokenAddress,
        moxieTokenAddress,
        platformReferrer,
      } = await loadFixture(deploy);

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
            platformReferrer,
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

      expect(await moxieBondingCurve.reserveRatio(subject.address)).equal(
        reserveRatio,
      );
      expect(
        await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress),
      ).equal(initialReserve);

      expect(
        await moxieBondingCurve.platformReferrer(subject.address),
      ).to.equal(platformReferrer.address);
    });

    it("should buy shares with platform referrer fee", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        reserveRatio,
        vaultInstance,
        subjectTokenAddress,
        moxieTokenAddress,
        buyer,
        subjectToken,
        formula,
        feeInput,
        PCT_BASE,
        referralFeeInput,
        platformReferrer,
        feeBeneficiary,
        protocolRewards,
      } = deployment;

      await setupBuyV2(deployment);
      const buyAmount = ethers.parseEther("100");

      const { expectedShares, subjectFee, protocolFee, platformReferrerFee } =
        await getExpectedBuyAmountAndFee(
          subjectToken,
          vaultInstance,
          subjectTokenAddress,
          moxieTokenAddress,
          formula,
          reserveRatio,
          feeInput,
          PCT_BASE,
          BigInt(buyAmount),
          referralFeeInput,
        );

      await moxieToken
        .connect(buyer)
        .approve(moxieBondingCurveAddress, buyAmount);

      // Buy shares with order referrer and platform referrer
      await expect(
        moxieBondingCurve
          .connect(buyer)
          .buyShares(subject.address, buyAmount, expectedShares),
      )
        .to.emit(moxieBondingCurve, "SubjectSharePurchased")
        .withArgs(
          subject.address,
          moxieTokenAddress,
          buyAmount,
          buyer.address,
          subjectTokenAddress,
          expectedShares,
          buyer.address,
        );

      // Check the buyer's balance of moxie tokens
      expect(await moxieToken.balanceOf(buyer.address)).to.equal(
        ethers.parseEther("0"),
      );

      expect(await subjectToken.balanceOf(buyer.address)).to.equal(
        expectedShares,
      );

      expect(await protocolRewards.balanceOf(platformReferrer)).to.equal(
        platformReferrerFee,
      );
      expect(await protocolRewards.balanceOf(subject.address)).to.equal(
        subjectFee,
      );
      expect(await protocolRewards.balanceOf(feeBeneficiary)).to.equal(
        BigInt(protocolFee) - BigInt(platformReferrerFee),
      );
    });

    it("should buy shares with platform referrer fee & order referrer fee", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        reserveRatio,
        vaultInstance,
        subjectTokenAddress,
        moxieTokenAddress,
        orderReferrer,
        buyer,
        subjectToken,
        formula,
        feeInput,
        PCT_BASE,
        referralFeeInput,
        platformReferrer,
        feeBeneficiary,
        protocolRewards,
      } = deployment;

      await setupBuyV2(deployment);
      const buyAmount = ethers.parseEther("100");

      const {
        expectedShares,
        subjectFee,
        protocolFee,
        platformReferrerFee,
        orderReferrrerFee,
      } = await getExpectedBuyAmountAndFee(
        subjectToken,
        vaultInstance,
        subjectTokenAddress,
        moxieTokenAddress,
        formula,
        reserveRatio,
        feeInput,
        PCT_BASE,
        BigInt(buyAmount),
        referralFeeInput,
      );

      await moxieToken
        .connect(buyer)
        .approve(moxieBondingCurveAddress, buyAmount);

      // Buy shares with order referrer and platform referrer
      await expect(
        moxieBondingCurve
          .connect(buyer)
          .buySharesV2(
            subject.address,
            buyAmount,
            expectedShares,
            orderReferrer.address,
          ),
      )
        .to.emit(moxieBondingCurve, "SubjectSharePurchased")
        .withArgs(
          subject.address,
          moxieTokenAddress,
          buyAmount,
          buyer.address,
          subjectTokenAddress,
          expectedShares,
          buyer.address,
        );

      // Check the buyer's balance of moxie tokens
      expect(await moxieToken.balanceOf(buyer.address)).to.equal(
        ethers.parseEther("0"),
      );

      expect(await subjectToken.balanceOf(buyer.address)).to.equal(
        expectedShares,
      );

      expect(await protocolRewards.balanceOf(platformReferrer)).to.equal(
        platformReferrerFee,
      );
      expect(await protocolRewards.balanceOf(orderReferrer)).to.equal(
        orderReferrrerFee,
      );
      expect(await protocolRewards.balanceOf(feeBeneficiary)).to.equal(
        BigInt(protocolFee) -
          BigInt(platformReferrerFee) -
          BigInt(orderReferrrerFee),
      );
      expect(await protocolRewards.balanceOf(subject.address)).to.equal(
        subjectFee,
      );
    });

    it("should not transfer order referrer fee if order referrer is zero address during buy", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        reserveRatio,
        vaultInstance,
        subjectTokenAddress,
        moxieTokenAddress,
        orderReferrer,
        buyer,
        subjectToken,
        formula,
        feeInput,
        PCT_BASE,
        referralFeeInput,
        platformReferrer,
        feeBeneficiary,
        protocolRewards,
      } = deployment;

      await setupBuyV2(deployment);
      const buyAmount = ethers.parseEther("100");

      const { expectedShares, subjectFee, protocolFee, platformReferrerFee } =
        await getExpectedBuyAmountAndFee(
          subjectToken,
          vaultInstance,
          subjectTokenAddress,
          moxieTokenAddress,
          formula,
          reserveRatio,
          feeInput,
          PCT_BASE,
          BigInt(buyAmount),
          referralFeeInput,
        );

      await moxieToken
        .connect(buyer)
        .approve(moxieBondingCurveAddress, buyAmount);

      // Buy shares with order referrer and platform referrer
      await expect(
        moxieBondingCurve
          .connect(buyer)
          .buySharesV2(
            subject.address,
            buyAmount,
            expectedShares,
            ethers.ZeroAddress,
          ),
      )
        .to.emit(moxieBondingCurve, "SubjectSharePurchased")
        .withArgs(
          subject.address,
          moxieTokenAddress,
          buyAmount,
          buyer.address,
          subjectTokenAddress,
          expectedShares,
          buyer.address,
        );

      // Check the buyer's balance of moxie tokens
      expect(await moxieToken.balanceOf(buyer.address)).to.equal(
        ethers.parseEther("0"),
      );

      expect(await subjectToken.balanceOf(buyer.address)).to.equal(
        expectedShares,
      );

      expect(await protocolRewards.balanceOf(platformReferrer)).to.equal(
        platformReferrerFee,
      );
      expect(await protocolRewards.balanceOf(orderReferrer)).to.equal(0);
      expect(await protocolRewards.balanceOf(feeBeneficiary)).to.equal(
        BigInt(protocolFee) - BigInt(platformReferrerFee) - BigInt(0),
      );
      expect(await protocolRewards.balanceOf(subject.address)).to.equal(
        subjectFee,
      );
    });
  });

  describe("platformReferrer & orderReferrer for sell side", () => {
    const setupSellV2 = async (deployment: any) => {
      const {
        moxieBondingCurve,
        subject,
        subjectFactory,
        moxieToken,
        moxieBondingCurveAddress,
        initialReserve,
        initialSupply,
        reserveRatio,
        subjectTokenAddress,
        seller,
        seller2,
        owner,
        moxiePass,
        minter,
        platformReferrer,
        referralFeeInput,
      } = deployment;

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
            platformReferrer,
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

      await moxieBondingCurve
        .connect(owner)
        .grantRole(await moxieBondingCurve.UPDATE_FEES_ROLE(), owner);

      await moxieBondingCurve
        .connect(owner)
        .updateReferralFee(
          referralFeeInput.platformReferrerBuyFeePct,
          referralFeeInput.platformReferrerSellFeePct,
          referralFeeInput.orderReferrerBuyFeePct,
          referralFeeInput.orderReferrerSellFeePct,
        );

      // fund buyer
      await moxieToken
        .connect(owner)
        .transfer(seller.address, (1 * 1e20).toString());
      await moxieToken
        .connect(owner)
        .transfer(seller2.address, (1 * 1e20).toString());

      const buyAmount = (1 * 1e19).toString();

      await moxiePass.connect(minter).mint(seller.address, "url");
      await moxiePass.connect(minter).mint(seller2.address, "url");

      await moxieToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, buyAmount);
      await expect(
        moxieBondingCurve
          .connect(seller)
          .buySharesFor(subject.address, buyAmount, seller.address, 0),
      ).to.emit(moxieBondingCurve, "SubjectSharePurchased");

      await moxieToken
        .connect(seller2)
        .approve(moxieBondingCurveAddress, buyAmount);
      await expect(
        moxieBondingCurve
          .connect(seller2)
          .buySharesFor(subject.address, buyAmount, seller2.address, 0),
      ).to.emit(moxieBondingCurve, "SubjectSharePurchased");
    };

    it("should be able to sell subject token with platform referrer fee", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        reserveRatio,
        subjectTokenAddress,
        moxieTokenAddress,
        formula,
        subjectToken,
        vaultInstance,
        feeInput,
        PCT_BASE,
        feeBeneficiary,
        seller,
        protocolRewards,
        platformReferrer,
        referralFeeInput,
      } = deployment;

      await setupSellV2(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );

      // seller 1
      const { returnAmount, protocolFee, subjectFee, platformReferrerFee } =
        await getExpectedSellReturnAndFee(
          subjectToken,
          vaultInstance,
          subjectTokenAddress,
          moxieTokenAddress,
          formula,
          reserveRatio,
          feeInput,
          PCT_BASE,
          totalSellAmountSeller1,
          referralFeeInput,
        );

      const expectedReturn = returnAmount - protocolFee - subjectFee;

      await subjectToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller1);

      const sellerPreviousMoxieBalance = await moxieToken.balanceOf(
        seller.address,
      );
      const feeBeneficiaryPreviousMoxieBalance =
        await protocolRewards.balanceOf(feeBeneficiary.address);
      const subjectBeneficiaryPreviousMoxieBalance =
        await protocolRewards.balanceOf(subject.address);

      const platformReferrerPreviousMoxieBalance =
        await protocolRewards.balanceOf(platformReferrer.address);
      await expect(
        moxieBondingCurve
          .connect(seller)
          .sellSharesFor(
            subject.address,
            totalSellAmountSeller1,
            seller.address,
            0,
          ),
      )
        .to.emit(moxieBondingCurve, "SubjectShareSold")
        .withArgs(
          subject.address,
          subjectTokenAddress,
          totalSellAmountSeller1,
          seller.address,
          moxieTokenAddress,
          expectedReturn,
          seller.address,
        );

      //verify fund transfers
      expect(await moxieToken.balanceOf(seller.address)).to.equal(
        BigInt(sellerPreviousMoxieBalance) + expectedReturn,
      );

      expect(await protocolRewards.balanceOf(subject.address)).to.equal(
        BigInt(subjectBeneficiaryPreviousMoxieBalance) + subjectFee,
      );

      expect(await protocolRewards.balanceOf(platformReferrer)).to.equal(
        BigInt(platformReferrerPreviousMoxieBalance) +
          BigInt(platformReferrerFee),
      );

      expect(await protocolRewards.balanceOf(feeBeneficiary.address)).to.equal(
        BigInt(feeBeneficiaryPreviousMoxieBalance) +
          protocolFee -
          BigInt(platformReferrerFee),
      );
    });

    it("should be able to sell subject token with platform referrer fee & order referrer fee", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        reserveRatio,
        subjectTokenAddress,
        moxieTokenAddress,
        formula,
        subjectToken,
        vaultInstance,
        feeInput,
        PCT_BASE,
        feeBeneficiary,
        seller,
        protocolRewards,
        platformReferrer,
        referralFeeInput,
        orderReferrer,
      } = deployment;

      await setupSellV2(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );

      // seller 1
      const {
        returnAmount,
        protocolFee,
        subjectFee,
        platformReferrerFee,
        orderReferrrerFee,
      } = await getExpectedSellReturnAndFee(
        subjectToken,
        vaultInstance,
        subjectTokenAddress,
        moxieTokenAddress,
        formula,
        reserveRatio,
        feeInput,
        PCT_BASE,
        totalSellAmountSeller1,
        referralFeeInput,
      );

      const expectedReturn = returnAmount - protocolFee - subjectFee;

      await subjectToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller1);

      const sellerPreviousMoxieBalance = await moxieToken.balanceOf(
        seller.address,
      );
      const feeBeneficiaryPreviousMoxieBalance =
        await protocolRewards.balanceOf(feeBeneficiary.address);
      const subjectBeneficiaryPreviousMoxieBalance =
        await protocolRewards.balanceOf(subject.address);

      const platformReferrerPreviousMoxieBalance =
        await protocolRewards.balanceOf(platformReferrer.address);
      await expect(
        moxieBondingCurve
          .connect(seller)
          .sellSharesForV2(
            subject.address,
            totalSellAmountSeller1,
            seller.address,
            0,
            orderReferrer,
          ),
      )
        .to.emit(moxieBondingCurve, "SubjectShareSold")
        .withArgs(
          subject.address,
          subjectTokenAddress,
          totalSellAmountSeller1,
          seller.address,
          moxieTokenAddress,
          expectedReturn,
          seller.address,
        );

      //verify fund transfers
      expect(await moxieToken.balanceOf(seller.address)).to.equal(
        BigInt(sellerPreviousMoxieBalance) + expectedReturn,
      );

      expect(await protocolRewards.balanceOf(subject.address)).to.equal(
        BigInt(subjectBeneficiaryPreviousMoxieBalance) + subjectFee,
      );

      expect(await protocolRewards.balanceOf(platformReferrer)).to.equal(
        BigInt(platformReferrerPreviousMoxieBalance) +
          BigInt(platformReferrerFee),
      );

      expect(await protocolRewards.balanceOf(feeBeneficiary.address)).to.equal(
        BigInt(feeBeneficiaryPreviousMoxieBalance) +
          protocolFee -
          BigInt(platformReferrerFee) -
          BigInt(orderReferrrerFee),
      );

      expect(await protocolRewards.balanceOf(orderReferrer.address)).to.equal(
        BigInt(orderReferrrerFee),
      );
    });

    it("should not transfer order referrer fee if order referrer is zero address during sell", async () => {
      const deployment = await loadFixture(deploy);
      const {
        moxieBondingCurve,
        subject,
        moxieToken,
        moxieBondingCurveAddress,
        reserveRatio,
        subjectTokenAddress,
        moxieTokenAddress,
        formula,
        subjectToken,
        vaultInstance,
        feeInput,
        PCT_BASE,
        feeBeneficiary,
        seller,
        protocolRewards,
        platformReferrer,
        referralFeeInput,
        orderReferrer,
      } = deployment;

      await setupSellV2(deployment);

      const totalSellAmountSeller1 = await subjectToken.balanceOf(
        seller.address,
      );

      // seller 1
      const { returnAmount, protocolFee, subjectFee, platformReferrerFee } =
        await getExpectedSellReturnAndFee(
          subjectToken,
          vaultInstance,
          subjectTokenAddress,
          moxieTokenAddress,
          formula,
          reserveRatio,
          feeInput,
          PCT_BASE,
          totalSellAmountSeller1,
          referralFeeInput,
        );

      const expectedReturn = returnAmount - protocolFee - subjectFee;

      await subjectToken
        .connect(seller)
        .approve(moxieBondingCurveAddress, totalSellAmountSeller1);

      const sellerPreviousMoxieBalance = await moxieToken.balanceOf(
        seller.address,
      );
      const feeBeneficiaryPreviousMoxieBalance =
        await protocolRewards.balanceOf(feeBeneficiary.address);
      const subjectBeneficiaryPreviousMoxieBalance =
        await protocolRewards.balanceOf(subject.address);

      const platformReferrerPreviousMoxieBalance =
        await protocolRewards.balanceOf(platformReferrer.address);
      await expect(
        moxieBondingCurve
          .connect(seller)
          .sellSharesForV2(
            subject.address,
            totalSellAmountSeller1,
            seller.address,
            0,
            ethers.ZeroAddress,
          ),
      )
        .to.emit(moxieBondingCurve, "SubjectShareSold")
        .withArgs(
          subject.address,
          subjectTokenAddress,
          totalSellAmountSeller1,
          seller.address,
          moxieTokenAddress,
          expectedReturn,
          seller.address,
        );

      //verify fund transfers
      expect(await moxieToken.balanceOf(seller.address)).to.equal(
        BigInt(sellerPreviousMoxieBalance) + expectedReturn,
      );

      expect(await protocolRewards.balanceOf(subject.address)).to.equal(
        BigInt(subjectBeneficiaryPreviousMoxieBalance) + subjectFee,
      );

      expect(await protocolRewards.balanceOf(platformReferrer)).to.equal(
        BigInt(platformReferrerPreviousMoxieBalance) +
          BigInt(platformReferrerFee),
      );

      expect(await protocolRewards.balanceOf(feeBeneficiary.address)).to.equal(
        BigInt(feeBeneficiaryPreviousMoxieBalance) +
          protocolFee -
          BigInt(platformReferrerFee) -
          BigInt(0),
      );

      expect(await protocolRewards.balanceOf(orderReferrer.address)).to.equal(
        0,
      );
    });
  });

  describe("updateReferralFee", () => {
    it("should update referral fee percentages", async () => {
      const deployment = await loadFixture(deploy);
      const { moxieBondingCurve, owner } = deployment;

      await moxieBondingCurve
        .connect(owner)
        .grantRole(await moxieBondingCurve.UPDATE_FEES_ROLE(), owner);

      const newReferralFeeInput = {
        platformReferrerBuyFeePct: 10,
        platformReferrerSellFeePct: 15,
        orderReferrerBuyFeePct: 5,
        orderReferrerSellFeePct: 10,
      };

      await expect(
        moxieBondingCurve
          .connect(owner)
          .updateReferralFee(
            newReferralFeeInput.platformReferrerBuyFeePct,
            newReferralFeeInput.platformReferrerSellFeePct,
            newReferralFeeInput.orderReferrerBuyFeePct,
            newReferralFeeInput.orderReferrerSellFeePct,
          ),
      )
        .to.emit(moxieBondingCurve, "UpdateReferralFees")
        .withArgs(
          newReferralFeeInput.platformReferrerBuyFeePct,
          newReferralFeeInput.platformReferrerSellFeePct,
          newReferralFeeInput.orderReferrerBuyFeePct,
          newReferralFeeInput.orderReferrerSellFeePct,
        );

      // Verify updated referral fee percentages
      expect(await moxieBondingCurve.platformReferrerBuyFeePct()).to.equal(
        newReferralFeeInput.platformReferrerBuyFeePct,
      );
      expect(await moxieBondingCurve.platformReferrerSellFeePct()).to.equal(
        newReferralFeeInput.platformReferrerSellFeePct,
      );
      expect(await moxieBondingCurve.orderReferrerBuyFeePct()).to.equal(
        newReferralFeeInput.orderReferrerBuyFeePct,
      );
      expect(await moxieBondingCurve.orderReferrerSellFeePct()).to.equal(
        newReferralFeeInput.orderReferrerSellFeePct,
      );
    });

    it("should revert if not authorized to update referral fee", async () => {
      const deployment = await loadFixture(deploy);
      const { moxieBondingCurve, deployer } = deployment;

      const newReferralFeeInput = {
        platformReferrerBuyFeePct: 10,
        platformReferrerSellFeePct: 15,
        orderReferrerBuyFeePct: 5,
        orderReferrerSellFeePct: 10,
      };

      await expect(
        moxieBondingCurve
          .connect(deployer)
          .updateReferralFee(
            newReferralFeeInput.platformReferrerBuyFeePct,
            newReferralFeeInput.platformReferrerSellFeePct,
            newReferralFeeInput.orderReferrerBuyFeePct,
            newReferralFeeInput.orderReferrerSellFeePct,
          ),
      )
        .to.revertedWithCustomError(
          moxieBondingCurve,
          "AccessControlUnauthorizedAccount",
        )
        .withArgs(deployer.address, await moxieBondingCurve.UPDATE_FEES_ROLE());
    });

    it("should revert if invalid fee percentage is provided for buy side", async () => {
      const deployment = await loadFixture(deploy);
      const { moxieBondingCurve, PCT_BASE, owner } = deployment;

      const invalidReferralFeeInput = {
        platformReferrerBuyFeePct: PCT_BASE, // Invalid percentage
        platformReferrerSellFeePct: 15,
        orderReferrerBuyFeePct: PCT_BASE,
        orderReferrerSellFeePct: 10,
      };

      await moxieBondingCurve
        .connect(owner)
        .grantRole(await moxieBondingCurve.UPDATE_FEES_ROLE(), owner);

      await expect(
        moxieBondingCurve
          .connect(owner)
          .updateReferralFee(
            invalidReferralFeeInput.platformReferrerBuyFeePct,
            invalidReferralFeeInput.platformReferrerSellFeePct,
            invalidReferralFeeInput.orderReferrerBuyFeePct,
            invalidReferralFeeInput.orderReferrerSellFeePct,
          ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidFeePercentage",
      );
    });

    it("should revert if invalid fee percentage is provided for sell side", async () => {
      const deployment = await loadFixture(deploy);
      const { moxieBondingCurve, PCT_BASE, owner } = deployment;

      const invalidReferralFeeInput = {
        platformReferrerBuyFeePct: 10,
        platformReferrerSellFeePct: PCT_BASE,
        orderReferrerBuyFeePct: 11,
        orderReferrerSellFeePct: 10,
      };

      await moxieBondingCurve
        .connect(owner)
        .grantRole(await moxieBondingCurve.UPDATE_FEES_ROLE(), owner);

      await expect(
        moxieBondingCurve
          .connect(owner)
          .updateReferralFee(
            invalidReferralFeeInput.platformReferrerBuyFeePct,
            invalidReferralFeeInput.platformReferrerSellFeePct,
            invalidReferralFeeInput.orderReferrerBuyFeePct,
            invalidReferralFeeInput.orderReferrerSellFeePct,
          ),
      ).to.revertedWithCustomError(
        moxieBondingCurve,
        "MoxieBondingCurve_InvalidFeePercentage",
      );
    });
  });
});
