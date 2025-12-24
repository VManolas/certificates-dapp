const hre = require("hardhat");

async function main() {
  const certificateRegistry = await hre.ethers.getContractAt(
    "CertificateRegistry",
    "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
  );

  // The counter is internal, so we can't read it directly
  // But we can try to get certificates by ID until we hit a miss
  let lastValidId = 0;
  for (let i = 1; i <= 10; i++) {
    try {
      const cert = await certificateRegistry.certificates(i);
      if (cert.certificateId.toString() !== "0") {
        lastValidId = i;
        console.log(`Certificate ${i}:`);
        console.log(`  Student: ${cert.studentWallet}`);
        console.log(`  Institution: ${cert.issuingInstitution}`);
        console.log(`  Revoked: ${cert.isRevoked}`);
      }
    } catch (error) {
      // Certificate doesn't exist
      break;
    }
  }
  
  console.log(`\nTotal certificates in system: ${lastValidId}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
