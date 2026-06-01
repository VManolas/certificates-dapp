import { ethers } from "hardhat";

const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

async function getImpl(proxyAddr: string): Promise<string> {
  const raw = await ethers.provider.getStorage(proxyAddr, IMPL_SLOT);
  return "0x" + raw.slice(26);
}

async function main() {
  console.log("\n=== Implementation Addresses (EIP-1967) ===\n");

  const inst = await getImpl("0xADA8d4369C8378F42Aaabb76e994cc7AE7d10dcD");
  const cert = await getImpl("0x9E0d446e913b7F41d6053DAB21b1071AceB688D7");
  const emp  = await getImpl("0xAa8aC288f3aEDb9eca653E03fE1D85bfc9082D38");
  const zk   = await getImpl("0x6DB6087B168F0a5d004b1fb6B356c876B93d88f0");

  console.log("InstitutionRegistry impl:", inst);
  console.log("CertificateRegistry impl:", cert);
  console.log("EmployerRegistry impl:   ", emp);
  console.log("ZKAuthRegistry impl:     ", zk);
  console.log("");
}

main().catch(console.error);
