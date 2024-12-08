import { expect } from "chai";
import hre, { ethers } from "hardhat";
import EasyAuctionArtifact from "../test-artifact/easy-auction/artifacts/contracts/EasyAuction.sol/EasyAuction.json";
import { EasyAuction } from "../test-artifact/easy-auction/typechain/EasyAuction";
import { BigNumber} from "@ethersproject/bignumber";
import { network } from 'hardhat';
import { BigNumberish } from "ethers";
import { SubjectERC20 } from "../typechain-types";



describe('Subject Onboarding Test', () => {


    const deploy = async () => {

        const chainIdHex = await network.provider.send('eth_chainId');
        const chainId = parseInt(chainIdHex, 16);
        console.log("Using deployed contracts on chainId: ", chainId);

        const [deployer, owner, minter, feeBeneficiary, subject, bidder1, bidder2] = await ethers.getSigners();

        // initialize variables
        let moxieBondingCurve;
        let subjectFactory;
        let tokenManager;
        let moxiePass;
        let moxieToken;
        let vaultInstance;
        let moxieTokenAddress;
        let formulaAddress;
        let tokenManagerAddress;
        let vaultAddress;
        let formula;
        let subjectFactoryAddress;
        let moxieBondingCurveAddress;
        let easyAuctionAddress;
        let moxiePassAddress;
        let subjectErc20Address;
        let moxiePassVerifierAddress;
        const SubjectERC20 = await hre.ethers.getContractFactory("SubjectERC20");

        moxieBondingCurveAddress = "0xc3216954C25d18a366A67A86c64C7db9c8D62e45";
        moxieBondingCurve = await hre.ethers.getContractAt("MoxieBondingCurve", moxieBondingCurveAddress);

        moxieTokenAddress = "0xF2DdE6E0AdCBEa7A5c523a52bbE48B378fd88B77"
        formulaAddress = "0x574Faa295548D72A0f418C0e048126fc35092d7e"
        tokenManagerAddress = "0x374F9809147A57CbaE5E3EDcd612540acF264330"
        vaultAddress = "0xEBA41D777c97FDEFd02FaCD1D1F70938d671208C"
        subjectFactoryAddress = "0xaC73C366cB18E0DF6b3775EF3872442568A80040"
        easyAuctionAddress = "0xAfDA05dc699BdaF77B4c8E324a6269c1896dEB96"
        moxiePassAddress = "0xFf2A168F71B3772cBDfa73904440F43D83105384"
        subjectErc20Address = "0x31B90e8Ac800F66368834196771bA47460daD424"
        moxiePassVerifierAddress = "0xB6CD414e563F3255485B3a5785bA2881Da4E6B30"

        subjectFactory = await hre.ethers.getContractAt("SubjectFactory", subjectFactoryAddress);
        tokenManager = await hre.ethers.getContractAt("TokenManager", tokenManagerAddress);
        const easyAuction: EasyAuction = await hre.ethers.getContractAt(EasyAuctionArtifact.abi, easyAuctionAddress) as unknown as EasyAuction;
        moxiePass = await hre.ethers.getContractAt("MoxiePass", moxiePassAddress);
        moxieToken = await hre.ethers.getContractAt("MoxieToken", moxieTokenAddress);
        vaultInstance = await hre.ethers.getContractAt("Vault", vaultAddress);
        formula = await hre.ethers.getContractAt("BancorFormula", formulaAddress);


        const protocolBuyFeePct = (1e16).toString(); // 1%
        const protocolSellFeePct = (2 * 1e16).toString(); // 2%
        const subjectBuyFeePct = (3 * 1e16).toString(); // 3%
        const subjectSellFeePct = (4 * 1e16).toString(); // 4%
        const auctionDuration = 100;
        const auctionCancellationDuration = 900;
        const reserveRatio = 660000;

        const feeInput = {
            protocolBuyFeePct,
            protocolSellFeePct,
            subjectBuyFeePct,
            subjectSellFeePct,
        };

        const feeInputSubjectFactory = {
            protocolFeePct: protocolBuyFeePct,
            subjectFeePct: subjectBuyFeePct
        }

        await tokenManager.connect(owner).grantRole(await tokenManager.CREATE_ROLE(), subjectFactoryAddress);
        await tokenManager
            .connect(owner)
            .grantRole(await tokenManager.MINT_ROLE(), subjectFactoryAddress);

            await tokenManager
            .connect(owner)
            .grantRole(await tokenManager.MINT_ROLE(), moxieBondingCurveAddress);

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
            chainId,
        };

    }

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
        } = await deploy();


        expect(await subjectFactory.hasRole(await subjectFactory.DEFAULT_ADMIN_ROLE(), owner.address)).to.true;
        expect(await subjectFactory.easyAuction()).to.equal(easyAuctionAddress);
        expect(await subjectFactory.tokenManager()).to.equal(tokenManagerAddress);
        expect(await subjectFactory.moxieBondingCurve()).to.equal(moxieBondingCurveAddress);
        expect(await subjectFactory.token()).to.equal(moxieTokenAddress);
        expect(await subjectFactory.subjectFeePct()).equal(feeInputSubjectFactory.subjectFeePct);
        expect(await subjectFactory.protocolFeePct()).equal(feeInputSubjectFactory.protocolFeePct);
        expect(await subjectFactory.feeBeneficiary()).equal(feeBeneficiary.address);
        expect(await subjectFactory.auctionDuration()).equal(60);
        expect(await subjectFactory.auctionOrderCancellationDuration()).equal(60);

    });


});

