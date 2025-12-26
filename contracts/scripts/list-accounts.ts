// List all Hardhat test accounts
import { ethers } from "hardhat";

async function main() {
  console.log("=== Available Hardhat Test Accounts ===\n");
  
  const signers = await ethers.getSigners();
  
  const maxAccounts = Math.min(10, signers.length);
  
  for (let i = 0; i < maxAccounts; i++) {
    const addr = await signers[i].getAddress();
    const balance = await ethers.provider.getBalance(addr);
    console.log(`Account #${i}: ${addr}`);
    console.log(`           Balance: ${ethers.formatEther(balance)} ETH\n`);
  }
  
  console.log("\n💡 TIP: You can use any of these accounts (except #0 which is admin)");
  console.log("   to register a new university in your UI.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

