// contracts/deploy/deploy-local.ts
/**
 * Deploy ALL contracts for local testing
 * 
 * This script deploys the complete zkCredentials system:
 * 1. UltraVerifier - Real ZK verifier
 * 2. UltraPlonkAuthVerifierAdapter - Adapter for IAuthVerifier
 * 3. InstitutionRegistry
 * 4. CertificateRegistry
 * 5. EmployerRegistry
 * 6. ZKAuthRegistry (with real verifier)
 */
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet, Provider } from "zksync-ethers";
import * as dotenv from "dotenv";

dotenv.config();

export default async function (hre: HardhatRuntimeEnvironment) {
  console.log("\n🚀 Deploying zkCredentials System (Local Testing)...\n");

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
  // 1. Deploy UltraPlonk Verifier
  // ============================================
  console.log("═══════════════════════════════════════════════════════");
  console.log("STEP 1: Deploy UltraPlonk Verifier");
  console.log("═══════════════════════════════════════════════════════\n");
  
  console.log("📝 Deploying UltraVerifier (production ZK verifier)...");
  
  const ultraVerifierArtifact = await deployer.loadArtifact("UltraVerifier");
  const ultraVerifier = await deployer.deploy(ultraVerifierArtifact, []);
  await ultraVerifier.waitForDeployment();
  const ultraVerifierAddress = await ultraVerifier.getAddress();
  
  console.log(`✅ UltraVerifier deployed: ${ultraVerifierAddress}\n`);

  // ============================================
  // 2. Deploy Verifier Adapter
  // ============================================
  console.log("📝 Deploying UltraPlonkAuthVerifierAdapter...");
  
  const adapterArtifact = await deployer.loadArtifact("UltraPlonkAuthVerifierAdapter");
  const adapter = await deployer.deploy(adapterArtifact, [ultraVerifierAddress]);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  
  console.log(`✅ Adapter deployed: ${adapterAddress}\n`);

  // Verify it's production ready
  const isProduction = await adapter.isProductionReady();
  console.log(`   🔍 isProductionReady: ${isProduction}`);
  console.log(`   🔍 circuitName: ${await adapter.getCircuitName()}\n`);

  // ============================================
  // 3. Deploy InstitutionRegistry
  // ============================================
  console.log("═══════════════════════════════════════════════════════");
  console.log("STEP 2: Deploy InstitutionRegistry");
  console.log("═══════════════════════════════════════════════════════\n");
  
  const institutionRegistryArtifact = await deployer.loadArtifact("InstitutionRegistry");
  
  const institutionRegistry = await hre.zkUpgrades.deployProxy(
    wallet,
    institutionRegistryArtifact,
    [wallet.address],
    { initializer: "initialize" }
  );
  
  await institutionRegistry.waitForDeployment();
  const institutionRegistryAddress = await institutionRegistry.getAddress();
  
  console.log(`✅ InstitutionRegistry: ${institutionRegistryAddress}\n`);

  // ============================================
  // 4. Deploy CertificateRegistry
  // ============================================
  console.log("═══════════════════════════════════════════════════════");
  console.log("STEP 3: Deploy CertificateRegistry");
  console.log("═══════════════════════════════════════════════════════\n");
  
  const certificateRegistryArtifact = await deployer.loadArtifact("CertificateRegistry");
  
  const certificateRegistry = await hre.zkUpgrades.deployProxy(
    wallet,
    certificateRegistryArtifact,
    [wallet.address, institutionRegistryAddress],
    { initializer: "initialize" }
  );
  
  await certificateRegistry.waitForDeployment();
  const certificateRegistryAddress = await certificateRegistry.getAddress();
  
  console.log(`✅ CertificateRegistry: ${certificateRegistryAddress}\n`);

  // Configure InstitutionRegistry
  const setCertRegistryTx = await institutionRegistry.setCertificateRegistry(
    certificateRegistryAddress
  );
  await setCertRegistryTx.wait();
  console.log("   ⚙️  CertificateRegistry linked to InstitutionRegistry\n");

  // ============================================
  // 5. Deploy EmployerRegistry
  // ============================================
  console.log("═══════════════════════════════════════════════════════");
  console.log("STEP 4: Deploy EmployerRegistry");
  console.log("═══════════════════════════════════════════════════════\n");
  
  const employerRegistryArtifact = await deployer.loadArtifact("EmployerRegistry");
  
  const employerRegistry = await hre.zkUpgrades.deployProxy(
    wallet,
    employerRegistryArtifact,
    [wallet.address],
    { initializer: "initialize" }
  );
  
  await employerRegistry.waitForDeployment();
  const employerRegistryAddress = await employerRegistry.getAddress();
  
  console.log(`✅ EmployerRegistry: ${employerRegistryAddress}\n`);

  // ============================================
  // 6. Deploy ZKAuthRegistry
  // ============================================
  console.log("═══════════════════════════════════════════════════════");
  console.log("STEP 5: Deploy ZKAuthRegistry (with REAL verifier)");
  console.log("═══════════════════════════════════════════════════════\n");
  
  const zkAuthRegistryArtifact = await deployer.loadArtifact("ZKAuthRegistry");
  
  const zkAuthRegistry = await hre.zkUpgrades.deployProxy(
    wallet,
    zkAuthRegistryArtifact,
    [wallet.address, adapterAddress], // admin, verifier
    { initializer: "initialize" }
  );
  
  await zkAuthRegistry.waitForDeployment();
  const zkAuthRegistryAddress = await zkAuthRegistry.getAddress();
  
  console.log(`✅ ZKAuthRegistry: ${zkAuthRegistryAddress}`);
  console.log(`   ⚙️  Using verifier: ${adapterAddress}\n`);

  // ============================================
  // Deployment Summary
  // ============================================
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("         🎉 DEPLOYMENT COMPLETE 🎉                     ");
  console.log("═══════════════════════════════════════════════════════");
  
  console.log(`\n📋 Verifier Contracts:\n`);
  console.log(`   UltraVerifier:                 ${ultraVerifierAddress}`);
  console.log(`   UltraPlonkAuthVerifierAdapter: ${adapterAddress}`);
  
  console.log(`\n📋 Main Contracts:\n`);
  console.log(`   InstitutionRegistry: ${institutionRegistryAddress}`);
  console.log(`   CertificateRegistry: ${certificateRegistryAddress}`);
  console.log(`   EmployerRegistry:    ${employerRegistryAddress}`);
  console.log(`   ZKAuthRegistry:      ${zkAuthRegistryAddress}`);
  
  console.log(`\n👤 Admin: ${wallet.address}`);
  console.log(`🌐 Network: ${hre.network.name}`);
  
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("📝 COPY THESE TO frontend/.env.local:");
  console.log("═══════════════════════════════════════════════════════\n");
  
  console.log(`VITE_CHAIN_ID=${hre.network.config.chainId || 1337}`);
  console.log(`VITE_RPC_URL=${hre.network.config.url}`);
  console.log(`VITE_INSTITUTION_REGISTRY_ADDRESS=${institutionRegistryAddress}`);
  console.log(`VITE_CERTIFICATE_REGISTRY_ADDRESS=${certificateRegistryAddress}`);
  console.log(`VITE_EMPLOYER_REGISTRY_ADDRESS=${employerRegistryAddress}`);
  console.log(`VITE_ZK_AUTH_REGISTRY_ADDRESS=${zkAuthRegistryAddress}`);
  console.log(`VITE_VERIFIER_ADAPTER_ADDRESS=${adapterAddress}`);
  console.log(`VITE_ENVIRONMENT=development`);
  
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("🚀 Next Steps:");
  console.log("═══════════════════════════════════════════════════════\n");
  console.log("1. Copy the .env variables above to frontend/.env.local");
  console.log("2. Start frontend: cd frontend && npm run dev");
  console.log("3. Configure MetaMask:");
  console.log("   - Network: Hardhat Local");
  console.log("   - RPC: http://127.0.0.1:8545");
  console.log("   - Chain ID: 1337");
  console.log("4. Import test account from Hardhat node output");
  console.log("5. Test ZK authentication flow!");
  console.log("\n═══════════════════════════════════════════════════════\n");
  
  return {
    ultraVerifier: ultraVerifierAddress,
    adapter: adapterAddress,
    institutionRegistry: institutionRegistryAddress,
    certificateRegistry: certificateRegistryAddress,
    employerRegistry: employerRegistryAddress,
    zkAuthRegistry: zkAuthRegistryAddress,
    admin: wallet.address,
  };
}
