const hre = require("hardhat");

async function main() {
  const hash = "0xe4540e79395dc8b9861596fe3976ffc13da25e4313e8c752d3dccce0ce81eb86";
  
  const certificateRegistry = await hre.ethers.getContractAt(
    "CertificateRegistry",
    "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
  );

  console.log(`Testing hash: ${hash}\n`);
  
  // Get certificate ID
  const certId = await certificateRegistry.hashToCertificateId(hash);
  console.log(`Certificate ID: ${certId.toString()}`);
  
  // Get certificate details
  const cert = await certificateRegistry.certificates(certId);
  console.log(`\nCertificate details:`);
  console.log(`  Is Revoked: ${cert.isRevoked}`);
  console.log(`  Student: ${cert.studentWallet}`);
  
  // Call isValidCertificate
  const result = await certificateRegistry.isValidCertificate(hash);
  console.log(`\nisValidCertificate() result:`);
  console.log(`  isValid: ${result.isValid}`);
  console.log(`  certificateId: ${result.certificateId.toString()}`);
  console.log(`  isRevoked: ${result.isRevoked}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
