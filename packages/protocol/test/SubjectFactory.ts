import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { SubjectERC20 } from "../typechain-types";


describe('Subject Factory', () => {


    const deploy = async () => {

        const [deployer, owner, minter, feeBeneficiary, subject] = await ethers.getSigners();


        const SubjectFactory = await hre.ethers.getContractFactory("SubjectFactory");
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

        const MockEasyAuction = await hre.ethers.getContractFactory("MockEasyAuction");;


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

        const easyAuction = await MockEasyAuction.deploy();

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


        await tokenManager.connect(owner).grantRole(await tokenManager.CREATE_ROLE(), subjectFactoryAddress);

        await moxiePass.connect(minter).mint(owner.address);
        await moxiePass.connect(minter).mint(subject.address);
        await moxiePass.connect(minter).mint(deployer.address);
        await moxiePass.connect(minter).mint(await moxieBondingCurve.getAddress());
        await moxiePass.connect(minter).mint(await tokenManager.getAddress());
        await moxiePass.connect(minter).mint(subjectFactoryAddress);

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
            feeInputSubjectFactory
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
                feeInput,
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
                owner,
                easyAuctionAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                tokenManagerAddress,
                feeInput,
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
                tokenManagerAddress,
                feeInput,
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
                moxieTokenAddress,
                tokenManagerAddress,
                feeInput,
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

        it('should fail to initialize for zero _token', async () => {
            const {
                owner,
                easyAuctionAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                tokenManagerAddress,
                feeInput,
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
                easyAuctionAddress,
                moxieBondingCurveAddress,
                moxieTokenAddress,
                tokenManagerAddress,
                feeInput,
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
                feeInput,
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
                feeInput,
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
                feeInput,
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
                feeInput,
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
                feeInput,
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

    describe('initiateSubjectOnboarding', () => {

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
                easyAuction,
                SubjectERC20,
                moxieToken
            } = await loadFixture(deploy);


            const auctionId = 1;
            await easyAuction.setAuctionId(auctionId);
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
                reserve

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
            expect(await subjectToken.allowance(await subjectFactory.getAddress(), easyAuctionAddress)).to.equal(auctionInput.initialSupply);
            expect(await subjectToken.name()).to.equal(auctionInput.name);
            expect(await subjectToken.symbol()).to.equal(auctionInput.symbol);
            expect(await moxieToken.balanceOf(await subjectFactory.getAddress())).to.equal(reserve);
            const auction = await subjectFactory.auctions(subject);
            expect(auction.auctionId).to.equals(BigInt(auctionId));
            expect(auction.auctionEndDate).to.equals(
                BigInt(timestamp) + BigInt(auctionDuration) + BigInt(1));
            expect(auction.reserveAmount).to.equals(
                BigInt(reserve),
            );
            expect(auction.initialSupply).to.equals(
                BigInt(auctionInput.initialSupply),
            );

        });

        it('should fail to initiate for zero subject address', async () => {

            const {
                subjectFactory,
                owner,
                moxiePassVerifierAddress,
                easyAuction,
            } = await loadFixture(deploy);


            const auctionId = 1;
            await easyAuction.setAuctionId(auctionId);
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
            await expect(subjectFactory.connect(owner).initiateSubjectOnboarding(
                ethers.ZeroAddress,
                auctionInput,
                reserve

            )).to.revertedWithCustomError(subjectFactory, "SubjectFactory_InvalidSubject");
        });

        it('should fail to initiate Subject Onboarding if already onboarded', async () => {

            const {
                subjectFactory,
                subject,
                owner,
                easyAuctionAddress,
                moxieTokenAddress,
                auctionDuration,
                moxiePassVerifierAddress,
                tokenManager,
                easyAuction,
                SubjectERC20,
                moxieToken
            } = await loadFixture(deploy);


            const auctionId = 1;
            await easyAuction.setAuctionId(auctionId);
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
                reserve

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
                reserve

            )).revertedWithCustomError(subjectFactory, "SubjectFactory_AuctionAlreadyCreated");

        });

        it('should fail to initiate Subject Onboarding without onboarding role', async () => {

            const {
                subjectFactory,
                subject,
                owner,
                moxiePassVerifierAddress,
                easyAuction,
                moxieToken
            } = await loadFixture(deploy);


            const auctionId = 1;
            await easyAuction.setAuctionId(auctionId);

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
                reserve

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
                easyAuction,
                moxieToken
            } = await loadFixture(deploy);


            const auctionId = 1;
            await easyAuction.setAuctionId(auctionId);

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
                reserve

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

        it('should  be able to update auction time without permissions', async () => {

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

        it('should not be able to update auction time without permissions', async () => {
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
});