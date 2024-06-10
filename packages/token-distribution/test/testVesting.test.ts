import { ethers } from 'hardhat'
import { expect } from 'chai'

import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'

import { MoxieTokenLockManager } from '../build/typechain/contracts/MoxieTokenLockManager'
import { MoxieTokenLockWallet } from '../build/typechain/contracts/MoxieTokenLockWallet'
import { MoxieTokenMock } from '../build/typechain/contracts/MoxieTokenMock'
import { StakingMock } from '../build/typechain/contracts/StakingMock'

import { Account, getAccounts, toMOXIE } from './network'
import { defaultInitArgs, TokenLockParameters } from './config'
import { setupTest, authProtocolFunctions, advancePeriods } from './helper'


describe('Airdrop Contract', () => {

    /*
       * TEST SUMMARY AIRDROP CONTRACT
       * deploy vesting contract (vesting schedule)
       * create new vesting schedule (180 tokens)
       * should be able to see unvested tokens as 180
       * check that vested amount is 0
       * check that releasable amount is 0
       * check that released amount is 0
       * wait till first vesting period and check that vested amount is 1
       * check that releasable amount is 1
       * check the unvested amount should be 179
       * check that owner cannot revoke vested and unvested tokens
       * release 1 token and check that a Transfer event is emitted with a value of 1
       * check that the released amount is 1
       * vest all tokens and check that the vested amount is 180
       * check that the releasable amount is 179
       * release all releasable tokens and check that a Transfer event is emitted with a value of 179
       * check after releasing all tokens the unvested amount is 0
       * check after releasing all tokens the releasable amount is 0
       * check after releasing all tokens beneficiary should not be able to release more tokens
    */

    let deployer: Account
    let beneficiary: Account
  
    let moxie: MoxieTokenMock
    let tokenLock: MoxieTokenLockWallet
    let tokenLockManager: MoxieTokenLockManager
    let staking: StakingMock
  
    let initArgs: TokenLockParameters

    const initWithArgs = async (args: TokenLockParameters): Promise<MoxieTokenLockWallet> => {
      const tx = await tokenLockManager.createTokenLockWallet(
        args.owner,
        args.beneficiary,
        args.managedAmount,
        args.startTime,
        args.endTime,
        args.periods,
        args.releaseStartTime,
        args.vestingCliffTime,
        args.revocable,
      )
      const receipt = await tx.wait()
      const contractAddress = receipt.events?.[0]?.args?.['proxy'];
      return ethers.getContractAt('MoxieTokenLockWallet', contractAddress) as Promise<MoxieTokenLockWallet>
    }
  
    before(async function () {
        [deployer, beneficiary] = await getAccounts();

        ({ moxie, tokenLockManager, staking } = await setupTest())
  
        // Setup authorized functions in Manager
        await authProtocolFunctions(tokenLockManager, staking.address);

        initArgs = defaultInitArgs(deployer, beneficiary, moxie, toMOXIE('180'));

        // Change the initArgs to the current time and 6 months from now
        // Current epoch time for startTime
        const currentTime = Math.floor(Date.now() / 1000);
        initArgs.startTime = currentTime;
        initArgs.endTime = currentTime + 15768000;
        initArgs.periods = 180;
            
        tokenLock = await initWithArgs(initArgs);
    })
  
    it('should be able to see unvested tokens as 180', async function () {
        const managedAmount = await tokenLock.managedAmount()
        const availableAmount = await tokenLock.availableAmount()
        const unVestedAmount = managedAmount.sub(availableAmount)
        expect(unVestedAmount).to.equal(toMOXIE('180'))
    })

    it('check that vested amount is 0', async function () {
        const availableAmount = await tokenLock.availableAmount()
        expect(availableAmount).to.equal(0)
    })

    it('check that releasable amount is 0', async function () {
        const releasableAmount = await tokenLock.releasableAmount()
        expect(releasableAmount).to.equal(0)
    })

    it('check that released amount is 0', async function () {
        const releasedAmount = await tokenLock.releasedAmount()
        expect(releasedAmount).to.equal(0)
    })

    it('wait till first vesting period and check that vested amount is 1', async function () {
        // Increase time by 1 day
        await advancePeriods(tokenLock, 1)

        const availableAmount = await tokenLock.availableAmount()
        expect(availableAmount).to.equal(toMOXIE('1'))
    })

    it('check that releasable amount is 1', async function () {
        const releasableAmount = await tokenLock.releasableAmount()
        expect(releasableAmount).to.equal(toMOXIE('1'))
    })

    it('check the unvested amount should be 179', async function () {
        const managedAmount = await tokenLock.managedAmount()
        const availableAmount = await tokenLock.availableAmount()
        const unVestedAmount = managedAmount.sub(availableAmount)
        expect(unVestedAmount).to.equal(toMOXIE('179'))
    })

    it('check that owner cannot revoke vested and unvested tokens', async function () {
        const tx = tokenLock.connect(deployer.signer).revoke()
        await expect(tx).revertedWith('Contract is non-revocable')
    })

    it('release 1 token and check that a Transfer event is emitted with a value of 1', async function () {
        const tx = tokenLock.connect(beneficiary.signer).release()
        await expect(tx).emit(tokenLock, 'TokensReleased').withArgs(beneficiary.address, toMOXIE('1'))
    })

    it('check that the released amount is 1', async function () {
        const releasedAmount = await tokenLock.releasedAmount()
        expect(releasedAmount).to.equal(toMOXIE('1'))
    })

    it('vest all tokens and check that the vested amount is 180', async function () {
        // Increase time by 179 day
        await advancePeriods(tokenLock, 179)

        const availableAmount = await tokenLock.availableAmount()
        expect(availableAmount).to.equal(toMOXIE('180'))
    })

    it('check that the releasable amount is 179', async function () {
        const releasableAmount = await tokenLock.releasableAmount()
        expect(releasableAmount).to.equal(toMOXIE('179'))
    })

    it('release all releasable tokens and check that a Transfer event is emitted with a value of 179', async function () {
        const tx = tokenLock.connect(beneficiary.signer).release()
        await expect(tx).emit(tokenLock, 'TokensReleased').withArgs(beneficiary.address, toMOXIE('179'))
    })

    it('check after releasing all tokens the unvested amount is 0', async function () {
        const managedAmount = await tokenLock.managedAmount()
        const availableAmount = await tokenLock.availableAmount()
        const unVestedAmount = managedAmount.sub(availableAmount)
        expect(unVestedAmount).to.equal(0)
    })

    it('check after releasing all tokens the releasable amount is 0', async function () {
        const releasableAmount = await tokenLock.releasableAmount()
        expect(releasableAmount).to.equal(0)
    })

    it('check after releasing all tokens beneficiary should not be able to release more tokens', async function () {
        const amountToRelease = await tokenLock.releasableAmount()
        const tx = tokenLock.connect(beneficiary.signer).release()
        await expect(tx).revertedWith('No available releasable amount')
    })

});


