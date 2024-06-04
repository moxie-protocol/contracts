import { constants, Wallet } from 'ethers'
import { deployments, ethers } from 'hardhat'
import { expect } from 'chai'

import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'

import { MoxieTokenLockManager } from '../build/typechain/contracts/MoxieTokenLockManager'
import { MoxieTokenLockWallet } from '../build/typechain/contracts/MoxieTokenLockWallet'
import { MoxieTokenMock } from '../build/typechain/contracts/MoxieTokenMock'
import { StakingMock } from '../build/typechain/contracts/StakingMock'
import { MoxiePassTokenMock } from '../build/typechain/contracts/MoxiePassTokenMock'

import { Account, getAccounts, toMOXIE } from './network'
import { defaultInitArgs, TokenLockParameters } from './config'
import { setupTest, authProtocolFunctions } from './helper'


describe('airdrop contract', () => {

    /*
       * TEST SUMMARY AIRDROP CONTRACT
       * deploy vesting contract (vesting schedule)
       * create new vesting schedule (180 tokens)
       * should be able to see unvested and allocated tokens
       * check that vested amount is 0
       * wait till first vesting period
       * check that vested amount is 1
       * check the unvested amount should be 179
       * check that owner cannot revoke vested and unvested tokens
       * check that only beneficiary can try to release vested tokens
       * check that beneficiary cannot release more than the vested amount
       * release 1 token and check that a Transfer event is emitted with a value of 1
       * check that the released amount is 1
       * set current time after the end of the vesting period
       * check that the vested amount is 179 (180 - 1 released tokens)
       * release all vested tokens (179) and check that a Transfer event is emitted with a value of 179
       * check that the number of released tokens is 180
       * check that the vested amount is 0
    */

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
      const contractAddress = receipt.events?.[0]?.args?.['proxy'];
      return ethers.getContractAt('MoxieTokenLockWallet', contractAddress) as Promise<MoxieTokenLockWallet>
    }
  
    before(async function () {
      [deployer, beneficiary, hacker] = await getAccounts()
    })
  
    beforeEach(async () => {
      ({ moxie: moxie, tokenLockManager, staking , moxiePassToken} = await setupTest())
  
        // Setup authorized functions in Manager
        await authProtocolFunctions(tokenLockManager, staking.address)
  
        initArgs = defaultInitArgs(deployer, beneficiary, moxie, toMOXIE('180'))

        // Change the initArgs to the current time and 6 months from now
        // Current epoch time for startTime
        const currentTime = Math.floor(Date.now() / 1000)
        initArgs.startTime = currentTime
        initArgs.endTime = currentTime + 15768000
        initArgs.periods = 180
        
      tokenLock = await initWithArgs(initArgs)
    })

});
