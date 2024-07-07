import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { MoxieBondingCurve, SubjectERC20 as SubjectERC20Type } from "../typechain-types";
import MoxieTokenLockWalletArtifact from "../test-artifact/MoxieTokenLockWallet.sol/artifacts/MoxieTokenLockWallet.json";
import MoxieTokenLockManagerArtifact from "../test-artifact/MoxieTokenLockManager.sol/artifacts/MoxieTokenLockManager.json";
import { MoxieTokenLockWallet } from "../test-artifact/MoxieTokenLockWallet.sol/typechain/MoxieTokenLockWallet";
import {
    getExpectedBuyReturnAndFee,
    getExpectedSellReturnAndFee,
    deployVestingContract,
    assertVestingContractData
} from "./Utils";
import { parseEther } from "ethers";

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
            vestingBeneficiary1,
            vestingBeneficiary2
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

        const MoxieBondingCurve =
            await hre.ethers.getContractFactory("MoxieBondingCurve");

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

        // moxie Bonding curve
        const moxieBondingCurve = await MoxieBondingCurve.deploy();

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

        await moxiePass.connect(minter).mint(owner.address, "uri");
        await moxiePass.connect(minter).mint(subject.address, "uri");
        await moxiePass.connect(minter).mint(deployer.address, "uri");
        await moxiePass.connect(minter).mint(subjectFactory.address, "uri");
        await moxiePass.connect(minter).mint(await moxieBondingCurve.getAddress(), "uri");
        await moxiePass.connect(minter).mint(await tokenManager.getAddress(), "uri");

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


        // token lock wallet and token lock manager
        const MoxieTokenLockWallet = await hre.ethers.getContractFactoryFromArtifact(MoxieTokenLockWalletArtifact);;
        const moxieTokenLockWallet: MoxieTokenLockWallet = (await MoxieTokenLockWallet.connect(owner).deploy()) as unknown as MoxieTokenLockWallet;
        const moxieTokenLockWalletAddress = await moxieTokenLockWallet.getAddress();

        const MoxieTokenLockManager = await hre.ethers.getContractFactoryFromArtifact(MoxieTokenLockManagerArtifact);
        const moxieTokenLockManager: MoxieTokenLockManager = (await MoxieTokenLockManager.connect(owner).deploy(moxieTokenAddress, moxieTokenLockWalletAddress)) as unknown as MoxieTokenLockManager;

        // set MoxiePass token and uri
        const moxiePassTokenAddress = await moxiePass.getAddress();
        await moxieTokenLockManager.connect(owner).setMoxiePassTokenAndUri(moxiePassTokenAddress, "uri");

        const moxieTokenLockManagerAddress = await moxieTokenLockManager.getAddress();

        await moxiePass
            .connect(owner)
            .grantRole(await moxiePass.MINTER_ROLE(), moxieTokenLockManagerAddress);

        // set token manager address in moxie token lock manager to fetch subject token address for given subject address
        await moxieTokenLockManager.connect(owner).setTokenManager(tokenManagerAddress);
        await moxieTokenLockManager.connect(owner).addSubjectTokenDestination(moxieBondingCurveAddress);

        // set authorized protocol contracts that will be used by vesting contract for invest while vest
        await moxieTokenLockManager.connect(owner).addTokenDestination(moxieBondingCurveAddress);

        // whitelist moxie bonding curve authorized functions
        await moxieTokenLockManager.connect(owner).setAuthFunctionCallMany(
            [
                'buyShares(address,uint256,uint256)',
                'sellShares(address,uint256,uint256)'
            ],
            [moxieBondingCurveAddress, moxieBondingCurveAddress]);


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
            moxieTokenLockWallet,
            moxieTokenLockWalletAddress,
            moxieTokenLockManager,
            moxieTokenLockManagerAddress,
            vestingBeneficiary1,
            vestingBeneficiary2
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
            } = deployment;

            await setupBuy(deployment);

            const buyAmount = (1 * 1e19).toString();

            const supply = await subjectToken.totalSupply();
            const reserveBeforeBuy = await vaultInstance.balanceOf(
                subjectTokenAddress,
                moxieTokenAddress,
            );

            const { expectedShares, protocolFee, subjectFee } =
                await getExpectedSellReturnAndFee(
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
                    subjectTokenAddress,
                    expectedShares,
                    buyer.address,
                );

            expect(await subjectToken.balanceOf(buyer.address)).equal(expectedShares);
            expect(await moxieToken.balanceOf(feeBeneficiary.address)).equal(
                protocolFee,
            );
            expect(await moxieToken.balanceOf(subject.address)).equal(subjectFee);
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
            } = await getExpectedSellReturnAndFee(
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
                    subjectTokenAddress,
                    expectedShares2,
                    buyer2.address,
                );

            expect(await subjectToken.balanceOf(buyer2.address)).equal(
                expectedShares2,
            );
            expect(await moxieToken.balanceOf(feeBeneficiary.address)).equal(
                protocolFee + protocolFee2,
            );
            expect(await moxieToken.balanceOf(subject.address)).equal(
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
            } = deployment;

            await setupBuy(deployment);

            const buyAmount = (1 * 1e19).toString();

            const supply = await subjectToken.totalSupply();
            const reserveBeforeBuy = await vaultInstance.balanceOf(
                subjectTokenAddress,
                moxieTokenAddress,
            );

            const { expectedShares, protocolFee, subjectFee } =
                await getExpectedSellReturnAndFee(
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
                    subjectTokenAddress,
                    expectedShares,
                    ethers.ZeroAddress,
                );

            expect(await moxieToken.balanceOf(feeBeneficiary.address)).equal(
                protocolFee,
            );
            expect(await moxieToken.balanceOf(subject.address)).equal(subjectFee);
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
                    .buySharesFor(subject.address, buyAmount, buyer.address, expectedShares),
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
                    .buySharesFor(subject.address, buyAmount, buyer.address, expectedShares),
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
            } = deployment;

            await setupBuy(deployment);

            const buyAmount = (1 * 1e19).toString();

            const supply = await subjectToken.totalSupply();
            const reserveBeforeBuy = await vaultInstance.balanceOf(
                subjectTokenAddress,
                moxieTokenAddress,
            );

            const { expectedShares, protocolFee, subjectFee } =
                await getExpectedSellReturnAndFee(
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
                    subjectTokenAddress,
                    expectedShares,
                    buyer.address,
                );

            expect(await subjectToken.balanceOf(buyer.address)).equal(expectedShares);
            expect(await moxieToken.balanceOf(feeBeneficiary.address)).equal(
                protocolFee,
            );
            expect(await moxieToken.balanceOf(subject.address)).equal(subjectFee);
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
            } = await getExpectedSellReturnAndFee(
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
                    subjectTokenAddress,
                    expectedShares2,
                    buyer2.address,
                );

            expect(await subjectToken.balanceOf(buyer2.address)).equal(
                expectedShares2,
            );
            expect(await moxieToken.balanceOf(feeBeneficiary.address)).equal(
                protocolFee + protocolFee2,
            );
            expect(await moxieToken.balanceOf(subject.address)).equal(
                subjectFee + subjectFee2,
            );
            expect(
                await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress),
            ).equal(BigInt(reserveBeforeBuy2) + effectiveBuyAmount2);

            //also make sure second buyer should get less shares than first buyer for same given buy amount
            expect(expectedShares2).to.be.lessThan(expectedShares);
        });

        it("should be able to buy subject token from vesting contract", async () => {
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
                moxieTokenLockWallet,
                moxieTokenLockManager,
                moxieTokenLockManagerAddress,
                vestingBeneficiary1,
                vestingBeneficiary2,
                owner
            } = deployment;

            await setupBuy(deployment);

            const buyAmount = (1 * 1e19).toString();

            const supply = await subjectToken.totalSupply();
            const reserveBeforeBuy = await vaultInstance.balanceOf(
                subjectTokenAddress,
                moxieTokenAddress,
            );

            const { expectedShares, protocolFee, subjectFee } =
                await getExpectedSellReturnAndFee(
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

            // fund the token lock manager 
            await moxieToken.connect(owner).transfer(moxieTokenLockManagerAddress, parseEther('100000'));

            // first buyer
            // vesting contract input parameters for non revocable contract starting in future time
            const startTime = Math.floor(Date.now() / 1000) + 86400; // future time day + 1 in epoch seconds
            const endTime = startTime + 172800; // + 2 days
            const periodsInterval = 60;// in seconds = 1 mins
            const periods = (endTime - startTime) / periodsInterval; // number of periods
            const releaseStartTime = 0; // release start time in epoch seconds. Default: 0
            const vestingCliffTime = 0; // vesting cliff time in epoch seconds. Default: 0
            const revocable = 2; // vesting contract revocable flag: 1 for revocable, 2 for non-revocable
            const managedAmount = parseEther('10000') // 10000 MOXIE  // amount managed by vesting contract

            // Deploy a vesting contract
            const vestingContractAddress1 = await deployVestingContract(moxieTokenLockManager,
                owner,
                vestingBeneficiary1.address,
                managedAmount,
                startTime,
                endTime,
                periods,
                releaseStartTime,
                vestingCliffTime,
                revocable);

            // verify if data looks okay for newly created vesting contract
            const vestingContract1 = moxieTokenLockWallet.attach(vestingContractAddress1) as MoxieTokenLockWallet

            await assertVestingContractData(vestingContract1,
                owner.address,
                vestingBeneficiary1.address,
                managedAmount,
                startTime,
                endTime,
                periods,
                releaseStartTime,
                vestingCliffTime,
                revocable
            );

            // console.log(`Deployed vesting contract1: ${vestingContractAddress1}`)

            // approve so that protocol contracts can spend the MOXIE tokens
            await vestingContract1.connect(vestingBeneficiary1).approveProtocol()

            // execute buy shares through vesting contract
            const moxieBondingCurveVC1 = moxieBondingCurve.attach(vestingContractAddress1) as MoxieBondingCurve;

            await expect(
                moxieBondingCurveVC1
                    .connect(vestingBeneficiary1)
                    .buyShares(subject.address, buyAmount, 0),
            )
                .to.emit(moxieBondingCurve, "SubjectSharePurchased")
                .withArgs(
                    subject.address,
                    moxieTokenAddress,
                    buyAmount,
                    subjectTokenAddress,
                    expectedShares,
                    vestingContract1,
                );

            expect(await subjectToken.balanceOf(vestingContract1)).equal(expectedShares);
            expect(await moxieToken.balanceOf(feeBeneficiary.address)).equal(
                protocolFee,
            );
            expect(await moxieToken.balanceOf(subject.address)).equal(subjectFee);
            expect(
                await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress),
            ).equal(BigInt(reserveBeforeBuy) + effectiveBuyAmount);
            expect(await subjectToken.totalSupply()).equal(supply + expectedShares);

            // second buyer
            // vesting contract input parameters for revocable contract started 1 day ago
            const startTime2 =  Math.floor(Date.now() / 1000) - 86400; //  today - 1 in epoch seconds
            const endTime2 = startTime2 + 172800; // +2 days
            const periodsInterval2 = 60;// in seconds = 1 mins
            const periods2 = (endTime2 - startTime2) / periodsInterval2; // number of periods
            const releaseStartTime2 = 0; // release start time in epoch seconds. Default: 0
            const vestingCliffTime2 = 0; // vesting cliff time in epoch seconds. Default: 0
            const revocable2 = 1; // vesting contract revocable flag: 1 for revocable, 2 for non-revocable
            const managedAmount2 = parseEther('5000') // 5000 MOXIE  // amount managed by vesting contract

            // Deploy a vesting contract
            const vestingContractAddress2 = await deployVestingContract(moxieTokenLockManager,
                owner,
                vestingBeneficiary2.address,
                managedAmount2,
                startTime2,
                endTime2,
                periods2,
                releaseStartTime2,
                vestingCliffTime2,
                revocable2);

            // verify if data looks okay for newly created vesting contract
            const vestingContract2 = moxieTokenLockWallet.attach(vestingContractAddress2) as MoxieTokenLockWallet

            await assertVestingContractData(vestingContract2,
                owner.address,
                vestingBeneficiary2.address,
                managedAmount2,
                startTime2,
                endTime2,
                periods2,
                releaseStartTime2,
                vestingCliffTime2,
                revocable2
            );

            // console.log(`Deployed vesting contract1: ${vestingContractAddress1}`)

            // approve so that protocol contracts can spend the MOXIE tokens
            await vestingContract2.connect(vestingBeneficiary2).approveProtocol()

            // execute buy shares through vesting contract
            const moxieBondingCurveVC2 = moxieBondingCurve.attach(vestingContractAddress2) as MoxieBondingCurve;

            const reserveBeforeBuy2 = await vaultInstance.balanceOf(
                subjectTokenAddress,
                moxieTokenAddress,
            );

            const {
                expectedShares: expectedShares2,
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
                BigInt(buyAmount),
            );
            const effectiveBuyAmount2 = BigInt(buyAmount) - protocolFee - subjectFee;

            await expect(
                moxieBondingCurveVC2
                    .connect(vestingBeneficiary2)
                    .buyShares(subject.address, buyAmount, 0),
            )
                .to.emit(moxieBondingCurve, "SubjectSharePurchased")
                .withArgs(
                    subject.address,
                    moxieTokenAddress,
                    buyAmount,
                    subjectTokenAddress,
                    expectedShares2,
                    vestingContract2,
                );

            expect(await subjectToken.balanceOf(vestingContract2)).equal(
                expectedShares2,
            );
            expect(await moxieToken.balanceOf(feeBeneficiary.address)).equal(
                protocolFee + protocolFee2,
            );
            expect(await moxieToken.balanceOf(subject.address)).equal(
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
                moxieBondingCurve
                    .connect(buyer)
                    .buyShares(subject.address, 0, 0),
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
                    .buyShares(owner.address, buyAmount, 0),
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
                    .buyShares(
                        subject.address,
                        buyAmount,
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

        const setupSellFromVestingContract = async (deployment: any) => {
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
                owner,
                moxieTokenLockManager,
                moxieTokenLockManagerAddress,
                vestingBeneficiary1,
                moxieTokenLockWallet,
                vestingBeneficiary2
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
                    ),
            ).to.emit(moxieBondingCurve, "BondingCurveInitialized");


            // fund the token lock manager 
            await moxieToken.connect(owner).transfer(moxieTokenLockManagerAddress, parseEther('100000'));

            // first buyer
            // vesting contract input parameters for non revocable contract starting in future time
            const startTime =  Math.floor(Date.now() / 1000) + 86400; // future time day + 1 in epoch seconds
            const endTime = startTime + 172800; // + 2 days
            const periodsInterval = 60;// in seconds = 1 mins
            const periods = (endTime - startTime) / periodsInterval; // number of periods
            const releaseStartTime = 0; // release start time in epoch seconds. Default: 0
            const vestingCliffTime = 0; // vesting cliff time in epoch seconds. Default: 0
            const revocable = 2; // vesting contract revocable flag: 1 for revocable, 2 for non-revocable
            const managedAmount = parseEther('10000') // 10000 MOXIE  // amount managed by vesting contract

            // Deploy a vesting contract
            const vestingContractAddress1 = await deployVestingContract(moxieTokenLockManager,
                owner,
                vestingBeneficiary1.address,
                managedAmount,
                startTime,
                endTime,
                periods,
                releaseStartTime,
                vestingCliffTime,
                revocable);

            // verify if data looks okay for newly created vesting contract
            const vestingContract1 = moxieTokenLockWallet.attach(vestingContractAddress1) as MoxieTokenLockWallet

            // approve so that protocol contracts can spend the MOXIE tokens
            await vestingContract1.connect(vestingBeneficiary1).approveProtocol()

            // approval for the protocol [moxie bonding curve] contract to spend the subject tokens from vesting contract during sell.
            await vestingContract1.connect(vestingBeneficiary1).approveSubjectToken(subject.address)

            // execute buy shares through vesting contract
            const moxieBondingCurveVC1 = moxieBondingCurve.attach(vestingContractAddress1) as MoxieBondingCurve;

            const buyAmount = (1 * 1e19).toString();

            await expect(
                moxieBondingCurveVC1
                    .connect(vestingBeneficiary1)
                    .buyShares(subject.address, buyAmount, 0),
            ).to.emit(moxieBondingCurve, "SubjectSharePurchased");

            // second buyer
            // vesting contract input parameters for revocable contract started 1 day ago
            const startTime2 =  Math.floor(Date.now() / 1000) - 86400; //  today - 1 in epoch seconds
            const endTime2 = startTime2 + 172800; // +2 days
            const periodsInterval2 = 60;// in seconds = 1 mins
            const periods2 = (endTime2 - startTime2) / periodsInterval2; // number of periods
            const releaseStartTime2 = 0; // release start time in epoch seconds. Default: 0
            const vestingCliffTime2 = 0; // vesting cliff time in epoch seconds. Default: 0
            const revocable2 = 1; // vesting contract revocable flag: 1 for revocable, 2 for non-revocable
            const managedAmount2 = parseEther('5000') // 5000 MOXIE  // amount managed by vesting contract

            // Deploy a vesting contract
            const vestingContractAddress2 = await deployVestingContract(moxieTokenLockManager,
                owner,
                vestingBeneficiary2.address,
                managedAmount2,
                startTime2,
                endTime2,
                periods2,
                releaseStartTime2,
                vestingCliffTime2,
                revocable2);

            // verify if data looks okay for newly created vesting contract
            const vestingContract2 = moxieTokenLockWallet.attach(vestingContractAddress2) as MoxieTokenLockWallet

            // approve so that protocol contracts can spend the MOXIE tokens
            await vestingContract2.connect(vestingBeneficiary2).approveProtocol()

            // approval for the protocol [moxie bonding curve] contract to spend the subject tokens from vesting contract during sell.
            await vestingContract2.connect(vestingBeneficiary2).approveSubjectToken(subject.address)

            // execute buy shares through vesting contract
            const moxieBondingCurveVC2 = moxieBondingCurve.attach(vestingContractAddress2) as MoxieBondingCurve;

            await expect(
                moxieBondingCurveVC2
                    .connect(vestingBeneficiary2)
                    .buyShares(subject.address, buyAmount, 0),
            ).to.emit(moxieBondingCurve, "SubjectSharePurchased");


            return {
                vestingContractAddress1,
                moxieBondingCurveVC1,
                vestingContractAddress2,
                moxieBondingCurveVC2
            }

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
                await getExpectedBuyReturnAndFee(
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
            const feeBeneficiaryPreviousMoxieBalance = await moxieToken.balanceOf(
                feeBeneficiary.address,
            );
            const subjectBeneficiaryPreviousMoxieBalance = await moxieToken.balanceOf(
                subject.address,
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
            )
                .to.emit(moxieBondingCurve, "SubjectShareSold")
                .withArgs(
                    subject.address,
                    subjectTokenAddress,
                    totalSellAmountSeller1,
                    moxieTokenAddress,
                    expectedReturn,
                    seller.address,
                );

            //verify fund transfers
            expect(await moxieToken.balanceOf(seller.address)).to.equal(
                BigInt(sellerPreviousMoxieBalance) + expectedReturn,
            );
            expect(await moxieToken.balanceOf(feeBeneficiary.address)).to.equal(
                BigInt(feeBeneficiaryPreviousMoxieBalance) + protocolFee,
            );
            expect(await moxieToken.balanceOf(subject.address)).to.equal(
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
            } = await getExpectedBuyReturnAndFee(
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
            const feeBeneficiaryPreviousMoxieBalance2 = await moxieToken.balanceOf(
                feeBeneficiary.address,
            );
            const subjectBeneficiaryPreviousMoxieBalance2 =
                await moxieToken.balanceOf(subject.address);

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
                    moxieTokenAddress,
                    expectedReturn2,
                    seller2.address,
                );

            //verify fund transfers
            expect(await moxieToken.balanceOf(seller2.address)).to.equal(
                BigInt(previousMoxieBalanceSeller2) + expectedReturn2,
            );
            expect(await moxieToken.balanceOf(feeBeneficiary.address)).to.equal(
                BigInt(feeBeneficiaryPreviousMoxieBalance2) + protocolFee2,
            );
            expect(await moxieToken.balanceOf(subject.address)).to.equal(
                BigInt(subjectBeneficiaryPreviousMoxieBalance2) + subjectFee2,
            );
        });

        it("should be able to sell subject tokens from vesting contract", async () => {
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
                vestingBeneficiary1,
                vestingBeneficiary2,
            } = deployment;

            const {vestingContractAddress1, moxieBondingCurveVC1,vestingContractAddress2, moxieBondingCurveVC2} = await setupSellFromVestingContract(deployment);

            const totalSellAmountVestingContract1 = await subjectToken.balanceOf(
                vestingContractAddress1,
            );
            const totalSellAmountVestingContract2 = await subjectToken.balanceOf(
                vestingContractAddress2,
            );

            // seller 1
            const { returnAmount, protocolFee, subjectFee } =
                await getExpectedBuyReturnAndFee(
                    subjectToken,
                    vaultInstance,
                    subjectTokenAddress,
                    moxieTokenAddress,
                    formula,
                    reserveRatio,
                    feeInput,
                    PCT_BASE,
                    totalSellAmountVestingContract1,
                );

            const expectedReturn = returnAmount - protocolFee - subjectFee;

            const sellerPreviousMoxieBalance = await moxieToken.balanceOf(
                vestingContractAddress1,
            );
            const feeBeneficiaryPreviousMoxieBalance = await moxieToken.balanceOf(
                feeBeneficiary.address,
            );
            const subjectBeneficiaryPreviousMoxieBalance = await moxieToken.balanceOf(
                subject.address,
            );
            await expect(
                moxieBondingCurveVC1
                    .connect(vestingBeneficiary1)
                    .sellShares(
                        subject.address,
                        totalSellAmountVestingContract1,
                        0,
                    ),
            )
                .to.emit(moxieBondingCurve, "SubjectShareSold")
                .withArgs(
                    subject.address,
                    subjectTokenAddress,
                    totalSellAmountVestingContract1,
                    moxieTokenAddress,
                    expectedReturn,
                    vestingContractAddress1,
                );

            //verify fund transfers
            expect(await moxieToken.balanceOf(vestingContractAddress1)).to.equal(
                BigInt(sellerPreviousMoxieBalance) + expectedReturn,
            );
            expect(await moxieToken.balanceOf(feeBeneficiary.address)).to.equal(
                BigInt(feeBeneficiaryPreviousMoxieBalance) + protocolFee,
            );
            expect(await moxieToken.balanceOf(subject.address)).to.equal(
                BigInt(subjectBeneficiaryPreviousMoxieBalance) + subjectFee,
            );

            // seller 2

            const {
                returnAmount: returnAmount2,
                protocolFee: protocolFee2,
                subjectFee: subjectFee2,
            } = await getExpectedBuyReturnAndFee(
                subjectToken,
                vaultInstance,
                subjectTokenAddress,
                moxieTokenAddress,
                formula,
                reserveRatio,
                feeInput,
                PCT_BASE,
                totalSellAmountVestingContract2,
            );

            const expectedReturn2 = returnAmount2 - protocolFee2 - subjectFee2;

            const previousMoxieBalanceVestingContract2 = await moxieToken.balanceOf(
                vestingContractAddress2,
            );
            const feeBeneficiaryPreviousMoxieBalance2 = await moxieToken.balanceOf(
                feeBeneficiary.address,
            );
            const subjectBeneficiaryPreviousMoxieBalance2 =
                await moxieToken.balanceOf(subject.address);

            await expect(
                moxieBondingCurveVC2
                    .connect(vestingBeneficiary2)
                    .sellShares(
                        subject.address,
                        totalSellAmountVestingContract2,
                        0,
                    ),
            )
                .to.emit(moxieBondingCurve, "SubjectShareSold")
                .withArgs(
                    subject.address,
                    subjectTokenAddress,
                    totalSellAmountVestingContract2,
                    moxieTokenAddress,
                    expectedReturn2,
                    vestingContractAddress2,
                );

            //verify fund transfers
            expect(await moxieToken.balanceOf(vestingContractAddress2)).to.equal(
                BigInt(previousMoxieBalanceVestingContract2) + expectedReturn2,
            );
            expect(await moxieToken.balanceOf(feeBeneficiary.address)).to.equal(
                BigInt(feeBeneficiaryPreviousMoxieBalance2) + protocolFee2,
            );
            expect(await moxieToken.balanceOf(subject.address)).to.equal(
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
                await getExpectedBuyReturnAndFee(
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
            } = await getExpectedBuyReturnAndFee(
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
                    .sellSharesFor(owner.address, totalSellAmountSeller1, seller.address, 0),
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
                await getExpectedBuyReturnAndFee(
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
            const feeBeneficiaryPreviousMoxieBalance = await moxieToken.balanceOf(
                feeBeneficiary.address,
            );
            const subjectBeneficiaryPreviousMoxieBalance = await moxieToken.balanceOf(
                subject.address,
            );
            await expect(
                moxieBondingCurve
                    .connect(seller)
                    .sellShares(
                        subject.address,
                        totalSellAmountSeller1,
                        0,
                    ),
            )
                .to.emit(moxieBondingCurve, "SubjectShareSold")
                .withArgs(
                    subject.address,
                    subjectTokenAddress,
                    totalSellAmountSeller1,
                    moxieTokenAddress,
                    expectedReturn,
                    seller.address,
                );

            //verify fund transfers
            expect(await moxieToken.balanceOf(seller.address)).to.equal(
                BigInt(sellerPreviousMoxieBalance) + expectedReturn,
            );
            expect(await moxieToken.balanceOf(feeBeneficiary.address)).to.equal(
                BigInt(feeBeneficiaryPreviousMoxieBalance) + protocolFee,
            );
            expect(await moxieToken.balanceOf(subject.address)).to.equal(
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
            } = await getExpectedBuyReturnAndFee(
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
            const feeBeneficiaryPreviousMoxieBalance2 = await moxieToken.balanceOf(
                feeBeneficiary.address,
            );
            const subjectBeneficiaryPreviousMoxieBalance2 =
                await moxieToken.balanceOf(subject.address);

            await expect(
                moxieBondingCurve
                    .connect(seller2)
                    .sellShares(
                        subject.address,
                        totalSellAmountSeller2,
                        0,
                    ),
            )
                .to.emit(moxieBondingCurve, "SubjectShareSold")
                .withArgs(
                    subject.address,
                    subjectTokenAddress,
                    totalSellAmountSeller2,
                    moxieTokenAddress,
                    expectedReturn2,
                    seller2.address,
                );

            //verify fund transfers
            expect(await moxieToken.balanceOf(seller2.address)).to.equal(
                BigInt(previousMoxieBalanceSeller2) + expectedReturn2,
            );
            expect(await moxieToken.balanceOf(feeBeneficiary.address)).to.equal(
                BigInt(feeBeneficiaryPreviousMoxieBalance2) + protocolFee2,
            );
            expect(await moxieToken.balanceOf(subject.address)).to.equal(
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
                await getExpectedBuyReturnAndFee(
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
                    .sellShares(
                        subject.address,
                        totalSellAmountSeller1,
                        0,
                    ),
            )
                .to.emit(moxieBondingCurve, "SubjectShareSold")
                .withArgs(
                    subject.address,
                    subjectTokenAddress,
                    totalSellAmountSeller1,
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
            } = await getExpectedBuyReturnAndFee(
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
                    .sellShares(
                        subject.address,
                        totalSellAmountSeller2,
                        0,
                    ),
            )
                .to.emit(moxieBondingCurve, "SubjectShareSold")
                .withArgs(
                    subject.address,
                    subjectTokenAddress,
                    totalSellAmountSeller2,
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
                    .sellShares(
                        subject.address,
                        initialSupply,
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
                    .sellShares(
                        ethers.ZeroAddress,
                        totalSellAmountSeller1,
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
                    .sellShares(subject.address, 0, 0),
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
                    .sellShares(
                        subject.address,
                        totalSellAmountSeller1,
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
                    .sellShares(
                        subject.address,
                        totalSellAmountSeller1,
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
                    .sellShares(
                        subject.address,
                        totalSellAmountSeller1,
                        0,
                    ),
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
});
