/**
 * Deploy ProtocolRewardsV2 with explicit gas limits.
 * Use this when Ignition fails with "intrinsic gas too low" (e.g. on HyperEVM).
 *
 * Requires env: REWARD_TOKEN_ADDRESS, MNEMONIC
 * Optional: HYPEREVM_RPC_URL for hyperevm
 *
 * Usage:
 *   REWARD_TOKEN_ADDRESS=0x... MNEMONIC="..." npx hardhat run scripts/deploy-ProtocolRewardsV2.ts --network hyperevm
 */

import { ethers } from "hardhat";

// HyperEVM: small blocks = 2M gas limit; large blocks = 30M (~1/min).
// If deploy reverts at 2M, try GAS_LIMIT_DEPLOY = 5_000_000n and use an RPC that targets large blocks.
const GAS_LIMIT_DEPLOY = 2_000_000n;
const GAS_LIMIT_CALL = 300_000n;

// Explicit gas price avoids "invalid block height" from Hardhat's EIP-1559 fee lookup on some RPCs.
const GAS_PRICE_WEI = 3_000_000_000n; // 3 gwei

const txOverrides = { gasPrice: GAS_PRICE_WEI };

function requireEnv(keys: string[]): void {
  const missing = keys.filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing env: ${missing.join(", ")}. Set them before running this script.`
    );
  }
}

async function main() {
  requireEnv(["REWARD_TOKEN_ADDRESS", "MNEMONIC"]);

  const rewardTokenAddress = process.env.REWARD_TOKEN_ADDRESS!.trim();
  const [deployer, owner] = await ethers.getSigners();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const config = require("../ignition/config/config.json") as { proxyAdminOwner?: string };
  const proxyAdminOwner = config.proxyAdminOwner;

  if (!proxyAdminOwner) {
    throw new Error("proxyAdminOwner not found in ignition/config/config.json");
  }

  console.log("Deployer:", deployer.address);
  console.log("Owner (rewards contract):", owner.address);
  console.log("Reward token:", rewardTokenAddress);
  console.log("ProxyAdmin owner:", proxyAdminOwner);
  console.log("");

  // 1. Deploy implementation
  console.log("Deploying ProtocolRewardsV2 implementation...");
  const ProtocolRewardsV2 = await ethers.getContractFactory("ProtocolRewardsV2");
  const impl = await ProtocolRewardsV2.deploy({
    gasLimit: GAS_LIMIT_DEPLOY,
    ...txOverrides,
  });
  await impl.waitForDeployment();
  const implAddress = await impl.getAddress();
  console.log("  Implementation:", implAddress);

  // 2. Initialize implementation (required by Ignition flow; proxy will use same init)
  console.log("Initializing implementation (no-op for proxy flow)...");
  const initTx = await impl.initialize(rewardTokenAddress, owner.address, {
    gasLimit: GAS_LIMIT_CALL,
    ...txOverrides,
  });
  await initTx.wait();

  // 3. Encode initialize for proxy constructor
  const initData = impl.interface.encodeFunctionData("initialize", [
    rewardTokenAddress,
    owner.address,
  ]);

  // 4. Deploy proxy
  console.log("Deploying TransparentUpgradeableProxy...");
  const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
  const proxy = await Proxy.deploy(implAddress, proxyAdminOwner, initData, {
    gasLimit: GAS_LIMIT_DEPLOY,
    ...txOverrides,
  });
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log("  Proxy:", proxyAddress);

  // 5. Instance = proxy address (use this in your app)
  const instance = await ethers.getContractAt("ProtocolRewardsV2", proxyAddress);
  const tokenAddr = await instance.token();
  console.log("");
  console.log("--- ProtocolRewardsV2 deployed ---");
  console.log("Proxy (use this address):", proxyAddress);
  console.log("Implementation:", implAddress);
  console.log("Reward token (on-chain):", tokenAddr);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
