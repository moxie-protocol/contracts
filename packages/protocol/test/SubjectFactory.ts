import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import EasyAuctionArtifact from "../test-artifact/easy-auction/artifacts/EasyAuction.json";
import { EasyAuction } from "../test-artifact/easy-auction/typechain/EasyAuction";
import { SubjectERC20 } from "../typechain-types";


describe('Subject Factory', () => {


    const deploy = async () => {

        const [deployer, owner, minter, feeBeneficiary, subject, bidder1, bidder2] = await ethers.getSigners();


        const SubjectFactory = await hre.ethers.getContractFactory("SubjectFactory");
        const MoxieToken = await hre.ethers.getContractFactory("MoxieToken");
        const BancorFormula = await hre.ethers.getContractFactory("BancorFormula");
        const Vault = await hre.ethers.getContractFactory("Vault");
        const SubjectERC20 = await hre.ethers.getContractFactory("SubjectERC20");

        const MoxiePass = await hre.ethers.getContractFactory("MoxiePass");
        const MoxiePassVerifier = await hre.ethers.getContractFactory(
            "MoxiePassVerifier",
        );
        const TokenManager = await hre.ethers.getContractFactory("TokenManager");

        const MoxieBondingCurve =
            await hre.ethers.getContractFactory("MoxieBondingCurve");

        const EasyAuction = await hre.ethers.getContractFactoryFromArtifact(EasyAuctionArtifact);;

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

        // moxie Bonding curve
        const moxieBondingCurve = await MoxieBondingCurve.deploy();

        // easy auction 

        const easyAuction: EasyAuction = (await EasyAuction.connect(owner).deploy()) as unknown as EasyAuction;

        // subject factory 
        const subjectFactory = await SubjectFactory.deploy({ from: deployer.address });

        // token manager
        const tokenManager = await TokenManager.deploy({ from: deployer.address });
        await tokenManager
            .connect(deployer)
            .initialize(owner.address, subjectErc20Address);


        const moxieTokenAddress = await moxieToken.getAddress();
        const formulaAddress = await formula.getAddress();
        const tokenManagerAddress = await tokenManager.getAddress();
        const vaultAddress = await vaultInstance.getAddress();
        const protocolBuyFeePct = (1e16).toString(); // 1%
        const protocolSellFeePct = (2 * 1e16).toString(); // 2%
        const subjectBuyFeePct = (3 * 1e16).toString(); // 3%
        const subjectSellFeePct = (4 * 1e16).toString(); // 4%
        const subjectFactoryAddress = await subjectFactory.getAddress();
        const moxieBondingCurveAddress = await moxieBondingCurve.getAddress();
        const easyAuctionAddress = await easyAuction.getAddress();
        const auctionDuration = 10;
        const auctionCancellationDuration = 5;
        const moxiePassVerifierAddress = await moxiePassVerifier.getAddress();
        const reserveRatio = 660000;

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
            subjectFactoryAddress
        );

        const feeInputSubjectFactory = {
            protocolFeePct: protocolBuyFeePct,
            subjectFeePct: subjectBuyFeePct
        }

        await subjectFactory.initialize(
            owner.address,
            tokenManagerAddress,
            moxieBondingCurveAddress,
            moxieTokenAddress,
            easyAuctionAddress,
            feeInputSubjectFactory,
            feeBeneficiary.address,
            auctionDuration,
            auctionCancellationDuration
        );

        await vaultInstance
            .connect(owner)
            .grantRole(await vaultInstance.DEPOSIT_ROLE(), subjectFactoryAddress);

        await vaultInstance
            .connect(owner)
            .grantRole(await vaultInstance.DEPOSIT_ROLE(), moxieBondingCurveAddress);

        await tokenManager.connect(owner).grantRole(await tokenManager.CREATE_ROLE(), subjectFactoryAddress);
        await tokenManager
            .connect(owner)
            .grantRole(await tokenManager.MINT_ROLE(), subjectFactoryAddress);

        await tokenManager
            .connect(owner)
            .grantRole(await tokenManager.MINT_ROLE(), moxieBondingCurveAddress);

        await easyAuction.connect(owner).setSubjectFactory(subjectFactoryAddress);

        await moxiePass.connect(minter).mint(owner.address, "uri");
        await moxiePass.connect(minter).mint(subject.address, "uri");
        await moxiePass.connect(minter).mint(deployer.address, "uri");
        await moxiePass.connect(minter).mint(await moxieBondingCurve.getAddress(), "uri");
        await moxiePass.connect(minter).mint(await tokenManager.getAddress(), "uri");
        await moxiePass.connect(minter).mint(subjectFactoryAddress, "uri");
        await moxiePass.connect(minter).mint(easyAuctionAddress, "uri");
        await moxiePass.connect(minter).mint(bidder1.address, "uri");
        await moxiePass.connect(minter).mint(bidder2.address, "uri");

        const PCT_BASE = BigInt(10 ** 18);
        return {
            subjectFactory,
            owner,
            subject,
            deployer,
            minter,
            easyAuction,
            easyAuctionAddress,
            moxieBondingCurveAddress,
            moxieTokenAddress,
            tokenManagerAddress,
            feeInput,
            feeBeneficiary,
            auctionDuration,
            auctionCancellationDuration,
            moxiePassVerifierAddress,
            tokenManager,
            SubjectERC20,
            moxieToken,
            feeInputSubjectFactory,
            bidder1,
            bidder2,
            reserveRatio,
            PCT_BASE,
            vaultInstance,
            formula
        };

    }

    describe('deployment', () => {

        it('verify deployment', async () => {

            const {
                subjectFactory,
                owner,
                easyAuctionAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                tokenManagerAddress,
                feeInputSubjectFactory,
                feeBeneficiary,
                auctionDuration,
                auctionCancellationDuration
            } = await loadFixture(deploy);


            expect(await subjectFactory.hasRole(await subjectFactory.DEFAULT_ADMIN_ROLE(), owner.address)).to.true;
            expect(await subjectFactory.easyAuction()).to.equal(easyAuctionAddress);
            expect(await subjectFactory.tokenManager()).to.equal(tokenManagerAddress);
            expect(await subjectFactory.moxieBondingCurve()).to.equal(moxieBondingCurveAddress);
            expect(await subjectFactory.token()).to.equal(moxieTokenAddress);
            expect(await subjectFactory.subjectFeePct()).equal(feeInputSubjectFactory.subjectFeePct);
            expect(await subjectFactory.protocolFeePct()).equal(feeInputSubjectFactory.protocolFeePct);
            expect(await subjectFactory.feeBeneficiary()).equal(feeBeneficiary.address);
            expect(await subjectFactory.auctionDuration()).equal(auctionDuration);
            expect(await subjectFactory.auctionOrderCancellationDuration()).equal(auctionCancellationDuration);

        });

        it('should fail to initialize if already initialized', async () => {

            const {
                subjectFactory,
                owner,
                easyAuctionAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                tokenManagerAddress,
                feeBeneficiary,
                auctionDuration,
                auctionCancellationDuration,
                feeInputSubjectFactory
            } = await loadFixture(deploy);

            await expect(subjectFactory.initialize(
                owner.address,
                tokenManagerAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                easyAuctionAddress,
                feeInputSubjectFactory,
                feeBeneficiary.address,
                auctionDuration,
                auctionCancellationDuration
            )).to.revertedWithCustomError(subjectFactory, "InvalidInitialization");
        });

        it('should fail to initialize for zero owner', async () => {
            const {
                easyAuctionAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                tokenManagerAddress,
                feeBeneficiary,
                auctionDuration,
                auctionCancellationDuration,
                feeInputSubjectFactory
            } = await loadFixture(deploy);

            const SubjectFactory = await hre.ethers.getContractFactory("SubjectFactory");
            const subjectFactory = await SubjectFactory.deploy();

            await expect(subjectFactory.initialize(
                ethers.ZeroAddress,
                tokenManagerAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                easyAuctionAddress,
                feeInputSubjectFactory,
                feeBeneficiary.address,
                auctionDuration,
                auctionCancellationDuration
            )).to.revertedWithCustomError(subjectFactory, "SubjectFactory_InvalidOwner");
        });

        it('should fail to initialize for zero token manager', async () => {
            const {
                owner,
                easyAuctionAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                feeBeneficiary,
                auctionDuration,
                auctionCancellationDuration,
                feeInputSubjectFactory
            } = await loadFixture(deploy);

            const SubjectFactory = await hre.ethers.getContractFactory("SubjectFactory");
            const subjectFactory = await SubjectFactory.deploy();

            await expect(subjectFactory.initialize(
                owner.address,
                ethers.ZeroAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                easyAuctionAddress,
                feeInputSubjectFactory,
                feeBeneficiary.address,
                auctionDuration,
                auctionCancellationDuration
            )).to.revertedWithCustomError(subjectFactory, "SubjectFactory_InvalidTokenManager");
        });

        it('should fail to initialize for zero token', async () => {
            const {
                owner,
                easyAuctionAddress,
                moxieBondingCurveAddress,
                tokenManagerAddress,
                feeBeneficiary,
                auctionDuration,
                auctionCancellationDuration,
                feeInputSubjectFactory
            } = await loadFixture(deploy);

            const SubjectFactory = await hre.ethers.getContractFactory("SubjectFactory");
            const subjectFactory = await SubjectFactory.deploy();

            await expect(subjectFactory.initialize(
                owner.address,
                tokenManagerAddress,
                moxieBondingCurveAddress,
                ethers.ZeroAddress,
                easyAuctionAddress,
                feeInputSubjectFactory,
                feeBeneficiary.address,
                auctionDuration,
                auctionCancellationDuration
            )).to.revertedWithCustomError(subjectFactory, "SubjectFactory_InvalidToken");
        });

        it('should fail to initialize for zero moxie bonding curve address', async () => {
            const {
                owner,
                easyAuctionAddress,
                moxieTokenAddress,
                tokenManagerAddress,
                feeBeneficiary,
                auctionDuration,
                auctionCancellationDuration,
                feeInputSubjectFactory
            } = await loadFixture(deploy);

            const SubjectFactory = await hre.ethers.getContractFactory("SubjectFactory");
            const subjectFactory = await SubjectFactory.deploy();

            await expect(subjectFactory.initialize(
                owner.address,
                tokenManagerAddress,
                ethers.ZeroAddress,
                moxieTokenAddress,
                easyAuctionAddress,
                feeInputSubjectFactory,
                feeBeneficiary.address,
                auctionDuration,
                auctionCancellationDuration
            )).to.revertedWithCustomError(subjectFactory, "SubjectFactory_InvalidMoxieBondingCurve");
        });

        it('should fail to initialize for zero _easyAuction', async () => {
            const {
                owner,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                tokenManagerAddress,
                feeBeneficiary,
                auctionDuration,
                auctionCancellationDuration,
                feeInputSubjectFactory
            } = await loadFixture(deploy);

            const SubjectFactory = await hre.ethers.getContractFactory("SubjectFactory");
            const subjectFactory = await SubjectFactory.deploy();

            await expect(subjectFactory.initialize(
                owner.address,
                tokenManagerAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                ethers.ZeroAddress,
                feeInputSubjectFactory,
                feeBeneficiary.address,
                auctionDuration,
                auctionCancellationDuration
            )).to.revertedWithCustomError(subjectFactory, "SubjectFactory_InvalidAuctionContract");
        });

        it('should fail to initialize for zero _feeBeneficiaryIsValid', async () => {
            const {
                owner,
                easyAuctionAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                tokenManagerAddress,
                auctionDuration,
                auctionCancellationDuration,
                feeInputSubjectFactory
            } = await loadFixture(deploy);

            const SubjectFactory = await hre.ethers.getContractFactory("SubjectFactory");
            const subjectFactory = await SubjectFactory.deploy();

            await expect(subjectFactory.initialize(
                owner.address,
                tokenManagerAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                easyAuctionAddress,
                feeInputSubjectFactory,
                ethers.ZeroAddress,
                auctionDuration,
                auctionCancellationDuration
            )).to.revertedWithCustomError(subjectFactory, "SubjectFactory_InvalidBeneficiary");
        });

        it('should fail to initialize for zero auction duration', async () => {
            const {
                owner,
                easyAuctionAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                tokenManagerAddress,
                feeBeneficiary,
                auctionCancellationDuration,
                feeInputSubjectFactory
            } = await loadFixture(deploy);

            const SubjectFactory = await hre.ethers.getContractFactory("SubjectFactory");
            const subjectFactory = await SubjectFactory.deploy();

            await expect(subjectFactory.initialize(
                owner.address,
                tokenManagerAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                easyAuctionAddress,
                feeInputSubjectFactory,
                feeBeneficiary.address,
                0,
                auctionCancellationDuration
            )).to.revertedWithCustomError(subjectFactory, "SubjectFactory_InvalidAuctionDuration");
        });

        it('should fail to initialize for zero auction cancellation duration', async () => {
            const {
                owner,
                easyAuctionAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                tokenManagerAddress,
                feeBeneficiary,
                auctionDuration,
                feeInputSubjectFactory,
            } = await loadFixture(deploy);

            const SubjectFactory = await hre.ethers.getContractFactory("SubjectFactory");
            const subjectFactory = await SubjectFactory.deploy();

            await expect(subjectFactory.initialize(
                owner.address,
                tokenManagerAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                easyAuctionAddress,
                feeInputSubjectFactory,
                feeBeneficiary.address,
                auctionDuration,
                0
            )).to.revertedWithCustomError(subjectFactory, "SubjectFactory_InvalidAuctionOrderCancellationDuration");
        });

        it("should fail of invalid protocolFeePct", async () => {
            const {
                owner,
                easyAuctionAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                tokenManagerAddress,
                feeBeneficiary,
                auctionDuration,
                auctionCancellationDuration,
                feeInputSubjectFactory
            } = await loadFixture(deploy);


            const protocolFeePct = (1e19).toString();
            const newFeeInput = {
                ...feeInputSubjectFactory,
                protocolFeePct,
            };

            const SubjectFactory = await hre.ethers.getContractFactory("SubjectFactory");
            const subjectFactory = await SubjectFactory.deploy();

            await expect(subjectFactory.initialize(
                owner.address,
                tokenManagerAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                easyAuctionAddress,
                newFeeInput,
                feeBeneficiary.address,
                auctionDuration,
                auctionCancellationDuration
            )).to.revertedWithCustomError(subjectFactory, "SubjectFactory_InvalidFeePercentage");
        });


        it("should fail of invalid subjectFeePct", async () => {

            const {

                owner,
                easyAuctionAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                tokenManagerAddress,
                feeBeneficiary,
                auctionDuration,
                auctionCancellationDuration,
                feeInputSubjectFactory
            } = await loadFixture(deploy);


            const subjectFeePct = (1e19).toString();
            const newFeeInput = {
                ...feeInputSubjectFactory,
                subjectFeePct,
            };

            const SubjectFactory = await hre.ethers.getContractFactory("SubjectFactory");
            const subjectFactory = await SubjectFactory.deploy();

            await expect(subjectFactory.initialize(
                owner.address,
                tokenManagerAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                easyAuctionAddress,
                newFeeInput,
                feeBeneficiary.address,
                auctionDuration,
                auctionCancellationDuration
            )).to.revertedWithCustomError(subjectFactory, "SubjectFactory_InvalidFeePercentage");

        });


    });

    describe('initiate subject onboarding', () => {

        it('should initiate Subject Onboarding', async () => {

            const {
                subjectFactory,
                subject,
                owner,
                easyAuctionAddress,
                moxieTokenAddress,
                auctionDuration,
                moxiePassVerifierAddress,
                tokenManager,
                SubjectERC20,
                moxieToken
            } = await loadFixture(deploy);

            await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '1000',
                minBuyAmount: '1',// in moxie token
                minBiddingAmount: '1', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded
            }

            const reserve = 100;

            await moxieToken.approve(await subjectFactory.getAddress(), reserve);
            const latestBlock = await hre.ethers.provider.getBlock("latest");
            const timestamp = latestBlock?.timestamp || 0;

            let subjectTokenAddress;

            const auctionId = BigInt(1);
            await expect(await subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,

            )).to.emit(subjectFactory, "SubjectOnboardingInitiated")
                .withArgs(
                    subject.address,
                    subjectTokenAddress = await tokenManager.tokens(subject.address),
                    auctionInput.initialSupply,
                    moxieTokenAddress,
                    BigInt(timestamp) + BigInt(auctionDuration) + BigInt(1),
                    auctionId
                );

            const subjectToken = SubjectERC20.attach(subjectTokenAddress) as SubjectERC20;
            expect(await subjectToken.totalSupply()).to.equal(auctionInput.initialSupply);
            expect(await subjectToken.balanceOf(easyAuctionAddress)).to.equal(auctionInput.initialSupply);
            expect(await subjectToken.name()).to.equal(auctionInput.name);
            expect(await subjectToken.symbol()).to.equal(auctionInput.symbol);
            const auction = await subjectFactory.auctions(subject);
            expect(auction.auctionId).to.equals(BigInt(auctionId));
            expect(auction.auctionEndDate).to.equals(
                BigInt(timestamp) + BigInt(auctionDuration) + BigInt(1));

            expect(auction.initialSupply).to.equals(
                BigInt(auctionInput.initialSupply),
            );

        });

        it('should fail to initiate for zero subject address', async () => {

            const {
                subjectFactory,
                owner,
                moxiePassVerifierAddress,
            } = await loadFixture(deploy);


            await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '1000',
                minBuyAmount: '1',// in moxie token
                minBiddingAmount: '1', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded
            }

            await expect(subjectFactory.connect(owner).initiateSubjectOnboarding(
                ethers.ZeroAddress,
                auctionInput,

            )).to.revertedWithCustomError(subjectFactory, "SubjectFactory_InvalidSubject");
        });

        it('should fail to initiate Subject Onboarding if already onboarded', async () => {

            const {
                subjectFactory,
                subject,
                owner,
                moxieTokenAddress,
                auctionDuration,
                moxiePassVerifierAddress,
                tokenManager,
                moxieToken
            } = await loadFixture(deploy);


            const auctionId = 1;
            await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '1000',
                minBuyAmount: '1',// in moxie token
                minBiddingAmount: '1', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded
            }

            const reserve = 100;

            await moxieToken.approve(await subjectFactory.getAddress(), reserve);
            const latestBlock = await hre.ethers.provider.getBlock("latest");
            const timestamp = latestBlock?.timestamp || 0;

            let subjectTokenAddress;

            await expect(await subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,

            )).to.emit(subjectFactory, "SubjectOnboardingInitiated")
                .withArgs(
                    subject.address,
                    subjectTokenAddress = await tokenManager.tokens(subject.address),
                    auctionInput.initialSupply,
                    moxieTokenAddress,
                    BigInt(timestamp) + BigInt(auctionDuration) + BigInt(1),
                    auctionId
                );


            await expect(subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,

            )).revertedWithCustomError(subjectFactory, "SubjectFactory_AuctionAlreadyCreated");

        });

        it('should fail to initiate Subject Onboarding without onboarding role', async () => {

            const {
                subjectFactory,
                subject,
                owner,
                moxiePassVerifierAddress,
                moxieToken
            } = await loadFixture(deploy);

            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '1000',
                minBuyAmount: '1',// in moxie token
                minBiddingAmount: '1', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded
            }

            const reserve = 100;
            await moxieToken.approve(await subjectFactory.getAddress(), reserve);

            await expect(subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,

            )).to.revertedWithCustomError(subjectFactory, "AccessControlUnauthorizedAccount",
            )
                .withArgs(owner.address, await subjectFactory.ONBOARDING_ROLE());

        });

        it('should fail to initiate Subject when contract is paused', async () => {

            const {
                subjectFactory,
                subject,
                owner,
                moxiePassVerifierAddress,
                moxieToken
            } = await loadFixture(deploy);

            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '1000',
                minBuyAmount: '1',// in moxie token
                minBiddingAmount: '1', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded
            }

            const reserve = 100;
            await moxieToken.approve(await subjectFactory.getAddress(), reserve);

            await subjectFactory.connect(owner).grantRole(await subjectFactory.PAUSE_ROLE(), owner.address);
            await subjectFactory.connect(owner).pause()

            await expect(subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,

            )).to.revertedWithCustomError(subjectFactory, "EnforcedPause")


        });

    });


    describe("update fee", () => {
        it("should be able to update fee", async () => {
            const { owner, subjectFactory, deployer } = await loadFixture(deploy);

            await subjectFactory
                .connect(owner)
                .grantRole(
                    await subjectFactory.UPDATE_FEES_ROLE(),
                    deployer.address,
                );

            const protocolFeePct = (1e16).toString(); // 1%
            const subjectFeePct = (3 * 1e16).toString(); // 3%

            const feeInput = {
                protocolFeePct,
                subjectFeePct,
            };

            await expect(subjectFactory.connect(deployer).updateFees(feeInput))
                .to.emit(subjectFactory, "UpdateFees")
                .withArgs(
                    feeInput.protocolFeePct,
                    feeInput.subjectFeePct,
                );
        });

        it("should not be able to update fee without permission", async () => {
            const { subjectFactory, deployer } = await loadFixture(deploy);

            const protocolFeePct = (1e16).toString(); // 1%
            const subjectFeePct = (3 * 1e16).toString(); // 3%

            const feeInput = {
                protocolFeePct,
                subjectFeePct,
            };

            await expect(subjectFactory.connect(deployer).updateFees(feeInput))
                .to.revertedWithCustomError(
                    subjectFactory,
                    "AccessControlUnauthorizedAccount",
                )
                .withArgs(deployer.address, await subjectFactory.UPDATE_FEES_ROLE());
        });

        it("should fail of invalid protocolFeePct", async () => {
            const { owner, subjectFactory, deployer } = await loadFixture(deploy);

            await subjectFactory
                .connect(owner)
                .grantRole(
                    await subjectFactory.UPDATE_FEES_ROLE(),
                    deployer.address,
                );

            const protocolFeePct = (1e19).toString(); // 1%
            const subjectFeePct = (3 * 1e16).toString(); // 3%

            const feeInput = {
                protocolFeePct,
                subjectFeePct,
            };

            await expect(
                subjectFactory.connect(deployer).updateFees(feeInput),
            ).to.revertedWithCustomError(
                subjectFactory,
                "SubjectFactory_InvalidFeePercentage",
            );
        });


        it("should fail of invalid subjectFeePct", async () => {
            const { owner, subjectFactory, deployer } = await loadFixture(deploy);

            await subjectFactory
                .connect(owner)
                .grantRole(
                    await subjectFactory.UPDATE_FEES_ROLE(),
                    deployer.address,
                );

            const protocolFeePct = (1e16).toString(); // 1%
            const subjectFeePct = (3 * 1e19).toString(); // 3%

            const feeInput = {
                protocolFeePct,
                subjectFeePct,
            };

            await expect(
                subjectFactory.connect(deployer).updateFees(feeInput),
            ).to.revertedWithCustomError(
                subjectFactory,
                "SubjectFactory_InvalidFeePercentage",
            );
        });

    });

    describe("update Beneficiary", () => {
        it("should update beneficiary ", async () => {
            const { owner, subjectFactory, deployer } = await loadFixture(deploy);

            await subjectFactory
                .connect(owner)
                .grantRole(
                    await subjectFactory.UPDATE_BENEFICIARY_ROLE(),
                    deployer.address,
                );

            const randomAddress = owner.address;
            expect(
                await subjectFactory
                    .connect(deployer)
                    .updateFeeBeneficiary(randomAddress),
            )
                .to.emit(subjectFactory, "UpdateBeneficiary")
                .withArgs(randomAddress);
        });

        it("should not update beneficiary without permission", async () => {
            const { owner, subjectFactory, deployer } = await loadFixture(deploy);

            const randomAddress = owner.address;
            await expect(
                subjectFactory.connect(deployer).updateFeeBeneficiary(randomAddress),
            )
                .to.revertedWithCustomError(
                    subjectFactory,
                    "AccessControlUnauthorizedAccount",
                )
                .withArgs(
                    deployer.address,
                    await subjectFactory.UPDATE_BENEFICIARY_ROLE(),
                );
        });

        it("should throw error when zero address is passed as beneficiary", async () => {
            const { owner, subjectFactory, deployer } = await loadFixture(deploy);

            await subjectFactory
                .connect(owner)
                .grantRole(
                    await subjectFactory.UPDATE_BENEFICIARY_ROLE(),
                    deployer.address,
                );
            await expect(
                subjectFactory
                    .connect(deployer)
                    .updateFeeBeneficiary(ethers.ZeroAddress),
            ).to.revertedWithCustomError(
                subjectFactory,
                "SubjectFactory_InvalidBeneficiary",
            );
        });
    });

    describe('update AuctionTime', () => {

        it('should  be able to update auction time with permissions', async () => {

            const { subjectFactory, deployer, owner } = await loadFixture(deploy);

            const auctionDuration = 100;
            const auctionOrderCancellationDuration = 50;

            await subjectFactory.connect(owner).grantRole(await subjectFactory.AUCTION_ROLE(), deployer.address);
            await expect(
                await subjectFactory.connect(deployer).updateAuctionTime(
                    auctionDuration,
                    auctionOrderCancellationDuration
                ),
            )
                .to.emit(
                    subjectFactory,
                    "UpdateAuctionParam",
                )
                .withArgs(
                    auctionDuration,
                    auctionOrderCancellationDuration,
                );
        });

        it('should not be able to update auction time without permissions', async () => {

            const { subjectFactory, deployer } = await loadFixture(deploy);

            const auctionDuration = 100;
            const auctionOrderCancellationDuration = 50;
            await expect(
                subjectFactory.connect(deployer).updateAuctionTime(
                    auctionDuration,
                    auctionOrderCancellationDuration
                ),
            )
                .to.revertedWithCustomError(
                    subjectFactory,
                    "AccessControlUnauthorizedAccount",
                )
                .withArgs(
                    deployer.address,
                    await subjectFactory.AUCTION_ROLE(),
                );
        });
        it('should not be able to update auction time with zero auction duration', async () => {

            const { subjectFactory, deployer, owner } = await loadFixture(deploy);

            await subjectFactory.connect(owner).grantRole(await subjectFactory.AUCTION_ROLE(), deployer.address);

            const auctionDuration = 0;
            const auctionOrderCancellationDuration = 50;
            await expect(
                subjectFactory.connect(deployer).updateAuctionTime(
                    auctionDuration,
                    auctionOrderCancellationDuration
                ),
            )
                .to.revertedWithCustomError(
                    subjectFactory,
                    "SubjectFactory_InvalidAuctionDuration",
                );

        });

        it('should not be able to update auction time with zero auction cancel duration', async () => {
            const { subjectFactory, deployer, owner } = await loadFixture(deploy);

            await subjectFactory.connect(owner).grantRole(await subjectFactory.AUCTION_ROLE(), deployer.address);

            const auctionDuration = 100;
            const auctionOrderCancellationDuration = 0;
            await expect(
                subjectFactory.connect(deployer).updateAuctionTime(
                    auctionDuration,
                    auctionOrderCancellationDuration
                ),
            )
                .to.revertedWithCustomError(
                    subjectFactory,
                    "SubjectFactory_InvalidAuctionOrderCancellationDuration",
                );
        });

    });

    describe('finalize subject onboarding', () => {

        it('should finalize subject onboarding when there are bids in auction', async () => {
            const {
                subjectFactory,
                owner,
                moxieTokenAddress,
                auctionDuration,
                moxiePassVerifierAddress,
                moxieToken,
                subject,
                tokenManager,
                easyAuction,
                bidder1,
                easyAuctionAddress,
                reserveRatio,
                feeInputSubjectFactory,
                PCT_BASE,
                SubjectERC20,
                vaultInstance,
                feeBeneficiary,
                formula,
                feeInput


            } = await loadFixture(deploy);

            await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '1000',
                minBuyAmount: '1000',// in moxie token
                minBiddingAmount: '1000', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded

            }

            const auctionId = BigInt(1);
            await subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,
            );

            let subjectTokenAddress = await tokenManager.tokens(subject.address);
            let subjectToken = SubjectERC20.attach(subjectTokenAddress) as SubjectERC20;

            // fund bidder
            const biddingAmount = '1000000'; //moxie
            await moxieToken.connect(owner).transfer(bidder1.address, biddingAmount);

            await moxieToken.connect(bidder1).approve(easyAuctionAddress, biddingAmount);
            const queueStartElement =
                "0x0000000000000000000000000000000000000000000000000000000000000001";
            await easyAuction.connect(bidder1).placeSellOrders(
                auctionId,
                [auctionInput.initialSupply],//subject token
                [biddingAmount], // moxie token
                [queueStartElement],
                '0x',
            );

            await time.increase(auctionDuration);


            const buyAmount = "1000000";
            const additionalSupplyDueToBuyAmount = BigInt(buyAmount) * BigInt(auctionInput.initialSupply) / BigInt(biddingAmount);

            const expectedProtocolFee = (BigInt(biddingAmount) + BigInt(buyAmount)) * BigInt(feeInputSubjectFactory.protocolFeePct) / PCT_BASE;
            const expectedSubjectFee = (BigInt(biddingAmount) + BigInt(buyAmount)) * BigInt(feeInputSubjectFactory.subjectFeePct) / PCT_BASE;;
            const expectedBondingSupply = BigInt(auctionInput.initialSupply) + additionalSupplyDueToBuyAmount
            const expectedBondingAmount = BigInt(biddingAmount) + BigInt(buyAmount) - expectedProtocolFee - expectedSubjectFee;

            await moxieToken.approve(await subjectFactory.getAddress(), buyAmount);
            await expect(await subjectFactory.connect(owner).finalizeSubjectOnboarding(
                subject.address,
                buyAmount,
                reserveRatio,
            )).to.emit(
                subjectFactory, "SubjectOnboardingFinished"
            ).withArgs(
                subject.address,
                subjectTokenAddress,
                auctionId,
                expectedBondingSupply,
                expectedBondingAmount,
                expectedProtocolFee,
                expectedSubjectFee
            );

            const actualBuyAmountFromSubjectFee = expectedSubjectFee * (PCT_BASE - BigInt(feeInput.protocolBuyFeePct) - BigInt(feeInput.subjectBuyFeePct)) / PCT_BASE;
            const expectedShareMintFromBondingCurve = await formula.calculatePurchaseReturn(
                expectedBondingSupply,
                expectedBondingAmount,
                reserveRatio,
                actualBuyAmountFromSubjectFee
            );
            expect(await subjectToken.totalSupply()).to.equal(expectedBondingSupply + BigInt(expectedShareMintFromBondingCurve));
            expect(await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress)).to.equal(expectedBondingAmount + actualBuyAmountFromSubjectFee);
            const auction = await subjectFactory.auctions(subject.address);
            expect(auction.auctionEndDate).to.equal(0);
            const expectedProtocolFeeFromFirstBuy = expectedSubjectFee * (BigInt(feeInput.protocolBuyFeePct)) / PCT_BASE;
            expect(await moxieToken.balanceOf(feeBeneficiary.address)).to.equal(BigInt(expectedProtocolFee) + BigInt(expectedProtocolFeeFromFirstBuy))

        });

        it('should finalize subject onboarding when there are multiple bids in auction', async () => {
            const {
                subjectFactory,
                owner,
                moxieTokenAddress,
                auctionDuration,
                moxiePassVerifierAddress,
                moxieToken,
                subject,
                tokenManager,
                easyAuction,
                bidder1,
                bidder2,
                easyAuctionAddress,
                reserveRatio,
                feeInputSubjectFactory,
                PCT_BASE,
                SubjectERC20,
                vaultInstance,
                feeInput,
                formula,
                feeBeneficiary


            } = await loadFixture(deploy);

            await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '1000',
                minBuyAmount: '1000',// in moxie token
                minBiddingAmount: '1', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded

            }

            const auctionId = BigInt(1);
            await subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,
            );

            let subjectTokenAddress = await tokenManager.tokens(subject.address);
            let subjectToken = SubjectERC20.attach(subjectTokenAddress) as SubjectERC20;

            // fund bidder 1
            const biddingAmount1 = '1000000'; //moxie
            await moxieToken.connect(owner).transfer(bidder1.address, biddingAmount1);

            await moxieToken.connect(bidder1).approve(easyAuctionAddress, biddingAmount1);
            const queueStartElement =
                "0x0000000000000000000000000000000000000000000000000000000000000001";
            await easyAuction.connect(bidder1).placeSellOrders(
                auctionId,
                ["700"],//subject token
                [biddingAmount1], // moxie token
                [queueStartElement],
                '0x',
            );

            // fund bidder 2
            const biddingAmount2 = '2000000'; //moxie
            await moxieToken.connect(owner).transfer(bidder2.address, biddingAmount2);

            await moxieToken.connect(bidder2).approve(easyAuctionAddress, biddingAmount2);

            await easyAuction.connect(bidder2).placeSellOrders(
                auctionId,
                ["600"],//subject token
                [biddingAmount2], // moxie token
                [queueStartElement],
                '0x',
            );

            await time.increase(auctionDuration);


            const buyAmount = "1000000";
            const additionalSupplyDueToBuyAmount = BigInt(buyAmount) * BigInt("1000") / BigInt("2000000");

            const expectedProtocolFee = (BigInt(biddingAmount2) + BigInt(buyAmount)) * BigInt(feeInputSubjectFactory.protocolFeePct) / PCT_BASE;
            const expectedSubjectFee = (BigInt(biddingAmount2) + BigInt(buyAmount)) * BigInt(feeInputSubjectFactory.subjectFeePct) / PCT_BASE;;
            const expectedBondingSupply = BigInt(auctionInput.initialSupply) + additionalSupplyDueToBuyAmount
            const expectedBondingAmount = BigInt(biddingAmount2) + BigInt(buyAmount) - expectedProtocolFee - expectedSubjectFee;


            await moxieToken.approve(await subjectFactory.getAddress(), buyAmount);
            await expect(await subjectFactory.connect(owner).finalizeSubjectOnboarding(
                subject.address,
                buyAmount,
                reserveRatio,
            )).to.emit(
                subjectFactory, "SubjectOnboardingFinished"
            ).withArgs(
                subject.address,
                subjectTokenAddress,
                auctionId,
                expectedBondingSupply,
                expectedBondingAmount,
                expectedProtocolFee,
                expectedSubjectFee
            );
            const actualBuyAmountFromSubjectFee = expectedSubjectFee * (PCT_BASE - BigInt(feeInput.protocolBuyFeePct) - BigInt(feeInput.subjectBuyFeePct)) / PCT_BASE;
            const expectedShareMintFromBondingCurve = await formula.calculatePurchaseReturn(
                expectedBondingSupply,
                expectedBondingAmount,
                reserveRatio,
                actualBuyAmountFromSubjectFee
            );
            expect(await subjectToken.totalSupply()).to.equal(expectedBondingSupply + BigInt(expectedShareMintFromBondingCurve));
            expect(await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress)).to.equal(expectedBondingAmount + actualBuyAmountFromSubjectFee);
            const auction = await subjectFactory.auctions(subject.address);
            expect(auction.auctionEndDate).to.equal(0);
            const expectedProtocolFeeFromFirstBuy = expectedSubjectFee * (BigInt(feeInput.protocolBuyFeePct)) / PCT_BASE;
            expect(await moxieToken.balanceOf(feeBeneficiary.address)).to.equal(BigInt(expectedProtocolFee) + BigInt(expectedProtocolFeeFromFirstBuy))

        });

        it('should finalize subject onboarding when there are no bids in auction', async () => {
            const {
                subjectFactory,
                owner,
                moxieTokenAddress,
                auctionDuration,
                moxiePassVerifierAddress,
                moxieToken,
                subject,
                tokenManager,
                reserveRatio,
                feeInputSubjectFactory,
                PCT_BASE,
                SubjectERC20,
                vaultInstance,
                feeInput,
                feeBeneficiary,
                formula


            } = await loadFixture(deploy);

            await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '1000',
                minBuyAmount: '1000',// in moxie token
                minBiddingAmount: '1000', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded

            }

            const auctionId = BigInt(1);
            await subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,
            );

            let subjectTokenAddress = await tokenManager.tokens(subject.address);
            let subjectToken = SubjectERC20.attach(subjectTokenAddress) as SubjectERC20;



            await time.increase(auctionDuration);


            const buyAmount = "1000000";
            const additionalSupplyDueToBuyAmount = BigInt(buyAmount) * BigInt(auctionInput.initialSupply) / BigInt(auctionInput.minBuyAmount);

            const expectedProtocolFee = (BigInt(buyAmount)) * BigInt(feeInputSubjectFactory.protocolFeePct) / PCT_BASE;
            const expectedSubjectFee = (BigInt(buyAmount)) * BigInt(feeInputSubjectFactory.subjectFeePct) / PCT_BASE;;
            const expectedBondingSupply = additionalSupplyDueToBuyAmount;
            const expectedBondingAmount = BigInt(buyAmount) - expectedProtocolFee - expectedSubjectFee;


            await moxieToken.approve(await subjectFactory.getAddress(), buyAmount);
            await expect(await subjectFactory.connect(owner).finalizeSubjectOnboarding(
                subject.address,
                buyAmount,
                reserveRatio,
            )).to.emit(
                subjectFactory, "SubjectOnboardingFinished"
            ).withArgs(
                subject.address,
                subjectTokenAddress,
                auctionId,
                expectedBondingSupply,
                expectedBondingAmount,
                expectedProtocolFee,
                expectedSubjectFee
            );

            const actualBuyAmountFromSubjectFee = expectedSubjectFee * (PCT_BASE - BigInt(feeInput.protocolBuyFeePct) - BigInt(feeInput.subjectBuyFeePct)) / PCT_BASE;
            const expectedShareMintFromBondingCurve = await formula.calculatePurchaseReturn(
                expectedBondingSupply,
                expectedBondingAmount,
                reserveRatio,
                actualBuyAmountFromSubjectFee
            );
            expect(await subjectToken.totalSupply()).to.equal(expectedBondingSupply + BigInt(expectedShareMintFromBondingCurve));
            expect(await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress)).to.equal(expectedBondingAmount + actualBuyAmountFromSubjectFee);
            const auction = await subjectFactory.auctions(subject.address);
            expect(auction.auctionEndDate).to.equal(0);
            const expectedProtocolFeeFromFirstBuy = expectedSubjectFee * (BigInt(feeInput.protocolBuyFeePct)) / PCT_BASE;
            expect(await moxieToken.balanceOf(feeBeneficiary.address)).to.equal(BigInt(expectedProtocolFee) + BigInt(expectedProtocolFeeFromFirstBuy))

        });

        it('should finalize subject onboarding when there are  bids for half of initial auction amout', async () => {
            const {
                subjectFactory,
                owner,
                moxieTokenAddress,
                auctionDuration,
                moxiePassVerifierAddress,
                moxieToken,
                subject,
                tokenManager,
                easyAuction,
                bidder1,
                easyAuctionAddress,
                reserveRatio,
                feeInputSubjectFactory,
                PCT_BASE,
                SubjectERC20,
                vaultInstance,
                formula,
                feeBeneficiary,
                feeInput


            } = await loadFixture(deploy);

            await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '2000',
                minBuyAmount: '1000',// in moxie token
                minBiddingAmount: '1', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded

            }

            const auctionId = BigInt(1);
            await subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,
            );

            let subjectTokenAddress = await tokenManager.tokens(subject.address);
            let subjectToken = SubjectERC20.attach(subjectTokenAddress) as SubjectERC20;

            // fund bidder
            const biddingAmount = '999'; //moxie
            await moxieToken.connect(owner).transfer(bidder1.address, biddingAmount);

            await moxieToken.connect(bidder1).approve(easyAuctionAddress, biddingAmount);
            const queueStartElement =
                "0x0000000000000000000000000000000000000000000000000000000000000001";

            const auctionBuyAmount = "1";
            await easyAuction.connect(bidder1).placeSellOrders(
                auctionId,
                [auctionBuyAmount],//subject token
                [biddingAmount], // moxie token
                [queueStartElement],
                '0x',
            );

            await time.increase(auctionDuration);


            const buyAmount = "1000000";
            const additionalSupplyDueToBuyAmount = BigInt(buyAmount) * BigInt(auctionInput.initialSupply) / BigInt(auctionInput.minBuyAmount);

            const expectedProtocolFee = (BigInt(biddingAmount) + BigInt(buyAmount)) * BigInt(feeInputSubjectFactory.protocolFeePct) / PCT_BASE;
            const expectedSubjectFee = (BigInt(biddingAmount) + BigInt(buyAmount)) * BigInt(feeInputSubjectFactory.subjectFeePct) / PCT_BASE;;
            const expectedBondingSupply = BigInt(biddingAmount) * BigInt(auctionInput.initialSupply) / BigInt(auctionInput.minBuyAmount) + additionalSupplyDueToBuyAmount
            const expectedBondingAmount = BigInt(biddingAmount) + BigInt(buyAmount) - expectedProtocolFee - expectedSubjectFee;


            await moxieToken.approve(await subjectFactory.getAddress(), buyAmount);
            await expect(await subjectFactory.connect(owner).finalizeSubjectOnboarding(
                subject.address,
                buyAmount,
                reserveRatio,
            )).to.emit(
                subjectFactory, "SubjectOnboardingFinished"
            ).withArgs(
                subject.address,
                subjectTokenAddress,
                auctionId,
                expectedBondingSupply,
                expectedBondingAmount,
                expectedProtocolFee,
                expectedSubjectFee
            );

            const subjectFeeOnSubjectBuyAmount = expectedSubjectFee * BigInt(feeInput.subjectBuyFeePct) / PCT_BASE;
            const protocolFeeOnSubjectBuyAmount = expectedSubjectFee * BigInt(feeInput.protocolBuyFeePct) / PCT_BASE;
            const actualBuyAmountFromSubjectFee = expectedSubjectFee - subjectFeeOnSubjectBuyAmount - protocolFeeOnSubjectBuyAmount;


            const expectedShareMintFromBondingCurve = await formula.calculatePurchaseReturn(
                expectedBondingSupply,
                expectedBondingAmount,
                reserveRatio,
                actualBuyAmountFromSubjectFee
            );
            expect(await subjectToken.totalSupply()).to.equal(expectedBondingSupply + BigInt(expectedShareMintFromBondingCurve));
            expect(await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress)).to.equal(expectedBondingAmount + actualBuyAmountFromSubjectFee);
            const auction = await subjectFactory.auctions(subject.address);
            expect(auction.auctionEndDate).to.equal(0);
            const expectedProtocolFeeFromFirstBuy = expectedSubjectFee * (BigInt(feeInput.protocolBuyFeePct)) / PCT_BASE;
            expect(await moxieToken.balanceOf(feeBeneficiary.address)).to.equal(BigInt(expectedProtocolFee) + BigInt(expectedProtocolFeeFromFirstBuy))

        });

        it('should not finalize subject onboarding when buy amount is too less', async () => {
            const {
                subjectFactory,
                owner,
                auctionDuration,
                moxiePassVerifierAddress,
                moxieToken,
                subject,
                tokenManager,
                easyAuction,
                bidder1,
                easyAuctionAddress,
                reserveRatio,
                SubjectERC20

            } = await loadFixture(deploy);

            await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '1000',
                minBuyAmount: '1000',// in moxie token
                minBiddingAmount: '1000', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded

            }

            const auctionId = BigInt(1);
            await subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,
            );

            let subjectTokenAddress = await tokenManager.tokens(subject.address);

            // fund bidder
            const biddingAmount = '1000000'; //moxie
            await moxieToken.connect(owner).transfer(bidder1.address, biddingAmount);

            await moxieToken.connect(bidder1).approve(easyAuctionAddress, biddingAmount);
            const queueStartElement =
                "0x0000000000000000000000000000000000000000000000000000000000000001";
            await easyAuction.connect(bidder1).placeSellOrders(
                auctionId,
                [auctionInput.initialSupply],//subject token
                [biddingAmount], // moxie token
                [queueStartElement],
                '0x',
            );

            await time.increase(auctionDuration);


            const buyAmount = "10";

            await moxieToken.approve(await subjectFactory.getAddress(), buyAmount);
            await expect(subjectFactory.connect(owner).finalizeSubjectOnboarding(
                subject.address,
                buyAmount,
                reserveRatio,
            )).to.revertedWithCustomError(subjectFactory, "SubjectFactory_BuyAmountTooLess");

        });


        it('should not finalize subject onboarding when contract is not approved for buy amount', async () => {
            const {
                subjectFactory,
                owner,
                auctionDuration,
                moxiePassVerifierAddress,
                moxieToken,
                subject,
                tokenManager,
                easyAuction,
                bidder1,
                easyAuctionAddress,
                reserveRatio,
                SubjectERC20

            } = await loadFixture(deploy);

            await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '1000',
                minBuyAmount: '1000',// in moxie token
                minBiddingAmount: '1000', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded
            }

            const auctionId = BigInt(1);
            await subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,
            );

            let subjectTokenAddress = await tokenManager.tokens(subject.address);

            // fund bidder
            const biddingAmount = '1000000'; //moxie
            await moxieToken.connect(owner).transfer(bidder1.address, biddingAmount);

            await moxieToken.connect(bidder1).approve(easyAuctionAddress, biddingAmount);
            const queueStartElement =
                "0x0000000000000000000000000000000000000000000000000000000000000001";
            await easyAuction.connect(bidder1).placeSellOrders(
                auctionId,
                [auctionInput.initialSupply],//subject token
                [biddingAmount], // moxie token
                [queueStartElement],
                '0x',
            );

            await time.increase(auctionDuration);


            const buyAmount = "10000";

            await expect(subjectFactory.connect(owner).finalizeSubjectOnboarding(
                subject.address,
                buyAmount,
                reserveRatio,
            )).to.revertedWithCustomError(moxieToken, "ERC20InsufficientAllowance");

        });

        it('should not finalize subject onboarding when caller doesnot have buy amount', async () => {
            const {
                subjectFactory,
                owner,
                auctionDuration,
                moxiePassVerifierAddress,
                moxieToken,
                subject,
                tokenManager,
                easyAuction,
                bidder1,
                easyAuctionAddress,
                reserveRatio,
                SubjectERC20

            } = await loadFixture(deploy);

            await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '1000',
                minBuyAmount: '1000',// in moxie token
                minBiddingAmount: '1000', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded
            }

            const auctionId = BigInt(1);
            await subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,
            );

            let subjectTokenAddress = await tokenManager.tokens(subject.address);

            // fund bidder
            const biddingAmount = '1000000'; //moxie
            await moxieToken.connect(owner).transfer(bidder1.address, biddingAmount);

            await moxieToken.connect(bidder1).approve(easyAuctionAddress, biddingAmount);
            const queueStartElement =
                "0x0000000000000000000000000000000000000000000000000000000000000001";
            await easyAuction.connect(bidder1).placeSellOrders(
                auctionId,
                [auctionInput.initialSupply],//subject token
                [biddingAmount], // moxie token
                [queueStartElement],
                '0x',
            );

            await time.increase(auctionDuration);


            const buyAmount = "10000";

            await moxieToken.approve(await subjectFactory.getAddress(), buyAmount);

            //burn all funds  to make zero balance
            await moxieToken.connect(owner).burn(await moxieToken.balanceOf(owner.address));

            await expect(subjectFactory.connect(owner).finalizeSubjectOnboarding(
                subject.address,
                buyAmount,
                reserveRatio,
            )).to.revertedWithCustomError(moxieToken, "ERC20InsufficientBalance");

        });

        it('should not finalize subject onboarding when subject is zero', async () => {
            const {
                subjectFactory,
                owner,
                auctionDuration,
                moxiePassVerifierAddress,
                moxieToken,
                subject,
                tokenManager,
                easyAuction,
                bidder1,
                easyAuctionAddress,
                reserveRatio,
                SubjectERC20

            } = await loadFixture(deploy);

            await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '1000',
                minBuyAmount: '1000',// in moxie token
                minBiddingAmount: '1000', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded

            }

            const auctionId = BigInt(1);
            await subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,
            );

            let subjectTokenAddress = await tokenManager.tokens(subject.address);

            // fund bidder
            const biddingAmount = '1000000'; //moxie
            await moxieToken.connect(owner).transfer(bidder1.address, biddingAmount);

            await moxieToken.connect(bidder1).approve(easyAuctionAddress, biddingAmount);
            const queueStartElement =
                "0x0000000000000000000000000000000000000000000000000000000000000001";
            await easyAuction.connect(bidder1).placeSellOrders(
                auctionId,
                [auctionInput.initialSupply],//subject token
                [biddingAmount], // moxie token
                [queueStartElement],
                '0x',
            );

            await time.increase(auctionDuration);


            const buyAmount = "10000";

            await moxieToken.approve(await subjectFactory.getAddress(), buyAmount);
            await expect(subjectFactory.connect(owner).finalizeSubjectOnboarding(
                ethers.ZeroAddress,
                buyAmount,
                reserveRatio,
            )).to.revertedWithCustomError(subjectFactory, "SubjectFactory_InvalidSubject");

        });

        it('should not finalize subject onboarding when reserve ratio is zero', async () => {
            const {
                subjectFactory,
                owner,
                auctionDuration,
                moxiePassVerifierAddress,
                moxieToken,
                subject,
                easyAuction,
                bidder1,
                easyAuctionAddress

            } = await loadFixture(deploy);

            await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '1000',
                minBuyAmount: '1000',// in moxie token
                minBiddingAmount: '1000', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded

            }

            const auctionId = BigInt(1);
            await subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,
            );

            // fund bidder
            const biddingAmount = '1000000'; //moxie
            await moxieToken.connect(owner).transfer(bidder1.address, biddingAmount);

            await moxieToken.connect(bidder1).approve(easyAuctionAddress, biddingAmount);
            const queueStartElement =
                "0x0000000000000000000000000000000000000000000000000000000000000001";
            await easyAuction.connect(bidder1).placeSellOrders(
                auctionId,
                [auctionInput.initialSupply],//subject token
                [biddingAmount], // moxie token
                [queueStartElement],
                '0x',
            );

            await time.increase(auctionDuration);


            const buyAmount = "10000";

            await moxieToken.approve(await subjectFactory.getAddress(), buyAmount);
            await expect(subjectFactory.connect(owner).finalizeSubjectOnboarding(
                subject.address,
                buyAmount,
                0,
            )).to.revertedWithCustomError(subjectFactory, "SubjectFactory_InvalidReserveRatio");

        });

        it('should fail when auction doesnot exists', async () => {
            const {
                subjectFactory,
                owner,
                auctionDuration,
                moxiePassVerifierAddress,
                moxieToken,
                subject,
                easyAuction,
                bidder1,
                easyAuctionAddress,
                reserveRatio

            } = await loadFixture(deploy);

            await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '1000',
                minBuyAmount: '1000',// in moxie token
                minBiddingAmount: '1000', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded

            }

            const auctionId = BigInt(1);
            await subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,
            );

            // fund bidder
            const biddingAmount = '1000000'; //moxie
            await moxieToken.connect(owner).transfer(bidder1.address, biddingAmount);

            await moxieToken.connect(bidder1).approve(easyAuctionAddress, biddingAmount);
            const queueStartElement =
                "0x0000000000000000000000000000000000000000000000000000000000000001";
            await easyAuction.connect(bidder1).placeSellOrders(
                auctionId,
                [auctionInput.initialSupply],//subject token
                [biddingAmount], // moxie token
                [queueStartElement],
                '0x',
            );

            await time.increase(auctionDuration);


            const buyAmount = "10000";

            await moxieToken.approve(await subjectFactory.getAddress(), buyAmount);
            await expect(subjectFactory.connect(owner).finalizeSubjectOnboarding(
                owner.address,
                buyAmount,
                reserveRatio,
            )).to.revertedWithCustomError(subjectFactory, "SubjectFactory_AuctionNotCreated");

        });

        it('should not be able to re-create auction for same subject', async () => {
            const {
                subjectFactory,
                owner,
                moxieTokenAddress,
                auctionDuration,
                moxiePassVerifierAddress,
                moxieToken,
                subject,
                tokenManager,
                easyAuction,
                bidder1,
                easyAuctionAddress,
                reserveRatio,
                feeInputSubjectFactory,
                PCT_BASE,
                SubjectERC20,
                vaultInstance,
                formula,
                feeInput,
                feeBeneficiary


            } = await loadFixture(deploy);

            await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '1000',
                minBuyAmount: '1000',// in moxie token
                minBiddingAmount: '1000', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded

            }

            const auctionId = BigInt(1);
            await subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,
            );

            let subjectTokenAddress = await tokenManager.tokens(subject.address);
            let subjectToken = SubjectERC20.attach(subjectTokenAddress) as SubjectERC20;

            // fund bidder
            const biddingAmount = '1000000'; //moxie
            await moxieToken.connect(owner).transfer(bidder1.address, biddingAmount);

            await moxieToken.connect(bidder1).approve(easyAuctionAddress, biddingAmount);
            const queueStartElement =
                "0x0000000000000000000000000000000000000000000000000000000000000001";
            await easyAuction.connect(bidder1).placeSellOrders(
                auctionId,
                [auctionInput.initialSupply],//subject token
                [biddingAmount], // moxie token
                [queueStartElement],
                '0x',
            );

            await time.increase(auctionDuration);


            const buyAmount = "1000000";
            const additionalSupplyDueToBuyAmount = BigInt(buyAmount) * BigInt(auctionInput.initialSupply) / BigInt(biddingAmount);

            const expectedProtocolFee = (BigInt(biddingAmount) + BigInt(buyAmount)) * BigInt(feeInputSubjectFactory.protocolFeePct) / PCT_BASE;
            const expectedSubjectFee = (BigInt(biddingAmount) + BigInt(buyAmount)) * BigInt(feeInputSubjectFactory.subjectFeePct) / PCT_BASE;;
            const expectedBondingSupply = BigInt(auctionInput.initialSupply) + additionalSupplyDueToBuyAmount
            const expectedBondingAmount = BigInt(biddingAmount) + BigInt(buyAmount) - expectedProtocolFee - expectedSubjectFee;


            await moxieToken.approve(await subjectFactory.getAddress(), buyAmount);
            await expect(await subjectFactory.connect(owner).finalizeSubjectOnboarding(
                subject.address,
                buyAmount,
                reserveRatio,
            )).to.emit(
                subjectFactory, "SubjectOnboardingFinished"
            ).withArgs(
                subject.address,
                subjectTokenAddress,
                auctionId,
                expectedBondingSupply,
                expectedBondingAmount,
                expectedProtocolFee,
                expectedSubjectFee
            );

            const actualBuyAmountFromSubjectFee = expectedSubjectFee * (PCT_BASE - BigInt(feeInput.protocolBuyFeePct) - BigInt(feeInput.subjectBuyFeePct)) / PCT_BASE;
            const expectedShareMintFromBondingCurve = await formula.calculatePurchaseReturn(
                expectedBondingSupply,
                expectedBondingAmount,
                reserveRatio,
                actualBuyAmountFromSubjectFee
            );
            expect(await subjectToken.totalSupply()).to.equal(expectedBondingSupply + BigInt(expectedShareMintFromBondingCurve));
            expect(await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress)).to.equal(expectedBondingAmount + actualBuyAmountFromSubjectFee);
            const auction = await subjectFactory.auctions(subject.address);
            expect(auction.auctionEndDate).to.equal(0);
            const expectedProtocolFeeFromFirstBuy = expectedSubjectFee * (BigInt(feeInput.protocolBuyFeePct)) / PCT_BASE;
            expect(await moxieToken.balanceOf(feeBeneficiary.address)).to.equal(BigInt(expectedProtocolFee) + BigInt(expectedProtocolFeeFromFirstBuy))
            await expect(subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,
            )).to.revertedWithCustomError(tokenManager, "TokenManager_SubjectExists");

        });

        it('should not finalize subject onboarding when auction end date is not passed', async () => {
            const {
                subjectFactory,
                owner,
                moxiePassVerifierAddress,
                moxieToken,
                subject,
                tokenManager,
                easyAuction,
                bidder1,
                easyAuctionAddress,
                reserveRatio,
                SubjectERC20

            } = await loadFixture(deploy);

            await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '1000',
                minBuyAmount: '1000',// in moxie token
                minBiddingAmount: '1000', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded

            }

            const auctionId = BigInt(1);
            await subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,
            );

            let subjectTokenAddress = await tokenManager.tokens(subject.address);

            // fund bidder
            const biddingAmount = '1000000'; //moxie
            await moxieToken.connect(owner).transfer(bidder1.address, biddingAmount);

            await moxieToken.connect(bidder1).approve(easyAuctionAddress, biddingAmount);
            const queueStartElement =
                "0x0000000000000000000000000000000000000000000000000000000000000001";
            await easyAuction.connect(bidder1).placeSellOrders(
                auctionId,
                [auctionInput.initialSupply],//subject token
                [biddingAmount], // moxie token
                [queueStartElement],
                '0x',
            );

            const buyAmount = "10";

            await moxieToken.approve(await subjectFactory.getAddress(), buyAmount);
            await expect(subjectFactory.connect(owner).finalizeSubjectOnboarding(
                subject.address,
                buyAmount,
                reserveRatio,
            )).to.revertedWithCustomError(subjectFactory, "SubjectFactory_AuctionNotDoneYet");

        });

        it('should not finalize subject onboarding when contract is paused.  ', async () => {
            const {
                subjectFactory,
                owner,
                auctionDuration,
                moxiePassVerifierAddress,
                moxieToken,
                subject,
                tokenManager,
                easyAuction,
                bidder1,
                easyAuctionAddress,
                reserveRatio,
                SubjectERC20

            } = await loadFixture(deploy);

            await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '1000',
                minBuyAmount: '1000',// in moxie token
                minBiddingAmount: '1000', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded

            };

            const auctionId = BigInt(1);
            await subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,
            );

            let subjectTokenAddress = await tokenManager.tokens(subject.address);

            // fund bidder
            const biddingAmount = '1000000'; //moxie
            await moxieToken.connect(owner).transfer(bidder1.address, biddingAmount);

            await moxieToken.connect(bidder1).approve(easyAuctionAddress, biddingAmount);
            const queueStartElement =
                "0x0000000000000000000000000000000000000000000000000000000000000001";
            await easyAuction.connect(bidder1).placeSellOrders(
                auctionId,
                [auctionInput.initialSupply],//subject token
                [biddingAmount], // moxie token
                [queueStartElement],
                '0x',
            );

            await time.increase(auctionDuration);

            const buyAmount = "1000000";

            await moxieToken.approve(await subjectFactory.getAddress(), buyAmount);

            // pause contract.
            await subjectFactory.connect(owner).grantRole(await subjectFactory.PAUSE_ROLE(), owner.address);
            await subjectFactory.connect(owner).pause();

            await expect(subjectFactory.connect(owner).finalizeSubjectOnboarding(
                subject.address,
                buyAmount,
                reserveRatio,
            )).to.revertedWithCustomError(subjectFactory, "EnforcedPause");

        });

        it('should not finalize subject onboarding when caller doesnot have onboarding role', async () => {
            const {
                subjectFactory,
                owner,
                auctionDuration,
                moxiePassVerifierAddress,
                moxieToken,
                subject,
                tokenManager,
                easyAuction,
                bidder1,
                easyAuctionAddress,
                reserveRatio,
                SubjectERC20

            } = await loadFixture(deploy);

            await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
            const auctionInput = {
                name: 'fid-3761',
                symbol: 'fid-3761',
                initialSupply: '1000',
                minBuyAmount: '1000',// in moxie token
                minBiddingAmount: '1000', // in subject token
                minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
                isAtomicClosureAllowed: false, // false can be hardcoded
                accessManagerContract: moxiePassVerifierAddress, //
                accessManagerContractData: '0x' //0x00 can be hardcoded

            };

            const auctionId = BigInt(1);
            await subjectFactory.connect(owner).initiateSubjectOnboarding(
                subject.address,
                auctionInput,
            );

            let subjectTokenAddress = await tokenManager.tokens(subject.address);

            // fund bidder
            const biddingAmount = '1000000'; //moxie
            await moxieToken.connect(owner).transfer(bidder1.address, biddingAmount);

            await moxieToken.connect(bidder1).approve(easyAuctionAddress, biddingAmount);
            const queueStartElement =
                "0x0000000000000000000000000000000000000000000000000000000000000001";
            await easyAuction.connect(bidder1).placeSellOrders(
                auctionId,
                [auctionInput.initialSupply],//subject token
                [biddingAmount], // moxie token
                [queueStartElement],
                '0x',
            );

            await time.increase(auctionDuration);

            const buyAmount = "1000000";

            await moxieToken.approve(await subjectFactory.getAddress(), buyAmount);

            // revoke role


            await subjectFactory.connect(owner).revokeRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);

            await expect(subjectFactory.connect(owner).finalizeSubjectOnboarding(
                subject.address,
                buyAmount,
                reserveRatio,
            )).to.revertedWithCustomError(subjectFactory, "AccessControlUnauthorizedAccount")
                .withArgs(owner.address, await subjectFactory.ONBOARDING_ROLE());

        });

    });
});