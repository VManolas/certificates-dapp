// test/CertificateRegistry.hash-rules.test.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { CertificateRegistry, InstitutionRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Tests for two undocumented but load-bearing hash-reuse rules:
 *
 * 1. Duplicate hash within a single batch call
 *    The first occurrence registers the hash; the second occurrence within the same
 *    loop hits CertificateAlreadyExists, reverting the whole transaction.
 *    No certificates are written (atomicity holds).
 *
 * 2. Hash reuse after revocation
 *    hashToCertificateId[hash] is set at issuance and never cleared.
 *    Revoking a certificate does NOT free the hash.
 *    Attempting to issue a new certificate with a revoked cert's hash fails with
 *    CertificateAlreadyExists.  The business rule "revocation does not free the
 *    hash for reuse" is intentional (prevents re-issuance of a revoked document).
 */
describe("CertificateRegistry - Hash reuse rules", function () {
  let certRegistry: CertificateRegistry;
  let instRegistry: InstitutionRegistry;
  let admin: SignerWithAddress;
  let university: SignerWithAddress;
  let student1: SignerWithAddress;
  let student2: SignerWithAddress;

  const hashA = ethers.keccak256(ethers.toUtf8Bytes("Document A"));
  const hashB = ethers.keccak256(ethers.toUtf8Bytes("Document B"));
  const hashC = ethers.keccak256(ethers.toUtf8Bytes("Document C"));

  beforeEach(async function () {
    [admin, university, student1, student2] = await ethers.getSigners();

    const InstFactory = await ethers.getContractFactory("InstitutionRegistry");
    instRegistry = await upgrades.deployProxy(
      InstFactory,
      [admin.address],
      { initializer: "initialize", kind: "uups" }
    ) as unknown as InstitutionRegistry;
    await instRegistry.waitForDeployment();

    const CertFactory = await ethers.getContractFactory("CertificateRegistry");
    certRegistry = await upgrades.deployProxy(
      CertFactory,
      [admin.address, await instRegistry.getAddress()],
      { initializer: "initialize", kind: "uups" }
    ) as unknown as CertificateRegistry;
    await certRegistry.waitForDeployment();

    await instRegistry.connect(admin).setCertificateRegistry(
      await certRegistry.getAddress()
    );
    await instRegistry.connect(university).registerInstitution("MIT", "mit.edu");
    await instRegistry.connect(admin).approveInstitution(university.address);
  });

  // ─────────────────────────────────────────────────────────────
  // Duplicate hash within a single batch call
  // ─────────────────────────────────────────────────────────────

  describe("Duplicate hash within a single batch call", function () {
    it("Should revert the entire batch when the same hash appears twice", async function () {
      const hashes = [hashA, hashB, hashA]; // hashA at 0 and 2
      const students = [student1.address, student1.address, student2.address];
      const uris = ["", "", ""];
      const years = [2024, 2024, 2024];

      await expect(
        certRegistry.connect(university).issueCertificatesBatch(hashes, students, uris, years)
      ).to.be.revertedWithCustomError(certRegistry, "CertificateAlreadyExists");
    });

    it("Should leave total certificate count at zero after a duplicate-hash batch revert", async function () {
      const hashes = [hashA, hashA];
      const students = [student1.address, student2.address];
      const uris = ["", ""];
      const years = [2024, 2024];

      await expect(
        certRegistry.connect(university).issueCertificatesBatch(hashes, students, uris, years)
      ).to.be.reverted;

      expect(await certRegistry.getTotalCertificates()).to.equal(0);
    });

    it("Should leave no hashToCertificateId entries after a duplicate-hash batch revert", async function () {
      const hashes = [hashA, hashA];
      const students = [student1.address, student1.address];
      const uris = ["", ""];
      const years = [2024, 2024];

      await expect(
        certRegistry.connect(university).issueCertificatesBatch(hashes, students, uris, years)
      ).to.be.reverted;

      expect(await certRegistry.hashExists(hashA)).to.be.false;
    });

    it("Should revert when duplicate appears at the last position", async function () {
      const hashes = [hashA, hashB, hashC, hashA]; // duplicate at index 3
      const students = [student1.address, student1.address, student1.address, student2.address];
      const uris = ["", "", "", ""];
      const years = [2024, 2024, 2024, 2024];

      await expect(
        certRegistry.connect(university).issueCertificatesBatch(hashes, students, uris, years)
      ).to.be.revertedWithCustomError(certRegistry, "CertificateAlreadyExists");

      // Full revert — none of A, B, or C were registered
      expect(await certRegistry.getTotalCertificates()).to.equal(0);
      expect(await certRegistry.hashExists(hashA)).to.be.false;
      expect(await certRegistry.hashExists(hashB)).to.be.false;
      expect(await certRegistry.hashExists(hashC)).to.be.false;
    });

    it("Should revert when a batch hash collides with a previously issued certificate", async function () {
      // Issue hashA individually first
      await certRegistry.connect(university).issueCertificate(hashA, student1.address, "", 2024);

      // Batch that includes hashA (already exists)
      const hashes = [hashB, hashA];
      const students = [student1.address, student2.address];
      const uris = ["", ""];
      const years = [2024, 2024];

      await expect(
        certRegistry.connect(university).issueCertificatesBatch(hashes, students, uris, years)
      ).to.be.revertedWithCustomError(certRegistry, "CertificateAlreadyExists");

      // hashB was processed first but the whole tx reverted — it must not be registered
      expect(await certRegistry.hashExists(hashB)).to.be.false;
      expect(await certRegistry.getTotalCertificates()).to.equal(1); // only the pre-existing hashA cert
    });

    it("Should succeed when a batch contains all unique hashes", async function () {
      const hashes = [hashA, hashB, hashC];
      const students = [student1.address, student1.address, student2.address];
      const uris = ["", "", ""];
      const years = [2024, 2024, 2024];

      await expect(
        certRegistry.connect(university).issueCertificatesBatch(hashes, students, uris, years)
      ).to.not.be.reverted;

      expect(await certRegistry.getTotalCertificates()).to.equal(3);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Hash reuse after revocation
  // ─────────────────────────────────────────────────────────────

  describe("Hash reuse after revocation", function () {
    let certId: bigint;

    beforeEach(async function () {
      certId = await certRegistry.connect(university).issueCertificate.staticCall(
        hashA,
        student1.address,
        "",
        2024
      );
      await certRegistry.connect(university).issueCertificate(hashA, student1.address, "", 2024);
      await certRegistry.connect(university).revokeCertificate(certId, "Error in issuance");
    });

    it("hashExists should still return true after revocation", async function () {
      expect(await certRegistry.hashExists(hashA)).to.be.true;
    });

    it("Attempting to re-issue with a revoked cert's hash reverts with CertificateAlreadyExists", async function () {
      await expect(
        certRegistry.connect(university).issueCertificate(hashA, student2.address, "", 2024)
      ).to.be.revertedWithCustomError(certRegistry, "CertificateAlreadyExists");
    });

    it("Attempting to batch-issue with a revoked cert's hash reverts", async function () {
      const hashes = [hashB, hashA]; // hashA is revoked
      const students = [student2.address, student2.address];
      const uris = ["", ""];
      const years = [2024, 2024];

      await expect(
        certRegistry.connect(university).issueCertificatesBatch(hashes, students, uris, years)
      ).to.be.revertedWithCustomError(certRegistry, "CertificateAlreadyExists");

      // hashB should not have been registered either (full revert)
      expect(await certRegistry.hashExists(hashB)).to.be.false;
    });

    it("getCertificateByHash still returns the revoked certificate data", async function () {
      const cert = await certRegistry.getCertificateByHash(hashA);
      expect(cert.certificateId).to.equal(certId);
      expect(cert.isRevoked).to.be.true;
    });

    it("isValidCertificate returns false for the revoked hash but certId is still populated", async function () {
      const [isValid, returnedCertId, isRevoked] = await certRegistry.isValidCertificate(hashA);
      expect(isValid).to.be.false;
      expect(returnedCertId).to.equal(certId);
      expect(isRevoked).to.be.true;
    });

    it("hashToCertificateId mapping still points to the original cert after revocation", async function () {
      const mappedId = await certRegistry.hashToCertificateId(hashA);
      expect(mappedId).to.equal(certId);
    });

    it("Other hashes are unaffected by the revocation", async function () {
      await certRegistry.connect(university).issueCertificate(hashB, student2.address, "", 2024);

      expect(await certRegistry.hashExists(hashB)).to.be.true;
      const [isValid] = await certRegistry.isValidCertificate(hashB);
      expect(isValid).to.be.true;
    });
  });
});
