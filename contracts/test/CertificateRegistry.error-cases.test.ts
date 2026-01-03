// contracts/test/CertificateRegistry.error-cases.test.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { CertificateRegistry, InstitutionRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CertificateRegistry - Enhanced Error Cases", function () {
  let certificateRegistry: CertificateRegistry;
  let institutionRegistry: InstitutionRegistry;
  let superAdmin: SignerWithAddress;
  let university1: SignerWithAddress;
  let university2: SignerWithAddress;
  let student1: SignerWithAddress;
  let student2: SignerWithAddress;
  let randomUser: SignerWithAddress;

  // Sample certificate data
  const sampleHash1 = ethers.keccak256(ethers.toUtf8Bytes("Certificate Document 1"));
  const sampleHash2 = ethers.keccak256(ethers.toUtf8Bytes("Certificate Document 2"));
  const metadataURI = "ipfs://QmX...";

  beforeEach(async function () {
    [superAdmin, university1, university2, student1, student2, randomUser] = 
      await ethers.getSigners();

    // Deploy InstitutionRegistry
    const InstitutionRegistry = await ethers.getContractFactory("InstitutionRegistry");
    institutionRegistry = await upgrades.deployProxy(
      InstitutionRegistry,
      [superAdmin.address],
      { initializer: "initialize", kind: "uups" }
    ) as unknown as InstitutionRegistry;
    await institutionRegistry.waitForDeployment();

    // Deploy CertificateRegistry
    const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
    certificateRegistry = await upgrades.deployProxy(
      CertificateRegistry,
      [superAdmin.address, await institutionRegistry.getAddress()],
      { initializer: "initialize", kind: "uups" }
    ) as unknown as CertificateRegistry;
    await certificateRegistry.waitForDeployment();

    // Grant CertificateRegistry role to access InstitutionRegistry
    await institutionRegistry.connect(superAdmin).setCertificateRegistry(
      await certificateRegistry.getAddress()
    );

    // Register and approve university1
    await institutionRegistry.connect(university1).registerInstitution("MIT", "mit.edu");
    await institutionRegistry.connect(superAdmin).approveInstitution(university1.address);
  });

  describe("UnauthorizedIssuer Error", function () {
    it("Should revert when non-registered account tries to issue", async function () {
      await expect(
        certificateRegistry.connect(randomUser).issueCertificate(
          sampleHash1,
          student1.address,
          metadataURI
        )
      ).to.be.revertedWithCustomError(certificateRegistry, "UnauthorizedIssuer");
    });

    it("Should revert when registered but not approved institution tries to issue", async function () {
      // Register university2 but don't approve
      await institutionRegistry.connect(university2).registerInstitution("Stanford", "stanford.edu");
      
      await expect(
        certificateRegistry.connect(university2).issueCertificate(
          sampleHash1,
          student1.address,
          metadataURI
        )
      ).to.be.revertedWithCustomError(certificateRegistry, "UnauthorizedIssuer");
    });

    it("Should revert when suspended institution tries to issue", async function () {
      // Suspend university1
      await institutionRegistry.connect(superAdmin).suspendInstitution(university1.address);
      
      await expect(
        certificateRegistry.connect(university1).issueCertificate(
          sampleHash1,
          student1.address,
          metadataURI
        )
      ).to.be.revertedWithCustomError(certificateRegistry, "UnauthorizedIssuer");
    });

    it("Should succeed when suspended institution is reactivated", async function () {
      // Suspend university1
      await institutionRegistry.connect(superAdmin).suspendInstitution(university1.address);
      
      // Reactivate
      await institutionRegistry.connect(superAdmin).reactivateInstitution(university1.address);
      
      // Should now succeed
      await expect(
        certificateRegistry.connect(university1).issueCertificate(
          sampleHash1,
          student1.address,
          metadataURI
        )
      ).to.emit(certificateRegistry, "CertificateIssued");
    });
  });

  describe("Invalid Input Errors", function () {
    it("Should revert with InvalidStudentAddress when zero address provided", async function () {
      await expect(
        certificateRegistry.connect(university1).issueCertificate(
          sampleHash1,
          ethers.ZeroAddress,
          metadataURI
        )
      ).to.be.revertedWithCustomError(certificateRegistry, "InvalidStudentAddress");
    });

    it("Should revert with InvalidDocumentHash when zero hash provided", async function () {
      await expect(
        certificateRegistry.connect(university1).issueCertificate(
          ethers.ZeroHash,
          student1.address,
          metadataURI
        )
      ).to.be.revertedWithCustomError(certificateRegistry, "InvalidDocumentHash");
    });

    it("Should accept empty metadataURI", async function () {
      await expect(
        certificateRegistry.connect(university1).issueCertificate(
          sampleHash1,
          student1.address,
          ""  // Empty metadataURI
        )
      ).to.emit(certificateRegistry, "CertificateIssued");
    });
  });

  describe("Duplicate Certificate Errors", function () {
    it("Should revert with CertificateAlreadyExists when issuing duplicate hash", async function () {
      // Issue first certificate
      await certificateRegistry.connect(university1).issueCertificate(
        sampleHash1,
        student1.address,
        metadataURI
      );

      // Try to issue again with same hash (even to different student)
      await expect(
        certificateRegistry.connect(university1).issueCertificate(
          sampleHash1,
          student2.address,
          metadataURI
        )
      ).to.be.revertedWithCustomError(certificateRegistry, "CertificateAlreadyExists");
    });

    it("Should allow same institution to issue multiple different certificates to same student", async function () {
      // Issue first certificate
      await certificateRegistry.connect(university1).issueCertificate(
        sampleHash1,
        student1.address,
        metadataURI
      );

      // Issue second certificate with different hash
      await expect(
        certificateRegistry.connect(university1).issueCertificate(
          sampleHash2,
          student1.address,
          metadataURI
        )
      ).to.emit(certificateRegistry, "CertificateIssued");

      // Verify student has 2 certificates
      const certs = await certificateRegistry.getCertificatesByStudent(student1.address);
      expect(certs.length).to.equal(2);
    });

    it("Should allow different institutions to issue to same student", async function () {
      // Register and approve university2
      await institutionRegistry.connect(university2).registerInstitution("Stanford", "stanford.edu");
      await institutionRegistry.connect(superAdmin).approveInstitution(university2.address);

      // Both universities issue to same student (different hashes)
      await certificateRegistry.connect(university1).issueCertificate(
        sampleHash1,
        student1.address,
        metadataURI
      );

      await certificateRegistry.connect(university2).issueCertificate(
        sampleHash2,
        student1.address,
        metadataURI
      );

      // Student should have 2 certificates
      const studentCerts = await certificateRegistry.getCertificatesByStudent(student1.address);
      expect(studentCerts.length).to.equal(2);
    });
  });

  describe("Certificate Query Errors", function () {
    it("Should revert with CertificateNotFound when querying non-existent ID", async function () {
      await expect(
        certificateRegistry.getCertificate(999)
      ).to.be.revertedWithCustomError(certificateRegistry, "CertificateNotFound");
    });

    it("Should revert with CertificateNotFound when querying non-existent hash", async function () {
      const nonExistentHash = ethers.keccak256(ethers.toUtf8Bytes("Non-existent"));
      
      await expect(
        certificateRegistry.getCertificateByHash(nonExistentHash)
      ).to.be.revertedWithCustomError(certificateRegistry, "CertificateNotFound");
    });

    it("Should return empty array for student with no certificates", async function () {
      const certs = await certificateRegistry.getCertificatesByStudent(student1.address);
      expect(certs.length).to.equal(0);
    });
  });

  describe("Certificate Revocation Errors", function () {
    it("Should revert with CertificateNotFound when revoking non-existent certificate", async function () {
      await expect(
        certificateRegistry.connect(university1).revokeCertificate(999, "Test")
      ).to.be.revertedWithCustomError(certificateRegistry, "CertificateNotFound");
    });

    it("Should revert with CertificateAlreadyRevoked when revoking twice", async function () {
      // Issue certificate
      const tx = await certificateRegistry.connect(university1).issueCertificate(
        sampleHash1,
        student1.address,
        metadataURI
      );
      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => 
        'eventName' in log && log.eventName === 'CertificateIssued'
      ) as any;
      const certId = event?.args[0];

      // Revoke first time
      await certificateRegistry.connect(university1).revokeCertificate(certId, "Test revocation");

      // Try to revoke again
      await expect(
        certificateRegistry.connect(university1).revokeCertificate(certId, "Second revocation")
      ).to.be.revertedWithCustomError(certificateRegistry, "CertificateAlreadyRevoked");
    });

    it("Should revert with NotCertificateIssuer when wrong institution tries to revoke", async function () {
      // Register and approve university2
      await institutionRegistry.connect(university2).registerInstitution("Stanford", "stanford.edu");
      await institutionRegistry.connect(superAdmin).approveInstitution(university2.address);

      // University1 issues certificate
      const tx = await certificateRegistry.connect(university1).issueCertificate(
        sampleHash1,
        student1.address,
        metadataURI
      );
      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => 
        'eventName' in log && log.eventName === 'CertificateIssued'
      ) as any;
      const certId = event?.args[0];

      // University2 tries to revoke
      await expect(
        certificateRegistry.connect(university2).revokeCertificate(certId, "Unauthorized")
      ).to.be.revertedWithCustomError(certificateRegistry, "NotCertificateIssuer");
    });

    it("Should allow super admin to revoke any certificate", async function () {
      // Issue certificate
      const tx = await certificateRegistry.connect(university1).issueCertificate(
        sampleHash1,
        student1.address,
        metadataURI
      );
      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => 
        'eventName' in log && log.eventName === 'CertificateIssued'
      ) as any;
      const certId = event?.args[0];

      // Super admin revokes
      await expect(
        certificateRegistry.connect(superAdmin).revokeCertificate(certId, "Admin revocation")
      ).to.emit(certificateRegistry, "CertificateRevoked")
        .withArgs(certId, superAdmin.address, "Admin revocation", await ethers.provider.getBlock('latest').then(b => b!.timestamp + 1));
    });

    it("Should update certificate state correctly after revocation", async function () {
      // Issue certificate
      const tx = await certificateRegistry.connect(university1).issueCertificate(
        sampleHash1,
        student1.address,
        metadataURI
      );
      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => 
        'eventName' in log && log.eventName === 'CertificateIssued'
      ) as any;
      const certId = event?.args[0];

      // Get certificate before revocation
      const certBefore = await certificateRegistry.getCertificate(certId);
      expect(certBefore.isRevoked).to.be.false;
      expect(certBefore.revokedAt).to.equal(0);
      expect(certBefore.revocationReason).to.equal("");

      // Revoke
      const reason = "Test revocation reason";
      await certificateRegistry.connect(university1).revokeCertificate(certId, reason);

      // Get certificate after revocation
      const certAfter = await certificateRegistry.getCertificate(certId);
      expect(certAfter.isRevoked).to.be.true;
      expect(certAfter.revokedAt).to.be.gt(0);
      expect(certAfter.revocationReason).to.equal(reason);
    });
  });

  describe("Event Emissions", function () {
    it("Should emit correct event data on issuance", async function () {
      const tx = await certificateRegistry.connect(university1).issueCertificate(
        sampleHash1,
        student1.address,
        metadataURI
      );

      await expect(tx)
        .to.emit(certificateRegistry, "CertificateIssued");
    });

    it("Should emit correct event data on revocation", async function () {
      // Issue certificate
      const tx = await certificateRegistry.connect(university1).issueCertificate(
        sampleHash1,
        student1.address,
        metadataURI
      );
      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => 
        'eventName' in log && log.eventName === 'CertificateIssued'
      ) as any;
      const certId = event?.args[0];

      // Revoke and check event
      const reason = "Test revocation";
      await expect(
        certificateRegistry.connect(university1).revokeCertificate(certId, reason)
      ).to.emit(certificateRegistry, "CertificateRevoked");
    });
  });

  describe("Institution Certificate Counter", function () {
    it("Should increment institution certificate count on issuance", async function () {
      const institutionBefore = await institutionRegistry.getInstitution(university1.address);
      const countBefore = institutionBefore.totalCertificatesIssued;
      
      await certificateRegistry.connect(university1).issueCertificate(
        sampleHash1,
        student1.address,
        metadataURI
      );

      const institutionAfter = await institutionRegistry.getInstitution(university1.address);
      expect(institutionAfter.totalCertificatesIssued).to.equal(countBefore + 1n);
    });

    it("Should not increment counter when certificate issuance fails", async function () {
      const institutionBefore = await institutionRegistry.getInstitution(university1.address);
      const countBefore = institutionBefore.totalCertificatesIssued;
      
      // Try to issue with invalid student address
      await expect(
        certificateRegistry.connect(university1).issueCertificate(
          sampleHash1,
          ethers.ZeroAddress,
          metadataURI
        )
      ).to.be.revertedWithCustomError(certificateRegistry, "InvalidStudentAddress");

      const institutionAfter = await institutionRegistry.getInstitution(university1.address);
      expect(institutionAfter.totalCertificatesIssued).to.equal(countBefore);
    });
  });

  describe("Certificate Validation", function () {
    it("Should return correct validation status for valid certificate", async function () {
      await certificateRegistry.connect(university1).issueCertificate(
        sampleHash1,
        student1.address,
        metadataURI
      );

      const [isValid, certId, isRevoked] = await certificateRegistry.isValidCertificate(sampleHash1);
      expect(isValid).to.be.true;
      expect(certId).to.equal(1);
      expect(isRevoked).to.be.false;
    });

    it("Should return correct validation status for revoked certificate", async function () {
      const tx = await certificateRegistry.connect(university1).issueCertificate(
        sampleHash1,
        student1.address,
        metadataURI
      );
      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => 
        'eventName' in log && log.eventName === 'CertificateIssued'
      ) as any;
      const certId = event?.args[0];

      // Revoke
      await certificateRegistry.connect(university1).revokeCertificate(certId, "Test");

      const [isValid, , isRevoked] = await certificateRegistry.isValidCertificate(sampleHash1);
      expect(isValid).to.be.false;
      expect(isRevoked).to.be.true;
    });

    it("Should return correct validation status for non-existent certificate", async function () {
      const nonExistentHash = ethers.keccak256(ethers.toUtf8Bytes("Non-existent"));
      
      const [isValid, certId, isRevoked] = await certificateRegistry.isValidCertificate(nonExistentHash);
      expect(isValid).to.be.false;
      expect(certId).to.equal(0);
      expect(isRevoked).to.be.false;
    });
  });
});





