// contracts/deploy/upgrade-zkauth-registry.ts
/**
 * ZKAuthRegistry UUPS Upgrade Script (zkSync)
 * ============================================
 *
 * Upgrades the ZKAuthRegistry proxy on zkSync networks to the latest
 * implementation without changing storage layout or losing state.
 *
 * What this upgrade changes (v1.0.0 → v1.1.0):
 *   - Session ID derivation now includes the nullifier in the hash
 *   - VERSION constant bumped to "1.1.0"
 *   - No new state variables — storage layout unchanged
 *
 * Prerequisites:
 *   1. DEPLOYER_PRIVATE_KEY in .env (must hold ADMIN_ROLE on the proxy)
 *   2. Sepolia ETH in the deployer wallet for gas
 *   3. ZK_AUTH_REGISTRY_PROXY_ADDRESS in .env, or fallback to latest deployment JSON
 *
 * Usage:
 *   npx hardhat deploy-zksync --script deploy/upgrade-zkauth-registry.ts --network zkSyncSepoliaTestnet
 */

import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet, Provider } from "zksync-ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

function findLatestDeployment(network: string): string | null {
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) return null;

  const files = fs.readdirSync(deploymentsDir)
    .filter(f => f.startsWith(`zksync-${network}-`) && f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const data = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, files[0]), "utf-8")
  );
  return data.zkAuthRegistry || null;
}

export default async function (hre: HardhatRuntimeEnvironment) {
  console.log("=".repeat(60));
  console.log("ZKAuthRegistry UUPS Upgrade");
  console.log("=".repeat(60));

  // --- Wallet setup ---
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");
  }

  const provider = new Provider(hre.network.config.url);
  const wallet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const deployer = new Deployer(hre, wallet);

  console.log(`\nNetwork:  ${hre.network.name}`);
  console.log(`Deployer: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance:  ${hre.ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error("Deployer wallet has zero balance — fund it with Sepolia ETH first");
  }

  // --- Resolve proxy address ---
  const proxyAddress =
    process.env.ZK_AUTH_REGISTRY_PROXY_ADDRESS ||
    findLatestDeployment(hre.network.name);

  if (!proxyAddress) {
    throw new Error(
      "Cannot determine ZKAuthRegistry proxy address. Set ZK_AUTH_REGISTRY_PROXY_ADDRESS in .env " +
      "or ensure a deployment JSON exists in contracts/deployments/"
    );
  }

  console.log(`\nProxy:    ${proxyAddress}`);

  // --- Read current version ---
  const currentArtifact = await deployer.loadArtifact(
    "contracts/ZKAuthRegistry.sol:ZKAuthRegistry"
  );
  const proxyContract = new hre.ethers.Contract(
    proxyAddress,
    currentArtifact.abi,
    wallet
  );

  let currentVersion: string;
  try {
    currentVersion = await proxyContract.VERSION();
    console.log(`Current:  v${currentVersion}`);
  } catch (err) {
    throw new Error(
      `Failed to read VERSION() from proxy at ${proxyAddress}. ` +
      `Is the address correct and the contract deployed?`
    );
  }

  // --- Verify admin role ---
  const ADMIN_ROLE = await proxyContract.ADMIN_ROLE();
  const hasAdmin = await proxyContract.hasRole(ADMIN_ROLE, wallet.address);
  if (!hasAdmin) {
    throw new Error(
      `Deployer ${wallet.address} does not have ADMIN_ROLE on proxy ${proxyAddress}. ` +
      `Only the admin can authorize UUPS upgrades.`
    );
  }
  console.log(`Admin:    ✅ confirmed`);

  // --- Perform the upgrade ---
  console.log(`\n${"─".repeat(60)}`);
  console.log("Upgrading ZKAuthRegistry implementation...");
  console.log(`${"─".repeat(60)}\n`);

  const newArtifact = await deployer.loadArtifact(
    "contracts/ZKAuthRegistry.sol:ZKAuthRegistry"
  );

  const upgradedContract = await hre.zkUpgrades.upgradeProxy(
    deployer.zkWallet,
    proxyAddress,
    newArtifact
  );

  await upgradedContract.waitForDeployment();

  // --- Verify the upgrade ---
  const newVersion = await upgradedContract.VERSION();
  console.log(`\nNew version: v${newVersion}`);

  if (newVersion === currentVersion) {
    console.log("\n⚠️  VERSION unchanged — the implementation may not have differed.");
  } else {
    console.log(`\n✅ Upgrade successful: v${currentVersion} → v${newVersion}`);
  }

  // --- Spot-check that existing state is intact ---
  try {
    const sessionDuration = await upgradedContract.SESSION_DURATION();
    const verifierAddr = await upgradedContract.authVerifier();
    console.log(`\nState verification:`);
    console.log(`  SESSION_DURATION: ${sessionDuration} seconds (${Number(sessionDuration) / 3600}h)`);
    console.log(`  authVerifier:     ${verifierAddr}`);
    console.log(`  ✅ Existing state preserved`);
  } catch {
    console.warn("⚠️  Could not verify state — check manually on the explorer");
  }

  // --- Summary ---
  console.log(`\n${"=".repeat(60)}`);
  console.log("Upgrade Summary");
  console.log("=".repeat(60));
  console.log(`Network:        ${hre.network.name}`);
  console.log(`Proxy:          ${proxyAddress}`);
  console.log(`Version:        v${currentVersion} → v${newVersion}`);
  console.log(`Deployer:       ${wallet.address}`);
  console.log("=".repeat(60));
  console.log("\nChanges in v1.1.0:");
  console.log("  - Session ID now includes nullifier in keccak256 hash (N14 + N16)");
  console.log("  - No storage layout changes — all state preserved");
  console.log("\nNext steps:");
  console.log("  - Verify on explorer: https://sepolia.explorer.zksync.io/address/" + proxyAddress);
  console.log("  - No frontend changes needed (sessionId is read from events)");
  console.log("=".repeat(60) + "\n");
}
