// scripts/deploy-zkauth-local.ts
/**
 * Deploy ZKAuth System to Local Hardhat Network
 * ==============================================
 * 
 * Deploys:
 * 1. MockAuthVerifier (for testing)
 * 2. ZKAuthRegistry (upgradeable proxy)
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-zkauth-local.ts --network localhost
 */

import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("🚀 Deploying ZKAuth System to Local Network...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ============================================
  // 1. Deploy MockAuthVerifier
  // ============================================
  console.log("📦 Deploying MockAuthVerifier...");
  const MockVerifierFactory = await ethers.getContractFactory("MockAuthVerifier");
  const mockVerifier = await MockVerifierFactory.deploy();
  await mockVerifier.waitForDeployment();
  const mockVerifierAddress = await mockVerifier.getAddress();
  console.log("✅ MockAuthVerifier deployed to:", mockVerifierAddress);
  console.log("");

  // ============================================
  // 2. Deploy ZKAuthRegistry (UUPS Proxy)
  // ============================================
  console.log("📦 Deploying ZKAuthRegistry (UUPS Proxy)...");
  const ZKAuthRegistryFactory = await ethers.getContractFactory("ZKAuthRegistry");
  const zkAuthRegistry = await upgrades.deployProxy(
    ZKAuthRegistryFactory,
    [deployer.address, mockVerifierAddress],
    { 
      initializer: "initialize",
      kind: "uups"
    }
  );
  await zkAuthRegistry.waitForDeployment();
  const zkAuthRegistryAddress = await zkAuthRegistry.getAddress();
  console.log("✅ ZKAuthRegistry (Proxy) deployed to:", zkAuthRegistryAddress);
  console.log("");

  // ============================================
  // 3. Verify Deployment
  // ============================================
  console.log("🔍 Verifying deployment...");
  
  const version = await zkAuthRegistry.VERSION();
  console.log("   Version:", version);
  
  const verifierAddr = await zkAuthRegistry.authVerifier();
  console.log("   Verifier:", verifierAddr);
  console.log("   ✅ Verifier matches:", verifierAddr === mockVerifierAddress);
  
  const ADMIN_ROLE = await zkAuthRegistry.ADMIN_ROLE();
  const hasAdminRole = await zkAuthRegistry.hasRole(ADMIN_ROLE, deployer.address);
  console.log("   ✅ Admin role granted:", hasAdminRole);
  console.log("");

  // ============================================
  // 4. Test Registration (Optional)
  // ============================================
  console.log("🧪 Testing commitment registration...");
  const testCommitment = ethers.id("test_commitment_student_1");
  const mockProof = "0x1234567890abcdef";
  
  try {
    const tx = await zkAuthRegistry.registerCommitment(
      testCommitment,
      1, // UserRole.Student
      mockProof
    );
    await tx.wait();
    
    const isRegistered = await zkAuthRegistry.isRegistered(testCommitment);
    const role = await zkAuthRegistry.getRole(testCommitment);
    
    console.log("   ✅ Test commitment registered:", isRegistered);
    console.log("   ✅ Role assigned:", role === 1n ? "Student" : "Unknown");
  } catch (error: any) {
    console.log("   ⚠️  Test registration failed:", error.message);
  }
  console.log("");

  // ============================================
  // 5. Summary & Next Steps
  // ============================================
  console.log("=" .repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=" .repeat(60));
  console.log("");
  console.log("📋 Contract Addresses:");
  console.log("   MockAuthVerifier:  ", mockVerifierAddress);
  console.log("   ZKAuthRegistry:    ", zkAuthRegistryAddress);
  console.log("");
  console.log("🔧 Update your frontend/.env.local:");
  console.log(`   VITE_ZK_AUTH_REGISTRY_ADDRESS=${zkAuthRegistryAddress}`);
  console.log("");
  console.log("📖 Next Steps:");
  console.log("   1. Update frontend .env.local with contract address");
  console.log("   2. Restart frontend dev server");
  console.log("   3. Test registration flow (Student/University/Employer)");
  console.log("   4. Test login/logout with ZK proofs");
  console.log("   5. Check session validation");
  console.log("");
  console.log("🧪 Test Commands:");
  console.log("   npx hardhat test test/ZKAuthRegistry.test.ts");
  console.log("");
  console.log("⚠️  Note: Using MockAuthVerifier - proofs always pass!");
  console.log("   For production, replace with real Noir-generated verifier.");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

