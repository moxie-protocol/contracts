
import { BigNumber, constants, Wallet } from 'ethers'
import { deployments, ethers } from 'hardhat'
import { expect } from 'chai'

import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'

import { MoxieTokenLockManager } from '../build/typechain/contracts/MoxieTokenLockManager'
import { MoxieTokenLockWallet } from '../build/typechain/contracts/MoxieTokenLockWallet'
import { MoxieTokenMock } from '../build/typechain/contracts/MoxieTokenMock'
import { StakingMock } from '../build/typechain/contracts/StakingMock'
import { MoxiePassTokenMock } from '../build/typechain/contracts/MoxiePassTokenMock'

import { Staking__factory } from '@graphprotocol/contracts/dist/types/factories/Staking__factory'

import { Account, advanceBlocks, advanceTimeAndBlock, formatMOXIE, getAccounts, getContract, randomHexBytes, toMOXIE } from './network'
import { defaultInitArgs, Revocability, TokenLockParameters } from './config'
import { DeployOptions } from 'hardhat-deploy/types'
import { setupTest, authProtocolFunctions, addAndVerifyTokenDestination, removeAndVerifyTokenDestination , advanceToStart, advancePeriods} from './helper'
import { Staking } from '@graphprotocol/contracts/dist/types/Staking'

const { AddressZero, MaxUint256 } = constants


// -- Tests --

