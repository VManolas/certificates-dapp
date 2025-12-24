import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet } from "zksync-ethers";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Script to upgrade CertificateRegistry from V1 to V2
 * 
 * Prerequisites:
 * 1. V1 contract must be deployed via UUPS proxy
 * 2. Deployer wallet must have SUPER_ADMIN_ROLE
 * 3. Set PROXY_ADDRESS in environment or pass as argument
 * 
 * Usage:
 * npx hardhat deploy-zksync --script upgrade-certificate-registry.ts --network zkSyncSepoliaTestnet
 */
export default async function (hre: HardhatRuntimeEnvironment) {
  console.log("=".repeat(60));
  console.log("CertificateRegistry Upgrade: V1 → V2");
  console.log("=".repeat(60));

  // Load deployer wallet
  const wallet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY!);
  const deployer = new Deployer(hre, wallet);

  console.log(`\nDeployer address: ${wallet.address}`);

  // Get proxy address from environment
  const proxyAddress = process.env.CERTIFICATE_REGISTRY_PROXY_ADDRESS;
  if (!proxyAddress) {
    throw new Error(
      "CERTIFICATE_REGISTRY_PROXY_ADDRESS not set in environment variables"
    );
  }

  console.log(`Proxy address: ${proxyAddress}`);

  // Check current version
  const proxyArtifact = await deployer.loadArtifact("CertificateRegistry");
  const proxy = new hre.ethers.Contract(
    proxyAddress,
    proxyArtifact.abi,
    wallet
  );

  try {
    const currentVersion = await proxy.VERSION();
    console.log(`\nCurrent version: ${currentVersion}`);

    if (currentVersion !== "1.0.0") {
      console.warn(
        `⚠️  Warning: Expected V1 (1.0.0), found ${currentVersion}`
      );
      const readline = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        readline.question("Continue anyway? (yes/no): ", resolve);
      });
      readline.close();

      if (answer.toLowerCase() !== "yes") {
        console.log("Upgrade cancelled");
        process.exit(0);
      }
    }
  } catch (error) {
    console.error("Error checking current version:", error);
    throw error;
  }

  // Deploy new implementation (V2)
  console.log("\n📦 Deploying CertificateRegistryV2 implementation...");
  const v2Artifact = await deployer.loadArtifact("CertificateRegistryV2");
  const v2Implementation = await deployer.deploy(v2Artifact);
  await v2Implementation.waitForDeployment();
  const v2Address = await v2Implementation.getAddress();

  console.log(`✅ V2 implementation deployed at: ${v2Address}`);

  // Upgrade proxy to new implementation
  console.log("\n⬆️  Upgrading proxy to V2 implementation...");
  
  try {
    // Call upgradeTo (UUPS pattern)
    const upgradeTx = await proxy.upgradeToAndCall(
      v2Address,
      "0x" // No initialization data - we'll call upgradeToV2 separately
    );
    
    console.log(`Transaction hash: ${upgradeTx.hash}`);
    await upgradeTx.wait();
    console.log("✅ Proxy upgraded successfully");

    // Call upgradeToV2 to initialize V2 features
    console.log("\n🔧 Initializing V2 features...");
    const proxyV2 = new hre.ethers.Contract(
      proxyAddress,
      v2Artifact.abi,
      wallet
    );

    const initTx = await proxyV2.upgradeToV2(
      "Upgraded to V2: Added batch certificate issuance and template support"
    );
    
    console.log(`Transaction hash: ${initTx.hash}`);
    await initTx.wait();
    console.log("✅ V2 initialized successfully");

    // Verify upgrade
    console.log("\n✓ Verifying upgrade...");
    const newVersion = await proxyV2.getVersion();
    console.log(`New version: ${newVersion}`);

    const upgradeHistory = await proxyV2.getUpgradeHistory();
    console.log(`\nUpgrade history (${upgradeHistory.length} entries):`);
    upgradeHistory.forEach((entry: any, index: number) => {
      console.log(`  ${index + 1}. Version ${entry.version} at ${new Date(Number(entry.timestamp) * 1000).toISOString()}`);
      console.log(`     Upgrader: ${entry.upgrader}`);
      console.log(`     Notes: ${entry.notes}`);
    });

    if (newVersion === "2.0.0") {
      console.log("\n" + "=".repeat(60));
      console.log("🎉 Upgrade completed successfully!");
      console.log("=".repeat(60));
      console.log("\nNext steps:");
      console.log("1. Update frontend EXPECTED_VERSION to '2.0.0'");
      console.log("2. Deploy new ABIs to frontend");
      console.log("3. Test new V2 features (batch operations, templates)");
      console.log("4. Verify on zkSync Explorer");
    } else {
      console.error("❌ Upgrade verification failed: Version mismatch");
    }

  } catch (error) {
    console.error("\n❌ Upgrade failed:", error);
    throw error;
  }

  console.log("\n" + "=".repeat(60));
  console.log("Deployment Summary");
  console.log("=".repeat(60));
  console.log(`Proxy Address:          ${proxyAddress}`);
  console.log(`V2 Implementation:      ${v2Address}`);
  console.log(`New Version:            2.0.0`);
  console.log(`Upgrader:               ${wallet.address}`);
  console.log("=".repeat(60));
}
