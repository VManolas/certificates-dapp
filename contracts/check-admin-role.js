const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  
  console.log("=== Checking Admin Role ===");
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
  
  console.log("\nRole Check:");
  console.log("- Has DEFAULT_ADMIN_ROLE:", hasDefaultAdmin);
  console.log("- Has SUPER_ADMIN_ROLE:", hasSuperAdmin);
  
  // Try to check if an institution exists
  const testWallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  try {
    const institution = await InstitutionRegistry.getInstitution(testWallet);
    console.log("\nExisting Institution Check:");
    console.log("- Wallet:", institution.walletAddress);
    console.log("- Name:", institution.name);
    console.log("- Already registered:", institution.walletAddress !== ethers.ZeroAddress);
  } catch (err) {
    console.log("\nNo institution found for wallet:", testWallet);
  }
  
  // Check email domain
  const emailDomain = "uniwa.gr";
  try {
    const existingWallet = await InstitutionRegistry.getInstitutionByDomain(emailDomain);
    console.log("\nEmail Domain Check:");
    console.log("- Domain 'uniwa.gr' is already registered to:", existingWallet);
  } catch (err) {
    console.log("\nEmail domain 'uniwa.gr' is available");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
