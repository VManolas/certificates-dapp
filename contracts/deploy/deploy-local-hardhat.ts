// contracts/deploy/deploy-local-hardhat.ts
/**
 * Deploy ALL contracts for local Hardhat testing
 * (Standard Hardhat, not zkSync)
 */
import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export default async function (hre: HardhatRuntimeEnvironment) {
  console.log("\n🚀 Deploying zkCredentials System (Local Hardhat)...\n");

  const [deployer] = await ethers.getSigners();
  console.log(`📍 Deploying with account: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

  // ============================================
  // 1. Deploy UltraPlonk Verifier
  // ============================================
  console.log("═══════════════════════════════════════════════════════");
  console.log("STEP 1: Deploy UltraPlonk Verifier");
  console.log("═══════════════════════════════════════════════════════\n");
  
  console.log("📝 Deploying UltraVerifier...");
  const UltraVerifier = await ethers.getContractFactory("UltraVerifier");
  const ultraVerifier = await UltraVerifier.deploy();
  await ultraVerifier.waitForDeployment();
  const ultraVerifierAddress = await ultraVerifier.getAddress();
  
  console.log(`✅ UltraVerifier: ${ultraVerifierAddress}\n`);

  // ============================================
  // 2. Deploy Verifier Adapter
  // ============================================
  console.log("📝 Deploying UltraPlonkAuthVerifierAdapter...");
  const Adapter = await ethers.getContractFactory("UltraPlonkAuthVerifierAdapter");
  const adapter = await Adapter.deploy(ultraVerifierAddress);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  
  console.log(`✅ Adapter: ${adapterAddress}`);
  console.log(`   🔍 isProductionReady: ${await adapter.isProductionReady()}`);
  console.log(`   🔍 circuitName: ${await adapter.getCircuitName()}\n`);

  // ============================================
  // 3. Deploy InstitutionRegistry
  // ============================================
  console.log("═══════════════════════════════════════════════════════");
  console.log("STEP 2: Deploy InstitutionRegistry");
  console.log("═══════════════════════════════════════════════════════\n");
  
  const InstitutionRegistry = await ethers.getContractFactory("InstitutionRegistry");
  const institutionRegistry = await InstitutionRegistry.deploy();
  await institutionRegistry.waitForDeployment();
  const institutionRegistryAddress = await institutionRegistry.getAddress();
  
  // Initialize
  await institutionRegistry.initialize(deployer.address);
  
  console.log(`✅ InstitutionRegistry: ${institutionRegistryAddress}\n`);

  // ============================================
  // 4. Deploy CertificateRegistry
  // ============================================
  console.log("═══════════════════════════════════════════════════════");
  console.log("STEP 3: Deploy CertificateRegistry");
  console.log("═══════════════════════════════════════════════════════\n");
  
  const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
  const certificateRegistry = await CertificateRegistry.deploy();
  await certificateRegistry.waitForDeployment();
  const certificateRegistryAddress = await certificateRegistry.getAddress();
  
  // Initialize
  await certificateRegistry.initialize(deployer.address, institutionRegistryAddress);
  
  console.log(`✅ CertificateRegistry: ${certificateRegistryAddress}\n`);

  // Link registries
  console.log("⚙️  Linking CertificateRegistry to InstitutionRegistry...");
  await institutionRegistry.setCertificateRegistry(certificateRegistryAddress);
  console.log("   ✅ Linked\n");

  // ============================================
  // 5. Deploy EmployerRegistry
  // ============================================
  console.log("═══════════════════════════════════════════════════════");
  console.log("STEP 4: Deploy EmployerRegistry");
  console.log("═══════════════════════════════════════════════════════\n");
  
  const EmployerRegistry = await ethers.getContractFactory("EmployerRegistry");
  const employerRegistry = await EmployerRegistry.deploy();
  await employerRegistry.waitForDeployment();
  const employerRegistryAddress = await employerRegistry.getAddress();
  
  // Initialize
  await employerRegistry.initialize(deployer.address);
  
  console.log(`✅ EmployerRegistry: ${employerRegistryAddress}\n`);

  // ============================================
  // 6. Deploy ZKAuthRegistry
  // ============================================
  console.log("═══════════════════════════════════════════════════════");
  console.log("STEP 5: Deploy ZKAuthRegistry (with REAL verifier)");
  console.log("═══════════════════════════════════════════════════════\n");
  
  const ZKAuthRegistry = await ethers.getContractFactory("ZKAuthRegistry");
  const zkAuthRegistry = await ZKAuthRegistry.deploy();
  await zkAuthRegistry.waitForDeployment();
  const zkAuthRegistryAddress = await zkAuthRegistry.getAddress();
  
  // Initialize with the real verifier adapter
  await zkAuthRegistry.initialize(deployer.address, adapterAddress);
  
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
  
  console.log(`\n👤 Admin: ${deployer.address}`);
  console.log(`🌐 Network: ${hre.network.name}`);
  
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("📝 COPY THESE TO frontend/.env.local:");
  console.log("═══════════════════════════════════════════════════════\n");
  
  console.log(`VITE_CHAIN_ID=1337`);
  console.log(`VITE_RPC_URL=http://127.0.0.1:8545`);
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
  console.log("4. Import test account:");
  console.log(`   - Address: ${deployer.address}`);
  console.log("   - Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
  console.log("5. Test ZK authentication flow!");
  console.log("\n═══════════════════════════════════════════════════════\n");
  
  return {
    ultraVerifier: ultraVerifierAddress,
    adapter: adapterAddress,
    institutionRegistry: institutionRegistryAddress,
    certificateRegistry: certificateRegistryAddress,
    employerRegistry: employerRegistryAddress,
    zkAuthRegistry: zkAuthRegistryAddress,
    admin: deployer.address,
  };
}
