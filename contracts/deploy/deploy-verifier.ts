// contracts/deploy/deploy-verifier.ts
/**
 * Deploy Groth16 Verifier Contracts (standalone)
 *
 * Deploys:
 *   1. Groth16Verifier   — snarkjs-generated BN254 verifier (~7.7KB, pure Solidity)
 *   2. Groth16AuthVerifierAdapter — IAuthVerifier wrapper
 *
 * After deployment, call zkAuthRegistry.setAuthVerifier(<adapterAddress>)
 * to wire the new verifier into an existing registry.
 */
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet, Provider } from "zksync-ethers";
import * as dotenv from "dotenv";

dotenv.config();

export default async function (hre: HardhatRuntimeEnvironment) {
  console.log("\n🔐 Deploying Groth16 Verifier Contracts...\n");

  const provider = new Provider(hre.network.config.url);

  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set in environment");
  }

  const wallet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const deployer = new Deployer(hre, wallet);

  console.log(`📍 Deploying with wallet: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Wallet balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  // ============================================
  // 1. Deploy Groth16Verifier
  // ============================================
  console.log("📝 Deploying Groth16Verifier...");
  console.log("   snarkjs-generated BN254 verifier (~7.7KB, pure Solidity, no assembly)\n");

  const verifierArtifact = await deployer.loadArtifact("Groth16Verifier");
  const verifier = await deployer.deploy(verifierArtifact, []);
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();

  console.log(`✅ Groth16Verifier deployed to: ${verifierAddress}\n`);

  // ============================================
  // 2. Deploy Groth16AuthVerifierAdapter
  // ============================================
  console.log("📝 Deploying Groth16AuthVerifierAdapter...");

  const adapterArtifact = await deployer.loadArtifact("Groth16AuthVerifierAdapter");
  const adapter = await deployer.deploy(adapterArtifact, [verifierAddress]);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();

  console.log(`✅ Groth16AuthVerifierAdapter deployed to: ${adapterAddress}\n`);

  const isProduction = await adapter.isProductionReady();
  const circuitName = await adapter.getCircuitName();
  const version = await adapter.getVersion();

  console.log(`   isProductionReady: ${isProduction}`);
  console.log(`   circuitName: ${circuitName}`);
  console.log(`   version: ${version}\n`);

  // ============================================
  // Summary
  // ============================================
  console.log("═══════════════════════════════════════════════════════");
  console.log("      🎉 VERIFIER DEPLOYMENT COMPLETE 🎉               ");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`\n📋 Contract Addresses:\n`);
  console.log(`   Groth16Verifier:              ${verifierAddress}`);
  console.log(`   Groth16AuthVerifierAdapter:   ${adapterAddress}`);
  console.log(`\n👤 Admin: ${wallet.address}`);
  console.log(`\n🌐 Network: ${hre.network.name}`);
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("\n📌 Next Steps:");
  console.log("   1. Update ZKAuthRegistry to use the adapter:");
  console.log(`      zkAuthRegistry.setAuthVerifier("${adapterAddress}")`);
  console.log("   2. Test end-to-end proof verification");
  console.log("\n═══════════════════════════════════════════════════════");

  return {
    verifier: verifierAddress,
    adapter: adapterAddress,
    admin: wallet.address,
  };
}
