import { BancorFormula, SubjectERC20, Vault } from "../typechain-types";
import { MoxieTokenLockWallet } from "../test-artifact/MoxieTokenLockWallet.sol/typechain/MoxieTokenLockWallet";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { MoxieTokenLockManager } from "../test-artifact/MoxieTokenLockManager.sol/typechain/MoxieTokenLockManager";
import { BigNumber} from "@ethersproject/bignumber";
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

export const deployVestingContract = async (
    moxieTokenLockManager: MoxieTokenLockManager,
    owner: HardhatEthersSigner,
    vestingBeneficiary: string,
    managedAmount: bigint,
    startTime: number,
    endTime: number,
    periods: number,
    releaseStartTime: number,
    vestingCliffTime: number,
    revocable: number
) => {
    const tx = await moxieTokenLockManager
        .connect(owner)
        .createTokenLockWallet(
            owner.address,
            vestingBeneficiary,
            managedAmount,
            startTime,
            endTime,
            periods,
            releaseStartTime,
            vestingCliffTime,
            revocable
        );
    // console.log(`> Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait(1); // 1 confirmations
    const vestingContractAddress = receipt.logs[0].args[0];

    return vestingContractAddress;
}

export const assertVestingContractData = async (
    vestingContract: MoxieTokenLockWallet,
    owner: string,
    vestingBeneficiary: string,
    managedAmount: bigint,
    startTime: number,
    endTime: number,
    periods: number,
    releaseStartTime: number,
    vestingCliffTime: number,
    revocable: number
) => {
    expect(await vestingContract.owner()).to.equal(owner);
    expect(await vestingContract.beneficiary()).to.equal(vestingBeneficiary);
    expect(await vestingContract.managedAmount()).to.equal(managedAmount);
    expect(await vestingContract.startTime()).to.equal(startTime);
    expect(await vestingContract.endTime()).to.equal(endTime);
    expect(await vestingContract.periods()).to.equal(periods);
    expect(await vestingContract.releaseStartTime()).to.equal(releaseStartTime);
    expect(await vestingContract.vestingCliffTime()).to.equal(vestingCliffTime);
    expect(await vestingContract.revocable()).to.equal(revocable);
}

export function encodeOrder(order: Order): string {
    return (
      "0x" +
      order.userId.toHexString().slice(2).padStart(16, "0") +
      order.buyAmount.toHexString().slice(2).padStart(24, "0") +
      order.sellAmount.toHexString().slice(2).padStart(24, "0")
    );
 }
 
 export interface Order {
    sellAmount: BigNumber;
    buyAmount: BigNumber;
    userId: BigNumber;
 }