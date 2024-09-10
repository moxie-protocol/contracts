import { BancorFormula, SubjectERC20, Vault } from "../typechain-types";

export const getExpectedSellReturnAndFee = async (
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

export const getExpectedBuyAmountAndFee = async (
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