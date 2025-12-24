// contracts/test/integration.test.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { CertificateRegistry, InstitutionRegistry, CertificateRegistryV2 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Integration Tests - Full Workflow", function () {
  let certificateRegistry: CertificateRegistry;
  let institutionRegistry: InstitutionRegistry;
  let superAdmin: SignerWithAddress;
  let mit: SignerWithAddress;
  let stanford: SignerWithAddress;
  let studentAlice: SignerWithAddress;
  let studentBob: SignerWithAddress;
  let employerTechCorp: SignerWithAddress;

  // Certificate hashes
  const aliceDegreeHash = ethers.keccak256(ethers.toUtf8Bytes("Alice MIT CS Degree 2024"));
  const bobDegreeHash = ethers.keccak256(ethers.toUtf8Bytes("Bob Stanford MBA 2024"));
  const aliceCertHash = ethers.keccak256(ethers.toUtf8Bytes("Alice ML Certificate"));

  beforeEach(async function () {
    [superAdmin, mit, stanford, studentAlice, studentBob, employerTechCorp] = 
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

    // Link registries
    await institutionRegistry.connect(superAdmin).setCertificateRegistry(
      await certificateRegistry.getAddress()
    );
  });

  describe("Complete User Journey: Happy Path", function () {
    it("should complete full flow: Register → Approve → Issue → Verify", async function () {
      // ===== STEP 1: Institution Registration =====
      console.log("\n1. MIT registers as an institution...");
      await institutionRegistry.connect(mit).registerInstitution(
        "Massachusetts Institute of Technology",
        "mit.edu"
      );

      let mitData = await institutionRegistry.getInstitution(mit.address);
      expect(mitData.name).to.equal("Massachusetts Institute of Technology");
      expect(mitData.isVerified).to.be.false;
      expect(mitData.isActive).to.be.false;
      console.log("   ✓ MIT registered (pending approval)");

      // ===== STEP 2: Super Admin Approval =====
      console.log("\n2. Super admin approves MIT...");
      await institutionRegistry.connect(superAdmin).approveInstitution(mit.address);

      mitData = await institutionRegistry.getInstitution(mit.address);
      expect(mitData.isVerified).to.be.true;
      expect(mitData.isActive).to.be.true;
      expect(await institutionRegistry.canIssueCertificates(mit.address)).to.be.true;
      console.log("   ✓ MIT approved and can issue certificates");

      // ===== STEP 3: Certificate Issuance =====
      console.log("\n3. MIT issues degree to Alice...");
      await expect(
        certificateRegistry.connect(mit).issueCertificate(
          aliceDegreeHash,
          studentAlice.address,
          "ipfs://QmAliceDegree"
        )
      ).to.emit(certificateRegistry, "CertificateIssued");
      console.log("   ✓ Certificate issued (ID: 1)");

      // Verify certificate data
      const cert = await certificateRegistry.getCertificate(1);
      expect(cert.documentHash).to.equal(aliceDegreeHash);
      expect(cert.studentWallet).to.equal(studentAlice.address);
      expect(cert.issuingInstitution).to.equal(mit.address);
      expect(cert.isRevoked).to.be.false;

      // Verify student has certificate
      const aliceCerts = await certificateRegistry.getCertificatesByStudent(studentAlice.address);
      expect(aliceCerts.length).to.equal(1);
      expect(aliceCerts[0]).to.equal(1);

      // Verify institution count incremented
      mitData = await institutionRegistry.getInstitution(mit.address);
      expect(mitData.totalCertificatesIssued).to.equal(1);
      console.log("   ✓ Certificate linked to student wallet");

      // ===== STEP 4: Employer Verification =====
      console.log("\n4. TechCorp verifies Alice's degree...");
      const [isValid, certId, isRevoked] = await certificateRegistry
        .connect(employerTechCorp)
        .isValidCertificate(aliceDegreeHash);

      expect(isValid).to.be.true;
      expect(certId).to.equal(1);
      expect(isRevoked).to.be.false;
      console.log("   ✓ Certificate verified as authentic");

      // Employer can also verify by querying student's certificates
      const verifiedCert = await certificateRegistry.getCertificate(certId);
      expect(verifiedCert.issuingInstitution).to.equal(mit.address);
      expect(verifiedCert.studentWallet).to.equal(studentAlice.address);
      console.log("   ✓ Employer confirmed issuing institution");

      console.log("\n✅ Complete workflow successful!");
    });

    it("should handle multiple institutions and students", async function () {
      // Register and approve both institutions
      await institutionRegistry.connect(mit).registerInstitution("MIT", "mit.edu");
      await institutionRegistry.connect(stanford).registerInstitution("Stanford", "stanford.edu");
      await institutionRegistry.connect(superAdmin).approveInstitution(mit.address);
      await institutionRegistry.connect(superAdmin).approveInstitution(stanford.address);

      // MIT issues to Alice
      await certificateRegistry.connect(mit).issueCertificate(
        aliceDegreeHash,
        studentAlice.address,
        ""
      );

      // Stanford issues to Bob
      await certificateRegistry.connect(stanford).issueCertificate(
        bobDegreeHash,
        studentBob.address,
        ""
      );

      // MIT issues second certificate to Alice
      await certificateRegistry.connect(mit).issueCertificate(
        aliceCertHash,
        studentAlice.address,
        ""
      );

      // Verify system state
      expect(await certificateRegistry.getTotalCertificates()).to.equal(3);

      // Verify Alice has 2 certificates
      const aliceCerts = await certificateRegistry.getCertificatesByStudent(studentAlice.address);
      expect(aliceCerts.length).to.equal(2);

      // Verify Bob has 1 certificate
      const bobCerts = await certificateRegistry.getCertificatesByStudent(studentBob.address);
      expect(bobCerts.length).to.equal(1);

      // Verify institution counts
      const mitData = await institutionRegistry.getInstitution(mit.address);
      const stanfordData = await institutionRegistry.getInstitution(stanford.address);
      expect(mitData.totalCertificatesIssued).to.equal(2);
      expect(stanfordData.totalCertificatesIssued).to.equal(1);

      // Verify all certificates are valid
      expect((await certificateRegistry.isValidCertificate(aliceDegreeHash))[0]).to.be.true;
      expect((await certificateRegistry.isValidCertificate(bobDegreeHash))[0]).to.be.true;
      expect((await certificateRegistry.isValidCertificate(aliceCertHash))[0]).to.be.true;
    });
  });

  describe("Complete User Journey: Revocation Flow", function () {
    it("should complete flow: Register → Approve → Issue → Verify → Revoke", async function () {
      // Setup
      await institutionRegistry.connect(mit).registerInstitution("MIT", "mit.edu");
      await institutionRegistry.connect(superAdmin).approveInstitution(mit.address);
      await certificateRegistry.connect(mit).issueCertificate(
        aliceDegreeHash,
        studentAlice.address,
        ""
      );

      // Verify certificate is valid
      let [isValid] = await certificateRegistry.isValidCertificate(aliceDegreeHash);
      expect(isValid).to.be.true;

      // ===== REVOCATION =====
      console.log("\nRevoking certificate due to fraud...");
      const revocationReason = "Certificate issued in error - identity verification failed";
      
      await expect(
        certificateRegistry.connect(mit).revokeCertificate(1, revocationReason)
      ).to.emit(certificateRegistry, "CertificateRevoked");

      // Verify certificate is now invalid
      [isValid] = await certificateRegistry.isValidCertificate(aliceDegreeHash);
      expect(isValid).to.be.false;

      // Verify revocation details
      const cert = await certificateRegistry.getCertificate(1);
      expect(cert.isRevoked).to.be.true;
      expect(cert.revocationReason).to.equal(revocationReason);
      expect(cert.revokedAt).to.be.gt(0);

      // Certificate still appears in student's list but marked as revoked
      const aliceCerts = await certificateRegistry.getCertificatesByStudent(studentAlice.address);
      expect(aliceCerts.length).to.equal(1);
      expect(aliceCerts[0]).to.equal(1);

      console.log("✅ Certificate successfully revoked");
    });

    it("should allow super admin to revoke any certificate", async function () {
      // Setup
      await institutionRegistry.connect(mit).registerInstitution("MIT", "mit.edu");
      await institutionRegistry.connect(superAdmin).approveInstitution(mit.address);
      await certificateRegistry.connect(mit).issueCertificate(
        aliceDegreeHash,
        studentAlice.address,
        ""
      );

      // Super admin revokes (not the issuing institution)
      await certificateRegistry.connect(superAdmin).revokeCertificate(
        1,
        "Administrative action required"
      );

      const cert = await certificateRegistry.getCertificate(1);
      expect(cert.isRevoked).to.be.true;
    });

    it("should prevent revoked certificate from being revoked again", async function () {
      await institutionRegistry.connect(mit).registerInstitution("MIT", "mit.edu");
      await institutionRegistry.connect(superAdmin).approveInstitution(mit.address);
      await certificateRegistry.connect(mit).issueCertificate(
        aliceDegreeHash,
        studentAlice.address,
        ""
      );

      // First revocation
      await certificateRegistry.connect(mit).revokeCertificate(1, "First reason");

      // Second revocation attempt should fail
      await expect(
        certificateRegistry.connect(mit).revokeCertificate(1, "Second reason")
      ).to.be.revertedWithCustomError(certificateRegistry, "CertificateAlreadyRevoked");
    });
  });

  describe("Complete User Journey: Institution Suspension", function () {
    it("should complete flow: Approve → Issue → Suspend → Cannot Issue → Reactivate → Can Issue", async function () {
      // Setup
      await institutionRegistry.connect(mit).registerInstitution("MIT", "mit.edu");
      await institutionRegistry.connect(superAdmin).approveInstitution(mit.address);

      // ===== ISSUE BEFORE SUSPENSION =====
      console.log("\n1. MIT issues certificate to Alice...");
      await certificateRegistry.connect(mit).issueCertificate(
        aliceDegreeHash,
        studentAlice.address,
        ""
      );
      console.log("   ✓ Certificate issued");

      // ===== SUSPENSION =====
      console.log("\n2. Super admin suspends MIT...");
      await institutionRegistry.connect(superAdmin).suspendInstitution(mit.address);
      expect(await institutionRegistry.canIssueCertificates(mit.address)).to.be.false;
      console.log("   ✓ MIT suspended");

      // ===== CANNOT ISSUE WHILE SUSPENDED =====
      console.log("\n3. MIT attempts to issue while suspended...");
      await expect(
        certificateRegistry.connect(mit).issueCertificate(
          bobDegreeHash,
          studentBob.address,
          ""
        )
      ).to.be.revertedWithCustomError(certificateRegistry, "UnauthorizedIssuer");
      console.log("   ✓ Issuance blocked (as expected)");

      // ===== EXISTING CERTIFICATES STILL VALID =====
      console.log("\n4. Checking existing certificate...");
      const [isValid] = await certificateRegistry.isValidCertificate(aliceDegreeHash);
      expect(isValid).to.be.true;
      console.log("   ✓ Previously issued certificates remain valid");

      // ===== CAN STILL REVOKE WHILE SUSPENDED =====
      console.log("\n5. MIT can still revoke certificates while suspended...");
      await certificateRegistry.connect(mit).revokeCertificate(1, "Revoked during suspension");
      const cert = await certificateRegistry.getCertificate(1);
      expect(cert.isRevoked).to.be.true;
      console.log("   ✓ Revocation still allowed");

      // ===== REACTIVATION =====
      console.log("\n6. Super admin reactivates MIT...");
      await institutionRegistry.connect(superAdmin).reactivateInstitution(mit.address);
      expect(await institutionRegistry.canIssueCertificates(mit.address)).to.be.true;
      console.log("   ✓ MIT reactivated");

      // ===== CAN ISSUE AFTER REACTIVATION =====
      console.log("\n7. MIT issues certificate to Bob...");
      await certificateRegistry.connect(mit).issueCertificate(
        bobDegreeHash,
        studentBob.address,
        ""
      );
      const bobCert = await certificateRegistry.getCertificate(2);
      expect(bobCert.studentWallet).to.equal(studentBob.address);
      console.log("   ✓ New issuance successful");

      console.log("\n✅ Suspension/reactivation workflow complete");
    });
  });

  describe("Complete User Journey: Upgrade Scenario", function () {
    it("should upgrade to V2 and maintain data integrity", async function () {
      // ===== SETUP IN V1 =====
      console.log("\n1. Setting up V1 data...");
      await institutionRegistry.connect(mit).registerInstitution("MIT", "mit.edu");
      await institutionRegistry.connect(stanford).registerInstitution("Stanford", "stanford.edu");
      await institutionRegistry.connect(superAdmin).approveInstitution(mit.address);
      await institutionRegistry.connect(superAdmin).approveInstitution(stanford.address);

      // Issue certificates
      await certificateRegistry.connect(mit).issueCertificate(
        aliceDegreeHash,
        studentAlice.address,
        ""
      );
      await certificateRegistry.connect(stanford).issueCertificate(
        bobDegreeHash,
        studentBob.address,
        ""
      );

      console.log("   ✓ 2 institutions registered and approved");
      console.log("   ✓ 2 certificates issued");

      // Verify V1 data
      const aliceCertV1 = await certificateRegistry.getCertificate(1);
      const bobCertV1 = await certificateRegistry.getCertificate(2);
      expect(aliceCertV1.studentWallet).to.equal(studentAlice.address);
      expect(bobCertV1.studentWallet).to.equal(studentBob.address);

      // ===== UPGRADE TO V2 =====
      console.log("\n2. Upgrading CertificateRegistry to V2...");
      const CertificateRegistryV2 = await ethers.getContractFactory("CertificateRegistryV2");
      const upgradedRegistry = await upgrades.upgradeProxy(
        await certificateRegistry.getAddress(),
        CertificateRegistryV2,
        { kind: "uups" }
      ) as unknown as CertificateRegistryV2;

      await upgradedRegistry.upgradeToV2("Upgraded to V2 with batch operations");
      console.log("   ✓ Upgraded to V2");

      // ===== VERIFY DATA INTEGRITY =====
      console.log("\n3. Verifying data integrity after upgrade...");
      const aliceCertV2 = await upgradedRegistry.getCertificate(1);
      const bobCertV2 = await upgradedRegistry.getCertificate(2);

      expect(aliceCertV2.documentHash).to.equal(aliceCertV1.documentHash);
      expect(aliceCertV2.studentWallet).to.equal(aliceCertV1.studentWallet);
      expect(bobCertV2.documentHash).to.equal(bobCertV1.documentHash);
      expect(bobCertV2.studentWallet).to.equal(bobCertV1.studentWallet);
      console.log("   ✓ All V1 data preserved");

      // ===== VERIFY VERSION CHANGE =====
      expect(await upgradedRegistry.getVersion()).to.equal("2.0.0");
      const history = await upgradedRegistry.getUpgradeHistory();
      expect(history.length).to.equal(2);
      expect(history[1].version).to.equal("2.0.0");
      console.log("   ✓ Version updated to 2.0.0");

      // ===== TEST V2 NEW FEATURE: BATCH ISSUANCE =====
      console.log("\n4. Testing V2 batch issuance feature...");
      const batchHashes = [
        ethers.keccak256(ethers.toUtf8Bytes("Batch Cert 1")),
        ethers.keccak256(ethers.toUtf8Bytes("Batch Cert 2")),
        ethers.keccak256(ethers.toUtf8Bytes("Batch Cert 3")),
      ];
      const students = [studentAlice.address, studentAlice.address, studentBob.address];
      const metadatas = ["", "", ""];

      await upgradedRegistry.connect(mit).issueCertificateBatch(
        batchHashes,
        students,
        metadatas
      );

      // Verify batch was recorded
      const tx = await upgradedRegistry.connect(mit).issueCertificateBatch(
        [ethers.keccak256(ethers.toUtf8Bytes("Batch Cert 4"))],
        [studentBob.address],
        [""]
      );
      const receipt = await tx.wait();
      
      console.log("   ✓ Batch issuance successful");

      // Verify all certificates exist
      expect(await upgradedRegistry.getTotalCertificates()).to.equal(6); // 2 from V1 + 3 from first batch + 1 from second batch

      // Verify Alice now has 3 certificates (1 from V1 + 2 from batch)
      const aliceCertsV2 = await upgradedRegistry.getCertificatesByStudent(studentAlice.address);
      expect(aliceCertsV2.length).to.equal(3);
      console.log("   ✓ Student certificates tracked correctly");

      console.log("\n✅ Upgrade scenario completed successfully");
    });
  });

  describe("Complex Multi-User Scenarios", function () {
    it("should handle complex workflow with multiple users and edge cases", async function () {
      // Register 2 institutions
      await institutionRegistry.connect(mit).registerInstitution("MIT", "mit.edu");
      await institutionRegistry.connect(stanford).registerInstitution("Stanford", "stanford.edu");

      // Approve MIT but not Stanford (yet)
      await institutionRegistry.connect(superAdmin).approveInstitution(mit.address);

      // MIT issues to both students
      await certificateRegistry.connect(mit).issueCertificate(
        aliceDegreeHash,
        studentAlice.address,
        "ipfs://alice-degree"
      );
      await certificateRegistry.connect(mit).issueCertificate(
        aliceCertHash,
        studentAlice.address,
        "ipfs://alice-cert"
      );
      await certificateRegistry.connect(mit).issueCertificate(
        bobDegreeHash,
        studentBob.address,
        "ipfs://bob-degree"
      );

      // Stanford tries to issue (should fail - not approved)
      await expect(
        certificateRegistry.connect(stanford).issueCertificate(
          ethers.keccak256(ethers.toUtf8Bytes("Stanford Degree")),
          studentBob.address,
          ""
        )
      ).to.be.revertedWithCustomError(certificateRegistry, "UnauthorizedIssuer");

      // Approve Stanford
      await institutionRegistry.connect(superAdmin).approveInstitution(stanford.address);

      // Now Stanford can issue
      const stanfordCertHash = ethers.keccak256(ethers.toUtf8Bytes("Stanford MBA"));
      await certificateRegistry.connect(stanford).issueCertificate(
        stanfordCertHash,
        studentBob.address,
        ""
      );

      // Suspend MIT
      await institutionRegistry.connect(superAdmin).suspendInstitution(mit.address);

      // MIT tries to issue (should fail - suspended)
      await expect(
        certificateRegistry.connect(mit).issueCertificate(
          ethers.keccak256(ethers.toUtf8Bytes("New MIT Degree")),
          studentAlice.address,
          ""
        )
      ).to.be.revertedWithCustomError(certificateRegistry, "UnauthorizedIssuer");

      // MIT can still revoke its own certificates
      await certificateRegistry.connect(mit).revokeCertificate(2, "Revoked by MIT");

      // Verify final state
      const totalCerts = await certificateRegistry.getTotalCertificates();
      expect(totalCerts).to.equal(4);

      const aliceCerts = await certificateRegistry.getCertificatesByStudent(studentAlice.address);
      const bobCerts = await certificateRegistry.getCertificatesByStudent(studentBob.address);
      expect(aliceCerts.length).to.equal(2); // Both MIT certs
      expect(bobCerts.length).to.equal(2);   // 1 MIT + 1 Stanford

      // Verify revocation
      const revokedCert = await certificateRegistry.getCertificate(2);
      expect(revokedCert.isRevoked).to.be.true;

      // Verify institution stats
      const mitStats = await institutionRegistry.getInstitution(mit.address);
      const stanfordStats = await institutionRegistry.getInstitution(stanford.address);
      expect(mitStats.totalCertificatesIssued).to.equal(3);
      expect(stanfordStats.totalCertificatesIssued).to.equal(1);
      expect(mitStats.isActive).to.be.false; // Suspended
      expect(stanfordStats.isActive).to.be.true;
    });

    it("should handle employer verification of multiple certificates", async function () {
      // Setup
      await institutionRegistry.connect(mit).registerInstitution("MIT", "mit.edu");
      await institutionRegistry.connect(superAdmin).approveInstitution(mit.address);

      // Issue 3 certificates to Alice
      const cert1Hash = ethers.keccak256(ethers.toUtf8Bytes("Bachelor's Degree"));
      const cert2Hash = ethers.keccak256(ethers.toUtf8Bytes("Master's Degree"));
      const cert3Hash = ethers.keccak256(ethers.toUtf8Bytes("PhD Degree"));

      await certificateRegistry.connect(mit).issueCertificate(cert1Hash, studentAlice.address, "");
      await certificateRegistry.connect(mit).issueCertificate(cert2Hash, studentAlice.address, "");
      await certificateRegistry.connect(mit).issueCertificate(cert3Hash, studentAlice.address, "");

      // Revoke one certificate
      await certificateRegistry.connect(mit).revokeCertificate(2, "Degree rescinded");

      // Employer verifies all three
      const [valid1] = await certificateRegistry.connect(employerTechCorp).isValidCertificate(cert1Hash);
      const [valid2] = await certificateRegistry.connect(employerTechCorp).isValidCertificate(cert2Hash);
      const [valid3] = await certificateRegistry.connect(employerTechCorp).isValidCertificate(cert3Hash);

      expect(valid1).to.be.true;   // Valid
      expect(valid2).to.be.false;  // Revoked
      expect(valid3).to.be.true;   // Valid

      // Employer can see all certificates for student
      const allCerts = await certificateRegistry.getCertificatesByStudent(studentAlice.address);
      expect(allCerts.length).to.equal(3);

      // Employer can check revocation status
      const cert2 = await certificateRegistry.getCertificate(2);
      expect(cert2.isRevoked).to.be.true;
      expect(cert2.revocationReason).to.equal("Degree rescinded");
    });
  });

  describe("Access Control Integration", function () {
    it("should enforce proper role-based access control across contracts", async function () {
      // Get a truly unauthorized signer (not one of the test actors)
      const signers = await ethers.getSigners();
      const unauthorized = signers[6]; // Use 7th signer, all our test actors are in first 6

      // Use a unique hash for this test to avoid collision
      const uniqueHash = ethers.keccak256(ethers.toUtf8Bytes("Unique Access Control Test Cert"));

      // Setup
      await institutionRegistry.connect(mit).registerInstitution("MIT", "mit.edu");

      // Only super admin can approve
      await expect(
        institutionRegistry.connect(unauthorized).approveInstitution(mit.address)
      ).to.be.reverted;

      await institutionRegistry.connect(superAdmin).approveInstitution(mit.address);

      // Issue certificate
      await certificateRegistry.connect(mit).issueCertificate(
        uniqueHash,
        studentAlice.address,
        ""
      );

      // Get the certificate ID that was just issued
      const issuedCert = await certificateRegistry.getCertificateByHash(uniqueHash);
      const certId = issuedCert.certificateId;

      // Verify certificate is not revoked before testing
      expect(issuedCert.isRevoked).to.be.false;
      // Verify unauthorized is not the issuer
      expect(issuedCert.issuingInstitution).to.not.equal(unauthorized.address);

      // Only issuer or super admin can revoke - test unauthorized first
      await expect(
        certificateRegistry.connect(unauthorized).revokeCertificate(certId, "Unauthorized")
      ).to.be.revertedWithCustomError(certificateRegistry, "NotCertificateIssuer");

      // Super admin can revoke
      await certificateRegistry.connect(superAdmin).revokeCertificate(certId, "Admin revocation");

      const cert = await certificateRegistry.getCertificate(certId);
      expect(cert.isRevoked).to.be.true;

      // Only super admin can upgrade contracts
      const InstitutionRegistryV2 = await ethers.getContractFactory(
        "InstitutionRegistry",
        unauthorized
      );

      await expect(
        upgrades.upgradeProxy(
          await institutionRegistry.getAddress(),
          InstitutionRegistryV2,
          { kind: "uups" }
        )
      ).to.be.reverted;
    });
  });
});

