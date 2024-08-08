import { expect } from "chai";
import hre from "hardhat";


describe('Test Protocol Deloyment', () => {

    const deploy = async () => {

        // Read deployed addresses json file
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, '../deployments/testnet-v2/deployed_addresses.json');
        const data = fs.readFileSync(filePath)
        const deployed_addresses = JSON.parse(data)

        // Read config json file
        const configFilePath = path.join(__dirname, '../config/config.json');
        const configData = fs.readFileSync(configFilePath)
        const config = JSON.parse(configData)

        return {deployed_addresses, config}

    }

    it('Verify Contracts Permissions', async () => {
        const {deployed_addresses, config} = await deploy();

        // verify contracts have correct vault permissions
        const vault = await hre.ethers.getContractAt("Vault", deployed_addresses["ProtocolContractsProxy#vaultProxy"]);
        const transferRole = await vault.TRANSFER_ROLE();
        const depositRole = await vault.DEPOSIT_ROLE();
        const adminRole = await vault.DEFAULT_ADMIN_ROLE();
        expect(await vault.hasRole(transferRole, deployed_addresses["ProtocolContractsProxy#moxieBondingCurveProxy"])).to.be.true;
        expect(await vault.hasRole(depositRole, deployed_addresses["ProtocolContractsProxy#moxieBondingCurveProxy"])).to.be.true;
        expect(await vault.hasRole(depositRole, deployed_addresses["ProtocolContractsProxy#subjectFactoryProxy"])).to.be.true;
        expect(await vault.hasRole(adminRole, config.adminRoleBeneficiary)).to.be.true;

        // verify contracts have correct token manager permissions
        const tokenManager = await hre.ethers.getContractAt("TokenManager", deployed_addresses["ProtocolContractsProxy#tokenManagerProxy"]);
        const createRole = await tokenManager.CREATE_ROLE();
        const mintRole = await tokenManager.MINT_ROLE();
        const tokenAdminRole = await tokenManager.DEFAULT_ADMIN_ROLE();
        expect(await tokenManager.hasRole(createRole, deployed_addresses["ProtocolContractsProxy#subjectFactoryProxy"])).to.be.true;
        expect(await tokenManager.hasRole(mintRole, deployed_addresses["ProtocolContractsProxy#subjectFactoryProxy"])).to.be.true;
        expect(await tokenManager.hasRole(mintRole, deployed_addresses["ProtocolContractsProxy#moxieBondingCurveProxy"])).to.be.true;
        expect(await tokenManager.hasRole(tokenAdminRole, config.adminRoleBeneficiary)).to.be.true;

        // verify contracts have correct subject factory permissions
        const subjectFactory = await hre.ethers.getContractAt("SubjectFactory", deployed_addresses["ProtocolContractsProxy#subjectFactoryProxy"]);
        expect(await subjectFactory.hasRole(adminRole, config.adminRoleBeneficiary)).to.be.true;

        // verify contracts have correct moxie bonding curve permissions
        const moxieBondingCurve = await hre.ethers.getContractAt("MoxieBondingCurve", deployed_addresses["ProtocolContractsProxy#moxieBondingCurveProxy"]);
        expect(await moxieBondingCurve.hasRole(adminRole, config.adminRoleBeneficiary)).to.be.true;

        // verify contracts have correct moxie pass permissions
        const moxiePass = await hre.ethers.getContractAt("MoxiePass", deployed_addresses["MoxiePass#MoxiePass"]);
        expect(await moxiePass.hasRole(adminRole, config.adminRoleBeneficiary)).to.be.true;

    });

    it('Verify contract has correct address of other contracts', async () => {

        const {deployed_addresses} = await deploy();

        // verify moxie bonding curve has correct address of other contracts
        const moxieBondingCurve = await hre.ethers.getContractAt("MoxieBondingCurve", deployed_addresses["ProtocolContractsProxy#moxieBondingCurveProxy"]);
        expect(await moxieBondingCurve.formula()).to.equal(deployed_addresses["ProtocolContracts#BancorFormula"]);
        expect(await moxieBondingCurve.tokenManager()).to.equal(deployed_addresses["ProtocolContractsProxy#tokenManagerProxy"]);
        expect(await moxieBondingCurve.vault()).to.equal(deployed_addresses["ProtocolContractsProxy#vaultProxy"]);
        expect(await moxieBondingCurve.subjectFactory()).to.equal(deployed_addresses["ProtocolContractsProxy#subjectFactoryProxy"]);

        // verify subject factory has correct address of other contracts
        const subjectFactory = await hre.ethers.getContractAt("SubjectFactory", deployed_addresses["ProtocolContractsProxy#subjectFactoryProxy"]);
        expect(await subjectFactory.moxieBondingCurve()).to.equal(deployed_addresses["ProtocolContractsProxy#moxieBondingCurveProxy"]);
        expect(await subjectFactory.tokenManager()).to.equal(deployed_addresses["ProtocolContractsProxy#tokenManagerProxy"]);

    });

    it('check proxy admin owner should be owner key in config file', async () => {
        const {deployed_addresses, config} = await deploy();

        // verify proxy admin owner
        const subjectFactoryProxyAdmin = await hre.ethers.getContractAt("ProxyAdmin", deployed_addresses["ProtocolContractsProxy#subjectFactoryProxyAdmin"]);
        expect(await subjectFactoryProxyAdmin.owner()).to.equal(config.proxyAdminOwner);

        const tokenManagerProxyAdmin = await hre.ethers.getContractAt("ProxyAdmin", deployed_addresses["ProtocolContractsProxy#tokenManagerProxyAdmin"]);
        expect(await tokenManagerProxyAdmin.owner()).to.equal(config.proxyAdminOwner);

        const vaultProxyAdmin = await hre.ethers.getContractAt("ProxyAdmin", deployed_addresses["ProtocolContractsProxy#vaultProxyAdmin"]);
        expect(await vaultProxyAdmin.owner()).to.equal(config.proxyAdminOwner);

        const moxieBondingCurveProxyAdmin = await hre.ethers.getContractAt("ProxyAdmin", deployed_addresses["ProtocolContractsProxy#moxieBondingCurveProxyAdmin"]);
        expect(await moxieBondingCurveProxyAdmin.owner()).to.equal(config.proxyAdminOwner);

    });

    it('check config file input was passed correctly while contract deployment', async () => {
        const {deployed_addresses, config} = await deploy();

        // verify bonding curve input
        const moxieBondingCurve = await hre.ethers.getContractAt("MoxieBondingCurve", deployed_addresses["ProtocolContractsProxy#moxieBondingCurveProxy"]);
        expect(await moxieBondingCurve.protocolBuyFeePct()).to.equal(config.protocolBuyFeePctForBC);
        expect(await moxieBondingCurve.protocolSellFeePct()).to.equal(config.protocolSellFeePctForBC);
        expect(await moxieBondingCurve.subjectBuyFeePct()).to.equal(config.subjectBuyFeePctForBC);
        expect(await moxieBondingCurve.subjectSellFeePct()).to.equal(config.subjectSellFeePctForBC);

        // verify subject factory input
        const subjectFactory = await hre.ethers.getContractAt("SubjectFactory", deployed_addresses["ProtocolContractsProxy#subjectFactoryProxy"]);
        expect(await subjectFactory.protocolFeePct()).to.equal(config.protocolFeePctForSF);
        expect(await subjectFactory.subjectFeePct()).to.equal(config.subjectFeePctForSF);

    });


});
