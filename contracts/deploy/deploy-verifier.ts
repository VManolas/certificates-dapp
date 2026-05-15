// contracts/deploy/deploy-verifier.ts
/**
 * Deploy UltraPlonk Verifier Contracts
 * 
 * This script deploys:
 * 1. UltraVerifier - The auto-generated UltraPlonk verifier
 * 2. UltraPlonkAuthVerifierAdapter - Wrapper implementing IAuthVerifier
 * 
 * After deployment, update ZKAuthRegistry to use the adapter.
 */
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet, Provider } from "zksync-ethers";
import * as dotenv from "dotenv";

dotenv.config();

export default async function (hre: HardhatRuntimeEnvironment) {
  console.log("\n🔐 Deploying UltraPlonk Verifier Contracts...\n");

  // Initialize provider and wallet
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
  // 1. Deploy UltraVerifier (the raw verifier)
  // ============================================
  console.log("📝 Deploying UltraVerifier (production ZK verifier)...");
  console.log("   This is the auto-generated UltraPlonk verifier from Barretenberg.");
  console.log("   VK Hash: 0xc86321500310369d37897e6c3d6563856ca4174e9bcc0f9dc65099f6529e377a\n");
  
  const ultraVerifierArtifact = await deployer.loadArtifact("UltraVerifier");
  
  // Deploy the raw verifier (no proxy needed - immutable)
  const ultraVerifier = await deployer.deploy(ultraVerifierArtifact, []);
  
  await ultraVerifier.waitForDeployment();
  const ultraVerifierAddress = await ultraVerifier.getAddress();
  
  console.log(`✅ UltraVerifier deployed to: ${ultraVerifierAddress}\n`);

  // Verify the VK hash
  const vkHash = await ultraVerifier.getVerificationKeyHash();
  console.log(`   Verification Key Hash: ${vkHash}`);
  
  const expectedVkHash = "0xc86321500310369d37897e6c3d6563856ca4174e9bcc0f9dc65099f6529e377a";
  if (vkHash.toLowerCase() === expectedVkHash.toLowerCase()) {
    console.log("   ✅ VK Hash matches expected value!\n");
  } else {
    console.log("   ⚠️  VK Hash mismatch - verify circuit artifact is correct!\n");
  }

  // ============================================
  // 2. Deploy UltraPlonkAuthVerifierAdapter
  // ============================================
  console.log("📝 Deploying UltraPlonkAuthVerifierAdapter...");
  console.log("   This adapter wraps UltraVerifier and implements IAuthVerifier.\n");
  
  const adapterArtifact = await deployer.loadArtifact("UltraPlonkAuthVerifierAdapter");
  
  // Deploy the adapter (no proxy needed for simplicity)
  const adapter = await deployer.deploy(adapterArtifact, [ultraVerifierAddress]);
  
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  
  console.log(`✅ UltraPlonkAuthVerifierAdapter deployed to: ${adapterAddress}\n`);

  // Verify adapter configuration
  const isProduction = await adapter.isProductionReady();
  const circuitName = await adapter.getCircuitName();
  const verifierAddr = await adapter.getVerifierAddress();
  
  console.log(`   isProductionReady: ${isProduction}`);
  console.log(`   circuitName: ${circuitName}`);
  console.log(`   verifierAddress: ${verifierAddr}\n`);

  // ============================================
  // Deployment Summary
  // ============================================
  console.log("═══════════════════════════════════════════════════════");
  console.log("      🎉 VERIFIER DEPLOYMENT COMPLETE 🎉               ");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`\n📋 Contract Addresses:\n`);
  console.log(`   UltraVerifier:                 ${ultraVerifierAddress}`);
  console.log(`   UltraPlonkAuthVerifierAdapter: ${adapterAddress}`);
  console.log(`\n🔑 Verification Key Hash: ${vkHash}`);
  console.log(`\n👤 Admin: ${wallet.address}`);
  console.log(`\n🌐 Network: ${hre.network.name}`);
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("\n📌 Next Steps:");
  console.log("   1. Update ZKAuthRegistry to use the adapter:");
  console.log(`      zkAuthRegistry.setAuthVerifier("${adapterAddress}")`);
  console.log("   2. Test end-to-end proof verification");
  console.log("\n═══════════════════════════════════════════════════════");
  
  // Return addresses for further use
  return {
    ultraVerifier: ultraVerifierAddress,
    adapter: adapterAddress,
    vkHash: vkHash,
    admin: wallet.address,
  };
}