describe("Test Bonding Curve", () => {
    const deploy = async () => {
        const [
            deployer,
            owner,
            minter,
            subject,
            feeBeneficiary,
            buyer,
            seller,
            buyer2,
            seller2,
            buyer3,
            seller3,
        ] = await ethers.getSigners();

        // initialize variables
        let moxieBondingCurve;
        let tokenManager;
        let moxiePass;
        let moxieToken;
        let vaultInstance;
        let moxieTokenAddress;
        let formulaAddress;
        let tokenManagerAddress;
        let vaultAddress;
        let formula;
        let subjectFactoryAddress;
        let easyAuctionAddress;
        let moxiePassAddress;
        let subjectErc20Address;
        let moxiePassVerifierAddress;
        let moxiePassVerifier;
        const SubjectERC20 = await hre.ethers.getContractFactory("SubjectERC20");

        const moxieBondingCurveAddress = "0xc3216954C25d18a366A67A86c64C7db9c8D62e45";
        moxieBondingCurve = await hre.ethers.getContractAt("MoxieBondingCurve", moxieBondingCurveAddress);

        moxieTokenAddress = "0xF2DdE6E0AdCBEa7A5c523a52bbE48B378fd88B77"
        formulaAddress = "0x574Faa295548D72A0f418C0e048126fc35092d7e"
        tokenManagerAddress = "0x374F9809147A57CbaE5E3EDcd612540acF264330"
        vaultAddress = "0xEBA41D777c97FDEFd02FaCD1D1F70938d671208C"
        subjectFactoryAddress = "0xaC73C366cB18E0DF6b3775EF3872442568A80040"
        easyAuctionAddress = "0xAfDA05dc699BdaF77B4c8E324a6269c1896dEB96"
        moxiePassAddress = "0xFf2A168F71B3772cBDfa73904440F43D83105384"
        subjectErc20Address = "0x31B90e8Ac800F66368834196771bA47460daD424"
        moxiePassVerifierAddress = "0xB6CD414e563F3255485B3a5785bA2881Da4E6B30"

        const subjectFactory = await hre.ethers.getContractAt("SubjectFactory", subjectFactoryAddress);
        tokenManager = await hre.ethers.getContractAt("TokenManager", tokenManagerAddress);
        moxiePass = await hre.ethers.getContractAt("MoxiePass", moxiePassAddress);
        moxieToken = await hre.ethers.getContractAt("MoxieToken", moxieTokenAddress);
        vaultInstance = await hre.ethers.getContractAt("Vault", vaultAddress);
        formula = await hre.ethers.getContractAt("BancorFormula", formulaAddress);
        moxiePassVerifier = await hre.ethers.getContractAt("MoxiePassVerifier", moxiePassVerifierAddress);

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

        const reserveRatio = 660000;
        const initialSupply = "10000000000000000000000";
        const initialReserve = "10000000000000000000000";

        const subjectTokenAddress = await tokenManager.tokens(subject.address);
        const subjectToken = SubjectERC20.attach(
            subjectTokenAddress,
        ) as unknown as SubjectERC20;

        await tokenManager
            .connect(owner)
            .grantRole(await tokenManager.CREATE_ROLE(), subjectFactoryAddress);

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
            buyer3,
            seller3,
        };
    };

    it('buy subject tokens', async () => {
        const setupBuy = async (deployment: any) => {
            const {
            } = deployment;

        };

        const deployment = await deploy();
        const {
            moxieBondingCurve,
            subject,
            moxieToken,
            moxieBondingCurveAddress,
            subjectTokenAddress,
            buyer,
            moxieTokenAddress,
            subjectToken,
            vaultInstance,
            feeInput,
            PCT_BASE,
            owner
        } = deployment;

        await setupBuy(deployment);

        const buyAmount = 100;

        await moxieToken
            .connect(buyer)
            .approve(moxieBondingCurveAddress, buyAmount);
        
        // fund buyer
        await moxieToken
            .connect(owner)
            .transfer(buyer.address, buyAmount);

        const supply = await subjectToken.totalSupply();
        const reserveBeforeBuy = await vaultInstance.balanceOf(
            subjectTokenAddress,
            moxieTokenAddress,
        );

        const expectedShares = BigInt(51);
        const protocolFee = (BigInt(feeInput.protocolBuyFeePct) * BigInt(buyAmount)) / BigInt(PCT_BASE);
        const subjectFee = (BigInt(feeInput.subjectBuyFeePct) * BigInt(buyAmount)) / BigInt(PCT_BASE);

        const effectiveBuyAmount = BigInt(buyAmount) - protocolFee - subjectFee;

        // first buyer
        await moxieToken
            .connect(buyer)
            .approve(moxieBondingCurveAddress, buyAmount);

        // buyer before balance
        const buyerBeforeBalance = await subjectToken.balanceOf(buyer.address)

        await expect(
            moxieBondingCurve
                .connect(buyer)
                .buyShares(subject.address, buyAmount, buyer.address, 0, { gasLimit: 1000000 }),
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
        
        // verify that buyer has received the correct number of shares
        const buyerAfterBalance = await subjectToken.balanceOf(buyer.address)
        expect(buyerAfterBalance).to.be.greaterThan(buyerBeforeBalance);
        expect(buyerAfterBalance).to.be.equal(buyerBeforeBalance + expectedShares);

        // verify that the vault has received the correct amount of moxie tokens
        expect(
            await vaultInstance.balanceOf(subjectTokenAddress, moxieTokenAddress),
        ).equal(BigInt(reserveBeforeBuy) + effectiveBuyAmount);

        // verify that the total supply of the subject token has increased by the correct amount
        expect(await subjectToken.totalSupply()).equal(supply + expectedShares);

    });

    it("sell subject tokens", async () => {
        const setupSell = async (deployment: any) => {
            const {
            } = deployment;

        };

        const deployment = await deploy();
        const {
            moxieBondingCurve,
            subject,
            moxieToken,
            moxieBondingCurveAddress,
            subjectTokenAddress,
            moxieTokenAddress,
            subjectToken,
            seller,
            owner
        } = deployment;

        await setupSell(deployment);

        const buyAmount = 100;

        await moxieToken
            .connect(seller)
            .approve(moxieBondingCurveAddress, buyAmount);

        // fund buyer
        await moxieToken
            .connect(owner)
            .transfer(seller.address, buyAmount);

        await expect(
            moxieBondingCurve
                .connect(seller)
                .buyShares(subject.address, buyAmount, seller.address, 0),
        ).to.emit(moxieBondingCurve, "SubjectSharePurchased");

        const totalSellAmountSeller1 = await subjectToken.balanceOf(
            seller.address,
        );

        // seller 1
        const expectedReturn = 90;

        await subjectToken
            .connect(seller)
            .approve(moxieBondingCurveAddress, totalSellAmountSeller1);

        const sellerPreviousMoxieBalance = await moxieToken.balanceOf(
            seller.address,
        );

        const supply = await subjectToken.totalSupply();
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
        
        // verify that seller has received the correct number of moxie tokens back
        expect(await moxieToken.balanceOf(seller.address)).to.equal(
            BigInt(sellerPreviousMoxieBalance) + BigInt(90),
        );

        // verify that the total supply of the subject token has increased by the correct amount
        expect(await subjectToken.totalSupply()).to.equal(supply - totalSellAmountSeller1);

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
