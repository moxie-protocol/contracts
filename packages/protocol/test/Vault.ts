import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";

describe("Vault", () => {

    const deploy = async () => {
        const [deployer, owner, anyAddress, signer1] = await ethers.getSigners();

        const Vault = await hre.ethers.getContractFactory("Vault");
        const vaultInstance = await Vault.deploy({ from: deployer.address });

        await vaultInstance.connect(deployer).initialize(
            owner.address
        );


        const MoxieToken = await hre.ethers.getContractFactory("MoxieToken");
        const token = await MoxieToken.connect(owner).deploy();

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
            
        const vaultAddress = await vaultInstance.getAddress();
        const tokenAddress = await token.getAddress();

        // moxie pass to vault contract
        await mockErc721.mint(vaultAddress, "102")

        return { Vault, vaultInstance, deployer, owner, mockErc721, token, vaultAddress, tokenAddress, anyAddress, signer1 };

    };

    describe('Verify deployment', () => {

        it('Verify deployment', async () => {

            const {
                vaultInstance,
                owner
            } = await loadFixture(deploy);

            expect(await vaultInstance.hasRole(await vaultInstance.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;


        });

        it('should fail to reinit deployment', async () => {

            const {
                vaultInstance,
                owner,
                deployer
            } = await loadFixture(deploy);

            await expect(vaultInstance.connect(deployer).initialize(
                owner.address
            )).to.revertedWithCustomError(vaultInstance, "InvalidInitialization");
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
                vaultInstance,
                anyAddress,
                owner,
                token,
                vaultAddress,
                tokenAddress
            } = await loadFixture(deploy);

            //first deposit
            let amount = 15 * 10 ^ 18;
            await token.connect(owner).approve(vaultAddress, amount);

            await vaultInstance.connect(owner).grantRole(await vaultInstance.DEPOSIT_ROLE(), owner.address);

            let previousBalance = await token.balanceOf(vaultAddress);
            expect(await vaultInstance.connect(owner).deposit(anyAddress.address, tokenAddress, amount))
                .to.emit(vaultInstance, 'VaultDeposit').withArgs(anyAddress.address, tokenAddress, amount, amount);
            let afterBalance = await token.balanceOf(vaultAddress);

            expect(BigInt(previousBalance) + BigInt(amount)).equal(BigInt(afterBalance));
            expect(await vaultInstance.balanceOf(anyAddress.address, tokenAddress)).to.equal(amount);

            // second deposit
            let amount2 = 17 * 10 ^ 18;

            await token.connect(owner).approve(vaultAddress, amount2);
            previousBalance = await token.balanceOf(vaultAddress);
            expect(await vaultInstance.connect(owner).deposit(anyAddress.address, tokenAddress, amount2))
                .to.emit(vaultInstance, 'VaultDeposit').withArgs(anyAddress.address, tokenAddress, amount, amount + amount2);;
            afterBalance = await token.balanceOf(vaultAddress);

            expect(BigInt(previousBalance) + BigInt(amount2)).equal(BigInt(afterBalance));
            expect(await vaultInstance.balanceOf(anyAddress.address, tokenAddress)).to.equal(BigInt(amount) + BigInt(amount2));
        });

        it('should revert deposit without deposit role ', async () => {

            const {
                vaultInstance,
                owner,
                anyAddress,
                token,
                vaultAddress,
            } = await loadFixture(deploy);

            //first deposit
            let amount = 15 * 10 ^ 18;
            await token.connect(owner).approve(vaultAddress, amount);

            await expect(vaultInstance.connect(owner).deposit(anyAddress.address, ethers.ZeroAddress, amount))
                .to.revertedWithCustomError(vaultInstance, 'AccessControlUnauthorizedAccount')
                .withArgs(owner.address, await vaultInstance.DEPOSIT_ROLE());
        });

        it(' deposit should revert for zero subject token address', async () => {

            const {
                vaultInstance,
                owner,
                token,
                vaultAddress,
                tokenAddress
            } = await loadFixture(deploy);

            //first deposit
            let amount = 15 * 10 ^ 18;
            await token.connect(owner).approve(vaultAddress, amount);

            await vaultInstance.connect(owner).grantRole(await vaultInstance.DEPOSIT_ROLE(), owner.address);
            await expect(vaultInstance.connect(owner).deposit(ethers.ZeroAddress, tokenAddress, amount))
                .to.revertedWithCustomError(vaultInstance, 'InvalidSubjectToken');

        });

        it(' deposit should revert for zero token address', async () => {

            const {
                vaultInstance,
                owner,
                anyAddress,
                token,
                vaultAddress,
            } = await loadFixture(deploy);

            //first deposit
            let amount = 15 * 10 ^ 18;
            await token.connect(owner).approve(vaultAddress, amount);

            await vaultInstance.connect(owner).grantRole(await vaultInstance.DEPOSIT_ROLE(), owner.address);
            await expect(vaultInstance.connect(owner).deposit(anyAddress.address, ethers.ZeroAddress, amount))
                .to.revertedWithCustomError(vaultInstance, 'InvalidToken');

        });

        it(' deposit should revert for zero amount', async () => {

            const {
                vaultInstance,
                owner,
                anyAddress,
                token,
                vaultAddress,
                tokenAddress
            } = await loadFixture(deploy);

            //first deposit
            let amount = 0;
            await token.connect(owner).approve(vaultAddress, amount);

            await vaultInstance.connect(owner).grantRole(await vaultInstance.DEPOSIT_ROLE(), owner.address);
            await expect(vaultInstance.connect(owner).deposit(anyAddress.address, tokenAddress, amount))
                .to.revertedWithCustomError(vaultInstance, 'InvalidAmount');

        });

        it(' deposit should revert if funds cannot be transferred', async () => {

            const {
                vaultInstance,
                owner,
                anyAddress,
                token,
                vaultAddress,
                tokenAddress
            } = await loadFixture(deploy);

            //first deposit
            let amount = 10 * 10 ^ 18;

            await vaultInstance.connect(owner).grantRole(await vaultInstance.DEPOSIT_ROLE(), owner.address);
            await expect(vaultInstance.connect(owner).deposit(anyAddress.address, tokenAddress, amount))
                .to.revertedWithCustomError(token, 'ERC20InsufficientAllowance');

        });

    });

    describe('transfer', () => {

        it('should allow transfer', async () => {
            const {
                vaultInstance,
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

            await vaultInstance.connect(owner).grantRole(await vaultInstance.DEPOSIT_ROLE(), owner.address);

            expect(await vaultInstance.connect(owner).deposit(anyAddress.address, tokenAddress, amount))
                .to.emit(vaultInstance, 'VaultDeposit').withArgs(anyAddress.address, tokenAddress, amount, amount);

            await vaultInstance.connect(owner).grantRole((await vaultInstance.TRANSFER_ROLE()), signer1.address);
            const transferAmount = 1 * 10 ^ 18;
            const benficiary = owner;
            const previousBalance = await token.balanceOf(benficiary.address)

            expect(await vaultInstance.connect(signer1).transfer(
                anyAddress.address,
                tokenAddress,
                benficiary.address,
                transferAmount
            )).to.emit(vaultInstance, 'VaultTransfer').withArgs(anyAddress.address, tokenAddress, benficiary, transferAmount, amount - transferAmount);

            const afterBalance = await token.balanceOf(benficiary.address);

            expect(BigInt(afterBalance) - BigInt(previousBalance)).to.equal(BigInt(transferAmount));
        });

        it('should not allow transfer when paused', async () => {
            const {
                vaultInstance,
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

            await vaultInstance.connect(owner).grantRole(await vaultInstance.DEPOSIT_ROLE(), owner.address);

            expect(await vaultInstance.connect(owner).deposit(anyAddress.address, tokenAddress, amount))
                .to.emit(vaultInstance, 'VaultDeposit').withArgs(anyAddress.address, tokenAddress, amount, amount);

            await vaultInstance.connect(owner).grantRole((await vaultInstance.TRANSFER_ROLE()), signer1.address);
            const transferAmount = 1 * 10 ^ 18;
            const benficiary = owner;
            const previousBalance = await token.balanceOf(benficiary.address)

            await vaultInstance.connect(owner).grantRole(await vaultInstance.PAUSE_ROLE(), owner.address);
            await vaultInstance.connect(owner).pause();
            await expect(vaultInstance.connect(signer1).transfer(
                anyAddress.address,
                tokenAddress,
                benficiary.address,
                transferAmount
            )).to.revertedWithCustomError(vaultInstance, "EnforcedPause");
        });

        it('should not allow transfer more than deposit', async () => {
            const {
                vaultInstance,
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

            await vaultInstance.connect(owner).grantRole(await vaultInstance.DEPOSIT_ROLE(), owner.address);

            expect(await vaultInstance.connect(owner).deposit(anyAddress.address, tokenAddress, amount))
                .to.emit(vaultInstance, 'VaultDeposit').withArgs(anyAddress.address, tokenAddress, amount, amount);

            await vaultInstance.connect(owner).grantRole((await vaultInstance.TRANSFER_ROLE()), signer1.address);
            const transferAmount = 1000 * 10 ^ 18;
            const benficiary = owner;

            await expect(vaultInstance.connect(signer1).transfer(
                anyAddress.address,
                tokenAddress,
                benficiary.address,
                transferAmount
            )).to.revertedWithCustomError(vaultInstance, "InvalidReserveBalance");
        });

        it('should only allow transfer with the transfer role', async () => {
            const {
                vaultInstance,
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

            await vaultInstance.connect(owner).grantRole(await vaultInstance.DEPOSIT_ROLE(), owner.address);

            expect(await vaultInstance.connect(owner).deposit(anyAddress.address, tokenAddress, amount))
                .to.emit(vaultInstance, 'VaultDeposit').withArgs(anyAddress.address, tokenAddress, amount, amount);

            const transferAmount = 1 * 10 ^ 18;
            const benficiary = owner;
            await expect(vaultInstance.connect(signer1).transfer(
                anyAddress.address,
                tokenAddress,
                benficiary.address,
                transferAmount
            )).to.revertedWithCustomError(vaultInstance, "AccessControlUnauthorizedAccount");
        });


        it('should not allow zero subject address ', async () => {

            const {
                vaultInstance,
                anyAddress,
                owner,
                token,
                vaultAddress,
                tokenAddress,
                signer1
            } = await loadFixture(deploy);

            let amount = 15 * 10 ^ 18;
            await token.connect(owner).approve(vaultAddress, amount);

            await vaultInstance.connect(owner).grantRole(await vaultInstance.DEPOSIT_ROLE(), owner.address);

            await vaultInstance.connect(owner).grantRole((await vaultInstance.TRANSFER_ROLE()), signer1.address);
            expect(await vaultInstance.connect(owner).deposit(anyAddress.address, tokenAddress, amount))
                .to.emit(vaultInstance, 'VaultDeposit').withArgs(anyAddress.address, tokenAddress, amount, amount);

            const transferAmount = 1 * 10 ^ 18;
            const benficiary = owner;
            await expect(vaultInstance.connect(signer1).transfer(
                ethers.ZeroAddress,
                tokenAddress,
                benficiary.address,
                transferAmount
            )).to.revertedWithCustomError(vaultInstance, "InvalidSubjectToken");

        });

        it('should not allow zero token address ', async () => {

            const {
                vaultInstance,
                anyAddress,
                owner,
                token,
                vaultAddress,
                tokenAddress,
                signer1
            } = await loadFixture(deploy);

            let amount = 15 * 10 ^ 18;
            await token.connect(owner).approve(vaultAddress, amount);

            await vaultInstance.connect(owner).grantRole(await vaultInstance.DEPOSIT_ROLE(), owner.address);

            await vaultInstance.connect(owner).grantRole((await vaultInstance.TRANSFER_ROLE()), signer1.address);
            expect(await vaultInstance.connect(owner).deposit(anyAddress.address, tokenAddress, amount))
                .to.emit(vaultInstance, 'VaultDeposit').withArgs(anyAddress.address, tokenAddress, amount, amount);

            const transferAmount = 1 * 10 ^ 18;
            const benficiary = owner;
            await expect(vaultInstance.connect(signer1).transfer(
                anyAddress.address,
                ethers.ZeroAddress,
                benficiary.address,
                transferAmount
            )).to.revertedWithCustomError(vaultInstance, "InvalidToken");

        });


        it('should not allow transfer to zero  address ', async () => {

            const {
                vaultInstance,
                anyAddress,
                owner,
                token,
                vaultAddress,
                tokenAddress,
                signer1
            } = await loadFixture(deploy);

            let amount = 15 * 10 ^ 18;
            await token.connect(owner).approve(vaultAddress, amount);
            await vaultInstance.connect(owner).grantRole(await vaultInstance.DEPOSIT_ROLE(), owner.address);
            await vaultInstance.connect(owner).grantRole((await vaultInstance.TRANSFER_ROLE()), signer1.address);
            expect(await vaultInstance.connect(owner).deposit(anyAddress.address, tokenAddress, amount))
                .to.emit(vaultInstance, 'VaultDeposit').withArgs(anyAddress.address, tokenAddress, amount, amount);

            const transferAmount = 1 * 10 ^ 18;
            await expect(vaultInstance.connect(signer1).transfer(
                anyAddress.address,
                tokenAddress,
                ethers.ZeroAddress,
                transferAmount
            )).to.revertedWithCustomError(vaultInstance, "InvalidToAddress");
        });


        it('should not allow zero transfer amount', async () => {

            const {
                vaultInstance,
                anyAddress,
                owner,
                token,
                vaultAddress,
                tokenAddress,
                signer1
            } = await loadFixture(deploy);

            let amount = 15 * 10 ^ 18;
            await token.connect(owner).approve(vaultAddress, amount);
            await vaultInstance.connect(owner).grantRole(await vaultInstance.DEPOSIT_ROLE(), owner.address);
            await vaultInstance.connect(owner).grantRole((await vaultInstance.TRANSFER_ROLE()), signer1.address);
            expect(await vaultInstance.connect(owner).deposit(anyAddress.address, tokenAddress, amount))
                .to.emit(vaultInstance, 'VaultDeposit').withArgs(anyAddress.address, tokenAddress, amount, amount);

            const benficiary = owner;
            await expect(vaultInstance.connect(signer1).transfer(
                anyAddress.address,
                tokenAddress,
                benficiary.address,
                0
            )).to.revertedWithCustomError(vaultInstance, "InvalidAmount");

        });

    });

});