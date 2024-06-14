import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";

describe('Moxie Pass', () => {


    const deploy = async () => {
        const [deployer, owner, minter] = await ethers.getSigners();

        const MoxiePass = await hre.ethers.getContractFactory('MoxiePass');
        const moxiePass = await MoxiePass.deploy(owner.address, minter.address);

        return { deployer, owner, minter, moxiePass }

    }
    describe('Deployment', () => {

        it('verify deployment ', async () => {
            const {
                minter,
                owner,
                moxiePass
            } = await loadFixture(deploy);


            expect(await moxiePass.hasRole(await moxiePass.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
            expect(await moxiePass.hasRole(await moxiePass.MINTER_ROLE(), minter.address)).to.be.true;
            expect(await moxiePass.name()).to.equal("Moxie Pass");
            expect(await moxiePass.symbol()).to.equal("MXP");
        });

        it('should fail for zero default admin', async () => {

            const [minter] = await ethers.getSigners();
            const MoxiePass = await hre.ethers.getContractFactory('MoxiePass');
            await expect(MoxiePass.deploy(ethers.ZeroAddress, minter.address)).to.revertedWithCustomError(
                MoxiePass, "MoxiePass_InvalidAdmin"
            );
        });

        it('should fail for zero minter', async () => {

            const [owner] = await ethers.getSigners();
            const MoxiePass = await hre.ethers.getContractFactory('MoxiePass');
            await expect(MoxiePass.deploy(owner.address, ethers.ZeroAddress)).to.revertedWithCustomError(
                MoxiePass, "MoxiePass_InvalidMinter"
            );

        });

    });

    describe('mint', () => {

        it('should mint with wallet with minter role ', async () => {
            const {
                minter,
                deployer,
                moxiePass,
                owner
            } = await loadFixture(deploy);

            const uri = "uri-1";

            await expect(moxiePass.connect(minter).mint(deployer.address, uri)).to.emit(
                moxiePass,
                "Transfer"
            ).withArgs(ethers.ZeroAddress, deployer.address, "0");

            expect(await moxiePass.tokenURI("0")).to.equal("uri-1");

            await expect(moxiePass.connect(minter).mint(minter.address, "uri-2")).to.emit(
                moxiePass,
                "Transfer"
            ).withArgs(ethers.ZeroAddress, minter.address, "1");

            expect(await moxiePass.tokenURI("1")).to.equal("uri-2");

            await expect(moxiePass.connect(minter).mint(owner.address, "uri-3")).to.emit(
                moxiePass,
                "Transfer"
            ).withArgs(ethers.ZeroAddress, owner.address, "2");

            expect(await moxiePass.tokenURI("2")).to.equal("uri-3");

        });

        it('should not allow mint more than once', async () => {
            const {
                minter,
                deployer,
                moxiePass,
                owner
            } = await loadFixture(deploy);

            const uri = "uri-1";

            await expect(moxiePass.connect(minter).mint(deployer.address, uri)).to.emit(
                moxiePass,
                "Transfer"
            ).withArgs(ethers.ZeroAddress, deployer.address, "0");

            expect(await moxiePass.tokenURI("0")).to.equal("uri-1");


            await expect(moxiePass.connect(minter).mint(deployer.address, "uri")).to.revertedWithCustomError(
                moxiePass,
                "MoxiePass_OnlyOneMintAllowed"
            );

        });

        it('should not mint if minter doesnot has minter role ', async () => {
            const {
                deployer,
                moxiePass
            } = await loadFixture(deploy);


            await expect(moxiePass.connect(deployer).mint(deployer.address, "uri")).to.revertedWithCustomError(
                moxiePass,
                "AccessControlUnauthorizedAccount"
            ).withArgs(deployer.address, await moxiePass.MINTER_ROLE());
        });
    });

    describe('transfer', () => {

        it('should not allow transfer of tokens ', async () => {
            const {
                minter,
                deployer,
                moxiePass
            } = await loadFixture(deploy);


            await moxiePass.connect(minter).mint(deployer.address, "uri");
            await moxiePass.connect(deployer).approve(minter.address, 0);

            await expect(moxiePass.connect(minter).transferFrom(deployer.address, minter.address, 0))
                .revertedWithCustomError(moxiePass, "MoxiePass_TransferNotAllowed");
        });

    });

    describe('supportsInterface', () => {

        it('should return true for eip 165 ', async () => {
            const {
                minter,
                moxiePass
            } = await loadFixture(deploy);

            expect(await moxiePass.connect(minter).supportsInterface("0x01ffc9a7")).to.be.true;

        });

        it('should return false not supported interface ', async () => {
            const {
                minter,
                moxiePass
            } = await loadFixture(deploy);

            expect(await moxiePass.connect(minter).supportsInterface("0x11ffc9a7")).to.be.false;

        });
    });
});