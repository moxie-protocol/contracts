import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";

describe("SubjectERC20", () => {

    const deploy = async () => {
        const [deployer, owner, signer] = await ethers.getSigners();

        const MoxiePassVerifier = await hre.ethers.getContractFactory(
            "MockMoxiePassVerifier",
        );
        const MockERC721 = await hre.ethers.getContractFactory("MockERC721");
        const mockErc721 = await MockERC721.deploy("MockERC721", "M721");
        const moxiePassVerifier = await MoxiePassVerifier.deploy(owner.address);

        await mockErc721.mint(deployer.address, "100")
        await mockErc721.mint(owner.address, "101")

        await moxiePassVerifier
            .connect(owner)
            .setErc721ContractAddress(await mockErc721.getAddress());

        const SubjectERC20 = await hre.ethers.getContractFactory("SubjectERC20");
        const subjectErc20MasterCopy = await SubjectERC20.deploy({ from: deployer.address });


        const TokenManager =
            await hre.ethers.getContractFactory("TokenManager");

        const tokenManager = await TokenManager.deploy({ from: deployer.address });
        const subjectErc20Address = await subjectErc20MasterCopy.getAddress();

        await tokenManager.connect(deployer).initialize(
            owner.address, subjectErc20Address
        );


        const initialSupply = 100 * 10 ^ 18;
        const name = 'test';
        const symbol = 'test';

        await tokenManager.connect(owner).grantRole((await tokenManager.CREATE_ROLE()), owner.address);
        await tokenManager.connect(owner).grantRole((await tokenManager.MINT_ROLE()), owner.address);

        const tokenManagerAddress = await tokenManager.getAddress();
        await mockErc721.mint(tokenManagerAddress, "102")

        await tokenManager.connect(owner).create(
            owner.address,
            name,
            symbol,
            initialSupply,
            await moxiePassVerifier.getAddress()
        );

        const tokenAddress = await tokenManager.tokens(owner.address);

        const subjectErc20 = await SubjectERC20.attach(tokenAddress);


        return { mockErc721, moxiePassVerifier, subjectErc20, initialSupply, name, symbol, owner, deployer, signer, tokenManagerAddress, tokenManager };
    };


    describe('deployment', () => {

        it('verify deployment', async () => {

            const {
                subjectErc20,
                owner,
                name,
                symbol,
                initialSupply,
                moxiePassVerifier,
                tokenManagerAddress
            } = await loadFixture(deploy);

            expect(await subjectErc20.symbol()).equal(symbol);
            expect(await subjectErc20.name()).equal(name);
            expect(await subjectErc20.totalSupply()).equal(initialSupply);
            expect(await subjectErc20.moxiePassVerifier()).to.equal(await moxiePassVerifier.getAddress())
            expect(await subjectErc20.owner()).to.equal(tokenManagerAddress)

            expect(await subjectErc20.balanceOf(owner.address)).to.equal(initialSupply);
        });

        it('should fail to initialize if already initialized', async () => {

            const {
                subjectErc20,
                owner,
                name,
                symbol,
                initialSupply,
                moxiePassVerifier,
                deployer
            } = await loadFixture(deploy);

            await expect(subjectErc20.connect(deployer).initialize(
                owner.address,
                name,
                symbol,
                initialSupply,
                await moxiePassVerifier.getAddress()
            )).to.revertedWithCustomError(subjectErc20, "InvalidInitialization");

        });


        it('should fail for zero owner ', async () => {

            const {
                deployer,
                name,
                symbol,
                initialSupply,
                moxiePassVerifier
            } = await loadFixture(deploy);

            const SubjectERC20 = await hre.ethers.getContractFactory("SubjectERC20");
            const subjectErc20 = await SubjectERC20.deploy({ from: deployer.address });

            await expect(subjectErc20.connect(deployer).initialize(
                ethers.ZeroAddress,
                name,
                symbol,
                initialSupply,
                await moxiePassVerifier.getAddress()
            )).revertedWithCustomError(subjectErc20, 'SubjectERC20_InvalidOwner');

        });
    });


    describe('mint/transfer', () => {

        it('should allow mint', async () => {

            const {
                subjectErc20,
                owner,
                mockErc721,
                signer,
                tokenManager
            } = await loadFixture(deploy);

            await mockErc721.connect(owner).mint(signer.address, '200');

            const amount = 20 * 10 ^ 18;
            const beforeBalance = await subjectErc20.balanceOf(signer.address);
            await expect(tokenManager.connect(owner).mint(owner.address, signer.address, amount)).emit(subjectErc20, 'Transfer')
                .withArgs(ethers.ZeroAddress, signer.address, amount);
            const afterBalance = await subjectErc20.balanceOf(signer.address);

            expect(BigInt(afterBalance) - BigInt(beforeBalance)).to.equal(amount);

        });

        it('should allow transfer when no whitelisted address set in tokenManager', async () => {

            const {
                subjectErc20,
                owner,
                mockErc721,
                signer
            } = await loadFixture(deploy);

            await mockErc721.connect(owner).mint(signer.address, '200');

            const amount = 20 * 10 ^ 18;
            const beforeBalance = await subjectErc20.balanceOf(signer.address);
            await expect(subjectErc20.connect(owner).transfer(signer.address, amount))
                .emit(subjectErc20, 'Transfer').withArgs(owner.address, signer.address, amount);
            const afterBalance = await subjectErc20.balanceOf(signer.address);

            expect(BigInt(afterBalance) - BigInt(beforeBalance)).to.equal(amount);

        });

        it('should not allow mint by non owner', async () => {
            const {
                subjectErc20,
                owner,
                mockErc721,
                signer
            } = await loadFixture(deploy);

            const amount = 20 * 10 ^ 18;

            await mockErc721.connect(signer).mint(signer.address, '200');
            await expect(subjectErc20.connect(signer).mint(signer.address, amount)).to.revertedWithCustomError(subjectErc20, 'OwnableUnauthorizedAccount');


        });

        it('should allow burn', async () => {

            const {
                subjectErc20,
                owner,
                initialSupply
            } = await loadFixture(deploy);

            const amount = 20 * 10 ^ 18;
            await expect(subjectErc20.connect(owner).burn(amount)).emit(subjectErc20, 'Transfer').withArgs(owner.address, ethers.ZeroAddress, amount);
            const afterBalance = await subjectErc20.balanceOf(owner.address);
            expect(BigInt(initialSupply) - BigInt(amount)).to.equal(afterBalance);

        });

        it('should not allow mint to non moxie pass holder', async () => {

            const {
                subjectErc20,
                owner,
                signer,
                tokenManager
            } = await loadFixture(deploy);

            const amount = 20 * 10 ^ 18;

            await expect(tokenManager.connect(owner).mint(owner.address, signer.address, amount))
            .revertedWithCustomError(subjectErc20, 'SubjectERC20_NotAMoxiePassHolder');


        });

        it('should not allow transfer to non moxie pass holder', async () => {
            const {
                subjectErc20,
                owner,
                signer
            } = await loadFixture(deploy);

            const amount = 20 * 10 ^ 18;
            await expect(subjectErc20.connect(owner).transfer(signer.address, amount))
                .revertedWithCustomError(subjectErc20, 'SubjectERC20_NotAMoxiePassHolder');

        });
    });

    describe('allowlist', () => {

        it('should fail to transfer if its triggered from wallet not in allow list', async () => {

        })

    });

});