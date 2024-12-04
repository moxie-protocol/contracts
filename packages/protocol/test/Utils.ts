import { BancorFormula, SubjectERC20, Vault } from "../typechain-types";
import hre from "hardhat";
import { ethers } from "ethers";
const { Interface } = ethers;
export const getExpectedSellReturnAndFee = async (
    subjectToken: SubjectERC20,
    vaultInstance: Vault,
    subjectTokenAddress: string,
    moxieTokenAddress: string,
    formula: BancorFormula,
    reserveRatio: number,
    feeInput: any,
    PCT_BASE: bigint,
    sellAmount: bigint,
    referralFeeInput?: any
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
    
    if(referralFeeInput) {
        return {
            returnAmount,
            protocolFee,
            subjectFee,
            platformReferrerFee: (BigInt(referralFeeInput.platformReferrerSellFeePct) * BigInt(protocolFee)) / BigInt(PCT_BASE),
            orderReferrrerFee: (BigInt(referralFeeInput.orderReferrerSellFeePct) * BigInt(protocolFee)) / BigInt(PCT_BASE),
        }
    }

    return {
        returnAmount,
        protocolFee,
        subjectFee,
        platformReferrerFee: 0,
        orderReferrrerFee: 0
    }

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
    buyAmount: bigint,
    referralFeeInput?: any
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

    
    if(referralFeeInput) {
        return {
            expectedShares,
            protocolFee,
            subjectFee,
            platformReferrerFee: (BigInt(referralFeeInput.platformReferrerBuyFeePct) * BigInt(protocolFee)) / BigInt(PCT_BASE),
            orderReferrrerFee: (BigInt(referralFeeInput.orderReferrerBuyFeePct) * BigInt(protocolFee)) / BigInt(PCT_BASE),
        }
    }

    return {
        expectedShares,
        protocolFee,
        subjectFee,
        platformReferrerFee: 0,
        orderReferrrerFee: 0
    }


}

// 1. depositAndLock
export const getDepositAndLockCalldata = (_subject: string, _amount: ethers.BigNumberish, _lockPeriod: ethers.BigNumberish): string => {
    const abi = ["function depositAndLock(address _subject, uint256 _amount, uint256 _lockPeriod)"];
    const iface = new Interface(abi);
    return iface.encodeFunctionData("depositAndLock", [_subject, _amount, _lockPeriod]);
}

// 2. buyAndLock
export const getBuyAndLockCalldata = (_subject: string, _depositAmount: ethers.BigNumberish, _minReturnAmountAfterFee: ethers.BigNumberish, _lockPeriod: ethers.BigNumberish): string => {
    const abi = ["function buyAndLock(address _subject, uint256 _depositAmount, uint256 _minReturnAmountAfterFee, uint256 _lockPeriod)"];
    const iface = new Interface(abi);
    return iface.encodeFunctionData("buyAndLock", [_subject, _depositAmount, _minReturnAmountAfterFee, _lockPeriod]);
}

// 3. withdraw
export const getWithdrawCalldata = (_indexes: ethers.BigNumberish[], _subject: string): string => {
    const abi = ["function withdraw(uint256[] memory _indexes, address _subject)"];
    const iface = new Interface(abi);
    return iface.encodeFunctionData("withdraw", [_indexes, _subject]);
}

// 4. extendLock
export const getExtendLockCalldata = (_indexes: ethers.BigNumberish[], _subject: string, _lockPeriod: ethers.BigNumberish): string => {
    const abi = ["function extendLock(uint256[] memory _indexes, address _subject, uint256 _lockPeriod)"];
    const iface = new Interface(abi);
    return iface.encodeFunctionData("extendLock", [_indexes, _subject, _lockPeriod]);
}


export const getApproveCalldata = (_spender: string, _amount: ethers.BigNumberish): string => {
    const abi = ["function approve(address _spender, uint256 _amount)"];
    const iface = new Interface(abi);
    return iface.encodeFunctionData("approve", [_spender, _amount]);
}