import { expect } from "chai";
import hre, { ethers } from "hardhat";

describe('Moxie Token', () => {

    describe('Verify Deployment', () => {

        it('verify deployment', async () => {

            const [deployer] = await ethers.getSigners();

            const MoxieToken = await hre.ethers.getContractFactory('MoxieToken');

            const moxieToken = await MoxieToken.connect(deployer).deploy();

            expect(await moxieToken.name()).equal("Moxie");
            expect(await moxieToken.symbol()).equal("MOXIE");
            const totalSupply = "10000000000000000000000000000";
            expect(await moxieToken.totalSupply()).equal(BigInt(totalSupply));
            expect(await moxieToken.balanceOf(deployer.address)).to.equal(totalSupply);
        });

    });

    describe('Burn', () => {

        it('allow burn & it should reduce total supploy', async () => {

            const [deployer] = await ethers.getSigners();

            const MoxieToken = await hre.ethers.getContractFactory('MoxieToken');

            const moxieToken = await MoxieToken.connect(deployer).deploy();


            const totalSupply = "10000000000000000000000000000";
            expect(await moxieToken.totalSupply()).equal(BigInt(totalSupply));

            const burnAmount = "10000";
            expect(await moxieToken.connect(deployer).burn(burnAmount))
                .to.emit(moxieToken, "Transfer").withArgs(
                    deployer.address,
                    ethers.ZeroAddress,
                    burnAmount
                );

            expect(await moxieToken.totalSupply()).equal(BigInt(totalSupply)-BigInt(burnAmount));

        });

    });

});