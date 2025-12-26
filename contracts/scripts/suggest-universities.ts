// Quick registration helper with unique institutions
import { ethers } from "hardhat";

async function main() {
  const institutionRegistryAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const InstitutionRegistry = await ethers.getContractAt(
    "InstitutionRegistry",
    institutionRegistryAddress
  );
  
  console.log("=== Quick Register New Universities ===\n");
  
  // Suggested test universities with different wallets
  const universities = [
    {
      wallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      name: "University of Athens",
      domain: "uoa.gr"
    },
    {
      wallet: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      name: "National Technical University of Athens",
      domain: "ntua.gr"
    },
    {
      wallet: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
      name: "Aristotle University of Thessaloniki",
      domain: "auth.gr"
    },
  ];
  
  console.log("📋 Suggested Universities for Testing:\n");
  
  for (const uni of universities) {
    // Check if already registered
    const inst = await InstitutionRegistry.getInstitution(uni.wallet);
    const isRegistered = inst.walletAddress !== ethers.ZeroAddress;
    
    console.log(`${uni.name}`);
    console.log(`  Wallet: ${uni.wallet}`);
    console.log(`  Email Domain: ${uni.domain}`);
    console.log(`  Status: ${isRegistered ? '✅ Already Registered' : '⚪ Available'}\n`);
  }
  
  console.log("\n💡 TIP: Copy any 'Available' wallet address to register in your UI!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

