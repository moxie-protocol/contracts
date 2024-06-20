import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import EasyAuctionArtifact from "../test-artifact/easy-auction/artifacts/contracts/EasyAuction.sol/EasyAuction.json";
import { EasyAuction } from "../test-artifact/easy-auction/typechain/EasyAuction";
import { SubjectERC20 } from "../typechain-types";
import { BigNumber} from "@ethersproject/bignumber";

import { BancorFormula, Vault } from "../typechain-types";
import { BigNumberish } from "ethers";



describe('Subject Onboarding Test', () => {


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
        const auctionDuration = 1000;
        const auctionCancellationDuration = 900;
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
            moxiePass,
            easyAuction,
            easyAuctionAddress,
            moxieBondingCurve,
            moxieBondingCurveAddress,
            moxieTokenAddress,
            tokenManagerAddress,
            feeInput,
            feeBeneficiary,
            auctionDuration,
            subjectTokenAddress: subjectErc20Address,
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
            formula,
        };

    }

    it('Assertions for initiateSubjectOnboarding', async () => {
        const {
            subjectFactory,
            owner,
            moxiePassVerifierAddress,
            subject,
            tokenManager,
            SubjectERC20,
            feeInputSubjectFactory,
            PCT_BASE
        } = await loadFixture(deploy);

        await subjectFactory.connect(owner).grantRole(await subjectFactory.ONBOARDING_ROLE(), owner.address);
        const auctionInput = {
            name: 'fid-1536',
            symbol: 'fid-1536',
            initialSupply: '10000',
            minBuyAmount: '10000',// in moxie token
            minBiddingAmount: '10000', // in subject token
            minFundingThreshold: '0', // amount of auction funding in moxie token below which auction will be cancelled.
            isAtomicClosureAllowed: false, // false can be hardcoded
            accessManagerContract: moxiePassVerifierAddress, //
            accessManagerContractData: '0x' //0x00 can be hardcoded

        }

        await expect(subjectFactory.connect(owner).initiateSubjectOnboarding(
            subject.address,
            auctionInput,
        )).to.emit(subjectFactory, "SubjectOnboardingInitiated");

        // Assertions for initiateSubjectOnboarding
        // Verify that subject is created
        expect(await tokenManager.tokens(subject.address)).exist;
        let subjectTokenAddress = await tokenManager.tokens(subject.address);
        let subjectToken = SubjectERC20.attach(subjectTokenAddress) as SubjectERC20;

        // Verify that subject token has correct name, symbol and subject.address, easyAuction.address
        expect(await subjectToken.name()).to.equal(auctionInput.name);
        expect(await subjectToken.symbol()).to.equal(auctionInput.symbol);
        expect(await subjectToken.totalSupply()).to.equal(auctionInput.initialSupply);

        // Verify that subject token has correct owner
        expect(await subjectToken.owner()).to.equal(tokenManager);
        
        // Verify feees
        const buyAmount = "1000000";
        const biddingAmount = '1000000'; //moxie
        expect((BigInt(biddingAmount) + BigInt(buyAmount)) * BigInt(feeInputSubjectFactory.protocolFeePct) / PCT_BASE).to.equal(20000)
        expect((BigInt(biddingAmount) + BigInt(buyAmount)) * BigInt(feeInputSubjectFactory.subjectFeePct) / PCT_BASE).to.equal(60000)

    });

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

    it('Able to place a bid', async () => {
        const {
            subjectFactory,
            owner,
            moxiePassVerifierAddress,
            moxieToken,
            subject,
            easyAuction,
            bidder1,
            easyAuctionAddress,

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

        // verify that bidder balance is increased
        expect(await moxieToken.balanceOf(bidder1.address)).to.equal(1000000);

        const queueStartElement =
            "0x0000000000000000000000000000000000000000000000000000000000000001";
        await expect(easyAuction.connect(bidder1).placeSellOrders(
            auctionId,
            [auctionInput.initialSupply],//subject token
            [biddingAmount], // moxie token
            [queueStartElement],
            '0x',
        ),
        ).to.emit(easyAuction, "NewSellOrder");

        // Verify that bidder balance is reduced
        expect(await moxieToken.balanceOf(bidder1.address)).to.equal(0);
        expect(await moxieToken.balanceOf(easyAuctionAddress)).to.equal(1000000);


    });

    it('Able to place multiple bids', async () => {
        const {
            subjectFactory,
            owner,
            moxiePassVerifierAddress,
            moxieToken,
            subject,
            easyAuction,
            bidder1,
            bidder2,
            easyAuctionAddress,

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

        // fund bidder 1
        const biddingAmount1 = '1000000'; //moxie
        await moxieToken.connect(owner).transfer(bidder1.address, biddingAmount1);

        await moxieToken.connect(bidder1).approve(easyAuctionAddress, biddingAmount1);
        const queueStartElement =
            "0x0000000000000000000000000000000000000000000000000000000000000001";
        await expect(easyAuction.connect(bidder1).placeSellOrders(
            auctionId,
            [auctionInput.initialSupply],//subject token
            [biddingAmount1], // moxie token
            [queueStartElement],
            '0x',
        ),
        ).to.emit(easyAuction, "NewSellOrder");

        // fund bidder 2
        const biddingAmount2 = '2000000'; //moxie
        await moxieToken.connect(owner).transfer(bidder2.address, biddingAmount2);

        await moxieToken.connect(bidder2).approve(easyAuctionAddress, biddingAmount2);

        await expect(easyAuction.connect(bidder2).placeSellOrders(
        auctionId,
        [auctionInput.initialSupply],//subject token
        [biddingAmount2], // moxie token
        [queueStartElement],
        '0x',
        ),
        ).to.emit(easyAuction, "NewSellOrder");

        // Verify that bidder balance is reduced
        expect(await moxieToken.balanceOf(bidder1.address)).to.equal(0);
        expect(await moxieToken.balanceOf(easyAuctionAddress)).to.equal(3000000);

        // Verify that bidder2 balance is reduced
        expect(await moxieToken.balanceOf(bidder2.address)).to.equal(0);
        expect(await moxieToken.balanceOf(easyAuctionAddress)).to.equal(3000000);

    });

    it('Able to increase bid', async () => {
        const {
            subjectFactory,
            owner,
            moxiePassVerifierAddress,
            moxieToken,
            subject,
            easyAuction,
            bidder1,
            easyAuctionAddress,

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

        // fund bidder 1
        const biddingAmount1 = '1000000'; //moxie
        await moxieToken.connect(owner).transfer(bidder1.address, biddingAmount1);

        await moxieToken.connect(bidder1).approve(easyAuctionAddress, biddingAmount1);
        const queueStartElement =
            "0x0000000000000000000000000000000000000000000000000000000000000001";
        await expect(easyAuction.connect(bidder1).placeSellOrders(
            auctionId,
            [auctionInput.initialSupply],//subject token
            [biddingAmount1], // moxie token
            [queueStartElement],
            '0x',
        ),
        ).to.emit(easyAuction, "NewSellOrder");

        // fund bidder 1
        const biddingAmount2 = '2000000'; //moxie
        await moxieToken.connect(owner).transfer(bidder1.address, biddingAmount2);

        await moxieToken.connect(bidder1).approve(easyAuctionAddress, biddingAmount2);
        const queueStartElemen2 =
            "0x0000000000000000000000000000000000000000000000000000000000000001";
        await expect(easyAuction.connect(bidder1).placeSellOrders(
            auctionId,
            [auctionInput.initialSupply],//subject token
            [biddingAmount2], // moxie token
            [queueStartElemen2],
            '0x',
        ),
        ).to.emit(easyAuction, "NewSellOrder");

        // Verify that bidder balance is reduced
        expect(await moxieToken.balanceOf(bidder1.address)).to.equal(0);
        expect(await moxieToken.balanceOf(easyAuctionAddress)).to.equal(3000000);

    });

    it('Able to cancel/withdraw bid', async () => {
        const {
            subjectFactory,
            owner,
            moxiePassVerifierAddress,
            moxieToken,
            subject,
            easyAuction,
            bidder1,
            easyAuctionAddress,

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

        // verify that bidder balance is increased
        expect(await moxieToken.balanceOf(bidder1.address)).to.equal(1000000);

        const queueStartElement =
            "0x0000000000000000000000000000000000000000000000000000000000000001";
        await expect(easyAuction.connect(bidder1).placeSellOrders(
            auctionId,
            [auctionInput.initialSupply],//subject token
            [biddingAmount], // moxie token
            [queueStartElement],
            '0x',
        ),
        ).to.emit(easyAuction, "NewSellOrder").withArgs(
            auctionId,
            2,
            auctionInput.initialSupply,
            biddingAmount
        );;

        // Verify that bidder balance is reduced
        expect(await moxieToken.balanceOf(bidder1.address)).to.equal(0);
        expect(await moxieToken.balanceOf(easyAuctionAddress)).to.equal(1000000);

        const sellAmount = BigNumber.from(biddingAmount);
        const buyAmount = BigNumber.from(auctionInput.initialSupply);
        const userId = BigNumber.from(2);
        
        await easyAuction
            .connect(bidder1)
            .cancelSellOrders(auctionId, [
            encodeOrder({ sellAmount, buyAmount,  userId}),
        ]);

        // Verify that bidder balance is increased and auction balance is reduced
        expect(await moxieToken.balanceOf(bidder1.address)).to.equal(1000000);
        expect(await moxieToken.balanceOf(easyAuctionAddress)).to.equal(0);

    });

    it('Cannot cllose Auction twice', async () => {
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
            feeInputSubjectFactory,
            PCT_BASE,

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

        // Close Auction again and verify that it fails
        await expect(subjectFactory.connect(owner).finalizeSubjectOnboarding(
            owner.address,
            buyAmount,
            reserveRatio,
        )).to.revertedWithCustomError(subjectFactory, "SubjectFactory_AuctionNotCreated");

    });

    it('Should not be able to place bid when auction is closed', async () => {
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
            feeInputSubjectFactory,
            PCT_BASE,


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

        // fund bidder
        const biddingAmount1 = '1000000'; //moxie
        await moxieToken.connect(owner).transfer(bidder1.address, biddingAmount1);

        await moxieToken.connect(bidder1).approve(easyAuctionAddress, biddingAmount1);
        const queueStartElement1 =
            "0x0000000000000000000000000000000000000000000000000000000000000001";
        await expect(easyAuction.connect(bidder1).placeSellOrders(
            auctionId,
            [auctionInput.initialSupply],//subject token
            [biddingAmount1], // moxie token
            [queueStartElement1],
            '0x',
        )).to.revertedWith("no longer in order placement phase");

    });

    it('Claim tokens', async () => {
        const {
            subjectFactory,
            owner,
            auctionDuration,
            moxiePassVerifierAddress,
            moxieToken,
            subject,
            tokenManager,
            easyAuction,
            SubjectERC20,
            bidder1,
            easyAuctionAddress,
            reserveRatio,
            feeInputSubjectFactory,
            PCT_BASE,


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
        await expect (easyAuction.connect(bidder1).placeSellOrders(
            auctionId,
            [auctionInput.initialSupply],//subject token
            [biddingAmount], // moxie token
            [queueStartElement],
            '0x',
        )).to.emit(easyAuction, "NewSellOrder").withArgs(
            auctionId,
            2,
            auctionInput.initialSupply,
            biddingAmount
        );

        let subjectToken = SubjectERC20.attach(subjectTokenAddress) as SubjectERC20;

        // Verify that bidder balance is reduced
        expect(await subjectToken.balanceOf(bidder1.address)).to.equal(0);
        expect(await subjectToken.balanceOf(easyAuctionAddress)).to.equal(auctionInput.initialSupply);

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
            expectedSubjectFee,
        );

        // Claim tokens
        const sellOrders = [
            {
              sellAmount: BigNumber.from(biddingAmount),
              buyAmount: BigNumber.from(auctionInput.initialSupply),
              userId: BigNumber.from(2),
            },
        ];

        await claimFromAllOrders(easyAuction, auctionId, sellOrders);

        // Verify that bidder balance is increased and auction balance is reduced
        expect(await subjectToken.balanceOf(bidder1.address)).to.equal(auctionInput.initialSupply);
        expect(await subjectToken.balanceOf(easyAuctionAddress)).to.equal(0);

    });

});

describe("Test Moxie Bonding Curve", () => {
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

        await moxiePass.connect(minter).mint(owner.address,"uri");
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
        ) as unknown as SubjectERC20;

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
        };
    };

    it('buy subject token shares', async () => {
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
                .buyShares(subject.address, buyAmount, buyer.address, 0),
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
                .buyShares(subject.address, buyAmount, buyer2.address, 0),
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

    it("sell subject token shares", async () => {
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
                    .buyShares(subject.address, buyAmount, seller.address, 0),
            ).to.emit(moxieBondingCurve, "SubjectSharePurchased");

            await moxieToken
                .connect(seller2)
                .approve(moxieBondingCurveAddress, buyAmount);
            await expect(
                moxieBondingCurve
                    .connect(seller2)
                    .buyShares(subject.address, buyAmount, seller2.address, 0),
            ).to.emit(moxieBondingCurve, "SubjectSharePurchased");
        };

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
                .sellShares(
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

    

});

export interface Order {
    sellAmount: BigNumber;
    buyAmount: BigNumber;
    userId: BigNumber;
}

export function encodeOrder(order: Order): string {
    return (
      "0x" +
      order.userId.toHexString().slice(2).padStart(16, "0") +
      order.buyAmount.toHexString().slice(2).padStart(24, "0") +
      order.sellAmount.toHexString().slice(2).padStart(24, "0")
    );
}

export const getExpectedSellReturnAndFee = async (
    subjectToken: SubjectERC20,
    vaultInstance: Vault,
    subjectTokenAddress: string,
    moxieTokenAddress: string,
    formula: BancorFormula,
    reserveRatio: number,
    feeInput: any,
    PCT_BASE: bigint,
    buyAmount: bigint
) => {


    const supply = await subjectToken.totalSupply();
    const reserveBeforeBuy = await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress);

    const protocolFee = (BigInt(feeInput.protocolBuyFeePct) * BigInt(buyAmount)) / BigInt(PCT_BASE);
    const subjectFee = (BigInt(feeInput.subjectBuyFeePct) * BigInt(buyAmount)) / BigInt(PCT_BASE);

    const effectiveBuyAmount = BigInt(buyAmount) - protocolFee - subjectFee;

    const expectedShares = await formula.calculatePurchaseReturn(
        supply,
        reserveBeforeBuy,
        reserveRatio,
        effectiveBuyAmount
    );

    return {
        expectedShares,
        protocolFee,
        subjectFee
    }


}

export const getExpectedBuyReturnAndFee = async (
    subjectToken: SubjectERC20,
    vaultInstance: Vault,
    subjectTokenAddress: string,
    moxieTokenAddress: string,
    formula: BancorFormula,
    reserveRatio: number,
    feeInput: any,
    PCT_BASE: bigint,
    sellAmount: bigint
) => {

    const supply = await subjectToken.totalSupply();
    const reserveBeforeSell = await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress);

    const returnAmount = await formula.calculateSaleReturn(
        supply,
        reserveBeforeSell,
        reserveRatio,
        sellAmount
    );

    const protocolFee = (BigInt(feeInput.protocolSellFeePct) * BigInt(returnAmount)) / BigInt(PCT_BASE);
    const subjectFee = (BigInt(feeInput.subjectSellFeePct) * BigInt(returnAmount)) / BigInt(PCT_BASE);

    return {
        returnAmount,
        protocolFee,
        subjectFee
    };

}

export async function claimFromAllOrders(
    easyAuction: EasyAuction,
    auctionId: BigNumberish,
    orders: Order[],
  ): Promise<void> {
    for (const order of orders) {
      await easyAuction.claimFromParticipantOrder(auctionId, [
        encodeOrder(order),
      ]);
    }
  }