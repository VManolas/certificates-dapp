const hre = require("hardhat");

async function main() {
  const certificateRegistry = await hre.ethers.getContractAt(
    "CertificateRegistry",
    "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
  );

  for (let i = 1; i <= 3; i++) {
    const cert = await certificateRegistry.certificates(i);
    console.log(`\nCertificate #${i}:`);
    console.log(`  Student: ${cert.studentWallet}`);
    console.log(`  Document Hash: ${cert.documentHash}`);
    console.log(`  Is Revoked: ${cert.isRevoked}`);
    console.log(`  Revoked At: ${cert.revokedAt.toString()}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
