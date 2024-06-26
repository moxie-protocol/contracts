import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";

describe("Vault", () => {

    const deploy = async () => {
        const [deployer, owner, anyAddress, signer1] = await ethers.getSigners();

        const Vault = await hre.ethers.getContractFactory("Vault");
        const vault = await Vault.deploy({ from: deployer.address });

        await vault.connect(deployer).initialize(
            owner.address
        );


        const SubjectERC20 = await hre.ethers.getContractFactory("SubjectERC20");
        const token = await SubjectERC20.deploy({ from: deployer.address });

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

        const initialSupply = 100 * 10 ^ 18;
        const name = 'test';
        const symbol = 'test';
        await token.connect(deployer).initialize(
            owner.address,
            name,
            symbol,
            initialSupply,
            await moxiePassVerifier.getAddress()
        );

        const vaultAddress = await vault.getAddress();
        const tokenAddress = await token.getAddress();

        // moxie pass to vault contract
        await mockErc721.mint(vaultAddress, "102")

        return { Vault, vault, deployer, owner, mockErc721, token, vaultAddress, tokenAddress, anyAddress, signer1 };

    };

    describe('Verify deployment', () => {

        it('Verify deployment', async () => {

            const {
                vault,
                owner
            } = await loadFixture(deploy);

            expect(await vault.hasRole(await vault.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;

        });


        it('should fail for zero owner address', async () => {

            const {
                Vault,
                deployer
            } = await loadFixture(deploy);

            const vault = await Vault.deploy();

            await expect(vault.connect(deployer).initialize(ethers.ZeroAddress))
                .to.revertedWithCustomError(vault, 'InvalidOwner');

        });
    });

    describe('deposit', () => {

        it('Verify deposit', async () => {

            const {
                vault,
                anyAddress,
                owner,
                token,
                vaultAddress,
                tokenAddress
            } = await loadFixture(deploy);

            //first deposit
            let amount = 15 * 10 ^ 18;
            await token.connect(owner).approve(vaultAddress, amount);

            let previousBalance = await token.balanceOf(vaultAddress);
            expect(await vault.connect(owner).deposit(anyAddress.address, tokenAddress, amount)).to.emit(vault, 'VaultDeposit');
            let afterBalance = await token.balanceOf(vaultAddress);

            expect(BigInt(previousBalance) + BigInt(amount)).equal(BigInt(afterBalance));
            expect(await vault.balanceOf(anyAddress.address, tokenAddress)).to.equal(amount);

            // second deposit
            let amount2 = 17 * 10 ^ 18;

            await token.connect(owner).approve(vaultAddress, amount2);
            previousBalance = await token.balanceOf(vaultAddress);
            expect(await vault.connect(owner).deposit(anyAddress.address, tokenAddress, amount2)).to.emit(vault, 'VaultDeposit');
            afterBalance = await token.balanceOf(vaultAddress);

            expect(BigInt(previousBalance) + BigInt(amount2)).equal(BigInt(afterBalance));
            expect(await vault.balanceOf(anyAddress.address, tokenAddress)).to.equal(BigInt(amount) + BigInt(amount2));
        });

        it(' deposit should revert for zero subject token address', async () => {

            const {
                vault,
                owner,
                token,
                vaultAddress,
                tokenAddress
            } = await loadFixture(deploy);

            //first deposit
            let amount = 15 * 10 ^ 18;
            await token.connect(owner).approve(vaultAddress, amount);

            await expect(vault.connect(owner).deposit(ethers.ZeroAddress, tokenAddress, amount))
                .to.revertedWithCustomError(vault, 'InvalidSubjectToken');

        });

        it(' deposit should revert for zero token address', async () => {

            const {
                vault,
                owner,
                anyAddress,
                token,
                vaultAddress,
            } = await loadFixture(deploy);

            //first deposit
            let amount = 15 * 10 ^ 18;
            await token.connect(owner).approve(vaultAddress, amount);

            await expect(vault.connect(owner).deposit(anyAddress.address, ethers.ZeroAddress, amount))
                .to.revertedWithCustomError(vault, 'InvalidToken');

        });

        it(' deposit should revert for zero amount', async () => {

            const {
                vault,
                owner,
                anyAddress,
                token,
                vaultAddress,
                tokenAddress
            } = await loadFixture(deploy);

            //first deposit
            let amount = 0;
            await token.connect(owner).approve(vaultAddress, amount);

            await expect(vault.connect(owner).deposit(anyAddress.address, tokenAddress, amount))
                .to.revertedWithCustomError(vault, 'InvalidAmount');

        });

        it(' deposit should revert if funds cannot be transferred', async () => {

            const {
                vault,
                owner,
                anyAddress,
                token,
                vaultAddress,
                tokenAddress
            } = await loadFixture(deploy);

            //first deposit
            let amount = 10 * 10 ^ 18;

            await expect(vault.connect(owner).deposit(anyAddress.address, tokenAddress, amount))
                .to.revertedWithCustomError(token, 'ERC20InsufficientAllowance');

        });

    });

    describe('transfer', () => {

        it('should allow transfer', async () => {
            const {
                vault,
                anyAddress,
                owner,
                token,
                vaultAddress,
                tokenAddress,
                signer1
            } = await loadFixture(deploy);

            //first deposit
            let amount = 15 * 10 ^ 18;
            await token.connect(owner).approve(vaultAddress, amount);
            expect(await vault.connect(owner).deposit(anyAddress.address, tokenAddress, amount)).to.emit(vault, 'VaultDeposit');

            await vault.connect(owner).grantRole((await vault.TRANSFER_ROLE()), signer1.address);
            const transferAmount = 1 * 10 ^ 18;
            const benficiary = owner;
            const previousBalance = await token.balanceOf(benficiary.address)

            expect(await vault.connect(signer1).transfer(
                anyAddress.address,
                tokenAddress,
                benficiary.address,
                transferAmount
            )).to.emit(vault, 'VaultTransfer');

            const afterBalance = await token.balanceOf(benficiary.address);

            expect(BigInt(afterBalance) - BigInt(previousBalance)).to.equal(BigInt(transferAmount));
        });

        it('should not allow transfer more than deposit', async () => {
            const {
                vault,
                anyAddress,
                owner,
                token,
                vaultAddress,
                tokenAddress,
                signer1
            } = await loadFixture(deploy);

            //first deposit
            let amount = 15 * 10 ^ 18;
            await token.connect(owner).approve(vaultAddress, amount);
            expect(await vault.connect(owner).deposit(anyAddress.address, tokenAddress, amount)).to.emit(vault, 'VaultDeposit');

            await vault.connect(owner).grantRole((await vault.TRANSFER_ROLE()), signer1.address);
            const transferAmount = 1000 * 10 ^ 18;
            const benficiary = owner;

            await expect(vault.connect(signer1).transfer(
                anyAddress.address,
                tokenAddress,
                benficiary.address,
                transferAmount
            )).to.revertedWithCustomError(vault, "InvalidReserveBalance");
        });

        it('should only allow transfer with the transfer role', async () => {
            const {
                vault,
                anyAddress,
                owner,
                token,
                vaultAddress,
                tokenAddress,
                signer1
            } = await loadFixture(deploy);

            //first deposit
            let amount = 15 * 10 ^ 18;
            await token.connect(owner).approve(vaultAddress, amount);
            expect(await vault.connect(owner).deposit(anyAddress.address, tokenAddress, amount)).to.emit(vault, 'VaultDeposit');

            const transferAmount = 1 * 10 ^ 18;
            const benficiary = owner;
            await expect(vault.connect(signer1).transfer(
                anyAddress.address,
                tokenAddress,
                benficiary.address,
                transferAmount
            )).to.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
        });


        it('should not allow zero subject address ', async () => {

            const {
                vault,
                anyAddress,
                owner,
                token,
                vaultAddress,
                tokenAddress,
                signer1
            } = await loadFixture(deploy);

            let amount = 15 * 10 ^ 18;
            await token.connect(owner).approve(vaultAddress, amount);
            await vault.connect(owner).grantRole((await vault.TRANSFER_ROLE()), signer1.address);
            expect(await vault.connect(owner).deposit(anyAddress.address, tokenAddress, amount)).to.emit(vault, 'VaultDeposit');

            const transferAmount = 1 * 10 ^ 18;
            const benficiary = owner;
            await expect(vault.connect(signer1).transfer(
                ethers.ZeroAddress,
                tokenAddress,
                benficiary.address,
                transferAmount
            )).to.revertedWithCustomError(vault, "InvalidSubjectToken");

        });

        it('should not allow zero token address ', async () => {

            const {
                vault,
                anyAddress,
                owner,
                token,
                vaultAddress,
                tokenAddress,
                signer1
            } = await loadFixture(deploy);

            let amount = 15 * 10 ^ 18;
            await token.connect(owner).approve(vaultAddress, amount);
            await vault.connect(owner).grantRole((await vault.TRANSFER_ROLE()), signer1.address);
            expect(await vault.connect(owner).deposit(anyAddress.address, tokenAddress, amount)).to.emit(vault, 'VaultDeposit');

            const transferAmount = 1 * 10 ^ 18;
            const benficiary = owner;
            await expect(vault.connect(signer1).transfer(
                anyAddress.address,
                ethers.ZeroAddress,
                benficiary.address,
                transferAmount
            )).to.revertedWithCustomError(vault, "InvalidToken");

        });


        it('should not allow zero to address ', async () => {

            const {
                vault,
                anyAddress,
                owner,
                token,
                vaultAddress,
                tokenAddress,
                signer1
            } = await loadFixture(deploy);

            let amount = 15 * 10 ^ 18;
            await token.connect(owner).approve(vaultAddress, amount);
            await vault.connect(owner).grantRole((await vault.TRANSFER_ROLE()), signer1.address);
            expect(await vault.connect(owner).deposit(anyAddress.address, tokenAddress, amount)).to.emit(vault, 'VaultDeposit');

            const transferAmount = 1 * 10 ^ 18;
            await expect(vault.connect(signer1).transfer(
                anyAddress.address,
                tokenAddress,
                ethers.ZeroAddress,
                transferAmount
            )).to.revertedWithCustomError(vault, "InvalidToAddress");
        });


        it('should not allow zero transfer amount', async () => {

            const {
                vault,
                anyAddress,
                owner,
                token,
                vaultAddress,
                tokenAddress,
                signer1
            } = await loadFixture(deploy);

            let amount = 15 * 10 ^ 18;
            await token.connect(owner).approve(vaultAddress, amount);
            await vault.connect(owner).grantRole((await vault.TRANSFER_ROLE()), signer1.address);
            expect(await vault.connect(owner).deposit(anyAddress.address, tokenAddress, amount)).to.emit(vault, 'VaultDeposit');

            const transferAmount = 1 * 10 ^ 18;
            const benficiary = owner;
            await expect(vault.connect(signer1).transfer(
                anyAddress.address,
                tokenAddress,
                benficiary.address,
                0
            )).to.revertedWithCustomError(vault, "InvalidAmount");

        });

    });

});