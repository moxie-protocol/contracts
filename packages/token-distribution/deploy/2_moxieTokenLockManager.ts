import consola from 'consola'
import { utils } from 'ethers'

import '@nomiclabs/hardhat-ethers'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction, DeployOptions } from 'hardhat-deploy/types'

import { MoxieTokenMock } from '../build/typechain/contracts/MoxieTokenMock'
import { MoxieTokenLockManager } from '../build/typechain/contracts/MoxieTokenLockManager'
import { getDeploymentName, promptContractAddress } from './lib/utils'
import cfg from'./config.json'

const { parseEther, formatEther } = utils

const logger = consola.create({})

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const deploy = (name: string, options: DeployOptions) => hre.deployments.deploy(name, options)
  const { deployer } = await hre.getNamedAccounts()


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
    args: [cfg.MoxieTokenAddress, masterCopyDeploy.address],
    log: true,
    contract: 'MoxieTokenLockManager',
  })

  logger.info(`MoxieTokenLockManager deployed at ${managerDeploy.address}`)


  // set up moxie pass token address and uri
  const manager = (await hre.ethers.getContractAt(
        'MoxieTokenLockManager',
        managerDeploy.address,
      )) as MoxieTokenLockManager

  await manager.setMoxiePassTokenAndUri(cfg.MoxiePassTokenAddress, cfg.MoxiePassTokenURI)

  logger.info(`MoxieTokenLockManager set up with moxie pass token address: ${cfg.MoxiePassTokenAddress} and uri: ${cfg.MoxiePassTokenURI}`)

}

func.tags = ['manager']

export default func
