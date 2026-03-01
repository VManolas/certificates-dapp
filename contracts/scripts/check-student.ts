// Script to check student wallet and certificate details
import { ethers } from "hardhat";

async function main() {
  const studentWallet = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199";
  
  console.log("=== Checking Student Wallet ===");
  console.log(`Student Address: ${studentWallet}\n`);
  
  // Check InstitutionRegistry
  console.log("=== Institution Registry Check ===");
  const institutionRegistryAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const InstitutionRegistry = await ethers.getContractAt(
    "InstitutionRegistry",
    institutionRegistryAddress
  );
  
  const institutionData = await InstitutionRegistry.getInstitution(studentWallet);
  console.log("Institution Data:");
  console.log(`  Wallet Address: ${institutionData.walletAddress}`);
  console.log(`  Name: ${institutionData.name}`);
  console.log(`  Email Domain: ${institutionData.emailDomain}`);
  console.log(`  Is Verified: ${institutionData.isVerified}`);
  console.log(`  Is Active: ${institutionData.isActive}`);
  console.log(`  Certificates Issued: ${institutionData.totalCertificatesIssued}`);
  
  const isInstitution = institutionData.walletAddress !== '0x0000000000000000000000000000000000000000' 
                       && institutionData.name !== '';
  console.log(`  --> Is registered as Institution: ${isInstitution}\n`);
  
  // Check CertificateRegistry
  console.log("=== Certificate Registry Check ===");
  const certificateRegistryAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const CertificateRegistry = await ethers.getContractAt(
    "CertificateRegistry",
    certificateRegistryAddress
  );
  
  const certificates = await CertificateRegistry.getCertificatesByStudent(studentWallet);
  console.log(`Certificates owned: ${certificates.length}`);
  
  if (certificates.length > 0) {
    console.log("\nCertificate Details:");
    for (let i = 0; i < certificates.length; i++) {
      const certId = certificates[i];
      const cert = await CertificateRegistry.getCertificate(certId);
      console.log(`\n  Certificate #${certId}:`);
      console.log(`    Student: ${cert.studentWallet}`);
      console.log(`    Issuing Institution: ${cert.issuingInstitution}`);
      console.log(`    Document Hash: ${cert.documentHash}`);
      console.log(`    Metadata: ${cert.metadataURI}`);
      console.log(`    Issue Date: ${new Date(Number(cert.issueDate) * 1000).toISOString()}`);
      console.log(`    Is Revoked: ${cert.isRevoked}`);
      console.log(`    Revocation Reason: ${cert.revocationReason || 'N/A'}`);
    }
  }
  
  console.log("\n=== Conclusion ===");
  if (isInstitution) {
    console.log("⚠️  WARNING: This address IS registered as an Institution!");
    console.log("   This should NOT happen for a student wallet.");
    console.log("   The database may have been corrupted or incorrectly seeded.");
  } else {
    console.log("✅ Address is NOT registered as an institution (correct)");
  }
  
  if (certificates.length > 0) {
    console.log(`✅ Address owns ${certificates.length} certificate(s) - is a student`);
  } else {
    console.log("❌ Address owns no certificates - NOT a student");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
