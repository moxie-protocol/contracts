import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";
import { randomBytes, ZeroAddress, zeroPadBytes } from "ethers";

const MAGIC_VALUE = "0x19a05a7e";

describe("AllowListVerifier", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployAllowListVerifierFixture() {
    // Contracts are deployed using the first signer/account by default
    const [deployer, owner, signer1, signer2] = await hre.ethers.getSigners();

    const MoxiePassVerifier =
      await hre.ethers.getContractFactory("MoxiePassVerifier");
    const MockERC721 = await hre.ethers.getContractFactory("MockERC721");
    const mockErc721 = await MockERC721.deploy("MockERC721", "M721");
    const moxiePassVerifier = await MoxiePassVerifier.deploy(owner.address);

    return { deployer, owner, mockErc721, moxiePassVerifier, signer1, signer2 };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { owner, moxiePassVerifier } = await loadFixture(
        deployAllowListVerifierFixture,
      );

      expect(await moxiePassVerifier.owner()).to.equal(owner.address);
    });

    it("Should have zero address for ERC721 contract", async function () {
      const { deployer, owner, mockErc721, moxiePassVerifier } =
        await loadFixture(deployAllowListVerifierFixture);
      expect(await moxiePassVerifier.erc721ContractAddress()).to.equal(
        ZeroAddress,
      );
    });
  });

  describe("setErc721ContractAddress", function () {
    it("Should not set the ERC721 address by non owner address", async function () {
      const { owner, moxiePassVerifier, mockErc721, signer1 } =
        await loadFixture(deployAllowListVerifierFixture);
      const moxiePassContractAddress = mockErc721.getAddress();

      // While setting the ERC721 contract address by non-owner address, it should revert
      await expect(
        moxiePassVerifier
          .connect(signer1)
          .setErc721ContractAddress(moxiePassContractAddress),
      ).to.be.revertedWithCustomError(
        moxiePassVerifier,
        "OwnableUnauthorizedAccount",
      );

      // Check that the ERC721 contract address is not set
      expect(await moxiePassVerifier.erc721ContractAddress()).to.equal(
        ZeroAddress,
      );
    });

    it("Should set the ERC721 address by owner address", async function () {
      const { owner, moxiePassVerifier, signer1 } = await loadFixture(
        deployAllowListVerifierFixture,
      );
      // Set the new ERC721 contract address
      await moxiePassVerifier
        .connect(owner)
        .setErc721ContractAddress(signer1.address);

      // Check that the ERC721 contract address is set
      expect(await moxiePassVerifier.erc721ContractAddress()).to.equal(
        signer1.address,
      );
    });
  });

  describe("isMoxiePassHolder", function () {
    it("Should return true if the ERC721 token address is not set", async function () {
      const { moxiePassVerifier, signer1 } = await loadFixture(
        deployAllowListVerifierFixture,
      );

      expect(await moxiePassVerifier.isMoxiePassHolder(signer1.address)).to.be
        .true;
    });

    it("Should return false if the wallet address does not owns ERC721 token", async function () {
      const { owner, moxiePassVerifier, mockErc721, signer1 } =
        await loadFixture(deployAllowListVerifierFixture);
      // Set the new ERC721 contract address
      await moxiePassVerifier
        .connect(owner)
        .setErc721ContractAddress(await mockErc721.getAddress());

      expect(await moxiePassVerifier.isMoxiePassHolder(signer1.address)).to.be
        .false;
    });

    it("Should return true if the wallet address owns ERC721 token", async function () {
      const { owner, moxiePassVerifier, mockErc721, signer1 } =
        await loadFixture(deployAllowListVerifierFixture);
      // Set the new ERC721 contract address
      await moxiePassVerifier
        .connect(owner)
        .setErc721ContractAddress(await mockErc721.getAddress());

      await mockErc721.connect(owner).mint(signer1.address, 2);

      expect(await moxiePassVerifier.isMoxiePassHolder(signer1.address)).to.be
        .true;
    });
  });

  describe("onlyMoxiePassHolder", function () {
    async function deployMockAllowListVerifierFixture() {
      // Contracts are deployed using the first signer/account by default
      const [deployer, owner, signer1, signer2] = await hre.ethers.getSigners();

      const MoxiePassVerifier = await hre.ethers.getContractFactory(
        "MockMoxiePassVerifier",
      );
      const MockERC721 = await hre.ethers.getContractFactory("MockERC721");
      const mockErc721 = await MockERC721.deploy("MockERC721", "M721");
      const moxiePassVerifier = await MoxiePassVerifier.deploy(owner.address);

      return {
        deployer,
        owner,
        mockErc721,
        moxiePassVerifier,
        signer1,
        signer2,
      };
    }

    it("Should return true if the ERC721 token address is not set", async function () {
      const { owner, moxiePassVerifier } = await loadFixture(
        deployMockAllowListVerifierFixture,
      );

      await moxiePassVerifier
        .connect(owner)
        .setErc721ContractAddress(ZeroAddress);

      expect(await moxiePassVerifier.testModifier()).to.be.true;
    });

    it("Should throw error if the ERC721 token is valid but the wallet address does not hold token", async function () {
      const { owner, moxiePassVerifier, mockErc721, signer2 } =
        await loadFixture(deployMockAllowListVerifierFixture);
      // Set the new ERC721 contract address
      await moxiePassVerifier
        .connect(owner)
        .setErc721ContractAddress(await mockErc721.getAddress());

      await expect(
        moxiePassVerifier.connect(signer2).testModifier(),
      ).to.be.revertedWithCustomError(moxiePassVerifier, "MoxiePassVerifier_NotaMoxiePassHolder");
    });

    it("Should throw error if the wallet address does not owns ERC721 token", async function () {
      const { owner, moxiePassVerifier, mockErc721 } = await loadFixture(
        deployMockAllowListVerifierFixture,
      );
      // Set the new ERC721 contract address
      await moxiePassVerifier
        .connect(owner)
        .setErc721ContractAddress(await mockErc721.getAddress());

      expect(
        await moxiePassVerifier.testModifier(),
      ).to.be.revertedWithCustomError(moxiePassVerifier, "MoxiePassVerifier_NotaMoxiePassHolder");
    });

    it("Should not throw error if the wallet address owns ERC721 token", async function () {
      const { owner, moxiePassVerifier, mockErc721, signer1 } =
        await loadFixture(deployMockAllowListVerifierFixture);
      // Set the new ERC721 contract address
      await moxiePassVerifier
        .connect(owner)
        .setErc721ContractAddress(await mockErc721.getAddress());

      await mockErc721.connect(owner).mint(signer1.address, 2);

      expect(await moxiePassVerifier.testModifier()).to.be.true;
    });
  });

  describe("isAllowed", function () {
    it("Should return magic value if the ERC721 token address is not set", async function () {
      const { moxiePassVerifier, signer1 } = await loadFixture(
        deployAllowListVerifierFixture,
      );

      expect(
        await moxiePassVerifier.isAllowed(signer1.address, 1, randomBytes(32)),
      ).to.equal(MAGIC_VALUE);
    });

    it("Should return zero bytes if the wallet address does not owns ERC721 token", async function () {
      const { owner, moxiePassVerifier, mockErc721, signer1 } =
        await loadFixture(deployAllowListVerifierFixture);
      // Set the new ERC721 contract address
      await moxiePassVerifier
        .connect(owner)
        .setErc721ContractAddress(await mockErc721.getAddress());

      expect(
        await moxiePassVerifier.isAllowed(signer1.address, 1, randomBytes(32)),
      ).to.equal("0x00000000");
    });

    it("Should return zero bytes if the wallet address is zero", async function () {
      const { owner, moxiePassVerifier, mockErc721, signer1 } =
        await loadFixture(deployAllowListVerifierFixture);
      // Set the new ERC721 contract address
      await moxiePassVerifier
        .connect(owner)
        .setErc721ContractAddress(await mockErc721.getAddress());

      expect(
        await moxiePassVerifier.isAllowed(ZeroAddress, 1, randomBytes(32)),
      ).to.equal("0x00000000");
    });

    it("Should return zero bytes if the auction id is 0", async function () {
      const { owner, moxiePassVerifier, mockErc721, signer1 } =
        await loadFixture(deployAllowListVerifierFixture);
      // Set the new ERC721 contract address
      await moxiePassVerifier
        .connect(owner)
        .setErc721ContractAddress(await mockErc721.getAddress());

      expect(
        await moxiePassVerifier.isAllowed(signer1.address, 0, randomBytes(32)),
      ).to.equal("0x00000000");
    });

    it("Should return magic value if the wallet address owns ERC721 token", async function () {
      const { owner, moxiePassVerifier, mockErc721, signer1 } =
        await loadFixture(deployAllowListVerifierFixture);
      // Set the new ERC721 contract address
      await moxiePassVerifier
        .connect(owner)
        .setErc721ContractAddress(await mockErc721.getAddress());

      await mockErc721.connect(owner).mint(signer1.address, 2);

      expect(
        await moxiePassVerifier.isAllowed(signer1.address, 1, randomBytes(32)),
      ).to.equal(MAGIC_VALUE);
    });
  });
});
