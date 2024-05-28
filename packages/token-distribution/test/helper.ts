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

const { AddressZero, MaxUint256 } = constants

// Fixture
export const setupTest = deployments.createFixture(async ({ deployments }) => {
    const deploy = (name: string, options: DeployOptions) => deployments.deploy(name, options)
    const [deployer] = await getAccounts()
  
    // Start from a fresh snapshot
    await deployments.fixture([])
  
    // Deploy token
    await deploy('MoxieTokenMock', {
      from: deployer.address,
      args: [toMOXIE('1000000000'), deployer.address],
    })
    const moxie = await getContract('MoxieTokenMock')
  
    // Deploy token lock masterCopy
    await deploy('MoxieTokenLockWallet', {
      from: deployer.address,
    })
    const tokenLockWallet = await getContract('MoxieTokenLockWallet')
  
    // Deploy moxie pass token
    await deploy('MoxiePassTokenMock', {
      from: deployer.address,
      args: ['Moxie Pass', 'MOXIEPASS'],
    })
    const moxiePassToken = await getContract('MoxiePassTokenMock')
  
    // Deploy token lock manager
    await deploy('MoxieTokenLockManager', {
      from: deployer.address,
      args: [moxie.address, tokenLockWallet.address],
    })
    const tokenLockManager = await getContract('MoxieTokenLockManager')
    
    // set the moxie pass token in the token lock wallet
    await tokenLockManager.connect(deployer.signer).setMoxiePassToken(moxiePassToken.address)
  
    // Protocol contracts
    await deployments.deploy('StakingMock', { from: deployer.address, args: [moxie.address] })
    const staking = await getContract('StakingMock')
  
    // Fund the manager contract
    await moxie.connect(deployer.signer).transfer(tokenLockManager.address, toMOXIE('100000000'))
  
  
    return {
      moxie: moxie as MoxieTokenMock,
      staking: staking as StakingMock,
      tokenLock: tokenLockWallet as MoxieTokenLockWallet,
      tokenLockManager: tokenLockManager as MoxieTokenLockManager,
      moxiePassToken: moxiePassToken as MoxiePassTokenMock,
    }
  })

  // -- Time utils --

export const advancePeriods = async (tokenLock: MoxieTokenLockWallet, n = 1) => {
    const periodDuration = await tokenLock.periodDuration()
    return advanceTimeAndBlock(periodDuration.mul(n).toNumber()) // advance N period
  }
  export const advanceToStart = async (tokenLock: MoxieTokenLockWallet) => moveToTime(tokenLock, await tokenLock.startTime(), 60)
  export const moveToTime = async (tokenLock: MoxieTokenLockWallet, target: BigNumber, buffer: number) => {
    const ts = await tokenLock.currentTime()
    const delta = target.sub(ts).add(buffer)
    return advanceTimeAndBlock(delta.toNumber())
  }
  
  export async function authProtocolFunctions(tokenLockManager: MoxieTokenLockManager, stakingAddress: string) {
    await tokenLockManager.setAuthFunctionCall('stake(uint256)', stakingAddress)
    await tokenLockManager.setAuthFunctionCall('unstake(uint256)', stakingAddress)
    await tokenLockManager.setAuthFunctionCall('withdraw()', stakingAddress)
  }
  
  // Helper function to add a token destination and verify the process
  export const addAndVerifyTokenDestination = async (tokenLockManager: MoxieTokenLockManager, address: string) => {
    expect(await tokenLockManager.isTokenDestination(address)).to.equal(false);
    const tx = tokenLockManager.addTokenDestination(address);
    await expect(tx).to.emit(tokenLockManager, 'TokenDestinationAllowed').withArgs(address, true);
    expect(await tokenLockManager.isTokenDestination(address)).to.equal(true);
  };
  
  export const removeAndVerifyTokenDestination = async (tokenLockManager: MoxieTokenLockManager, address: string) => {
    expect(await tokenLockManager.isTokenDestination(address)).to.equal(true);
    const tx = tokenLockManager.removeTokenDestination(address);
    await expect(tx).to.emit(tokenLockManager, 'TokenDestinationAllowed').withArgs(address, false);
    expect(await tokenLockManager.isTokenDestination(address)).to.equal(false);
  };
  
  export const advanceToEnd = async (tokenLock: MoxieTokenLockWallet) => moveToTime(tokenLock, await tokenLock.endTime(), 60)

  export const advanceToAboutStart = async (tokenLock: MoxieTokenLockWallet) =>
  moveToTime(tokenLock, await tokenLock.startTime(), -60)
    
  export const advanceToReleasable = async (tokenLock: MoxieTokenLockWallet) => {
  const values = await Promise.all([
    tokenLock.vestingCliffTime(),
    tokenLock.releaseStartTime(),
    tokenLock.startTime(),
  ]).then(values => values.map(e => e.toNumber()))
  const time = Math.max(...values)
  await moveToTime(tokenLock, BigNumber.from(time), 60)
}

const forEachPeriod = async (tokenLock: MoxieTokenLockWallet, fn) => {
    const periods = (await tokenLock.periods()).toNumber()
    for (let currentPeriod = 1; currentPeriod <= periods + 1; currentPeriod++) {
      const currentPeriod = await tokenLock.currentPeriod()
      // console.log('\t  ✓ period ->', currentPeriod.toString())
      await fn(currentPeriod.sub(1), currentPeriod)
      await advancePeriods(tokenLock, 1)
    }
  }
  
  const shouldMatchSchedule = async (tokenLock: MoxieTokenLockWallet, fnName: string, initArgs: TokenLockParameters) => {
    await forEachPeriod(tokenLock, async function (passedPeriods: BigNumber) {
      const amount = (await tokenLock.functions[fnName]())[0]
      const amountPerPeriod = await tokenLock.amountPerPeriod()
      const managedAmount = await tokenLock.managedAmount()
  
      // console.log(`\t    - amount: ${formatGRT(amount)}/${formatGRT(managedAmount)}`)
  
      // After last period we expect to have all managed tokens available
      const expectedAmount = passedPeriods.lt(initArgs.periods) ? passedPeriods.mul(amountPerPeriod) : managedAmount
      expect(amount).eq(expectedAmount)
    })
  }