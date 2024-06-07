import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";

describe("TokenManager", () => {

    const deploy = async () => {

        const [deployer, owner] = await ethers.getSigners();

        const SubjectERC20 = await hre.ethers.getContractFactory("SubjectERC20");
        const subjectErc20 = await SubjectERC20.deploy({ from: deployer.address });

        const TokenManager =
            await hre.ethers.getContractFactory("TokenManager");

        const tokenManager = await TokenManager.deploy({ from: deployer.address });
        const subjectErc20Address = await subjectErc20.getAddress();

        await tokenManager.connect(deployer).initialize(
            owner.address, subjectErc20Address
        );

        const MoxiePassVerifier = await hre.ethers.getContractFactory(
            "MockMoxiePassVerifier",
        );
        const MockERC721 = await hre.ethers.getContractFactory("MockERC721");
        const mockErc721 = await MockERC721.deploy("MockERC721", "M721");
        const moxiePassVerifier = await MoxiePassVerifier.deploy(owner.address);

        await mockErc721.mint(deployer.address, "100")
        await mockErc721.mint(owner.address, "101")
        await mockErc721.mint(await tokenManager.getAddress(), "103")

        await moxiePassVerifier
            .connect(owner)
            .setErc721ContractAddress(await mockErc721.getAddress());

        return {
            tokenManager, owner, deployer, subjectErc20Address, moxiePassVerifier, mockErc721
        };
    }

    describe("Deployment", () => {

        it('Verify deployment ', async () => {

            const {
                tokenManager,
                owner,
                subjectErc20Address
            } = await loadFixture(deploy);

            const adminRole = await tokenManager.DEFAULT_ADMIN_ROLE();
            const isAdmin = await tokenManager.hasRole(adminRole, owner.address)
            const implementationAddress = await tokenManager.subjectImplementation();

            expect(await tokenManager.getAddress()).to.be.not.null;
            expect(isAdmin).to.be.true;
            expect(implementationAddress).to.equal(subjectErc20Address)
        });


        it('should fail if subject implementation is zero address', async () => {

            const [deployer] = await ethers.getSigners();

            const TokenManager =
                await hre.ethers.getContractFactory("TokenManager");

            const tokenManager = await TokenManager.deploy({ from: deployer.address });

            await expect(tokenManager.connect(deployer).initialize(
                deployer.address, ethers.ZeroAddress
            )).to.revertedWithCustomError(tokenManager, 'TokenManager_InvalidSubjectImplementation');

        })


        it('should fail if zero owner address is passed', async () => {

            const [deployer, subjectErc20] = await ethers.getSigners();

            const TokenManager =
                await hre.ethers.getContractFactory("TokenManager");

            const tokenManager = await TokenManager.deploy({ from: deployer.address });

            await expect(tokenManager.connect(deployer).initialize(
                ethers.ZeroAddress, subjectErc20.address
            )).to.revertedWithCustomError(tokenManager, 'TokenManager_InvalidOwner');

        })

        it('should fail to initialize if already initialize', async () => {

            const {
                tokenManager,
                owner,
                deployer,
                subjectErc20Address
            } = await loadFixture(deploy);

            await expect(tokenManager.connect(deployer).initialize(
                owner.address, subjectErc20Address
            )).to.revertedWithCustomError(tokenManager, 'InvalidInitialization');

        });

    });

    describe('Create', () => {

        it('Verify create call', async () => {

            const {
                tokenManager,
                owner,
                deployer,
                moxiePassVerifier,
            } = await loadFixture(deploy);

            await tokenManager.connect(owner).grantRole((await tokenManager.CREATE_ROLE()), deployer.address);
            const subject = deployer.address;
            const initialSupply = 100 * 10 ^ 18;
            const passVerifierAddress = await moxiePassVerifier.getAddress();
            await expect(await tokenManager.connect(deployer).create(
                subject,
                'test',
                'test',
                initialSupply,
                passVerifierAddress,
            )).to.emit(tokenManager, 'TokenDeployed').withArgs(subject, await tokenManager.tokens(subject), initialSupply);

            const subjectTokenAddress = await tokenManager.tokens(subject);
            expect(subjectTokenAddress).to.be.not.null;

            const subjectERC20 = await hre.ethers.getContractAt("SubjectERC20", subjectTokenAddress);
            const actualSupply = await subjectERC20.totalSupply();

            expect(await subjectERC20.symbol()).to.equal('test');
            expect(await subjectERC20.name()).to.equal('test');
            expect(await subjectERC20.moxiePassVerifier()).to.equal(passVerifierAddress)
            expect(actualSupply).equal(initialSupply);

            const balanceOfDeployer = await subjectERC20.balanceOf(deployer.address);

            expect(balanceOfDeployer).to.equal(initialSupply);

        });


        it('should revert if sender without create role send transaction', async () => {

            const {
                tokenManager,
                owner,
                deployer,
                moxiePassVerifier,
            } = await loadFixture(deploy);


            const subject = deployer.address;
            const initialSupply = 100 * 10 ^ 18;
            const passVerifierAddress = await moxiePassVerifier.getAddress();
            await expect(tokenManager.connect(deployer).create(
                subject,
                'test',
                'test',
                initialSupply,
                passVerifierAddress,
            )).to.revertedWithCustomError(tokenManager, 'AccessControlUnauthorizedAccount').withArgs(deployer.address, await tokenManager.CREATE_ROLE());


        });

        it('should revert to recreate for same subject', async () => {

            const {
                tokenManager,
                owner,
                deployer,
                moxiePassVerifier,
            } = await loadFixture(deploy);

            await tokenManager.connect(owner).grantRole((await tokenManager.CREATE_ROLE()), deployer.address);
            const subject = deployer.address;
            const initialSupply = 100 * 10 ^ 18;
            const passVerifierAddress = await moxiePassVerifier.getAddress();
            expect(await tokenManager.connect(deployer).create(
                subject,
                'test',
                'test',
                initialSupply,
                passVerifierAddress,
            )).to.emit(tokenManager, 'TokenDeployed').withArgs(subject, await tokenManager.tokens(subject), initialSupply);

            await expect(tokenManager.connect(deployer).create(
                subject,
                'test',
                'test',
                initialSupply,
                passVerifierAddress,
            )).to.revertedWithCustomError(tokenManager, 'TokenManager_SubjectExists');

        });

        it('should revert for zero subject', async () => {

            const {
                tokenManager,
                owner,
                deployer,
                moxiePassVerifier,
            } = await loadFixture(deploy);

            await tokenManager.connect(owner).grantRole((await tokenManager.CREATE_ROLE()), deployer.address);
            const subject = ethers.ZeroAddress;
            const initialSupply = 100 * 10 ^ 18;
            const passVerifierAddress = await moxiePassVerifier.getAddress();
            await expect(tokenManager.connect(deployer).create(
                subject,
                'test',
                'test',
                initialSupply,
                passVerifierAddress,
            )).to.revertedWithCustomError(tokenManager, 'TokenManager_InvalidSubject');

        });

        it('should revert on create when contract is paused', async () => {

            const {
                tokenManager,
                owner,
                deployer,
                moxiePassVerifier,
            } = await loadFixture(deploy);

            await tokenManager.connect(owner).grantRole((await tokenManager.CREATE_ROLE()), deployer.address);
            await tokenManager.connect(owner).grantRole((await tokenManager.PAUSE_ROLE()), deployer.address);

            await tokenManager.connect(deployer).pause();
            const subject = ethers.ZeroAddress;
            const initialSupply = 100 * 10 ^ 18;
            const passVerifierAddress = await moxiePassVerifier.getAddress();
            await expect(tokenManager.connect(deployer).create(
                subject,
                'test',
                'test',
                initialSupply,
                passVerifierAddress,
            )).to.revertedWithCustomError(tokenManager, 'EnforcedPause');

        });
    });

    describe('mint', () => {

        it('should allow mint', async () => {

            const {
                tokenManager,
                owner,
                deployer,
                moxiePassVerifier,
            } = await loadFixture(deploy);


            await tokenManager.connect(owner).grantRole((await tokenManager.CREATE_ROLE()), deployer.address);
            const subject = deployer.address;
            const initialSupply = 100 * 10 ^ 18;
            const passVerifierAddress = await moxiePassVerifier.getAddress();
            await expect(await tokenManager.connect(deployer).create(
                subject,
                'test',
                'test',
                initialSupply,
                passVerifierAddress,
            )).to.emit(tokenManager, 'TokenDeployed').withArgs(subject, await tokenManager.tokens(subject), initialSupply);


            await tokenManager.connect(owner).grantRole((await tokenManager.MINT_ROLE()), deployer.address);

            const subjectTokenAddress = await tokenManager.tokens(subject);

            const subjectERC20 = await hre.ethers.getContractAt("SubjectERC20", subjectTokenAddress);

            const beneficiaryAddress = owner.address;

            const amount = 20 * 10 ^ 18;
            const preBalance = await subjectERC20.balanceOf(beneficiaryAddress);
            await expect(await tokenManager.connect(deployer).mint(subject, beneficiaryAddress, amount)).to.emit(
                subjectERC20, "Transfer"
            ).withArgs(ethers.ZeroAddress, beneficiaryAddress, amount);

            const postBalance = await subjectERC20.balanceOf(beneficiaryAddress);
            const expectedBalance = BigInt(preBalance) + BigInt(amount);
            expect(postBalance).to.equal(expectedBalance)

        });

        it('should not allow mint without mint role', async () => {
            const {
                tokenManager,
                owner,
                deployer,
                moxiePassVerifier,
            } = await loadFixture(deploy);


            await tokenManager.connect(owner).grantRole((await tokenManager.CREATE_ROLE()), deployer.address);
            const subject = deployer.address;
            const initialSupply = 100 * 10 ^ 18;
            const passVerifierAddress = await moxiePassVerifier.getAddress();
            expect(await tokenManager.connect(deployer).create(
                subject,
                'test',
                'test',
                initialSupply,
                passVerifierAddress,
            )).to.emit(tokenManager, 'TokenDeployed').withArgs(subject, await tokenManager.tokens(subject), initialSupply);

            const beneficiaryAddress = owner.address;

            const amount = 20 * 10 ^ 18;

            await expect(tokenManager.connect(deployer).mint(subject, beneficiaryAddress, amount)).to.be.revertedWithCustomError(
                tokenManager, 'AccessControlUnauthorizedAccount'
            );


        });


        it('should not allow mint if contract is paused mint role', async () => {
            const {
                tokenManager,
                owner,
                deployer,
                moxiePassVerifier,
            } = await loadFixture(deploy);


            await tokenManager.connect(owner).grantRole((await tokenManager.CREATE_ROLE()), deployer.address);
            await tokenManager.connect(owner).grantRole((await tokenManager.MINT_ROLE()), deployer.address);
            await tokenManager.connect(owner).grantRole((await tokenManager.PAUSE_ROLE()), deployer.address);

            const subject = deployer.address;
            const initialSupply = 100 * 10 ^ 18;
            const passVerifierAddress = await moxiePassVerifier.getAddress();
            expect(await tokenManager.connect(deployer).create(
                subject,
                'test',
                'test',
                initialSupply,
                passVerifierAddress,
            )).to.emit(tokenManager, 'TokenDeployed').withArgs(subject, await tokenManager.tokens(subject), initialSupply);


            await tokenManager.connect(deployer).pause();
            const beneficiaryAddress = owner.address;

            const amount = 20 * 10 ^ 18;

            await expect(tokenManager.connect(deployer).mint(subject, beneficiaryAddress, amount)).to.be.revertedWithCustomError(
                tokenManager, 'EnforcedPause'
            );


        });


        it('should not allow mint for invalid subject', async () => {
            const {
                tokenManager,
                owner,
                deployer,
            } = await loadFixture(deploy);

            await tokenManager.connect(owner).grantRole((await tokenManager.MINT_ROLE()), deployer.address);
            const subject = deployer.address;
            const beneficiaryAddress = owner.address;

            const amount = 20 * 10 ^ 18;

            await expect(tokenManager.connect(deployer).mint(subject, beneficiaryAddress, amount)).to.be.revertedWithCustomError(
                tokenManager, 'TokenManager_TokenNotFound'
            );

        });

        it('should not allow mint for invalid amount', async () => {
            const {
                tokenManager,
                owner,
                deployer,
                moxiePassVerifier,
            } = await loadFixture(deploy);

            await tokenManager.connect(owner).grantRole((await tokenManager.MINT_ROLE()), deployer.address);
            await tokenManager.connect(owner).grantRole((await tokenManager.CREATE_ROLE()), deployer.address);
            const subject = deployer.address;
            const beneficiaryAddress = owner.address;

            const initialSupply = 100 * 10 ^ 18;
            const passVerifierAddress = await moxiePassVerifier.getAddress();

            expect(await tokenManager.connect(deployer).create(
                subject,
                'test',
                'test',
                initialSupply,
                passVerifierAddress,
            )).to.emit(tokenManager, 'TokenDeployed').withArgs(subject, await tokenManager.tokens(subject), initialSupply);

            const amount = 0;

            await expect(tokenManager.connect(deployer).mint(subject, beneficiaryAddress, amount)).to.be.revertedWithCustomError(
                tokenManager, 'TokenManager_InvalidAmount'
            );

        });
    });

    describe('pause/unpause', () => {

        it('should allow to pause ', async () => {
            const {
                tokenManager,
                owner,
                deployer
            } = await loadFixture(deploy);

            await tokenManager.connect(owner).grantRole(await tokenManager.PAUSE_ROLE(), deployer.address);
            await expect(tokenManager.connect(deployer).pause()).to.emit(tokenManager, 'Paused').withArgs(deployer.address);

        });


        it('should allow to unpause ', async () => {

            const {
                tokenManager,
                owner,
                deployer
            } = await loadFixture(deploy);

            await tokenManager.connect(owner).grantRole(await tokenManager.PAUSE_ROLE(), deployer.address);
            await expect(tokenManager.connect(deployer).pause()).to.emit(tokenManager, 'Paused').withArgs(deployer.address);
            await expect(tokenManager.connect(deployer).unpause()).to.emit(tokenManager, 'Unpaused').withArgs(deployer.address);

        });

        it('should not allow to pause without pause role ', async () => {

            const {
                tokenManager,
                owner,
                deployer
            } = await loadFixture(deploy);

            await expect(tokenManager.connect(deployer).pause()).to.revertedWithCustomError(tokenManager, "AccessControlUnauthorizedAccount")

        });


        it('should not allow to unpause without pause role ', async () => {

            const {
                tokenManager,
                owner,
                deployer
            } = await loadFixture(deploy);

            await tokenManager.connect(owner).grantRole(await tokenManager.PAUSE_ROLE(), deployer.address);
            await expect(tokenManager.connect(deployer).pause()).to.emit(tokenManager, 'Paused').withArgs(deployer.address);

            await tokenManager.connect(owner).revokeRole(await tokenManager.PAUSE_ROLE(), deployer.address);
            await expect(tokenManager.connect(deployer).unpause()).to.revertedWithCustomError(tokenManager, "AccessControlUnauthorizedAccount")

        });

        it('should fail to unpause if not paused', async () => {

            const {
                tokenManager,
                owner,
                deployer
            } = await loadFixture(deploy);

            await tokenManager.connect(owner).grantRole(await tokenManager.PAUSE_ROLE(), deployer.address);
            await expect(tokenManager.connect(deployer).unpause()).to.revertedWithCustomError(tokenManager, "ExpectedPause");

        });

        it('should fail to pause if not unpaused', async () => {

            const {
                tokenManager,
                owner,
                deployer
            } = await loadFixture(deploy);

            await tokenManager.connect(owner).grantRole(await tokenManager.PAUSE_ROLE(), deployer.address);
            await expect(tokenManager.connect(deployer).pause()).to.emit(tokenManager, 'Paused').withArgs(deployer.address);
            await expect(tokenManager.connect(deployer).pause()).to.revertedWithCustomError(tokenManager, "EnforcedPause")

        });
    })

});