describe('MoxieTokenLockWallet', () => {
  let deployer: Account
  let beneficiary: Account
  let hacker: Account

  let moxie: MoxieTokenMock
  let tokenLock: MoxieTokenLockWallet
  let tokenLockManager: MoxieTokenLockManager
  let moxiePassToken: MoxiePassTokenMock
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
    const contractAddress = receipt.events[0].args['proxy']
    return ethers.getContractAt('MoxieTokenLockWallet', contractAddress) as Promise<MoxieTokenLockWallet>
  }

  before(async function () {
    [deployer, beneficiary, hacker] = await getAccounts()
  })

  beforeEach(async () => {
    ({ moxie: moxie, tokenLockManager, staking , moxiePassToken} = await setupTest())

    // Setup authorized functions in Manager
    await authProtocolFunctions(tokenLockManager, staking.address)

    initArgs = defaultInitArgs(deployer, beneficiary, moxie, toMOXIE('35000000'))
    tokenLock = await initWithArgs(initArgs)
  })

  describe('Init', function () {
    it('should bubble up revert reasons on create', async function () {
      initArgs = defaultInitArgs(deployer, beneficiary, moxie, toMOXIE('35000000'))
      const tx = initWithArgs({ ...initArgs, endTime: 0 })
      await expect(tx).revertedWith('Start time > end time')
    })
  })

  describe('MoxiePassToken NFT check', function () {
    it('Should have moxie pass token nft after successful lock creation', async function () {
      const balanceResult = await moxiePassToken.balanceOf(tokenLock.address)
      expect(balanceResult).to.equal(1)
    })
  })

  describe('Admin functions', function () {
    it('should set manager', async function () {
      // Note: we use MOXIE contract here just to provide a different contract
      const oldManager = await tokenLock.manager()
      const tx = tokenLock.connect(deployer.signer).setManager(moxie.address)
      await expect(tx).emit(tokenLock, 'ManagerUpdated').withArgs(oldManager, moxie.address)
      expect(await tokenLock.manager()).eq(moxie.address)
    })

    it('reject set manager to a non-contract', async function () {
      const newAddress = randomHexBytes(20)
      const tx = tokenLock.connect(deployer.signer).setManager(newAddress)
      await expect(tx).revertedWith('Manager must be a contract')
    })

    it('reject set manager to empty address', async function () {
      const tx = tokenLock.connect(deployer.signer).setManager(AddressZero)
      await expect(tx).revertedWith('Manager cannot be empty')
    })
  })

  describe('Beneficiary functions', function () {
    beforeEach(async function () {
      await tokenLockManager.addTokenDestination(staking.address)
    })

    describe('Enabling protocol', function () {
      it('should approve protocol contracts', async function () {
        const tx = tokenLock.connect(beneficiary.signer).approveProtocol()
        await expect(tx).emit(moxie, 'Approval').withArgs(tokenLock.address, staking.address, MaxUint256)
      })
  
      it('should revoke protocol contracts', async function () {
        const tx = tokenLock.connect(beneficiary.signer).revokeProtocol()
        await expect(tx).emit(moxie, 'Approval').withArgs(tokenLock.address, staking.address, 0)
      })
  
      it('reject approve and revoke if not the beneficiary', async function () {
        const tx1 = tokenLock.connect(deployer.signer).approveProtocol()
        await expect(tx1).revertedWith('!auth')
  
        const tx2 = tokenLock.connect(deployer.signer).revokeProtocol()
        await expect(tx2).revertedWith('!auth')
      })
    })

    describe('Function call forwarding', function () {
      let lockAsStaking: Staking
  
      beforeEach(async () => {
        // Use the tokenLock contract as if it were the Staking contract
        lockAsStaking = Staking__factory.connect(tokenLock.address, deployer.signer)

        // Approve contracts to pull tokens from the token lock
        await tokenLock.connect(beneficiary.signer).approveProtocol()
      })
  
      it('should call an authorized function (stake)', async function () {
        // Before state
        const beforeLockBalance = await moxie.balanceOf(lockAsStaking.address)
  
        // Stake must work and the deposit address must be the one of the lock contract
        const stakeAmount = toMOXIE('100')
        const tx = lockAsStaking.connect(beneficiary.signer).stake(stakeAmount)
        await expect(tx).emit(staking, 'StakeDeposited').withArgs(tokenLock.address, stakeAmount)
  
        // After state
        const afterLockBalance = await moxie.balanceOf(lockAsStaking.address)
        expect(afterLockBalance).eq(beforeLockBalance.sub(stakeAmount))
      })
  
      it('should bubble up revert reasons for forwarded calls', async function () {
        // Force a failing call
        const tx = lockAsStaking.connect(beneficiary.signer).stake(toMOXIE('0'))
        await expect(tx).revertedWith('!tokens')
      })
  
      it('reject a function call from other than the beneficiary', async function () {
        // Send a function call from an unauthorized caller
        const stakeAmount = toMOXIE('100')
        const tx = lockAsStaking.connect(hacker.signer).stake(stakeAmount)
        await expect(tx).revertedWith('Unauthorized caller')
      })
  
      it('reject a function call that is not authorized', async function () {
        // Send a function call that is not authorized in the TokenLockManager
        const tx = lockAsStaking.connect(beneficiary.signer).setController(randomHexBytes(20))
        await expect(tx).revertedWith('Unauthorized function')
      })
    })

    describe('Revokability, Call Forwarding and Used Tokens', function () {
      let lockAsStaking: Staking

      beforeEach(async () => {
        // Deploy a revocable contract with 10 periods, 1 per month
        initArgs = defaultInitArgs(deployer, beneficiary, moxie, toMOXIE('10000'))
        tokenLock = await initWithArgs({ ...initArgs, periods: 10, revocable: Revocability.Enabled })
  
        // Use the tokenLock contract as if it were the Staking contract
        lockAsStaking = Staking__factory.connect(tokenLock.address, deployer.signer)
  
        // Approve contracts to pull tokens from the token lock
        await tokenLock.connect(beneficiary.signer).approveProtocol()
      })
  
      it('reject using more than vested amount in the protocol', async function () {
        await advanceToStart(tokenLock)
  
        // At this point no period has passed so we haven't vested any token
        // Try to stake funds into the protocol should fail
        const stakeAmount = toMOXIE('1000')
        const tx = lockAsStaking.connect(beneficiary.signer).stake(stakeAmount)
        await expect(tx).revertedWith('Cannot use more tokens than vested amount')
      })
  
      it('should release considering what is used in the protocol', async function () {
        // Move to have some vested periods
        await advanceToStart(tokenLock)
        await advancePeriods(tokenLock, 2)
  
        // Get amount that can be released with no used tokens yet
        const releasableAmount = await tokenLock.releasableAmount()
  
        // Use tokens in the protocol
        const stakeAmount = toMOXIE('1000')
        await lockAsStaking.connect(beneficiary.signer).stake(stakeAmount)
  
        // Release - should take into account used tokens
        const tx = await tokenLock.connect(beneficiary.signer).release()
        await expect(tx)
          .emit(tokenLock, 'TokensReleased')
          .withArgs(beneficiary.address, releasableAmount.sub(stakeAmount))
  
        // Revoke should work
        await tokenLock.connect(deployer.signer).revoke()
      })
  
      it('should release considering what is used in the protocol (even if most is used)', async function () {
        // Move to have some vested periods
        await advanceToStart(tokenLock)
        await advancePeriods(tokenLock, 2)
  
        // Get amount that can be released with no used tokens yet
        const releasableAmount = await tokenLock.releasableAmount()
  
        // Use tokens in the protocol
        const stakeAmount = (await tokenLock.availableAmount()).sub(toMOXIE('1'))
        await lockAsStaking.connect(beneficiary.signer).stake(stakeAmount)
  
        // Release - should take into account used tokens
        const tx = await tokenLock.connect(beneficiary.signer).release()
        await expect(tx)
          .emit(tokenLock, 'TokensReleased')
          .withArgs(beneficiary.address, releasableAmount.sub(stakeAmount))
  
        // Revoke should work
        await tokenLock.connect(deployer.signer).revoke()
      })
    })

    describe('Invest while you vest - revocability enabled', function () {
      let lockAsStaking: Staking
      beforeEach(async () => {
        // Deploy a revocable contract with 10 periods, 1 per month
        initArgs = defaultInitArgs(deployer, beneficiary, moxie, toMOXIE('10000'))
        tokenLock = await initWithArgs({ ...initArgs, periods: 10, revocable: Revocability.Enabled })
  
        // Use the tokenLock contract as if itCannot use more tokens than vested amoun were the Staking contract
        lockAsStaking = Staking__factory.connect(tokenLock.address, deployer.signer)
  
        // Approve contracts to pull tokens from the token lock
        await tokenLock.connect(beneficiary.signer).approveProtocol()
      })
  
      it('should not allow to invest - unvested tokens - revocability enabled', async function () {
        await advanceToStart(tokenLock)
        await advancePeriods(tokenLock, 1)
  
        // At this point we vested one period, we have tokens
        // Stake funds into the protocol
        const stakeAmount = toMOXIE('2000')
        const tx = lockAsStaking.connect(beneficiary.signer).stake(stakeAmount, {gasLimit: 1000000})
        await expect(tx).to.be.revertedWith('Cannot use more tokens than vested amount')
      })
  
      it('should get surplus profit amount received from protocol investing - revocability enabled', async function () {
        await advanceToStart(tokenLock)
        await advancePeriods(tokenLock, 2)
  
        // At this point we vested one period, we have tokens
        // Stake funds into the protocol
        const stakeAmount = toMOXIE('2000')
        await lockAsStaking.connect(beneficiary.signer).stake(stakeAmount)
  
        // Simulate having a profit
        await moxie.approve(staking.address, toMOXIE('10000'))
        await staking.stakeTo(lockAsStaking.address, toMOXIE('10000'))
  
        // Unstake more than we used in the protocol, this should work!
        await lockAsStaking.connect(beneficiary.signer).unstake(toMOXIE('10000'))
        await advanceBlocks(20)
        await lockAsStaking.connect(beneficiary.signer).withdraw()
  
        const surplus = await tokenLock.connect(beneficiary.signer).surplusAmount()
        expect(surplus).to.equal(toMOXIE('8000'))
      })
  
      it('should exclude loss received from protocol investing - revocability enabled', async function () {
        await advanceToStart(tokenLock)
        await advancePeriods(tokenLock, 2)
  
        const beforeReleasableAmount = await tokenLock.releasableAmount()
  
        // At this point we vested one period, we have tokens
        // Stake funds into the protocol
        const stakeAmount = toMOXIE('2000')
        await lockAsStaking.connect(beneficiary.signer).stake(stakeAmount)
       
        // Simulate having a loss
        await moxie.approve(staking.address, toMOXIE('1000'))
        await staking.stakeTo(lockAsStaking.address, toMOXIE('1000'))
  
        await lockAsStaking.connect(beneficiary.signer).unstake(toMOXIE('1000'))
        await advanceBlocks(20)
        await lockAsStaking.connect(beneficiary.signer).withdraw()
  
        const afterReleasableAmount = await tokenLock.releasableAmount()
        expect(afterReleasableAmount).to.equal(toMOXIE('1000'))
  
        await advancePeriods(tokenLock, 10)
        const finalReleasableAmount = await tokenLock.releasableAmount()
        expect(finalReleasableAmount).to.equal(toMOXIE('9000'))
  
      })
    })

    describe('Invest while you vest - revocability disabled', function () {
      let lockAsStaking: Staking
      beforeEach(async () => {
        // Deploy a revocable contract with 6 periods, 1 per month
        initArgs = defaultInitArgs(deployer, beneficiary, moxie, toMOXIE('10000'))
        tokenLock = await initWithArgs({ ...initArgs, periods: 10, revocable: Revocability.Disabled })
  
        // Use the tokenLock contract as if itCannot use more tokens than vested amoun were the Staking contract
        lockAsStaking = Staking__factory.connect(tokenLock.address, deployer.signer)
  
        // Approve contracts to pull tokens from the token lock
        await tokenLock.connect(beneficiary.signer).approveProtocol()
      })
  
      it('should allow to invest unvested tokens as well - revocability disabled', async function () {
        await advanceToStart(tokenLock)
        await advancePeriods(tokenLock, 1)
  
        // At this point we vested one period, we have tokens
        // Stake funds into the protocol
        const stakeAmount = toMOXIE('2000')
        const tx = await lockAsStaking.connect(beneficiary.signer).stake(stakeAmount)
      })
  
      it('revert if invest amount is greater than the token lock wallet balance - revocability disabled', async function () {
        await advanceToStart(tokenLock)
        await advancePeriods(tokenLock, 1)
  
        // At this point we vested one period, we have tokens
        // Stake funds into the protocol
        const stakeAmount = toMOXIE('50000000')
        const tx = lockAsStaking.connect(beneficiary.signer).stake(stakeAmount, {gasLimit: 1000000})
        await expect(tx).to.be.revertedWith('ERC20: transfer amount exceeds balance')
      })
  
      it('should get surplus profit amount received from protocol investing - revocability disabled', async function () {
        await advanceToStart(tokenLock)
        await advancePeriods(tokenLock, 2)
  
        // At this point we vested one period, we have tokens
        // Stake funds into the protocol
        const stakeAmount = toMOXIE('5000')
        await lockAsStaking.connect(beneficiary.signer).stake(stakeAmount)
  
        // Simulate having a profit
        await moxie.approve(staking.address, toMOXIE('10000'))
        await staking.stakeTo(lockAsStaking.address, toMOXIE('10000'))
  
        // Unstake more than we used in the protocol, this should work!
        await lockAsStaking.connect(beneficiary.signer).unstake(toMOXIE('10000'))
        await advanceBlocks(20)
        await lockAsStaking.connect(beneficiary.signer).withdraw()
  
        const surplus = await tokenLock.connect(beneficiary.signer).surplusAmount()
        expect(surplus).to.equal(toMOXIE('5000'))
       
      })

      it('should exclude loss received from protocol investing - revocability disabled', async function () {
        await advanceToStart(tokenLock)
        await advancePeriods(tokenLock, 2)
  
        const beforeReleasableAmount = await tokenLock.releasableAmount()
      //  console.log('beforeReleasableAmount', formatMOXIE(beforeReleasableAmount))
        const currentBalance = await tokenLock.currentBalance()
      //  console.log('currentBalance', formatMOXIE(currentBalance))
  
        // At this point we vested one period, we have tokens
        // Stake funds into the protocol
        const stakeAmount = toMOXIE('5000')
        await lockAsStaking.connect(beneficiary.signer).stake(stakeAmount)

        const releasedAmount = await tokenLock.releasedAmount()
       // console.log('releasedAmount', formatMOXIE(releasedAmount))
  
        // Simulate having a loss
        await moxie.approve(staking.address, toMOXIE('1000'))
        await staking.stakeTo(lockAsStaking.address, toMOXIE('1000'))

        const currentBalanceAfterStake = await tokenLock.currentBalance()
       // console.log('currentBalanceAfterStake', formatMOXIE(currentBalanceAfterStake))
  
        await lockAsStaking.connect(beneficiary.signer).unstake(toMOXIE('1000'))
        await advanceBlocks(20)
        await lockAsStaking.connect(beneficiary.signer).withdraw()

        const currentBalanceAfterUnStake = await tokenLock.currentBalance()
      //  console.log('currentBalanceAfterUnStake', formatMOXIE(currentBalanceAfterUnStake))
  
        //const afterReleasableAmount = await tokenLock.releasableAmount()
       // console.log('afterReleasableAmount', formatMOXIE(afterReleasableAmount))
       // expect(afterReleasableAmount).to.equal(toMOXIE('1000'))

       await advancePeriods(tokenLock, 5)
       const releaseAmountAt8thPeriod = await tokenLock.releasableAmount()
      // console.log('currentPeriod', await tokenLock.currentPeriod())
       //console.log('releaseAmountAt8thPeriod', formatMOXIE(releaseAmountAt8thPeriod))
       expect(releaseAmountAt8thPeriod).to.equal(toMOXIE('6000'))
  
        await advancePeriods(tokenLock, 10)
        const finalReleasableAmount = await tokenLock.releasableAmount()
        expect(finalReleasableAmount).to.equal(toMOXIE('6000'))
      })
    })
  })
})
