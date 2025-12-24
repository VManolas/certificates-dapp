const { ethers } = require('hardhat');

async function main() {
  const institutionAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const institutionRegistryAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
  
  const InstitutionRegistry = await ethers.getContractAt(
    'InstitutionRegistry',
    institutionRegistryAddress
  );
  
  const institution = await InstitutionRegistry.getInstitution(institutionAddress);
  console.log('Institution Details:');
  console.log('  Name:', institution.name);
  console.log('  Email Domain:', institution.emailDomain);
  console.log('  Is Verified:', institution.isVerified);
  console.log('  Is Active:', institution.isActive);
  console.log('  Total Certificates Issued:', institution.totalCertificatesIssued.toString());
  
  const canIssue = await InstitutionRegistry.canIssueCertificates(institutionAddress);
  console.log('\nCan Issue Certificates:', canIssue);
}

main().catch(console.error);
