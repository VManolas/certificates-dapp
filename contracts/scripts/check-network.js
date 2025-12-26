const { ethers } = require("hardhat");

async function main() {
  console.log("=== Checking Network Status ===\n");
  
  const latestBlock = await ethers.provider.getBlockNumber();
  console.log("Latest block number:", latestBlock);
  
  const block = await ethers.provider.getBlock(latestBlock);
  console.log("Latest block timestamp:", new Date(block.timestamp * 1000).toISOString());
  console.log("Latest block hash:", block.hash);
  
  console.log("\n=== Network Info ===");
  const network = await ethers.provider.getNetwork();
  console.log("Network name:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  
  console.log("\n=== Pending Transactions ===");
  const pendingBlock = await ethers.provider.getBlock("pending");
  if (pendingBlock && pendingBlock.transactions.length > 0) {
    console.log("Pending transactions:", pendingBlock.transactions.length);
    console.log("Transaction hashes:", pendingBlock.transactions.slice(0, 5));
  } else {
    console.log("No pending transactions");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

