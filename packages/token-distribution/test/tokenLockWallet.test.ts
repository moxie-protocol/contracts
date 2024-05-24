import { BigNumber, constants, Wallet } from 'ethers'
import { deployments, ethers } from 'hardhat'
import { expect } from 'chai'

import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'

import { MoxieTokenLockManager } from '../build/typechain/contracts/MoxieTokenLockManager'
import { MoxieTokenLockWallet } from '../build/typechain/contracts/MoxieTokenLockWallet'
import { MoxieTokenMock } from '../build/typechain/contracts/MoxieTokenMock'
import { StakingMock } from '../build/typechain/contracts/StakingMock'

import { Staking__factory } from '@graphprotocol/contracts/dist/types/factories/Staking__factory'

import { Account, advanceBlocks, advanceTimeAndBlock, getAccounts, getContract, randomHexBytes, toGRT } from './network'
import { defaultInitArgs, Revocability, TokenLockParameters } from './config'
import { DeployOptions } from 'hardhat-deploy/types'

const { AddressZero, MaxUint256 } = constants

// -- Time utils --

const advancePeriods = async (tokenLock: MoxieTokenLockWallet, n = 1) => {
  const periodDuration = await tokenLock.periodDuration()
  return advanceTimeAndBlock(periodDuration.mul(n).toNumber()) // advance N period
}
const advanceToStart = async (tokenLock: MoxieTokenLockWallet) => moveToTime(tokenLock, await tokenLock.startTime(), 60)
const moveToTime = async (tokenLock: MoxieTokenLockWallet, target: BigNumber, buffer: number) => {
  const ts = await tokenLock.currentTime()
  const delta = target.sub(ts).add(buffer)
  return advanceTimeAndBlock(delta.toNumber())
}

// Fixture
const setupTest = deployments.createFixture(async ({ deployments }) => {
  const deploy = (name: string, options: DeployOptions) => deployments.deploy(name, options)
  const [deployer] = await getAccounts()

  // Start from a fresh snapshot
  await deployments.fixture([])

  // Deploy token
  await deploy('MoxieTokenMock', {
    from: deployer.address,
    args: [toGRT('1000000000'), deployer.address],
  })
  const grt = await getContract('MoxieTokenMock')

  // Deploy token lock masterCopy
  await deploy('MoxieTokenLockWallet', {
    from: deployer.address,
  })
  const tokenLockWallet = await getContract('MoxieTokenLockWallet')

  // Deploy token lock manager
  await deploy('MoxieTokenLockManager', {
    from: deployer.address,
    args: [grt.address, tokenLockWallet.address],
  })
  const tokenLockManager = await getContract('MoxieTokenLockManager')

  // Protocol contracts
  await deployments.deploy('StakingMock', { from: deployer.address, args: [grt.address] })
  const staking = await getContract('StakingMock')

  // Fund the manager contract
  await grt.connect(deployer.signer).transfer(tokenLockManager.address, toGRT('100000000'))

  return {
    grt: grt as MoxieTokenMock,
    staking: staking as StakingMock,
    // tokenLock: tokenLockWallet as MoxieTokenLockWallet,
    tokenLockManager: tokenLockManager as MoxieTokenLockManager,
  }
})

async function authProtocolFunctions(tokenLockManager: MoxieTokenLockManager, stakingAddress: string) {
  await tokenLockManager.setAuthFunctionCall('stake(uint256)', stakingAddress)
  await tokenLockManager.setAuthFunctionCall('unstake(uint256)', stakingAddress)
  await tokenLockManager.setAuthFunctionCall('withdraw()', stakingAddress)
}

// -- Tests --

