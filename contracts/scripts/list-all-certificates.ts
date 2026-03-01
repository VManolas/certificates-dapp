// Script to list all certificates in the system
import { ethers } from "hardhat";

async function main() {
  console.log("=== All Certificates in System ===\n");
  
  const certificateRegistryAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const CertificateRegistry = await ethers.getContractAt(
    "CertificateRegistry",
    certificateRegistryAddress
  );
  
  // Get total certificate count
  const certificateCount = await CertificateRegistry.getTotalCertificates();
  console.log(`Total Certificates: ${certificateCount}\n`);
  
  if (certificateCount > 0n) {
    for (let i = 1n; i <= certificateCount; i++) {
      try {
        const cert = await CertificateRegistry.getCertificate(i);
        console.log(`Certificate #${i}:`);
        console.log(`  Student: ${cert.studentWallet}`);
        console.log(`  Issuing Institution: ${cert.issuingInstitution}`);
        console.log(`  Document Hash: ${cert.documentHash}`);
        console.log(`  Metadata: ${cert.metadataURI}`);
        console.log(`  Issue Date: ${new Date(Number(cert.issueDate) * 1000).toISOString()}`);
        console.log(`  Is Revoked: ${cert.isRevoked}`);
        if (cert.isRevoked) {
          console.log(`  Revocation Date: ${new Date(Number(cert.revocationDate) * 1000).toISOString()}`);
          console.log(`  Revocation Reason: ${cert.revocationReason}`);
        }
        console.log("");
      } catch (error) {
        console.log(`  Error reading certificate #${i}: ${error}`);
      }
    }
  } else {
    console.log("No certificates issued yet.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
