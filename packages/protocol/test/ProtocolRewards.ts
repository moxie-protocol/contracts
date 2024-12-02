import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";

describe('Protocol Rewards', () => {

    const deploy = async () => {
        const [deployer, owner] = await ethers.getSigners();

        const MoxieToken = await hre.ethers.getContractFactory("MoxieToken");
        const ProtocolRewards = await hre.ethers.getContractFactory('ProtocolRewards');


        const moxieToken = await MoxieToken.connect(owner).deploy();
        const protocolRewards = await ProtocolRewards.connect(deployer).deploy();


        const moxieTokenAddress = await moxieToken.getAddress();

        await protocolRewards.initialize(
            moxieTokenAddress,
            owner
        );

        return {
            ProtocolRewards,
            moxieToken,
            moxieTokenAddress,
            protocolRewards,
            owner,
            deployer
        }

    }
    describe('Verify Deployment', () => {

        it('verify deployment', async () => {

            const {
                moxieTokenAddress,
                protocolRewards,
                owner

            } = await loadFixture(deploy);

            expect(await protocolRewards.hasRole(await protocolRewards.DEFAULT_ADMIN_ROLE(), owner.address)).to.true;
            expect(await protocolRewards.token()).to.equal(moxieTokenAddress);

        });


        it('should fail for zero adress input', async () => {

            const {
                ProtocolRewards,
                owner,
                deployer,
                moxieTokenAddress
            } = await loadFixture(deploy);

            const protocolRewards = await ProtocolRewards.connect(deployer).deploy();

            await expect(protocolRewards.initialize(
                ethers.ZeroAddress,
                owner
            )).to.revertedWithCustomError(protocolRewards, "PROTOCOL_REWARDS_ADDRESS_ZERO");


            await expect(protocolRewards.initialize(
                moxieTokenAddress,
                ethers.ZeroAddress,
            )).to.revertedWithCustomError(protocolRewards, "PROTOCOL_REWARDS_ADDRESS_ZERO");

        });

        it('should fail to initialize if alreday initialized', async () => {

            const {
                ProtocolRewards,
                owner,
                deployer,
                moxieTokenAddress
            } = await loadFixture(deploy);

            const protocolRewards = await ProtocolRewards.connect(deployer).deploy();

            await protocolRewards.initialize(
                moxieTokenAddress,
                owner
            );

            await expect(protocolRewards.initialize(
                moxieTokenAddress,
                ethers.ZeroAddress,
            )).to.revertedWithCustomError(protocolRewards, "InvalidInitialization");

        });

    });

    describe('deposit rewards', () => {

        it('should deposit rewards', async () => {
            const {
                owner,
                deployer,
                moxieToken,
                protocolRewards

            } = await loadFixture(deploy);


            const depositAmount = ethers.parseEther("100");
            const reason = ethers.id("PROTOCOL_FEE").slice(0, 10); // Get first 4 bytes
            const comment = "Test deposit";

            // Approve tokens first
            await moxieToken.connect(owner).approve(await protocolRewards.getAddress(), depositAmount);

            // Check events and balance changes
            await expect(protocolRewards.connect(owner).deposit(
                deployer.address,
                depositAmount,
                reason,
                comment
            )).to.emit(protocolRewards, "Deposit")
                .withArgs(owner.address, deployer.address, reason, depositAmount, comment);

            expect(await protocolRewards.balanceOf(deployer.address)).to.equal(depositAmount);
        });

        it('should revert when depositing to zero address', async () => {
            const {
                owner,
                moxieToken,
                protocolRewards
            } = await loadFixture(deploy);

            const depositAmount = ethers.parseEther("100");
            const reason = ethers.id("PROTOCOL_FEE").slice(0, 10);
            const comment = "Test deposit";

            await moxieToken.connect(owner).approve(await protocolRewards.getAddress(), depositAmount);

            await expect(protocolRewards.connect(owner).deposit(
                ethers.ZeroAddress,
                depositAmount,
                reason,
                comment
            )).to.be.revertedWithCustomError(protocolRewards, "PROTOCOL_REWARDS_ADDRESS_ZERO");
        });

        it('should revert when depositing without allowance', async () => {
            const {
                owner,
                deployer,
                moxieToken,
                protocolRewards
            } = await loadFixture(deploy);

            const depositAmount = ethers.parseEther("100");
            const reason = ethers.id("PROTOCOL_FEE").slice(0, 10);
            const comment = "Test deposit";

            // Don't approve tokens first
            await expect(protocolRewards.connect(owner).deposit(
                deployer.address,
                depositAmount,
                reason,
                comment
            )).to.be.revertedWithCustomError(moxieToken, "ERC20InsufficientAllowance");
        });

        it('should revert when depositing with insufficient balance', async () => {
            const {
                owner,
                deployer,
                moxieToken,
                protocolRewards
            } = await loadFixture(deploy);

            const depositAmount = ethers.parseEther("100000000000"); // Amount larger than total supply
            const reason = ethers.id("PROTOCOL_FEE").slice(0, 10);
            const comment = "Test deposit";

            await moxieToken.connect(deployer).approve(await protocolRewards.getAddress(), depositAmount);

            await expect(protocolRewards.connect(deployer).deposit(
                deployer.address,
                depositAmount,
                reason,
                comment
            )).to.be.revertedWithCustomError(moxieToken, "ERC20InsufficientBalance");
        });
    });

    describe('Deposit Batch', () => {
        it('should revert when recipients array is empty', async () => {
            const {
                owner,
                protocolRewards
            } = await loadFixture(deploy);

            const recipients: string[] = [];
            const amounts: bigint[] = [];
            const reasons = [ethers.id("PROTOCOL_FEE").slice(0, 10)];
            const comment = "Test batch deposit";

            await expect(protocolRewards.connect(owner).depositBatch(
                recipients,
                amounts,
                reasons,
                comment
            )).to.be.revertedWithCustomError(protocolRewards, "PROTOCOL_REWARDS_ARRAY_LENGTH_MISMATCH");
        });

        it('should revert when recipients and amounts arrays have different lengths', async () => {
            const {
                owner,
                deployer,
                protocolRewards
            } = await loadFixture(deploy);

            const recipients = [deployer.address];
            const amounts: bigint[] = [];
            const reasons = [ethers.id("PROTOCOL_FEE").slice(0, 10)];
            const comment = "Test batch deposit";

            await expect(protocolRewards.connect(owner).depositBatch(
                recipients,
                amounts,
                reasons,
                comment
            )).to.be.revertedWithCustomError(protocolRewards, "PROTOCOL_REWARDS_ARRAY_LENGTH_MISMATCH");
        });

        it('should revert when any recipient is zero address', async () => {
            const {
                owner,
                deployer,
                protocolRewards,
                moxieToken
            } = await loadFixture(deploy);

            const recipients = [deployer.address, ethers.ZeroAddress];
            const amounts = [ethers.parseEther("50"), ethers.parseEther("50")];
            const reasons = [ethers.id("PROTOCOL_FEE").slice(0, 10), ethers.id("PROTOCOL_FEE").slice(0, 10)];
            const comment = "Test batch deposit";

            await moxieToken.connect(owner).approve(await protocolRewards.getAddress(), amounts[0] + amounts[1]);
            await expect(protocolRewards.connect(owner).depositBatch(
                recipients,
                amounts,
                reasons,
                comment
            )).to.be.revertedWithCustomError(protocolRewards, "PROTOCOL_REWARDS_ADDRESS_ZERO");
        });

        it('should revert when depositing batch without allowance', async () => {
            const {
                owner,
                deployer,
                moxieToken,
                protocolRewards
            } = await loadFixture(deploy);

            const recipients = [deployer.address, owner.address];
            const amounts = [ethers.parseEther("50"), ethers.parseEther("50")];
            const reasons = [ethers.id("PROTOCOL_FEE").slice(0, 10), ethers.id("PROTOCOL_FEE").slice(0, 10)];
            const comment = "Test batch deposit";

            // Don't approve tokens first
            await expect(protocolRewards.connect(owner).depositBatch(
                recipients,
                amounts,
                reasons,
                comment
            )).to.be.revertedWithCustomError(moxieToken, "ERC20InsufficientAllowance");
        });

        it('should revert when batch depositing with insufficient balance', async () => {
            const {
                owner,
                deployer,
                moxieToken,
                protocolRewards
            } = await loadFixture(deploy);

            const recipients = [deployer.address, owner.address];
            const amounts = [ethers.parseEther("50000000000"), ethers.parseEther("50000000000")]; // Amounts larger than total supply
            const reasons = [ethers.id("PROTOCOL_FEE").slice(0, 10), ethers.id("PROTOCOL_FEE").slice(0, 10)];
            const comment = "Test batch deposit";

            await moxieToken.connect(deployer).approve(await protocolRewards.getAddress(), amounts[0] + amounts[1]);

            await expect(protocolRewards.connect(deployer).depositBatch(
                recipients,
                amounts,
                reasons,
                comment
            )).to.be.revertedWithCustomError(moxieToken, "ERC20InsufficientBalance");
        });

        it('should successfully deposit batch rewards', async () => {
            const {
                owner,
                deployer,
                moxieToken,
                protocolRewards
            } = await loadFixture(deploy);

            const recipients = [deployer.address, owner.address];
            const amounts = [ethers.parseEther("50"), ethers.parseEther("50")];
            const reasons = [ethers.id("PROTOCOL_FEE").slice(0, 10), ethers.id("PROTOCOL_FEE").slice(0, 10)];
            const comment = "Test batch deposit";

            // Approve tokens first
            await moxieToken.connect(owner).approve(await protocolRewards.getAddress(), amounts[0] + amounts[1]);

            // Initial balances
            const initialBalance0 = await protocolRewards.balanceOf(recipients[0]);
            const initialBalance1 = await protocolRewards.balanceOf(recipients[1]);

            await expect(protocolRewards.connect(owner).depositBatch(
                recipients,
                amounts,
                reasons,
                comment
            )).to.emit(protocolRewards, "Deposit")
                .withArgs(owner.address, recipients[0], reasons[0], amounts[0], comment)
                .to.emit(protocolRewards, "Deposit")
                .withArgs(owner.address, recipients[1], reasons[1], amounts[1], comment);

            // Verify balances updated correctly
            expect(await protocolRewards.balanceOf(recipients[0])).to.equal(initialBalance0 + amounts[0]);
            expect(await protocolRewards.balanceOf(recipients[1])).to.equal(initialBalance1 + amounts[1]);
            expect(await moxieToken.balanceOf(await protocolRewards.getAddress())).to.equal(amounts[0] + amounts[1]);
        });
    });

    describe("withdraw", () => {
        it("should revert when withdrawing with zero address", async () => {
            const { protocolRewards } = await loadFixture(deploy);

            await expect(protocolRewards.withdraw(
                ethers.ZeroAddress,
                ethers.parseEther("50")
            )).to.be.revertedWithCustomError(protocolRewards, "PROTOCOL_REWARDS_ADDRESS_ZERO");
        });

        it("should revert when withdrawing more than balance", async () => {
            const { owner, protocolRewards, moxieToken } = await loadFixture(deploy);

            // First deposit some rewards
            const depositAmount = ethers.parseEther("40");
            await moxieToken.connect(owner).approve(await protocolRewards.getAddress(), depositAmount);
            await protocolRewards.connect(owner).deposit(
                owner.address,
                depositAmount,
                ethers.id("PROTOCOL_FEE").slice(0, 10),
                "Test deposit"
            );
            await expect(protocolRewards.withdraw(
                owner.address,
                ethers.parseEther("50")
            )).to.be.revertedWithCustomError(protocolRewards, "PROTOCOL_REWARDS_INVALID_WITHDRAW");
        });

        it("should successfully withdraw rewards", async () => {
            const {
                owner,
                deployer,
                moxieToken,
                protocolRewards
            } = await loadFixture(deploy);

            // First deposit some rewards
            const depositAmount = ethers.parseEther("100");
            await moxieToken.connect(owner).approve(await protocolRewards.getAddress(), depositAmount);
            await protocolRewards.connect(owner).deposit(
                deployer.address,
                depositAmount,
                ethers.id("PROTOCOL_FEE").slice(0, 10),
                "Test deposit"
            );

            // Initial balances
            const initialBalance = await moxieToken.balanceOf(owner.address);
            const initialRewardsBalance = await protocolRewards.balanceOf(deployer.address);

            // Withdraw half the rewards
            const withdrawAmount = ethers.parseEther("50");
            await expect(protocolRewards.connect(deployer).withdraw(
                owner.address,
                withdrawAmount
            )).to.emit(protocolRewards, "Withdraw")
                .withArgs(deployer.address, owner.address, withdrawAmount);

            // Verify balances updated correctly
            expect(await protocolRewards.balanceOf(deployer.address)).to.equal(initialRewardsBalance - withdrawAmount);
            expect(await moxieToken.balanceOf(owner.address)).to.equal(initialBalance + withdrawAmount);
        });

        it("should withdraw full balance when amount is zero", async () => {
            const {
                owner,
                deployer,
                moxieToken,
                protocolRewards
            } = await loadFixture(deploy);

            // First deposit some rewards
            const depositAmount = ethers.parseEther("100");
            await moxieToken.connect(owner).approve(await protocolRewards.getAddress(), depositAmount);
            await protocolRewards.connect(owner).deposit(
                deployer.address,
                depositAmount,
                ethers.id("PROTOCOL_FEE").slice(0, 10),
                "Test deposit"
            );

            // Initial balances
            const initialBalance = await moxieToken.balanceOf(owner.address);
            const initialRewardsBalance = await protocolRewards.balanceOf(deployer.address);

            // Withdraw with amount = 0 should withdraw full balance
            await expect(protocolRewards.connect(deployer).withdraw(
                owner.address,
                0
            )).to.emit(protocolRewards, "Withdraw")
                .withArgs(deployer.address, owner.address, initialRewardsBalance);

            // Verify balances updated correctly
            expect(await protocolRewards.balanceOf(deployer.address)).to.equal(0);
            expect(await moxieToken.balanceOf(owner.address)).to.equal(initialBalance + initialRewardsBalance);
        });

        it("should revert when withdrawing while blocked", async () => {
            const {
                owner,
                deployer,
                protocolRewards
            } = await loadFixture(deploy);

            // Block the deployer address
            await protocolRewards.connect(owner).grantRole(await protocolRewards.BLOCK_UNBLOCK_ROLE(), owner.address);
            await protocolRewards.connect(owner).addToBlockList(deployer.address);

            await expect(protocolRewards.connect(deployer).withdraw(
                owner.address,
                ethers.parseEther("50")
            )).to.be.revertedWithCustomError(protocolRewards, "PROTOCOL_REWARDS_BLOCKED");
        });
    });

    describe("Withdraw with signature", () => {
        it("should allow withdrawal using valid signature", async () => {
            const {
                owner,
                deployer,
                moxieToken,
                protocolRewards
            } = await loadFixture(deploy);

            // First deposit some rewards
            const depositAmount = ethers.parseEther("100");
            await moxieToken.connect(owner).approve(await protocolRewards.getAddress(), depositAmount);
            await protocolRewards.connect(owner).deposit(
                deployer.address,
                depositAmount,
                ethers.id("PROTOCOL_FEE").slice(0, 10),
                "Test deposit"
            );

            const initialBalance = await moxieToken.balanceOf(owner.address);

            // Create signature
            const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
            const nonce = await protocolRewards.nonces(deployer.address);
            const domain = {
                name: "ProtocolRewards",
                version: "1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: await protocolRewards.getAddress()
            };

            const types = {
                Withdraw: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "amount", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                from: deployer.address,
                to: owner.address,
                amount: depositAmount,
                nonce: nonce,
                deadline: deadline
            };

            const signature = await deployer.signTypedData(domain, types, value);
            const { v, r, s } = ethers.Signature.from(signature);

            // Execute withdraw with signature
            await expect(protocolRewards.withdrawWithSig(
                deployer.address,
                owner.address,
                depositAmount,
                deadline,
                v,
                r,
                s
            )).to.emit(protocolRewards, "Withdraw")
                .withArgs(deployer.address, owner.address, depositAmount);

            // Verify balances
            expect(await protocolRewards.balanceOf(deployer.address)).to.equal(0);
            expect(await moxieToken.balanceOf(owner.address)).to.equal(initialBalance + depositAmount);
        });

        it("should revert with expired deadline", async () => {
            const {
                owner,
                deployer,
                protocolRewards
            } = await loadFixture(deploy);

            const deadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
            const nonce = await protocolRewards.nonces(deployer.address);

            const domain = {
                name: "ProtocolRewards",
                version: "1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: await protocolRewards.getAddress()
            };

            const types = {
                Withdraw: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "amount", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                from: deployer.address,
                to: owner.address,
                amount: ethers.parseEther("50"),
                nonce: nonce,
                deadline: deadline
            };

            const signature = await deployer.signTypedData(domain, types, value);
            const { v, r, s } = ethers.Signature.from(signature);

            await expect(protocolRewards.withdrawWithSig(
                deployer.address,
                owner.address,
                ethers.parseEther("50"),
                deadline,
                v,
                r,
                s
            )).to.be.revertedWithCustomError(protocolRewards, "PROTOCOL_REWARDS_SIGNATURE_DEADLINE_EXPIRED");
        });

        it("should revert with invalid signature", async () => {
            const {
                owner,
                deployer,
                protocolRewards
            } = await loadFixture(deploy);

            const deadline = Math.floor(Date.now() / 1000) + 3600;

            // Use wrong signer to generate invalid signature
            const wrongSigner = owner; // Using owner instead of deployer
            const nonce = await protocolRewards.nonces(deployer.address);

            const domain = {
                name: "ProtocolRewards",
                version: "1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: await protocolRewards.getAddress()
            };

            const types = {
                Withdraw: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "amount", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                from: deployer.address,
                to: owner.address,
                amount: ethers.parseEther("50"),
                nonce: nonce,
                deadline: deadline
            };

            const signature = await wrongSigner.signTypedData(domain, types, value);
            const { v, r, s } = ethers.Signature.from(signature);

            await expect(protocolRewards.withdrawWithSig(
                deployer.address,
                owner.address,
                ethers.parseEther("50"),
                deadline,
                v,
                r,
                s
            )).to.be.revertedWithCustomError(protocolRewards, "PROTOCOL_REWARDS_INVALID_SIGNATURE");
        });

        it("should revert when withdrawing while blocked", async () => {
            const {
                owner,
                deployer,
                protocolRewards
            } = await loadFixture(deploy);

            // Block the deployer address
            await protocolRewards.connect(owner).grantRole(await protocolRewards.BLOCK_UNBLOCK_ROLE(), owner.address);
            await protocolRewards.connect(owner).addToBlockList(deployer.address);

            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const nonce = await protocolRewards.nonces(deployer.address);

            const domain = {
                name: "ProtocolRewards",
                version: "1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: await protocolRewards.getAddress()
            };

            const types = {
                Withdraw: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "amount", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = {
                from: deployer.address,
                to: owner.address,
                amount: ethers.parseEther("50"),
                nonce: nonce,
                deadline: deadline
            };

            const signature = await deployer.signTypedData(domain, types, value);
            const { v, r, s } = ethers.Signature.from(signature);

            await expect(protocolRewards.withdrawWithSig(
                deployer.address,
                owner.address,
                ethers.parseEther("50"),
                deadline,
                v,
                r,
                s
            )).to.be.revertedWithCustomError(protocolRewards, "PROTOCOL_REWARDS_BLOCKED");
        });
    });

    describe("Block List", () => {
        it("should revert when adding zero address to block list", async () => {
            const {
                owner,
                protocolRewards
            } = await loadFixture(deploy);

            await protocolRewards.connect(owner).grantRole(await protocolRewards.BLOCK_UNBLOCK_ROLE(), owner.address);

            await expect(protocolRewards.connect(owner).addToBlockList(
                ethers.ZeroAddress
            )).to.be.revertedWithCustomError(protocolRewards, "PROTOCOL_REWARDS_ADDRESS_ZERO");
        });

        it("should revert when caller doesn't have BLOCK_UNBLOCK_ROLE", async () => {
            const {
                deployer,
                protocolRewards
            } = await loadFixture(deploy);

            await expect(protocolRewards.connect(deployer).addToBlockList(
                deployer.address
            )).to.be.revertedWithCustomError(protocolRewards, "AccessControlUnauthorizedAccount");
        });

        it("should successfully add address to block list", async () => {
            const {
                owner,
                deployer,
                protocolRewards
            } = await loadFixture(deploy);

            await protocolRewards.connect(owner).grantRole(await protocolRewards.BLOCK_UNBLOCK_ROLE(), owner.address);

            expect(await protocolRewards.blockList(deployer.address)).to.be.false;

            await expect(protocolRewards.connect(owner).addToBlockList(deployer.address))
                .to.emit(protocolRewards, "BlockListUpdated")
                .withArgs(deployer.address, true);

            expect(await protocolRewards.blockList(deployer.address)).to.be.true;
        });
    });

    describe('removeFromBLockList', () => {
        it("should revert when removing zero address from block list", async () => {
            const {
                owner,
                protocolRewards
            } = await loadFixture(deploy);

            await protocolRewards.connect(owner).grantRole(await protocolRewards.BLOCK_UNBLOCK_ROLE(), owner.address);

            await expect(protocolRewards.connect(owner).removeFromBLockList(
                ethers.ZeroAddress
            )).to.be.revertedWithCustomError(protocolRewards, "PROTOCOL_REWARDS_ADDRESS_ZERO");
        });

        it("should revert when caller doesn't have BLOCK_UNBLOCK_ROLE", async () => {
            const {
                deployer,
                protocolRewards
            } = await loadFixture(deploy);

            await expect(protocolRewards.connect(deployer).removeFromBLockList(
                deployer.address
            )).to.be.revertedWithCustomError(protocolRewards, "AccessControlUnauthorizedAccount");
        });

        it("should successfully remove address from block list", async () => {
            const {
                owner,
                deployer,
                protocolRewards
            } = await loadFixture(deploy);

            await protocolRewards.connect(owner).grantRole(await protocolRewards.BLOCK_UNBLOCK_ROLE(), owner.address);

            // First add to block list
            await protocolRewards.connect(owner).addToBlockList(deployer.address);
            expect(await protocolRewards.blockList(deployer.address)).to.be.true;

            // Then remove from block list
            await expect(protocolRewards.connect(owner).removeFromBLockList(deployer.address))
                .to.emit(protocolRewards, "BlockListUpdated")
                .withArgs(deployer.address, false);

            expect(await protocolRewards.blockList(deployer.address)).to.be.false;
        });
    })

    describe('totalSupply', () => {
        it('should return the total supply of the token', async () => {
            const {
                protocolRewards,
                moxieToken,
                owner,
                deployer
            } = await loadFixture(deploy);

            const depositAmount1 = ethers.parseEther("100");
            const depositAmount2 = ethers.parseEther("200");
            await moxieToken.connect(owner).approve(await protocolRewards.getAddress(), depositAmount1 + depositAmount2);
            await protocolRewards.connect(owner).deposit(
                deployer.address,
                depositAmount1,
                ethers.id("PROTOCOL_FEE").slice(0, 10),
                "First deposit"
            );
            await protocolRewards.connect(owner).deposit(
                deployer.address,
                depositAmount2,
                ethers.id("PROTOCOL_FEE").slice(0, 10),
                "Second deposit"
            );
            const totalSupply = await protocolRewards.totalSupply();
            expect(totalSupply).to.not.equal(0);
        });
    });
});