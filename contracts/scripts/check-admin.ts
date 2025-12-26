// Script to check admin roles and diagnose registration issues
import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  
  console.log("=== Admin Role Diagnostic ===");
  console.log("Signer Address:", signerAddress);
  
  const institutionRegistryAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const InstitutionRegistry = await ethers.getContractAt(
    "InstitutionRegistry",
    institutionRegistryAddress
  );
  
  // Check roles
  const DEFAULT_ADMIN_ROLE = await InstitutionRegistry.DEFAULT_ADMIN_ROLE();
  const SUPER_ADMIN_ROLE = await InstitutionRegistry.SUPER_ADMIN_ROLE();
  
  const hasDefaultAdmin = await InstitutionRegistry.hasRole(DEFAULT_ADMIN_ROLE, signerAddress);
  const hasSuperAdmin = await InstitutionRegistry.hasRole(SUPER_ADMIN_ROLE, signerAddress);
  
  console.log("\n✓ Role Check:");
  console.log("  - Has DEFAULT_ADMIN_ROLE:", hasDefaultAdmin);
  console.log("  - Has SUPER_ADMIN_ROLE:", hasSuperAdmin);
  
  if (!hasSuperAdmin) {
    console.log("\n❌ ERROR: You don't have SUPER_ADMIN_ROLE!");
    console.log("   This is required to call registerInstitutionByAdmin()");
    return;
  }
  
  // Try to check if an institution exists
  const testWallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const institution = await InstitutionRegistry.getInstitution(testWallet);
  
  console.log("\n✓ Institution Check for", testWallet);
  console.log("  - Wallet:", institution.walletAddress);
  console.log("  - Name:", institution.name);
  console.log("  - Is Registered:", institution.walletAddress !== ethers.ZeroAddress);
  console.log("  - Is Verified:", institution.isVerified);
  console.log("  - Is Active:", institution.isActive);
  
  if (institution.walletAddress !== ethers.ZeroAddress) {
    console.log("\n❌ ERROR: Institution already exists!");
    console.log("   Wallet", testWallet, "is already registered as:", institution.name);
  }
  
  // Check email domain
  const emailDomain = "uniwa.gr";
  const existingWallet = await InstitutionRegistry.getInstitutionByDomain(emailDomain);
  
  console.log("\n✓ Email Domain Check for 'uniwa.gr':");
  console.log("  - Registered to wallet:", existingWallet);
  
  if (existingWallet !== ethers.ZeroAddress) {
    console.log("\n❌ ERROR: Email domain already registered!");
    console.log("   Domain 'uniwa.gr' is already registered to:", existingWallet);
  }
  
  // Check if wallet is the same as admin
  if (testWallet.toLowerCase() === signerAddress.toLowerCase()) {
    console.log("\n❌ ERROR: Cannot register admin as institution!");
    console.log("   You're trying to register your own wallet as an institution");
  }
  
  console.log("\n=== Diagnostic Complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Script Error:", error);
    process.exit(1);
  });

