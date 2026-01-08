// contracts/deploy/deploy.ts
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet, Provider } from "zksync-ethers";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Deploy zkCredentials contracts to zkSync Era
 * 
 * This script deploys:
 * 1. InstitutionRegistry (UUPS Proxy)
 * 2. CertificateRegistry (UUPS Proxy)
 * 
 * Post-deployment:
 * - Sets CertificateRegistry address in InstitutionRegistry
 * - Records all deployed addresses
 */
export default async function (hre: HardhatRuntimeEnvironment) {
  console.log("\n🚀 Starting zkCredentials deployment to zkSync Era...\n");

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
  // 1. Deploy InstitutionRegistry
  // ============================================
  console.log("📝 Deploying InstitutionRegistry...");
  
  const institutionRegistryArtifact = await deployer.loadArtifact("InstitutionRegistry");
  
  // Deploy as UUPS proxy
  const institutionRegistry = await hre.zkUpgrades.deployProxy(
    wallet,
    institutionRegistryArtifact,
    [wallet.address], // Initialize with deployer as admin
    { initializer: "initialize" }
  );
  
  await institutionRegistry.waitForDeployment();
  const institutionRegistryAddress = await institutionRegistry.getAddress();
  
  console.log(`✅ InstitutionRegistry deployed to: ${institutionRegistryAddress}\n`);

  // ============================================
  // 2. Deploy CertificateRegistry
  // ============================================
  console.log("📝 Deploying CertificateRegistry...");
  
  const certificateRegistryArtifact = await deployer.loadArtifact("CertificateRegistry");
  
  // Deploy as UUPS proxy with InstitutionRegistry address
  const certificateRegistry = await hre.zkUpgrades.deployProxy(
    wallet,
    certificateRegistryArtifact,
    [wallet.address, institutionRegistryAddress], // admin, institution registry
    { initializer: "initialize" }
  );
  
  await certificateRegistry.waitForDeployment();
  const certificateRegistryAddress = await certificateRegistry.getAddress();
  
  console.log(`✅ CertificateRegistry deployed to: ${certificateRegistryAddress}\n`);

  // ============================================
  // 3. Configure InstitutionRegistry
  // ============================================
  console.log("⚙️  Configuring InstitutionRegistry...");
  
  // Grant CERTIFICATE_REGISTRY_ROLE to CertificateRegistry
  const setCertRegistryTx = await institutionRegistry.setCertificateRegistry(
    certificateRegistryAddress
  );
  await setCertRegistryTx.wait();
  
  console.log("✅ CertificateRegistry role granted to InstitutionRegistry\n");

  // ============================================
  // Deployment Summary
  // ============================================
  console.log("═══════════════════════════════════════════════════════");
  console.log("            🎉 DEPLOYMENT COMPLETE 🎉                   ");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`\n📋 Contract Addresses:\n`);
  console.log(`   InstitutionRegistry: ${institutionRegistryAddress}`);
  console.log(`   CertificateRegistry: ${certificateRegistryAddress}`);
  console.log(`\n👤 Admin: ${wallet.address}`);
  console.log(`\n🌐 Network: ${hre.network.name}`);
  console.log("\n═══════════════════════════════════════════════════════");
  
  // Return addresses for further use
  return {
    institutionRegistry: institutionRegistryAddress,
    certificateRegistry: certificateRegistryAddress,
    admin: wallet.address,
  };
}