describe('MoxieTokenLockWallet', () => {
  let deployer: Account
  let beneficiary: Account
  let hacker: Account

  let grt: MoxieTokenMock
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
    const contractAddress = receipt.events[0].args['proxy']
    return ethers.getContractAt('MoxieTokenLockWallet', contractAddress) as Promise<MoxieTokenLockWallet>
  }

  before(async function () {
    [deployer, beneficiary, hacker] = await getAccounts()
  })

  beforeEach(async () => {
    ({ grt, tokenLockManager, staking } = await setupTest())

    // Setup authorized functions in Manager
    await authProtocolFunctions(tokenLockManager, staking.address)

    initArgs = defaultInitArgs(deployer, beneficiary, grt, toGRT('35000000'))
    tokenLock = await initWithArgs(initArgs)
  })

  describe('Init', function () {
    it('should bubble up revert reasons on create', async function () {
      initArgs = defaultInitArgs(deployer, beneficiary, grt, toGRT('35000000'))
      const tx = initWithArgs({ ...initArgs, endTime: 0 })
      await expect(tx).revertedWith('Start time > end time')
    })
  })

  describe('TokenLockWallet get functions', function () {
    it('is contract isInitialized', async function () {
      let isInitialized = tokenLock.isInitialized()
      await expect(tx).revertedWith('Start time > end time')
    })
  })

  describe('TokenLockManager', function () {
    it('revert if init with empty token', async function () {
      const deploy = (name: string, options: DeployOptions) => deployments.deploy(name, options)

      const d = deploy('MoxieTokenLockManager', {
        from: deployer.address,
        args: [AddressZero, Wallet.createRandom().address],
      })
      await expect(d).revertedWith('Token cannot be zero')
    })

    it('should set the master copy', async function () {
      const address = Wallet.createRandom().address
      const tx = tokenLockManager.setMasterCopy(address)
      await expect(tx).emit(tokenLockManager, 'MasterCopyUpdated').withArgs(address)
    })

    it('revert set the master copy to zero address', async function () {
      const tx = tokenLockManager.setMasterCopy(AddressZero)
      await expect(tx).revertedWith('MasterCopy cannot be zero')
    })

    it('should add a token destination', async function () {
      const address = Wallet.createRandom().address

      expect(await tokenLockManager.isTokenDestination(address)).eq(false)
      const tx = tokenLockManager.addTokenDestination(address)
      await expect(tx).emit(tokenLockManager, 'TokenDestinationAllowed').withArgs(address, true)
      expect(await tokenLockManager.isTokenDestination(address)).eq(true)
    })

    it('revert add a token destination with zero address', async function () {
      const tx = tokenLockManager.addTokenDestination(AddressZero)
      await expect(tx).revertedWith('Destination cannot be zero')
    })
  })

  describe('Admin wallet', function () {
    it('should set manager', async function () {
      // Note: we use GRT contract here just to provide a different contract
      const oldManager = await tokenLock.manager()
      const tx = tokenLock.connect(deployer.signer).setManager(grt.address)
      await expect(tx).emit(tokenLock, 'ManagerUpdated').withArgs(oldManager, grt.address)
      expect(await tokenLock.manager()).eq(grt.address)
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

  describe('Enabling protocol', function () {
    beforeEach(async function () {
      await tokenLockManager.addTokenDestination(staking.address)
    })

    it('should approve protocol contracts', async function () {
      const tx = tokenLock.connect(beneficiary.signer).approveProtocol()
      await expect(tx).emit(grt, 'Approval').withArgs(tokenLock.address, staking.address, MaxUint256)
    })

    it('should revoke protocol contracts', async function () {
      const tx = tokenLock.connect(beneficiary.signer).revokeProtocol()
      await expect(tx).emit(grt, 'Approval').withArgs(tokenLock.address, staking.address, 0)
    })

    it('reject approve and revoke if not the beneficiary', async function () {
      const tx1 = tokenLock.connect(deployer.signer).approveProtocol()
      await expect(tx1).revertedWith('!auth')

      const tx2 = tokenLock.connect(deployer.signer).revokeProtocol()
      await expect(tx2).revertedWith('!auth')
    })
  })

  describe('Function call forwarding', function () {
    let lockAsStaking

    beforeEach(async () => {
      // Use the tokenLock contract as if it were the Staking contract
      lockAsStaking = Staking__factory.connect(tokenLock.address, deployer.signer)

      // Add the staking contract as token destination
      await tokenLockManager.addTokenDestination(staking.address)

      // Approve contracts to pull tokens from the token lock
      await tokenLock.connect(beneficiary.signer).approveProtocol()
    })

    it('should call an authorized function (stake)', async function () {
      // Before state
      const beforeLockBalance = await grt.balanceOf(lockAsStaking.address)

      // Stake must work and the deposit address must be the one of the lock contract
      const stakeAmount = toGRT('100')
      const tx = lockAsStaking.connect(beneficiary.signer).stake(stakeAmount)
      await expect(tx).emit(staking, 'StakeDeposited').withArgs(tokenLock.address, stakeAmount)

      // After state
      const afterLockBalance = await grt.balanceOf(lockAsStaking.address)
      expect(afterLockBalance).eq(beforeLockBalance.sub(stakeAmount))
    })

    it('should bubble up revert reasons for forwarded calls', async function () {
      // Force a failing call
      const tx = lockAsStaking.connect(beneficiary.signer).stake(toGRT('0'))
      await expect(tx).revertedWith('!tokens')
    })

    it('reject a function call from other than the beneficiary', async function () {
      // Send a function call from an unauthorized caller
      const stakeAmount = toGRT('100')
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
    let lockAsStaking

    beforeEach(async () => {
      // Deploy a revocable contract with 6 periods, 1 per month
      initArgs = defaultInitArgs(deployer, beneficiary, grt, toGRT('10000000'))
      tokenLock = await initWithArgs({ ...initArgs, periods: 6, revocable: Revocability.Enabled })

      // Use the tokenLock contract as if it were the Staking contract
      lockAsStaking = Staking__factory.connect(tokenLock.address, deployer.signer)

      // Add the staking contract as token destination
      await tokenLockManager.addTokenDestination(staking.address)

      // Approve contracts to pull tokens from the token lock
      await tokenLock.connect(beneficiary.signer).approveProtocol()
    })

    it('reject using more than vested amount in the protocol', async function () {
      await advanceToStart(tokenLock)

      // At this point no period has passed so we haven't vested any token
      // Try to stake funds into the protocol should fail
      const stakeAmount = toGRT('100')
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
      const stakeAmount = toGRT('100')
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
      const stakeAmount = (await tokenLock.availableAmount()).sub(toGRT('1'))
      await lockAsStaking.connect(beneficiary.signer).stake(stakeAmount)

      // Release - should take into account used tokens
      const tx = await tokenLock.connect(beneficiary.signer).release()
      await expect(tx)
        .emit(tokenLock, 'TokensReleased')
        .withArgs(beneficiary.address, releasableAmount.sub(stakeAmount))

      // Revoke should work
      await tokenLock.connect(deployer.signer).revoke()
    })

    it('should allow to get profit from the protocol', async function () {
      await advanceToStart(tokenLock)
      await advancePeriods(tokenLock, 1)

      // At this point we vested one period, we have tokens
      // Stake funds into the protocol
      const stakeAmount = toGRT('100')
      await lockAsStaking.connect(beneficiary.signer).stake(stakeAmount)

      // Simulate having a profit
      await grt.approve(staking.address, toGRT('1000000'))
      await staking.stakeTo(lockAsStaking.address, toGRT('1000000'))

      // Unstake more than we used in the protocol, this should work!
      await lockAsStaking.connect(beneficiary.signer).unstake(toGRT('1000000'))
      await advanceBlocks(20)
      await lockAsStaking.connect(beneficiary.signer).withdraw()
    })
  })

  describe('xyz', function () {
    let lockAsStaking

    beforeEach(async () => {
      // Deploy a revocable contract with 6 periods, 1 per month
      initArgs = defaultInitArgs(deployer, beneficiary, grt, toGRT('10000000'))
      tokenLock = await initWithArgs({ ...initArgs, periods: 6, revocable: Revocability.Enabled })

      // Use the tokenLock contract as if it were the Staking contract
      lockAsStaking = Staking__factory.connect(tokenLock.address, deployer.signer)

      // Add the staking contract as token destination
      await tokenLockManager.addTokenDestination(staking.address)

      // Approve contracts to pull tokens from the token lock
      await tokenLock.connect(beneficiary.signer).approveProtocol()
    })

  })
})
