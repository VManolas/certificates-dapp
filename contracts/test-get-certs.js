const hre = require("hardhat");

async function main() {
  const institutionAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  
  const certificateRegistry = await hre.ethers.getContractAt(
    "CertificateRegistry",
    "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
  );

  console.log(`\nQuerying certificates for institution: ${institutionAddress}\n`);
  
  const result = await certificateRegistry.getCertificatesByInstitution(
    institutionAddress,
    0,
    100
  );
  
  const [certificateIds, total] = result;
  
  console.log(`Total certificates: ${total.toString()}`);
  console.log(`Certificate IDs: ${certificateIds.map(id => id.toString()).join(', ')}`);
  
  if (certificateIds.length > 0) {
    console.log('\nCertificate details:');
    for (const id of certificateIds) {
      const cert = await certificateRegistry.certificates(id);
      console.log(`\nID ${id}:`);
      console.log(`  Student: ${cert.studentWallet}`);
      console.log(`  Document Hash: ${cert.documentHash}`);
      console.log(`  Revoked: ${cert.isRevoked}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
