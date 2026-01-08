import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("\n🚀 Starting zkCredentials deployment to Hardhat local network...\n");

  const [deployer] = await ethers.getSigners();
  
  console.log(`📍 Deploying with wallet: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} ETH\n`);

  // ============================================
  // 1. Deploy InstitutionRegistry
  // ============================================
  console.log("📝 Deploying InstitutionRegistry...");
  const InstitutionRegistry = await ethers.getContractFactory("InstitutionRegistry");
  const institutionRegistry = await upgrades.deployProxy(
    InstitutionRegistry,
    [deployer.address], // Initialize with deployer as admin
    { initializer: "initialize" }
  );
  await institutionRegistry.waitForDeployment();
  const institutionRegistryAddress = await institutionRegistry.getAddress();
  console.log(`✅ InstitutionRegistry deployed to: ${institutionRegistryAddress}\n`);

  // ============================================
  // 2. Deploy CertificateRegistry
  // ============================================
  console.log("📝 Deploying CertificateRegistry...");
  const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
  const certificateRegistry = await upgrades.deployProxy(
    CertificateRegistry,
    [deployer.address, institutionRegistryAddress], // admin, institution registry
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
  const tx = await institutionRegistry.setCertificateRegistry(certificateRegistryAddress);
  await tx.wait();
  
  console.log("✅ CertificateRegistry role granted to InstitutionRegistry\n");

  // ============================================
  // 4. Deploy EmployerRegistry
  // ============================================
  console.log("📝 Deploying EmployerRegistry...");
  const EmployerRegistry = await ethers.getContractFactory("EmployerRegistry");
  const employerRegistry = await upgrades.deployProxy(
    EmployerRegistry,
    [deployer.address], // Initialize with deployer as admin
    { initializer: "initialize" }
  );
  await employerRegistry.waitForDeployment();
  const employerRegistryAddress = await employerRegistry.getAddress();
  console.log(`✅ EmployerRegistry deployed to: ${employerRegistryAddress}\n`);

  // ============================================
  // 5. Deploy NoirAuthVerifier (for ZK Auth)
  // ============================================
  console.log("📝 Deploying NoirAuthVerifier...");
  const NoirAuthVerifier = await ethers.getContractFactory("NoirAuthVerifier");
  const noirAuthVerifier = await NoirAuthVerifier.deploy();
  await noirAuthVerifier.waitForDeployment();
  const noirAuthVerifierAddress = await noirAuthVerifier.getAddress();
  console.log(`✅ NoirAuthVerifier deployed to: ${noirAuthVerifierAddress}`);
  
  // Verify the verifier deployment
  const circuitName = await noirAuthVerifier.getCircuitName();
  const proofFormat = await noirAuthVerifier.getProofFormat();
  const productionReady = await noirAuthVerifier.isProductionReady();
  console.log(`   Circuit: ${circuitName}`);
  console.log(`   Format: ${proofFormat}`);
  if (!productionReady) {
    console.log(`   ⚠️  Development verifier (format check only)\n`);
  } else {
    console.log(`   ✅ Production-ready verifier\n`);
  }

  // ============================================
  // 6. Deploy ZKAuthRegistry
  // ============================================
  console.log("📝 Deploying ZKAuthRegistry...");
  const ZKAuthRegistry = await ethers.getContractFactory("ZKAuthRegistry");
  const zkAuthRegistry = await upgrades.deployProxy(
    ZKAuthRegistry,
    [deployer.address, noirAuthVerifierAddress], // admin, verifier address
    { initializer: "initialize" }
  );
  await zkAuthRegistry.waitForDeployment();
  const zkAuthRegistryAddress = await zkAuthRegistry.getAddress();
  console.log(`✅ ZKAuthRegistry deployed to: ${zkAuthRegistryAddress}\n`);

  // ============================================
  // Deployment Summary
  // ============================================
  console.log("═══════════════════════════════════════════════════════");
  console.log("            🎉 DEPLOYMENT COMPLETE 🎉");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`\n📋 Contract Addresses:\n`);
  console.log(`   InstitutionRegistry: ${institutionRegistryAddress}`);
  console.log(`   CertificateRegistry: ${certificateRegistryAddress}`);
  console.log(`   EmployerRegistry:    ${employerRegistryAddress}`);
  console.log(`   NoirAuthVerifier:    ${noirAuthVerifierAddress}`);
  console.log(`   ZKAuthRegistry:      ${zkAuthRegistryAddress}`);
  console.log(`\n👤 Admin: ${deployer.address}`);
  console.log(`\n💾 Save these to frontend/.env.local:\n`);
  console.log(`VITE_CERTIFICATE_REGISTRY_ADDRESS=${certificateRegistryAddress}`);
  console.log(`VITE_INSTITUTION_REGISTRY_ADDRESS=${institutionRegistryAddress}`);
  console.log(`VITE_EMPLOYER_REGISTRY_ADDRESS=${employerRegistryAddress}`);
  console.log(`VITE_ZK_AUTH_REGISTRY_ADDRESS=${zkAuthRegistryAddress}`);
  console.log(`VITE_CHAIN_ID=1337`);
  console.log(`\n⚠️  Note: Using NoirAuthVerifier (Development Version)`);
  console.log(`   - Validates proof format (length, structure)`);
  console.log(`   - Does NOT verify cryptographic correctness`);
  console.log(`   - Replace with Barretenberg-generated verifier for production`);
  console.log(`\n═══════════════════════════════════════════════════════\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
