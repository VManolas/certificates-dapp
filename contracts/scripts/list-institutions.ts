// Script to list all registered institutions
import { ethers } from "hardhat";

async function main() {
  console.log("=== All Registered Institutions ===\n");
  
  const institutionRegistryAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const InstitutionRegistry = await ethers.getContractAt(
    "InstitutionRegistry",
    institutionRegistryAddress
  );
  
  const institutionCount = await InstitutionRegistry.getInstitutionCount();
  console.log(`Total Registered Institutions: ${institutionCount}\n`);
  
  if (institutionCount > 0n) {
    const allInstitutions = await InstitutionRegistry.getAllInstitutions();
    
    for (let i = 0; i < allInstitutions.length; i++) {
      const addr = allInstitutions[i];
      const inst = await InstitutionRegistry.getInstitution(addr);
      
      console.log(`${i + 1}. ${inst.name}`);
      console.log(`   Wallet: ${inst.walletAddress}`);
      console.log(`   Email Domain: ${inst.emailDomain}`);
      console.log(`   Verified: ${inst.isVerified}`);
      console.log(`   Active: ${inst.isActive}`);
      console.log(`   Certificates Issued: ${inst.totalCertificatesIssued}`);
      console.log("");
    }
  } else {
    console.log("No institutions registered yet.");
  }
  
  // Show available test accounts
  console.log("=== Available Test Accounts ===");
  const signers = await ethers.getSigners();
  for (let i = 0; i < Math.min(10, signers.length); i++) {
    const addr = await signers[i].getAddress();
    console.log(`Account #${i}: ${addr}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

