const hre = require("hardhat");

async function main() {
  const documentHash = "0xe4540e79395dc8b9861596fe3976ffc13da25e4313e8c752d3dccce0ce81eb86";
  
  const certificateRegistry = await hre.ethers.getContractAt(
    "CertificateRegistry",
    "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
  );

  const certificateId = await certificateRegistry.hashToCertificateId(documentHash);
  
  console.log(`\nDocument Hash: ${documentHash}`);
  console.log(`Certificate ID: ${certificateId.toString()}`);
  
  if (certificateId.toString() !== "0") {
    console.log("\n⚠️  DUPLICATE: This hash already exists!");
    
    // Get the existing certificate details
    const cert = await certificateRegistry.certificates(certificateId);
    console.log(`\nExisting Certificate Details:`);
    console.log(`  Certificate ID: ${certificateId.toString()}`);
    console.log(`  Student Wallet: ${cert.studentWallet}`);
    console.log(`  Issuing Institution: ${cert.issuingInstitution}`);
    console.log(`  Issue Date: ${new Date(Number(cert.issueDate) * 1000).toISOString()}`);
    console.log(`  Is Revoked: ${cert.isRevoked}`);
  } else {
    console.log("\n✓ Hash is unique - can be used for a new certificate");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