describe('Investor Contract 1 Year', () => {

    /*
       * TEST SUMMARY INVESTOR CONTRACT 1 YEAR
       * deploy vesting contract (vesting schedule)
       * create new vesting schedule (166.7 tokens)
            suppossing we are providing 1000 tokens for 2 years
       * should be able to see unvested tokens as 166.7
       * check that vested amount is 0
       * check that releasable amount is 0
       * check that released amount is 0
       * wait till 365 days and check that vested amount is 0
       * check that releasable amount is 0
       * check the unvested amount should be 166.7
       * check that owner cannot revoke vested and unvested tokens
       * wait till 370 days and check the vested amount is 27.78
       * check that releasable amount is 27.78
       * release 27.78 token and check that a Transfer event is emitted with a value of 27.78
       * check that the released amount is 27.78
       * vest all tokens and check that the vested amount is 166.7
       * check that the releasable amount is 138.91
       * release all releasable tokens and check that a Transfer event is emitted with a value of 138.91
       * check after releasing all tokens the unvested amount is 0
       * check after releasing all tokens the releasable amount is 0
       * check after releasing all tokens beneficiary should not be able to release more tokens
    */

    let deployer: Account
    let beneficiary: Account
  
    let moxie: MoxieTokenMock
    let tokenLock: MoxieTokenLockWallet
    let tokenLockManager: MoxieTokenLockManager
    let staking: StakingMock
  
    let initArgs: TokenLockParameters

    const initWithArgs = async (args: TokenLockParameters): Promise<MoxieTokenLockWallet> => {
      const tx = await tokenLockManager.createTokenLockWallet(
        args.owner,
        args.beneficiary,
        args.managedAmount,
        args.startTime,
        args.endTime,
        args.periods,
        args.releaseStartTime,
        args.vestingCliffTime,
        args.revocable,
      )
      const receipt = await tx.wait()
      const contractAddress = receipt.events?.[0]?.args?.['proxy'];
      return ethers.getContractAt('MoxieTokenLockWallet', contractAddress) as Promise<MoxieTokenLockWallet>
    }
  
    before(async function () {
        [deployer, beneficiary] = await getAccounts();

        ({ moxie, tokenLockManager, staking } = await setupTest())
  
        // Setup authorized functions in Manager
        await authProtocolFunctions(tokenLockManager, staking.address);

        initArgs = defaultInitArgs(deployer, beneficiary, moxie, toMOXIE('166.7'));

        // Change the initArgs to the startTime to start after 1 year
        // Current epoch time for startTime
        const currentTime = Math.floor(Date.now() / 1000);
        const secondsInAYear = 365 * 24 * 60 * 60;
        const currentTimePlusOneYear = currentTime + secondsInAYear;
        const secondsIn30Days = 30 * 24 * 60 * 60; // 30 days in seconds
        initArgs.startTime = currentTimePlusOneYear;
        initArgs.endTime = currentTimePlusOneYear + secondsIn30Days;
        initArgs.periods = 30;
            
        tokenLock = await initWithArgs(initArgs);
    })

    it('should be able to see unvested tokens as 166.7', async function () {
        const managedAmount = await tokenLock.managedAmount()
        const availableAmount = await tokenLock.availableAmount()
        const unVestedAmount = managedAmount.sub(availableAmount)
        expect(unVestedAmount).to.equal(toMOXIE('166.7'))
    })

    it('check that vested amount is 0', async function () {
        const availableAmount = await tokenLock.availableAmount()
        expect(availableAmount).to.equal(0)
    })

    it('check that releasable amount is 0', async function () {
        const releasableAmount = await tokenLock.releasableAmount()
        expect(releasableAmount).to.equal(0)
    })

    it('check that released amount is 0', async function () {
        const releasedAmount = await tokenLock.releasedAmount()
        expect(releasedAmount).to.equal(0)
    })

    it('wait till 365 days and check that vested amount is 0', async function () {
        // Increase time by 365 days
        await advancePeriods(tokenLock, 365)

        const availableAmount = await tokenLock.availableAmount()
        expect(availableAmount).to.equal(0)
    })

    it('check that releasable amount is 0', async function () {
        const releasableAmount = await tokenLock.releasableAmount()
        expect(releasableAmount).to.equal(0)
    })

    it('check the unvested amount should be 166.7', async function () {
        const managedAmount = await tokenLock.managedAmount()
        const availableAmount = await tokenLock.availableAmount()
        const unVestedAmount = managedAmount.sub(availableAmount)
        expect(unVestedAmount).to.equal(toMOXIE('166.7'))
    })

    it('check that owner cannot revoke vested and unvested tokens', async function () {
        const tx = tokenLock.connect(deployer.signer).revoke()
        await expect(tx).revertedWith('Contract is non-revocable')
    })

    it('wait till 370 days and check the vested amount is 27.78', async function () {
        // Increase time by 5 days
        await advancePeriods(tokenLock, 5)

        const availableAmount = await tokenLock.availableAmount()
        expect(availableAmount).to.equal('27783333333333333330')
    })

    it('check that releasable amount is 27.78', async function () {
        const releasableAmount = await tokenLock.releasableAmount()
        expect(releasableAmount).to.equal('27783333333333333330')
    })

    it('release 27.78 token and check that a Transfer event is emitted with a value of 27.78', async function () {
        const tx = tokenLock.connect(beneficiary.signer).release()
        await expect(tx).emit(tokenLock, 'TokensReleased').withArgs(beneficiary.address, '27783333333333333330')
    })

    it('check that the released amount is 27.78', async function () {
        const releasedAmount = await tokenLock.releasedAmount()
        expect(releasedAmount).to.equal('27783333333333333330')
    })

    it('vest all tokens and check that the vested amount is 166.7', async function () {
        // Increase time by 25 days
        await advancePeriods(tokenLock, 25)

        const availableAmount = await tokenLock.availableAmount()
        expect(availableAmount).to.equal(toMOXIE('166.7'))
    })

    it('check that the releasable amount is 138.91', async function () {
        const releasableAmount = await tokenLock.releasableAmount()
        expect(releasableAmount).to.equal('138916666666666666670')
    })

    it('release all releasable tokens and check that a Transfer event is emitted with a value of 138.91', async function () {
        const tx = tokenLock.connect(beneficiary.signer).release()
        await expect(tx).emit(tokenLock, 'TokensReleased').withArgs(beneficiary.address, '138916666666666666670')
    })

    it('check after releasing all tokens the unvested amount is 0', async function () {
        const managedAmount = await tokenLock.managedAmount()
        const availableAmount = await tokenLock.availableAmount()
        const unVestedAmount = managedAmount.sub(availableAmount)
        expect(unVestedAmount).to.equal(0)
    })

    it('check after releasing all tokens the releasable amount is 0', async function () {
        const releasableAmount = await tokenLock.releasableAmount()
        expect(releasableAmount).to.equal(0)
    })

    it('check after releasing all tokens beneficiary should not be able to release more tokens', async function () {
        const amountToRelease = await tokenLock.releasableAmount()
        const tx = tokenLock.connect(beneficiary.signer).release()
        await expect(tx).revertedWith('No available releasable amount')
    })
  

});


