import consola from 'consola'
import { utils } from 'ethers'

import '@nomiclabs/hardhat-ethers'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction, DeployOptions } from 'hardhat-deploy/types'

import { MoxieTokenMock } from '../build/typechain/contracts/MoxieTokenMock'
import { MoxieTokenLockManager } from '../build/typechain/contracts/MoxieTokenLockManager'
import { getDeploymentName, promptContractAddress } from './lib/utils'

const { parseEther, formatEther } = utils

const logger = consola.create({})

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const deploy = (name: string, options: DeployOptions) => hre.deployments.deploy(name, options)
  const { deployer } = await hre.getNamedAccounts()

  // -- Moxie Token --

  // Get the token address we will use
  const tokenAddress = await promptContractAddress('MOXIE', logger)
  if (!tokenAddress) {
    logger.warn('No token address provided')
    process.exit(1)
  }

  // -- Token Lock Manager --

  // Deploy the master copy of MoxieTokenLockWallet
  logger.info('Deploying MoxieTokenLockWallet master copy...')
  const masterCopySaveName = await getDeploymentName('MoxieTokenLockWallet')
  const masterCopyDeploy = await deploy(masterCopySaveName, {
    from: deployer,
    log: true,
    contract: 'MoxieTokenLockWallet',
  })

  // Deploy the Manager that uses the master copy to clone contracts
  logger.info('Deploying MoxieTokenLockManager...')
  const managerSaveName = await getDeploymentName('MoxieTokenLockManager')
  const managerDeploy = await deploy(managerSaveName, {
    from: deployer,
    args: [tokenAddress, masterCopyDeploy.address],
    log: true,
    contract: 'MoxieTokenLockManager',
  })

  // // -- Fund --

  //   const fundAmount = parseEther('100000000')
  //   logger.info(`Funding ${managerDeploy.address} with ${formatEther(fundAmount)} MOXIE...`)

  //   // Approve
  //   const moxie = (await hre.ethers.getContractAt('MoxieToken', tokenAddress)) as MoxieTokenMock
  //   await moxie.approve(managerDeploy.address, fundAmount)

  //   // Deposit
  //   const manager = (await hre.ethers.getContractAt(
  //     'MoxieTokenLockManager',
  //     managerDeploy.address,
  //   )) as MoxieTokenLockManager
  //   await manager.deposit(fundAmount)

  //   logger.success('Deposit Done!')
}

func.tags = ['manager']

export default func
