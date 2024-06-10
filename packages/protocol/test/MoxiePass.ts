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
                moxiePass
            } = await loadFixture(deploy);


            await expect(moxiePass.connect(minter).mint(deployer.address)).to.emit(
                moxiePass,
                "Transfer"
            ).withArgs(ethers.ZeroAddress, deployer.address, "0");

            expect(await moxiePass.tokenURI("0")).to.equal("https://moxie.xyz/moxie-pass/0");
        });

        it('should mint if minter doesnot has minter role ', async () => {
            const {
                deployer,
                moxiePass
            } = await loadFixture(deploy);


            await expect(moxiePass.connect(deployer).mint(deployer.address)).to.revertedWithCustomError(
                moxiePass,
                "AccessControlUnauthorizedAccount"
            ).withArgs(deployer.address, await moxiePass.MINTER_ROLE());
        });
    });

    describe('supportsInterface', () => {

        it('should return true for eip 165 ', async () => {
            const {
                minter,
                deployer,
                moxiePass
            } = await loadFixture(deploy);

            expect(await moxiePass.connect(minter).supportsInterface("0x01ffc9a7")).to.be.true;

        });
    });
});