describe('Investor Contract 2 Year', () => {

    /*
       * TEST SUMMARY INVESTOR CONTRACT 2 YEAR
       * deploy vesting contract (vesting schedule)
       * create new vesting schedule (833.3 tokens)
            suppossing we are providing 1000 tokens for 2 years
       * should be able to see unvested tokens as 833.3
       * check that vested amount is 0
       * check that releasable amount is 0
       * check that released amount is 0
       * wait till 395 days and check that vested amount is 0
       * check that releasable amount is 0
       * check the unvested amount should be 833.3
       * check that owner cannot revoke vested and unvested tokens
       * wait till 400 days and check the vested amount is 12.63
       * check that releasable amount is 12.63
       * release 12.63 token and check that a Transfer event is emitted with a value of 12.63
       * check that the released amount is 12.63
       * vest all tokens and check that the vested amount is 833.3
       * check that the releasable amount is 820.67
       * release all releasable tokens and check that a Transfer event is emitted with a value of 820.67
       * check after releasing all tokens the unvested amount is 0
       * check after releasing all tokens the releasable amount is 0
       * check after releasing all tokens beneficiary should not be able to release more tokens
    */

    let deployer: Account
    let beneficiary: Account
  
    let moxie: MoxieTokenMock
    let tokenLock: MoxieTokenLockWallet
    let tokenLockManager: MoxieTokenLockManager
    let staking: StakingMock
  
    let initArgs: TokenLockParameters

    const initWithArgs = async (args: TokenLockParameters): Promise<MoxieTokenLockWallet> => {
      const tx = await tokenLockManager.createTokenLockWallet(
        args.owner,
        args.beneficiary,
        args.managedAmount,
        args.startTime,
        args.endTime,
        args.periods,
        args.releaseStartTime,
        args.vestingCliffTime,
        args.revocable,
      )
      const receipt = await tx.wait()
      const contractAddress = receipt.events?.[0]?.args?.['proxy'];
      return ethers.getContractAt('MoxieTokenLockWallet', contractAddress) as Promise<MoxieTokenLockWallet>
    }
  
    before(async function () {
        [deployer, beneficiary] = await getAccounts();

        ({ moxie, tokenLockManager, staking } = await setupTest())
  
        // Setup authorized functions in Manager
        await authProtocolFunctions(tokenLockManager, staking.address);

        initArgs = defaultInitArgs(deployer, beneficiary, moxie, toMOXIE('833.3'));

        // Change the initArgs to the startTime to start after 13 months
        // Current epoch time for startTime
        const currentTime = Math.floor(Date.now() / 1000);
        const secondsInAYear = 395 * 24 * 60 * 60;
        const currentTimePlusOneYear = currentTime + secondsInAYear;
        const secondsIn11Months = 330 * 24 * 60 * 60; // 330 days in seconds
        initArgs.startTime = currentTimePlusOneYear;
        initArgs.endTime = currentTimePlusOneYear + secondsIn11Months;
        initArgs.periods = 330;
            
        tokenLock = await initWithArgs(initArgs);
    })

    it('should be able to see unvested tokens as 833.3', async function () {
        const managedAmount = await tokenLock.managedAmount()
        const availableAmount = await tokenLock.availableAmount()
        const unVestedAmount = managedAmount.sub(availableAmount)
        expect(unVestedAmount).to.equal(toMOXIE('833.3'))
    })

    it('check that vested amount is 0', async function () {
        const availableAmount = await tokenLock.availableAmount()
        expect(availableAmount).to.equal(0)
    })

    it('check that releasable amount is 0', async function () {
        const releasableAmount = await tokenLock.releasableAmount()
        expect(releasableAmount).to.equal(0)
    })

    it('check that released amount is 0', async function () {
        const releasedAmount = await tokenLock.releasedAmount()
        expect(releasedAmount).to.equal(0)
    })

    it('wait till 395 days and check that vested amount is 0', async function () {
        // Increase time by 395
        await advancePeriods(tokenLock, 395)

        const availableAmount = await tokenLock.availableAmount()
        expect(availableAmount).to.equal(0)
    })

    it('check that releasable amount is 0', async function () {
        const releasableAmount = await tokenLock.releasableAmount()
        expect(releasableAmount).to.equal(0)
    })

    it('check the unvested amount should be 833.3', async function () {
        const managedAmount = await tokenLock.managedAmount()
        const availableAmount = await tokenLock.availableAmount()
        const unVestedAmount = managedAmount.sub(availableAmount)
        expect(unVestedAmount).to.equal(toMOXIE('833.3'))
    })

    it('check that owner cannot revoke vested and unvested tokens', async function () {
        const tx = tokenLock.connect(deployer.signer).revoke()
        await expect(tx).revertedWith('Contract is non-revocable')
    })

    it('wait till 400 days and check the vested amount is 12.63', async function () {
        // Increase time by 5 days
        await advancePeriods(tokenLock, 5)

        const availableAmount = await tokenLock.availableAmount()
        expect(availableAmount).to.equal('12625757575757575755')
    })

    it('check that releasable amount is 12.63', async function () {
        const releasableAmount = await tokenLock.releasableAmount()
        expect(releasableAmount).to.equal('12625757575757575755')
    })

    it('release 12.63 token and check that a Transfer event is emitted with a value of 12.63', async function () {
        const tx = tokenLock.connect(beneficiary.signer).release()
        await expect(tx).emit(tokenLock, 'TokensReleased').withArgs(beneficiary.address, '12625757575757575755')
    })

    it('check that the released amount is 12.63', async function () {
        const releasedAmount = await tokenLock.releasedAmount()
        expect(releasedAmount).to.equal('12625757575757575755')
    })

    it('vest all tokens and check that the vested amount is 833.3', async function () {
        // Increase time by 1 year
        await advancePeriods(tokenLock, 325)

        const availableAmount = await tokenLock.availableAmount()
        expect(availableAmount).to.equal(toMOXIE('833.3'))
    })

    it('check that the releasable amount is 820.67', async function () {
        const releasableAmount = await tokenLock.releasableAmount()
        expect(releasableAmount).to.equal('820674242424242424245')
    })

    it('release all releasable tokens and check that a Transfer event is emitted with a value of 820.67', async function () {
        const tx = tokenLock.connect(beneficiary.signer).release()
        await expect(tx).emit(tokenLock, 'TokensReleased').withArgs(beneficiary.address, '820674242424242424245')
    })

    it('check after releasing all tokens the unvested amount is 0', async function () {
        const managedAmount = await tokenLock.managedAmount()
        const availableAmount = await tokenLock.availableAmount()
        const unVestedAmount = managedAmount.sub(availableAmount)
        expect(unVestedAmount).to.equal(0)
    })

    it('check after releasing all tokens the releasable amount is 0', async function () {
        const releasableAmount = await tokenLock.releasableAmount()
        expect(releasableAmount).to.equal(0)
    })

    it('check after releasing all tokens beneficiary should not be able to release more tokens', async function () {
        const amountToRelease = await tokenLock.releasableAmount()
        const tx = tokenLock.connect(beneficiary.signer).release()
        await expect(tx).revertedWith('No available releasable amount')
    })
  

});
