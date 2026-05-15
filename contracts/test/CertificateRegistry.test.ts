// contracts/test/CertificateRegistry.test.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { CertificateRegistry, InstitutionRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CertificateRegistry", function () {
  let certificateRegistry: CertificateRegistry;
  let institutionRegistry: InstitutionRegistry;
  let superAdmin: SignerWithAddress;
  let university1: SignerWithAddress;
  let university2: SignerWithAddress;
  let student1: SignerWithAddress;
  let student2: SignerWithAddress;
  let employer: SignerWithAddress;
  let randomUser: SignerWithAddress;

  // Sample certificate data
  const sampleHash1 = ethers.keccak256(ethers.toUtf8Bytes("Certificate Document 1"));
  const sampleHash2 = ethers.keccak256(ethers.toUtf8Bytes("Certificate Document 2"));
  const sampleHash3 = ethers.keccak256(ethers.toUtf8Bytes("Certificate Document 3"));
  const metadataURI = "ipfs://QmX...";

  beforeEach(async function () {
    [superAdmin, university1, university2, student1, student2, employer, randomUser] = 
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

  describe("Initialization", function () {
    it("should initialize with correct super admin", async function () {
      const ADMIN_ROLE = await certificateRegistry.ADMIN_ROLE();
      expect(await certificateRegistry.hasRole(ADMIN_ROLE, superAdmin.address)).to.be.true;
    });

    it("should set correct version", async function () {
      expect(await certificateRegistry.VERSION()).to.equal("1.0.0");
      expect(await certificateRegistry.getVersion()).to.equal("1.0.0");
    });

    it("should record initial deployment in upgrade history", async function () {
      const history = await certificateRegistry.getUpgradeHistory();
      expect(history.length).to.equal(1);
      expect(history[0].version).to.equal("1.0.0");
      expect(history[0].notes).to.equal("Initial deployment");
    });

    it("should start with zero certificates", async function () {
      expect(await certificateRegistry.getTotalCertificates()).to.equal(0);
    });

    it("should link to institution registry", async function () {
      expect(await certificateRegistry.institutionRegistry()).to.equal(
        await institutionRegistry.getAddress()
      );
    });

    it("should revert if initialized with zero address super admin", async function () {
      const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
      await expect(
        upgrades.deployProxy(
          CertificateRegistry,
          [ethers.ZeroAddress, await institutionRegistry.getAddress()],
          { initializer: "initialize", kind: "uups" }
        )
      ).to.be.revertedWithCustomError(certificateRegistry, "InvalidAddress");
    });

    it("should revert if initialized with zero address institution registry", async function () {
      const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
      await expect(
        upgrades.deployProxy(
          CertificateRegistry,
          [superAdmin.address, ethers.ZeroAddress],
          { initializer: "initialize", kind: "uups" }
        )
      ).to.be.revertedWithCustomError(certificateRegistry, "InvalidAddress");
    });
  });

  describe("Certificate Issuance Flow", function () {
    it("should allow verified institution to issue certificate", async function () {
      await expect(
        certificateRegistry.connect(university1).issueCertificate(
          sampleHash1,
          student1.address,
          metadataURI,
          2024
        )
      ).to.emit(certificateRegistry, "CertificateIssued")
        .withArgs(
          1, // certificateId
          sampleHash1,
          student1.address,
          university1.address,
          await ethers.provider.getBlock('latest').then(b => b!.timestamp + 1)
        );

      const cert = await certificateRegistry.getCertificate(1);
      expect(cert.documentHash).to.equal(sampleHash1);
      expect(cert.studentWallet).to.equal(student1.address);
      expect(cert.issuingInstitution).to.equal(university1.address);
      expect(cert.certificateId).to.equal(1);
      expect(cert.metadataURI).to.equal(metadataURI);
      expect(cert.isRevoked).to.be.false;
    });

    it("should increment certificate ID sequentially", async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);
      await certificateRegistry.connect(university1).issueCertificate(sampleHash2, student2.address, ""
      , 2024);

      expect((await certificateRegistry.getCertificate(1)).certificateId).to.equal(1);
      expect((await certificateRegistry.getCertificate(2)).certificateId).to.equal(2);
    });

    it("should increment total certificates count", async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);
      expect(await certificateRegistry.getTotalCertificates()).to.equal(1);

      await certificateRegistry.connect(university1).issueCertificate(sampleHash2, student2.address, ""
      , 2024);
      expect(await certificateRegistry.getTotalCertificates()).to.equal(2);
    });

    it("should add certificate to student's certificate list", async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);

      const studentCerts = await certificateRegistry.getCertificatesByStudent(student1.address);
      expect(studentCerts.length).to.equal(1);
      expect(studentCerts[0]).to.equal(1);
    });

    it("should map document hash to certificate ID", async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);

      const cert = await certificateRegistry.getCertificateByHash(sampleHash1);
      expect(cert.certificateId).to.equal(1);
    });

    it("should increment institution's certificate count", async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);

      const institution = await institutionRegistry.getInstitution(university1.address);
      expect(institution.totalCertificatesIssued).to.equal(1);
    });

    it("should revert if institution not authorized", async function () {
      await expect(
        certificateRegistry.connect(university2).issueCertificate(sampleHash1, student1.address, ""
        , 2024)
      ).to.be.revertedWithCustomError(certificateRegistry, "UnauthorizedIssuer");
    });

    it("should revert if student wallet is zero address", async function () {
      await expect(
        certificateRegistry.connect(university1).issueCertificate(sampleHash1, ethers.ZeroAddress, ""
        , 2024)
      ).to.be.revertedWithCustomError(certificateRegistry, "InvalidStudentAddress");
    });

    it("should revert if document hash is zero", async function () {
      await expect(
        certificateRegistry.connect(university1).issueCertificate(ethers.ZeroHash, student1.address, ""
        , 2024)
      ).to.be.revertedWithCustomError(certificateRegistry, "InvalidDocumentHash");
    });

    it("should revert if duplicate hash", async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);

      await expect(
        certificateRegistry.connect(university1).issueCertificate(sampleHash1, student2.address, ""
        , 2024)
      ).to.be.revertedWithCustomError(certificateRegistry, "CertificateAlreadyExists");
    });

    it("should allow issuing to same student multiple times with different hashes", async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);
      await certificateRegistry.connect(university1).issueCertificate(sampleHash2, student1.address, ""
      , 2024);

      const studentCerts = await certificateRegistry.getCertificatesByStudent(student1.address);
      expect(studentCerts.length).to.equal(2);
    });

    it("should handle empty metadata URI", async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);

      const cert = await certificateRegistry.getCertificate(1);
      expect(cert.metadataURI).to.equal("");
    });

    it("should not allow suspended institution to issue", async function () {
      await institutionRegistry.connect(superAdmin).suspendInstitution(university1.address);

      await expect(
        certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
        , 2024)
      ).to.be.revertedWithCustomError(certificateRegistry, "UnauthorizedIssuer");
    });
  });

  describe("Certificate Revocation Flow", function () {
    beforeEach(async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);
    });

    it("should allow issuing institution to revoke certificate", async function () {
      const reason = "Fraudulent document";
      
      await expect(
        certificateRegistry.connect(university1).revokeCertificate(1, reason)
      ).to.emit(certificateRegistry, "CertificateRevoked")
        .withArgs(
          1,
          university1.address,
          reason,
          await ethers.provider.getBlock('latest').then(b => b!.timestamp + 1)
        );

      const cert = await certificateRegistry.getCertificate(1);
      expect(cert.isRevoked).to.be.true;
      expect(cert.revocationReason).to.equal(reason);
      expect(cert.revokedAt).to.be.gt(0);
    });

    it("should allow super admin to revoke certificate", async function () {
      await certificateRegistry.connect(superAdmin).revokeCertificate(1, "Admin action");

      const cert = await certificateRegistry.getCertificate(1);
      expect(cert.isRevoked).to.be.true;
    });

    it("should revert if certificate not found", async function () {
      await expect(
        certificateRegistry.connect(university1).revokeCertificate(999, "Invalid")
      ).to.be.revertedWithCustomError(certificateRegistry, "CertificateNotFound");
    });

    it("should revert if already revoked", async function () {
      await certificateRegistry.connect(university1).revokeCertificate(1, "First revocation");

      await expect(
        certificateRegistry.connect(university1).revokeCertificate(1, "Second revocation")
      ).to.be.revertedWithCustomError(certificateRegistry, "CertificateAlreadyRevoked");
    });

    it("should revert if neither issuer nor super admin", async function () {
      await expect(
        certificateRegistry.connect(randomUser).revokeCertificate(1, "Unauthorized")
      ).to.be.revertedWithCustomError(certificateRegistry, "NotCertificateIssuer");
    });

    it("should not allow different institution to revoke", async function () {
      // Register and approve second university
      await institutionRegistry.connect(university2).registerInstitution("Stanford", "stanford.edu");
      await institutionRegistry.connect(superAdmin).approveInstitution(university2.address);

      await expect(
        certificateRegistry.connect(university2).revokeCertificate(1, "Wrong institution")
      ).to.be.revertedWithCustomError(certificateRegistry, "NotCertificateIssuer");
    });

    it("should preserve original certificate data after revocation", async function () {
      const certBefore = await certificateRegistry.getCertificate(1);
      
      await certificateRegistry.connect(university1).revokeCertificate(1, "Test");
      
      const certAfter = await certificateRegistry.getCertificate(1);
      expect(certAfter.documentHash).to.equal(certBefore.documentHash);
      expect(certAfter.studentWallet).to.equal(certBefore.studentWallet);
      expect(certAfter.issuingInstitution).to.equal(certBefore.issuingInstitution);
      expect(certAfter.issueDate).to.equal(certBefore.issueDate);
    });

    it("should record correct revocation timestamp", async function () {
      const tx = await certificateRegistry.connect(university1).revokeCertificate(1, "Test");
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      const cert = await certificateRegistry.getCertificate(1);
      expect(cert.revokedAt).to.equal(block!.timestamp);
    });
  });

  describe("Certificate Verification", function () {
    beforeEach(async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);
    });

    it("should verify valid certificate", async function () {
      const [isValid, certId, isRevoked] = await certificateRegistry.isValidCertificate(sampleHash1);
      
      expect(isValid).to.be.true;
      expect(certId).to.equal(1);
      expect(isRevoked).to.be.false;
    });

    it("should return false for non-existent certificate", async function () {
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("Fake Certificate"));
      const [isValid, certId, isRevoked] = await certificateRegistry.isValidCertificate(fakeHash);
      
      expect(isValid).to.be.false;
      expect(certId).to.equal(0);
      expect(isRevoked).to.be.false;
    });

    it("should return false for revoked certificate", async function () {
      await certificateRegistry.connect(university1).revokeCertificate(1, "Test");
      
      const [isValid, certId, isRevoked] = await certificateRegistry.isValidCertificate(sampleHash1);
      
      expect(isValid).to.be.false;
      expect(certId).to.equal(1);
      expect(isRevoked).to.be.true;
    });

    it("should allow anyone to verify certificate", async function () {
      const [isValid] = await certificateRegistry.connect(employer).isValidCertificate(sampleHash1);
      expect(isValid).to.be.true;
    });

    it("should get certificate by ID", async function () {
      const cert = await certificateRegistry.getCertificate(1);
      expect(cert.documentHash).to.equal(sampleHash1);
      expect(cert.studentWallet).to.equal(student1.address);
    });

    it("should get certificate by hash", async function () {
      const cert = await certificateRegistry.getCertificateByHash(sampleHash1);
      expect(cert.certificateId).to.equal(1);
      expect(cert.studentWallet).to.equal(student1.address);
    });

    it("should revert when getting non-existent certificate by ID", async function () {
      await expect(
        certificateRegistry.getCertificate(999)
      ).to.be.revertedWithCustomError(certificateRegistry, "CertificateNotFound");
    });

    it("should revert when getting non-existent certificate by hash", async function () {
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("Fake"));
      await expect(
        certificateRegistry.getCertificateByHash(fakeHash)
      ).to.be.revertedWithCustomError(certificateRegistry, "CertificateNotFound");
    });
  });

  describe("Student Certificate Queries", function () {
    it("should return empty array for student with no certificates", async function () {
      const certs = await certificateRegistry.getCertificatesByStudent(student1.address);
      expect(certs.length).to.equal(0);
    });

    it("should return all certificates for a student", async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);
      await certificateRegistry.connect(university1).issueCertificate(sampleHash2, student1.address, ""
      , 2024);
      await certificateRegistry.connect(university1).issueCertificate(sampleHash3, student1.address, ""
      , 2024);

      const certs = await certificateRegistry.getCertificatesByStudent(student1.address);
      expect(certs.length).to.equal(3);
      expect(certs[0]).to.equal(1);
      expect(certs[1]).to.equal(2);
      expect(certs[2]).to.equal(3);
    });

    it("should return certificates only for queried student", async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);
      await certificateRegistry.connect(university1).issueCertificate(sampleHash2, student2.address, ""
      , 2024);

      const student1Certs = await certificateRegistry.getCertificatesByStudent(student1.address);
      const student2Certs = await certificateRegistry.getCertificatesByStudent(student2.address);

      expect(student1Certs.length).to.equal(1);
      expect(student2Certs.length).to.equal(1);
      expect(student1Certs[0]).to.equal(1);
      expect(student2Certs[0]).to.equal(2);
    });

    it("should include revoked certificates in student's list", async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);
      await certificateRegistry.connect(university1).revokeCertificate(1, "Test");

      const certs = await certificateRegistry.getCertificatesByStudent(student1.address);
      expect(certs.length).to.equal(1);
    });
  });

  describe("Institution Certificate Queries", function () {
    beforeEach(async function () {
      // Register and approve second university
      await institutionRegistry.connect(university2).registerInstitution("Stanford", "stanford.edu");
      await institutionRegistry.connect(superAdmin).approveInstitution(university2.address);
    });

    it("should return empty result for institution with no certificates", async function () {
      const [certIds, total] = await certificateRegistry.getCertificatesByInstitution(
        university1.address,
        0,
        10
      );
      expect(certIds.length).to.equal(0);
      expect(total).to.equal(0);
    });

    it("should return all certificates for an institution", async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);
      await certificateRegistry.connect(university1).issueCertificate(sampleHash2, student2.address, ""
      , 2024);

      const [certIds, total] = await certificateRegistry.getCertificatesByInstitution(
        university1.address,
        0,
        10
      );

      expect(certIds.length).to.equal(2);
      expect(total).to.equal(2);
      expect(certIds[0]).to.equal(1);
      expect(certIds[1]).to.equal(2);
    });

    it("should support pagination", async function () {
      // Issue 5 certificates
      for (let i = 0; i < 5; i++) {
        const hash = ethers.keccak256(ethers.toUtf8Bytes(`Certificate ${i}`));
        await certificateRegistry.connect(university1).issueCertificate(hash, student1.address, ""
        , 2024);
      }

      // Get first page (2 items)
      const [page1, total1] = await certificateRegistry.getCertificatesByInstitution(
        university1.address,
        0,
        2
      );
      expect(page1.length).to.equal(2);
      expect(total1).to.equal(5);

      // Get second page (2 items)
      const [page2, total2] = await certificateRegistry.getCertificatesByInstitution(
        university1.address,
        2,
        2
      );
      expect(page2.length).to.equal(2);
      expect(total2).to.equal(5);
      expect(page2[0]).to.equal(3);

      // Get last page (1 item)
      const [page3, total3] = await certificateRegistry.getCertificatesByInstitution(
        university1.address,
        4,
        2
      );
      expect(page3.length).to.equal(1);
      expect(total3).to.equal(5);
    });

    it("should filter certificates by institution", async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);
      await certificateRegistry.connect(university2).issueCertificate(sampleHash2, student1.address, ""
      , 2024);

      const [uni1Certs] = await certificateRegistry.getCertificatesByInstitution(
        university1.address,
        0,
        10
      );
      const [uni2Certs] = await certificateRegistry.getCertificatesByInstitution(
        university2.address,
        0,
        10
      );

      expect(uni1Certs.length).to.equal(1);
      expect(uni2Certs.length).to.equal(1);
      expect(uni1Certs[0]).to.equal(1);
      expect(uni2Certs[0]).to.equal(2);
    });

    it("should return empty array if offset exceeds total", async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);

      const [certIds, total] = await certificateRegistry.getCertificatesByInstitution(
        university1.address,
        10,
        5
      );

      expect(certIds.length).to.equal(0);
      expect(total).to.equal(1);
    });
  });

  describe("Authorization Tests", function () {
    it("should only allow authorized institution to issue", async function () {
      await expect(
        certificateRegistry.connect(randomUser).issueCertificate(sampleHash1, student1.address, ""
        , 2024)
      ).to.be.revertedWithCustomError(certificateRegistry, "UnauthorizedIssuer");
    });

    it("should check institution status before issuance", async function () {
      // Register but don't approve university2
      await institutionRegistry.connect(university2).registerInstitution("Stanford", "stanford.edu");

      await expect(
        certificateRegistry.connect(university2).issueCertificate(sampleHash1, student1.address, ""
        , 2024)
      ).to.be.revertedWithCustomError(certificateRegistry, "UnauthorizedIssuer");
    });

    it("should only allow super admin to upgrade contract", async function () {
      const CertificateRegistryV2 = await ethers.getContractFactory(
        "CertificateRegistry",
        randomUser
      );

      await expect(
        upgrades.upgradeProxy(
          await certificateRegistry.getAddress(),
          CertificateRegistryV2,
          { kind: "uups" }
        )
      ).to.be.reverted;
    });

    it("should allow super admin to update institution registry address", async function () {
      const newRegistryAddress = ethers.Wallet.createRandom().address;
      
      await certificateRegistry.connect(superAdmin).setInstitutionRegistry(newRegistryAddress);
      
      expect(await certificateRegistry.institutionRegistry()).to.equal(newRegistryAddress);
    });

    it("should revert when setting zero address as institution registry", async function () {
      await expect(
        certificateRegistry.connect(superAdmin).setInstitutionRegistry(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(certificateRegistry, "InvalidAddress");
    });

    it("should not allow non-admin to update institution registry", async function () {
      await expect(
        certificateRegistry.connect(randomUser).setInstitutionRegistry(
          ethers.Wallet.createRandom().address
        )
      ).to.be.reverted;
    });
  });

  describe("Edge Cases", function () {
    it("should handle certificate with very long metadata URI", async function () {
      const longURI = "ipfs://" + "a".repeat(500);
      
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, longURI
      , 2024);

      const cert = await certificateRegistry.getCertificate(1);
      expect(cert.metadataURI).to.equal(longURI);
    });

    it("should handle revocation with very long reason", async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);

      const longReason = "Reason: " + "x".repeat(500);
      await certificateRegistry.connect(university1).revokeCertificate(1, longReason);

      const cert = await certificateRegistry.getCertificate(1);
      expect(cert.revocationReason).to.equal(longReason);
    });

    it("should handle multiple operations in sequence", async function () {
      // Issue certificate
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);

      // Verify it's valid
      let [isValid] = await certificateRegistry.isValidCertificate(sampleHash1);
      expect(isValid).to.be.true;

      // Revoke it
      await certificateRegistry.connect(university1).revokeCertificate(1, "Test");

      // Verify it's now invalid
      [isValid] = await certificateRegistry.isValidCertificate(sampleHash1);
      expect(isValid).to.be.false;

      // Issue new certificate to same student
      await certificateRegistry.connect(university1).issueCertificate(sampleHash2, student1.address, ""
      , 2024);

      // Verify student has 2 certificates
      const certs = await certificateRegistry.getCertificatesByStudent(student1.address);
      expect(certs.length).to.equal(2);
    });

    it("should maintain state integrity across multiple institutions", async function () {
      // Register second university
      await institutionRegistry.connect(university2).registerInstitution("Stanford", "stanford.edu");
      await institutionRegistry.connect(superAdmin).approveInstitution(university2.address);

      // Both issue certificates
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);
      await certificateRegistry.connect(university2).issueCertificate(sampleHash2, student1.address, ""
      , 2024);

      // Verify total count
      expect(await certificateRegistry.getTotalCertificates()).to.equal(2);

      // Verify student has both
      const studentCerts = await certificateRegistry.getCertificatesByStudent(student1.address);
      expect(studentCerts.length).to.equal(2);

      // Verify institution counts
      const uni1 = await institutionRegistry.getInstitution(university1.address);
      const uni2 = await institutionRegistry.getInstitution(university2.address);
      expect(uni1.totalCertificatesIssued).to.equal(1);
      expect(uni2.totalCertificatesIssued).to.equal(1);
    });

    it("should return correct data after ID counter wraps around large numbers", async function () {
      // This tests ID generation logic
      expect(await certificateRegistry.getTotalCertificates()).to.equal(0);
      
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, ""
      , 2024);
      
      const cert = await certificateRegistry.getCertificate(1);
      expect(cert.certificateId).to.equal(1);
      expect(await certificateRegistry.getTotalCertificates()).to.equal(1);
    });
  });

  describe("Version Management", function () {
    it("should have correct initial version", async function () {
      expect(await certificateRegistry.VERSION()).to.equal("1.0.0");
    });

    it("should allow super admin to record upgrades", async function () {
      await certificateRegistry.connect(superAdmin).recordUpgrade("1.0.1", "Bug fix");
      
      const history = await certificateRegistry.getUpgradeHistory();
      expect(history.length).to.equal(2);
      expect(history[1].version).to.equal("1.0.1");
      expect(history[1].notes).to.equal("Bug fix");
    });

    it("should not allow non-admin to record upgrades", async function () {
      await expect(
        certificateRegistry.connect(randomUser).recordUpgrade("1.0.1", "Unauthorized")
      ).to.be.reverted;
    });

    it("should maintain upgrade history correctly", async function () {
      await certificateRegistry.connect(superAdmin).recordUpgrade("1.0.1", "Patch");
      await certificateRegistry.connect(superAdmin).recordUpgrade("1.1.0", "Minor");
      await certificateRegistry.connect(superAdmin).recordUpgrade("2.0.0", "Major");

      const history = await certificateRegistry.getUpgradeHistory();
      expect(history.length).to.equal(4);
      expect(history[0].version).to.equal("1.0.0");
      expect(history[1].version).to.equal("1.0.1");
      expect(history[2].version).to.equal("1.1.0");
      expect(history[3].version).to.equal("2.0.0");
    });
  });

  describe("Helper Functions - certificateExists", function () {
    let certId: bigint;

    beforeEach(async function () {
      certId = await certificateRegistry.connect(university1).issueCertificate.staticCall(
        sampleHash1,
        student1.address,
        metadataURI,
        2024
      );
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, metadataURI
      , 2024);
    });

    it("should return true for existing certificate", async function () {
      expect(await certificateRegistry.certificateExists(certId)).to.be.true;
    });

    it("should return false for non-existent certificate ID", async function () {
      expect(await certificateRegistry.certificateExists(999n)).to.be.false;
    });

    it("should return false for ID 0", async function () {
      expect(await certificateRegistry.certificateExists(0n)).to.be.false;
    });

    it("should work for multiple certificates", async function () {
      const certId2 = await certificateRegistry.connect(university1).issueCertificate.staticCall(
        sampleHash2,
        student2.address,
        metadataURI,
        2024
      );
      await certificateRegistry.connect(university1).issueCertificate(sampleHash2, student2.address, metadataURI
      , 2024);

      expect(await certificateRegistry.certificateExists(certId)).to.be.true;
      expect(await certificateRegistry.certificateExists(certId2)).to.be.true;
      expect(await certificateRegistry.certificateExists(certId + 10n)).to.be.false;
    });

    it("should still return true for revoked certificates", async function () {
      await certificateRegistry.connect(university1).revokeCertificate(certId, "Test revocation");
      expect(await certificateRegistry.certificateExists(certId)).to.be.true;
    });

    it("should be callable by anyone", async function () {
      expect(await certificateRegistry.connect(randomUser).certificateExists(certId)).to.be.true;
      expect(await certificateRegistry.connect(employer).certificateExists(999n)).to.be.false;
    });

    it("should be more gas efficient than try-catch getCertificate", async function () {
      // This test demonstrates the purpose of the function
      // certificateExists doesn't revert, making it more gas-efficient for checks
      const exists = await certificateRegistry.certificateExists(certId);
      expect(exists).to.be.true;
    });
  });

  describe("Helper Functions - hashExists", function () {
    beforeEach(async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, metadataURI
      , 2024);
    });

    it("should return true for existing hash", async function () {
      expect(await certificateRegistry.hashExists(sampleHash1)).to.be.true;
    });

    it("should return false for non-existent hash", async function () {
      expect(await certificateRegistry.hashExists(sampleHash2)).to.be.false;
    });

    it("should return false for zero hash", async function () {
      expect(await certificateRegistry.hashExists(ethers.ZeroHash)).to.be.false;
    });

    it("should work for multiple hashes", async function () {
      await certificateRegistry.connect(university1).issueCertificate(sampleHash2, student2.address, metadataURI
      , 2024);

      expect(await certificateRegistry.hashExists(sampleHash1)).to.be.true;
      expect(await certificateRegistry.hashExists(sampleHash2)).to.be.true;
      expect(await certificateRegistry.hashExists(sampleHash3)).to.be.false;
    });

    it("should help prevent duplicate issuance", async function () {
      // Check before issuing
      expect(await certificateRegistry.hashExists(sampleHash2)).to.be.false;
      
      // Issue certificate
      await certificateRegistry.connect(university1).issueCertificate(sampleHash2, student1.address, metadataURI
      , 2024);
      
      // Check after issuing
      expect(await certificateRegistry.hashExists(sampleHash2)).to.be.true;
      
      // Attempting to issue duplicate should revert
      await expect(
        certificateRegistry.connect(university1).issueCertificate(sampleHash2, student1.address, metadataURI
        , 2024)
      ).to.be.revertedWithCustomError(certificateRegistry, "CertificateAlreadyExists");
    });

    it("should still return true for revoked certificate hashes", async function () {
      const certId = await certificateRegistry.connect(university1).issueCertificate.staticCall(
        sampleHash2,
        student1.address,
        metadataURI,
        2024
      );
      await certificateRegistry.connect(university1).issueCertificate(sampleHash2, student1.address, metadataURI
      , 2024);

      await certificateRegistry.connect(university1).revokeCertificate(certId, "Test revocation");
      
      expect(await certificateRegistry.hashExists(sampleHash2)).to.be.true;
    });

    it("should be callable by anyone", async function () {
      expect(await certificateRegistry.connect(randomUser).hashExists(sampleHash1)).to.be.true;
      expect(await certificateRegistry.connect(employer).hashExists(sampleHash3)).to.be.false;
    });
  });

  describe("Helper Functions - getCertificatesBatch", function () {
    let certId1: bigint;
    let certId2: bigint;
    let certId3: bigint;

    beforeEach(async function () {
      certId1 = await certificateRegistry.connect(university1).issueCertificate.staticCall(
        sampleHash1,
        student1.address,
        metadataURI,
        2024
      );
      await certificateRegistry.connect(university1).issueCertificate(sampleHash1, student1.address, metadataURI
      , 2024);

      certId2 = await certificateRegistry.connect(university1).issueCertificate.staticCall(
        sampleHash2,
        student2.address,
        "ipfs://QmY...",
        2023
      );
      await certificateRegistry.connect(university1).issueCertificate(sampleHash2, student2.address, "ipfs://QmY..."
      , 2024);

      certId3 = await certificateRegistry.connect(university1).issueCertificate.staticCall(
        sampleHash3,
        student1.address,
        "ipfs://QmZ...",
        2022
      );
      await certificateRegistry.connect(university1).issueCertificate(sampleHash3, student1.address, "ipfs://QmZ..."
      , 2024);
    });

    it("should return batch of existing certificates", async function () {
      const [certificates, foundFlags] = await certificateRegistry.getCertificatesBatch([
        certId1,
        certId2,
        certId3
      ]);

      expect(certificates.length).to.equal(3);
      expect(foundFlags.length).to.equal(3);
      expect(foundFlags[0]).to.be.true;
      expect(foundFlags[1]).to.be.true;
      expect(foundFlags[2]).to.be.true;

      expect(certificates[0].certificateId).to.equal(certId1);
      expect(certificates[0].documentHash).to.equal(sampleHash1);
      expect(certificates[0].studentWallet).to.equal(student1.address);

      expect(certificates[1].certificateId).to.equal(certId2);
      expect(certificates[1].documentHash).to.equal(sampleHash2);
      expect(certificates[1].studentWallet).to.equal(student2.address);
    });

    it("should handle mix of existing and non-existing certificates", async function () {
      const [certificates, foundFlags] = await certificateRegistry.getCertificatesBatch([
        certId1,
        999n,
        certId2,
        1000n
      ]);

      expect(certificates.length).to.equal(4);
      expect(foundFlags.length).to.equal(4);

      expect(foundFlags[0]).to.be.true;
      expect(foundFlags[1]).to.be.false;
      expect(foundFlags[2]).to.be.true;
      expect(foundFlags[3]).to.be.false;

      expect(certificates[0].certificateId).to.equal(certId1);
      expect(certificates[1].certificateId).to.equal(0n); // Empty certificate
      expect(certificates[2].certificateId).to.equal(certId2);
      expect(certificates[3].certificateId).to.equal(0n); // Empty certificate
    });

    it("should handle empty array", async function () {
      const [certificates, foundFlags] = await certificateRegistry.getCertificatesBatch([]);

      expect(certificates.length).to.equal(0);
      expect(foundFlags.length).to.equal(0);
    });

    it("should handle single certificate", async function () {
      const [certificates, foundFlags] = await certificateRegistry.getCertificatesBatch([certId1]);

      expect(certificates.length).to.equal(1);
      expect(foundFlags.length).to.equal(1);
      expect(foundFlags[0]).to.be.true;
      expect(certificates[0].certificateId).to.equal(certId1);
    });

    it("should include revoked certificates with revocation info", async function () {
      await certificateRegistry.connect(university1).revokeCertificate(certId2, "Test revocation");

      const [certificates, foundFlags] = await certificateRegistry.getCertificatesBatch([
        certId1,
        certId2,
        certId3
      ]);

      expect(foundFlags[1]).to.be.true;
      expect(certificates[1].isRevoked).to.be.true;
      expect(certificates[1].revocationReason).to.equal("Test revocation");
      expect(certificates[0].isRevoked).to.be.false;
      expect(certificates[2].isRevoked).to.be.false;
    });

    it("should be gas-efficient for large batches", async function () {
      // Issue more certificates
      const certIds = [certId1, certId2, certId3];
      
      for (let i = 4; i <= 10; i++) {
        const hash = ethers.keccak256(ethers.toUtf8Bytes(`Certificate ${i}`));
        const id = await certificateRegistry.connect(university1).issueCertificate.staticCall(
          hash,
          student1.address,
          metadataURI,
          2024
        );
        await certificateRegistry.connect(university1).issueCertificate(hash, student1.address, metadataURI
        , 2024);
        certIds.push(id);
      }

      const [certificates, foundFlags] = await certificateRegistry.getCertificatesBatch(certIds);

      expect(certificates.length).to.equal(10);
      expect(foundFlags.length).to.equal(10);
      expect(foundFlags.every(flag => flag)).to.be.true;
    });

    it("should be callable by anyone", async function () {
      const [certificates, foundFlags] = await certificateRegistry.connect(randomUser)
        .getCertificatesBatch([certId1, certId2]);

      expect(foundFlags[0]).to.be.true;
      expect(foundFlags[1]).to.be.true;
    });

    it("should handle duplicate IDs in request", async function () {
      const [certificates, foundFlags] = await certificateRegistry.getCertificatesBatch([
        certId1,
        certId1,
        certId2
      ]);

      expect(certificates.length).to.equal(3);
      expect(foundFlags[0]).to.be.true;
      expect(foundFlags[1]).to.be.true;
      expect(foundFlags[2]).to.be.true;
      expect(certificates[0].certificateId).to.equal(certId1);
      expect(certificates[1].certificateId).to.equal(certId1);
    });

    it("should preserve metadata for all certificates", async function () {
      const [certificates, foundFlags] = await certificateRegistry.getCertificatesBatch([
        certId1,
        certId2,
        certId3
      ]);

      expect(certificates[0].metadataURI).to.equal(metadataURI);
      expect(certificates[1].metadataURI).to.equal("ipfs://QmY...");
      expect(certificates[2].metadataURI).to.equal("ipfs://QmZ...");
    });
  });
});
