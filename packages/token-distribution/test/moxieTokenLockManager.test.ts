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
import { DeployOptions } from 'hardhat-deploy/types'
import { setupTest, authProtocolFunctions, addAndVerifyTokenDestination, removeAndVerifyTokenDestination } from './helper'

const { AddressZero } = constants


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

  describe('TokenLockManager', function () {
    it('revert if init with empty token', async function () {
      const deploy = (name: string, options: DeployOptions) => deployments.deploy(name, options)

      const d = deploy('MoxieTokenLockManager', {
        from: deployer.address,
        args: [AddressZero, Wallet.createRandom().address],
      })
      await expect(d).revertedWith('Token cannot be zero')
    })

    describe('Master copy', function () {
      it('should set the master copy', async function () {
        const address = Wallet.createRandom().address
        const tx = tokenLockManager.setMasterCopy(address)
        await expect(tx).emit(tokenLockManager, 'MasterCopyUpdated').withArgs(address)
      })
  
      it('revert set the master copy to zero address', async function () {
        const tx = tokenLockManager.setMasterCopy(AddressZero)
        await expect(tx).revertedWith('MasterCopy cannot be zero')
      })
    })

    // token destinations
    describe('Token destinations', function () {
      it('should add a token destination', async function () {
        const address = Wallet.createRandom().address;
        await addAndVerifyTokenDestination(tokenLockManager, address);
      });
  
      it('revert if token destination is already added', async function () {
        const address = Wallet.createRandom().address;
        await addAndVerifyTokenDestination(tokenLockManager, address);
        const duplicatedTx = tokenLockManager.addTokenDestination(address);
        await expect(duplicatedTx).to.be.revertedWith('Destination already added');
      });
      it('revert add a token destination with zero address', async function () {
        const tx = tokenLockManager.addTokenDestination(AddressZero)
        await expect(tx).revertedWith('Destination cannot be zero')
      })
      it('should return true if token destination is added', async function () {
        const address = Wallet.createRandom().address;
        await addAndVerifyTokenDestination(tokenLockManager, address);
        const tx = await tokenLockManager.isTokenDestination(address);
        await expect(tx).equal(true)
      })
      it('should return false if token destination is  not present', async function () {
        const address = Wallet.createRandom().address;
        const tx = await tokenLockManager.isTokenDestination(address);
        await expect(tx).equal(false);
      })
      it('should remove a token destination', async function () {
        const address = Wallet.createRandom().address;
        await addAndVerifyTokenDestination(tokenLockManager, address);
        await removeAndVerifyTokenDestination(tokenLockManager, address);
      })
      it('revert if token destination is already removed', async function () {
        const address = Wallet.createRandom().address;
        await addAndVerifyTokenDestination(tokenLockManager, address);
        await removeAndVerifyTokenDestination(tokenLockManager, address)
        const duplicatedTx = tokenLockManager.removeTokenDestination(address);
        await expect(duplicatedTx).revertedWith('Destination already removed')
      });
      it('should return the configured token destinations correctly', async function () {
        const address = Wallet.createRandom().address;
        await addAndVerifyTokenDestination(tokenLockManager, address);
        const destinations = await tokenLockManager.getTokenDestinations();
        expect(destinations).to.include(address);
      })

    })

    describe('function call auth', function () {
      it('should set an authorized function call', async function () {
        const tx = tokenLockManager.setAuthFunctionCall('stake(uint256)', staking.address)
        await expect(tx).emit(tokenLockManager, 'FunctionCallAuth').withArgs(deployer.address, '0xa694fc3a', staking.address, 'stake(uint256)')
        const address = await tokenLockManager.getAuthFunctionCallTarget('0xa694fc3a')
        expect(address).to.equal(staking.address)
        const authCallresponse = await tokenLockManager.isAuthFunctionCall('0xa694fc3a')
        expect(authCallresponse).to.equal(true)
      })
      it('revert if token lock manager address is used as protocal address', async function () {
        const tx = tokenLockManager.setAuthFunctionCall('stake(uint256)', tokenLockManager.address)
        await expect(tx).revertedWith('Target must be other contract')
      })
      it('revert if protocal address is not a contract', async function () {
        const randomAddress = Wallet.createRandom().address;
        const tx = tokenLockManager.setAuthFunctionCall('stake(uint256)', randomAddress)
        await expect(tx).revertedWith('Target must be a contract')
      })
      it('should unset an authorized function call', async function () {
        const tx = tokenLockManager.setAuthFunctionCall('stake(uint256)', staking.address)
        await expect(tx).emit(tokenLockManager, 'FunctionCallAuth').withArgs(deployer.address, '0xa694fc3a', staking.address, 'stake(uint256)')
        const tx2 = tokenLockManager.unsetAuthFunctionCall('stake(uint256)')
        await expect(tx2).emit(tokenLockManager, 'FunctionCallAuth').withArgs(deployer.address, '0xa694fc3a', AddressZero, 'stake(uint256)')
        const address = await tokenLockManager.getAuthFunctionCallTarget('0xa694fc3a')
        expect(address).to.equal(AddressZero)
        const authCallresponse = await tokenLockManager.isAuthFunctionCall('0xa694fc3a')
        expect(authCallresponse).to.equal(false)
      })
      it('should set multiple authorized function calls using setAuthFunctionCallMany', async function () {
        const tx = tokenLockManager.setAuthFunctionCallMany(['stake(uint256)', 'unstake(uint256)'], [staking.address, staking.address])
        await expect(tx).emit(tokenLockManager, 'FunctionCallAuth').withArgs(deployer.address, '0xa694fc3a', staking.address, 'stake(uint256)')
        await expect(tx).emit(tokenLockManager, 'FunctionCallAuth').withArgs(deployer.address, '0x2e17de78', staking.address, 'unstake(uint256)')
      })
      it('revert if array lengths are not matching using setAuthFunctionCallMany', async function () {
        const tx = tokenLockManager.setAuthFunctionCallMany(['stake(uint256)', 'unstake(uint256)'], [staking.address])
        await expect(tx).revertedWith('Array length mismatch')
      })

    })

      // deposit
    describe('deposit', function () {
      it('should deposit tokens into the token lock manager', async function () {
        const amount = toMOXIE('1000000')
        const oldBalance = await moxie.balanceOf(tokenLockManager.address)
        // approve Fund the manager contract to 
        await moxie.connect(deployer.signer).approve(tokenLockManager.address, toMOXIE('100000000'))
        const tx = tokenLockManager.deposit(amount)
        await expect(tx).emit(tokenLockManager, 'TokensDeposited').withArgs(deployer.address, amount)
        expect(await moxie.balanceOf(tokenLockManager.address)).to.equal(oldBalance.add(amount))
      })
      it('revert if deposit amount is zero', async function () {
        const tx = tokenLockManager.deposit(0)
        await expect(tx).revertedWith('Amount cannot be zero')
      })
    })
    
     // withdraw
    describe('withdraw', function () {
      it('should withdraw tokens from the token lock manager', async function () {
        const amount = toMOXIE('1000000')
        const oldBalance = await moxie.balanceOf(tokenLockManager.address)
        // approve Fund the manager contract to 
        await moxie.connect(deployer.signer).approve(tokenLockManager.address, toMOXIE('100000000'))
        const tx = tokenLockManager.withdraw(amount)
        await expect(tx).emit(tokenLockManager, 'TokensWithdrawn').withArgs(deployer.address, amount)
        expect(await moxie.balanceOf(tokenLockManager.address)).to.equal(oldBalance.sub(amount))
      })
      it('revert if withdraw amount is zero', async function () {
        const tx = tokenLockManager.withdraw(0)
        await expect(tx).revertedWith('Amount cannot be zero')
      })
    })
  })
})
