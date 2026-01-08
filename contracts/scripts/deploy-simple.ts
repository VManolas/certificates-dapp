// Simple deployment script for local testing (UUPS Proxy Pattern)
import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("\n🚀 Starting deployment...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy UltraVerifier (no proxy needed)
  console.log("1. Deploying UltraVerifier...");
  const UltraVerifier = await ethers.getContractFactory("UltraVerifier");
  const ultraVerifier = await UltraVerifier.deploy();
  await ultraVerifier.waitForDeployment();
  const ultraVerifierAddr = await ultraVerifier.getAddress();
  console.log("   ✅", ultraVerifierAddr, "\n");

  // Deploy Adapter (no proxy needed)
  console.log("2. Deploying UltraPlonkAuthVerifierAdapter...");
  const Adapter = await ethers.getContractFactory("UltraPlonkAuthVerifierAdapter");
  const adapter = await Adapter.deploy(ultraVerifierAddr);
  await adapter.waitForDeployment();
  const adapterAddr = await adapter.getAddress();
  console.log("   ✅", adapterAddr);
  console.log("   Production ready:", await adapter.isProductionReady(), "\n");

  // Deploy InstitutionRegistry as UUPS Proxy
  console.log("3. Deploying InstitutionRegistry (UUPS Proxy)...");
  const InstitutionRegistry = await ethers.getContractFactory("InstitutionRegistry");
  const institutionRegistry = await upgrades.deployProxy(
    InstitutionRegistry,
    [deployer.address],
    { kind: 'uups' }
  );
  await institutionRegistry.waitForDeployment();
  const institutionRegistryAddr = await institutionRegistry.getAddress();
  console.log("   ✅", institutionRegistryAddr, "\n");

  // Deploy CertificateRegistry as UUPS Proxy
  console.log("4. Deploying CertificateRegistry (UUPS Proxy)...");
  const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
  const certificateRegistry = await upgrades.deployProxy(
    CertificateRegistry,
    [deployer.address, institutionRegistryAddr],
    { kind: 'uups' }
  );
  await certificateRegistry.waitForDeployment();
  const certificateRegistryAddr = await certificateRegistry.getAddress();
  console.log("   ✅", certificateRegistryAddr);
  
  await institutionRegistry.setCertificateRegistry(certificateRegistryAddr);
  console.log("   🔗 Linked to InstitutionRegistry\n");

  // Deploy EmployerRegistry as UUPS Proxy
  console.log("5. Deploying EmployerRegistry (UUPS Proxy)...");
  const EmployerRegistry = await ethers.getContractFactory("EmployerRegistry");
  const employerRegistry = await upgrades.deployProxy(
    EmployerRegistry,
    [deployer.address],
    { kind: 'uups' }
  );
  await employerRegistry.waitForDeployment();
  const employerRegistryAddr = await employerRegistry.getAddress();
  console.log("   ✅", employerRegistryAddr, "\n");

  // Deploy ZKAuthRegistry as UUPS Proxy with REAL verifier
  console.log("6. Deploying ZKAuthRegistry (UUPS Proxy) with REAL verifier...");
  const ZKAuthRegistry = await ethers.getContractFactory("ZKAuthRegistry");
  const zkAuthRegistry = await upgrades.deployProxy(
    ZKAuthRegistry,
    [deployer.address, adapterAddr],
    { kind: 'uups' }
  );
  await zkAuthRegistry.waitForDeployment();
  const zkAuthRegistryAddr = await zkAuthRegistry.getAddress();
  console.log("   ✅", zkAuthRegistryAddr, "\n");

  console.log("═══════════════════════════════════════════════════════");
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("═══════════════════════════════════════════════════════\n");
  console.log("📋 Verifier Contracts:\n");
  console.log(`   UltraVerifier:                 ${ultraVerifierAddr}`);
  console.log(`   UltraPlonkAuthVerifierAdapter: ${adapterAddr}`);
  console.log("\n📋 Main Contracts (UUPS Proxies):\n");
  console.log(`   InstitutionRegistry: ${institutionRegistryAddr}`);
  console.log(`   CertificateRegistry: ${certificateRegistryAddr}`);
  console.log(`   EmployerRegistry:    ${employerRegistryAddr}`);
  console.log(`   ZKAuthRegistry:      ${zkAuthRegistryAddr}`);
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("📝 Copy these to frontend/.env.local:\n");
  console.log("═══════════════════════════════════════════════════════\n");
  console.log(`VITE_CHAIN_ID=1337`);
  console.log(`VITE_RPC_URL=http://127.0.0.1:8545`);
  console.log(`VITE_INSTITUTION_REGISTRY_ADDRESS=${institutionRegistryAddr}`);
  console.log(`VITE_CERTIFICATE_REGISTRY_ADDRESS=${certificateRegistryAddr}`);
  console.log(`VITE_EMPLOYER_REGISTRY_ADDRESS=${employerRegistryAddr}`);
  console.log(`VITE_ZK_AUTH_REGISTRY_ADDRESS=${zkAuthRegistryAddr}`);
  console.log(`VITE_VERIFIER_ADAPTER_ADDRESS=${adapterAddr}`);
  console.log(`VITE_ENVIRONMENT=development`);
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("🚀 Next Steps:");
  console.log("═══════════════════════════════════════════════════════\n");
  console.log("1. Copy the .env variables above to frontend/.env.local");
  console.log("2. Start frontend: cd frontend && npm run dev");
  console.log("3. Configure MetaMask:");
  console.log("   - Network Name: Hardhat Local");
  console.log("   - RPC URL: http://127.0.0.1:8545");
  console.log("   - Chain ID: 1337");
  console.log("   - Currency Symbol: ETH");
  console.log("4. Import test account:");
  console.log(`   - Address: ${deployer.address}`);
  console.log("   - Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
  console.log("5. Test ZK authentication with REAL cryptographic verification! 🔐");
  console.log("\n═══════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
