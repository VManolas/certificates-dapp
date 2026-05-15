// test/integration.employer.test.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
  CertificateRegistry,
  InstitutionRegistry,
  EmployerRegistry,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Integration tests covering EmployerRegistry in the context of the full system.
 *
 * Scenarios:
 * 1. Employer registers → verifies student certificates
 * 2. Admin deactivates employer → employer can no longer participate
 * 3. Batch issuance then employer verification
 * 4. Role conflict enforcement once all registries are wired together
 * 5. Registry address change: setRegistries called a second time
 */
describe("Integration - EmployerRegistry with full system", function () {
  let certRegistry: CertificateRegistry;
  let instRegistry: InstitutionRegistry;
  let empRegistry: EmployerRegistry;

  let admin: SignerWithAddress;
  let university: SignerWithAddress;
  let studentAlice: SignerWithAddress;
  let studentBob: SignerWithAddress;
  let employer: SignerWithAddress;
  let newUser: SignerWithAddress;

  const aliceHash = ethers.keccak256(ethers.toUtf8Bytes("Alice CS Degree 2024"));
  const bobHash1 = ethers.keccak256(ethers.toUtf8Bytes("Bob MBA Degree 2024"));
  const bobHash2 = ethers.keccak256(ethers.toUtf8Bytes("Bob Data Science Cert"));

  beforeEach(async function () {
    [admin, university, studentAlice, studentBob, employer, newUser] =
      await ethers.getSigners();

    // Deploy all three registries
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

    const EmpFactory = await ethers.getContractFactory("EmployerRegistry");
    empRegistry = await upgrades.deployProxy(
      EmpFactory,
      [admin.address],
      { initializer: "initialize", kind: "uups" }
    ) as unknown as EmployerRegistry;
    await empRegistry.waitForDeployment();

    // Wire registries
    await instRegistry.connect(admin).setCertificateRegistry(
      await certRegistry.getAddress()
    );
    await empRegistry.connect(admin).setRegistries(
      await instRegistry.getAddress(),
      await certRegistry.getAddress()
    );

    // Register and approve university
    await instRegistry.connect(university).registerInstitution("MIT", "mit.edu");
    await instRegistry.connect(admin).approveInstitution(university.address);
  });

  // ─────────────────────────────────────────────────────────────
  // Happy path: employer verifies student credentials
  // ─────────────────────────────────────────────────────────────

  describe("Employer registers and verifies student credentials", function () {
    it("Should complete the full flow: issue → employer registers → employer verifies", async function () {
      // University issues certificate to Alice
      await certRegistry.connect(university).issueCertificate(
        aliceHash, studentAlice.address, "ipfs://alice-degree", 2024
      );

      // Employer registers
      await empRegistry.connect(employer).registerEmployer("TechCorp", "VAT-TECH-001");
      expect(await empRegistry.isEmployer(employer.address)).to.be.true;

      // Employer verifies Alice's certificate (read-only — any address can call)
      const [isValid, certId, isRevoked] = await certRegistry
        .connect(employer)
        .isValidCertificate(aliceHash);

      expect(isValid).to.be.true;
      expect(certId).to.equal(1);
      expect(isRevoked).to.be.false;

      // Employer cross-checks the issuing institution
      const cert = await certRegistry.getCertificate(certId);
      expect(cert.issuingInstitution).to.equal(university.address);
      expect(cert.studentWallet).to.equal(studentAlice.address);
    });

    it("Should allow employer to detect a revoked certificate", async function () {
      await certRegistry.connect(university).issueCertificate(
        aliceHash, studentAlice.address, "", 2024
      );
      await empRegistry.connect(employer).registerEmployer("TechCorp", "VAT-TECH-001");

      // University revokes the certificate
      await certRegistry.connect(university).revokeCertificate(1, "Fraudulent submission");

      const [isValid, , isRevoked] = await certRegistry
        .connect(employer)
        .isValidCertificate(aliceHash);

      expect(isValid).to.be.false;
      expect(isRevoked).to.be.true;
    });

    it("Should allow employer to verify batch-issued certificates", async function () {
      const hashes = [bobHash1, bobHash2];
      const students = [studentBob.address, studentBob.address];
      const uris = ["ipfs://bob-mba", "ipfs://bob-ds"];
      const years: [number, number] = [2024, 2024];

      await certRegistry.connect(university).issueCertificatesBatch(
        hashes, students, uris, years
      );

      await empRegistry.connect(employer).registerEmployer("DataHire", "VAT-DH-001");

      const [valid1] = await certRegistry.connect(employer).isValidCertificate(bobHash1);
      const [valid2] = await certRegistry.connect(employer).isValidCertificate(bobHash2);
      expect(valid1).to.be.true;
      expect(valid2).to.be.true;

      const bobCerts = await certRegistry.getCertificatesByStudent(studentBob.address);
      expect(bobCerts.length).to.equal(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Employer deactivation
  // ─────────────────────────────────────────────────────────────

  describe("Admin deactivates employer", function () {
    it("isEmployer returns false after deactivation", async function () {
      await empRegistry.connect(employer).registerEmployer("TechCorp", "VAT-TECH-001");
      await empRegistry.connect(admin).deactivateEmployer(employer.address);

      expect(await empRegistry.isEmployer(employer.address)).to.be.false;
    });

    it("Deactivated employer can still read certificate data (no on-chain gate)", async function () {
      await certRegistry.connect(university).issueCertificate(
        aliceHash, studentAlice.address, "", 2024
      );
      await empRegistry.connect(employer).registerEmployer("TechCorp", "VAT-TECH-001");
      await empRegistry.connect(admin).deactivateEmployer(employer.address);

      // isValidCertificate has no employer-role check — anyone can call it
      const [isValid] = await certRegistry
        .connect(employer)
        .isValidCertificate(aliceHash);
      expect(isValid).to.be.true;
    });

    it("Admin can reactivate employer after deactivation", async function () {
      await empRegistry.connect(employer).registerEmployer("TechCorp", "VAT-TECH-001");
      await empRegistry.connect(admin).deactivateEmployer(employer.address);
      await empRegistry.connect(admin).reactivateEmployer(employer.address);

      expect(await empRegistry.isEmployer(employer.address)).to.be.true;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Role conflict: institution and student are blocked
  // ─────────────────────────────────────────────────────────────

  describe("Role conflict enforcement across all three registries", function () {
    it("Should prevent an approved university from registering as employer", async function () {
      await expect(
        empRegistry.connect(university).registerEmployer("UniCorp", "VAT-UNI-001")
      ).to.be.revertedWith("University cannot register as employer");
    });

    it("Should prevent a student (with certificate) from registering as employer", async function () {
      await certRegistry.connect(university).issueCertificate(
        aliceHash, studentAlice.address, "", 2024
      );

      await expect(
        empRegistry.connect(studentAlice).registerEmployer("Student Startup", "VAT-STU-001")
      ).to.be.revertedWith("Student cannot register as employer");
    });

    it("Should prevent admin from registering as employer", async function () {
      await expect(
        empRegistry.connect(admin).registerEmployer("Admin Corp", "VAT-ADM-001")
      ).to.be.revertedWith("Admin cannot register as employer");
    });

    it("Should allow a user with no other roles to register as employer", async function () {
      await expect(
        empRegistry.connect(newUser).registerEmployer("New Ventures", "VAT-NEW-001")
      ).to.not.be.reverted;

      expect(await empRegistry.isEmployer(newUser.address)).to.be.true;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // setRegistries called a second time (registry address update)
  // ─────────────────────────────────────────────────────────────

  describe("setRegistries called a second time", function () {
    it("Should update registry references when called again by admin", async function () {
      // Deploy a fresh institution registry
      const InstFactory2 = await ethers.getContractFactory("InstitutionRegistry");
      const newInstRegistry = await upgrades.deployProxy(
        InstFactory2,
        [admin.address],
        { initializer: "initialize", kind: "uups" }
      ) as unknown as InstitutionRegistry;
      await newInstRegistry.waitForDeployment();

      await empRegistry.connect(admin).setRegistries(
        await newInstRegistry.getAddress(),
        await certRegistry.getAddress()
      );

      expect(await empRegistry.institutionRegistry()).to.equal(
        await newInstRegistry.getAddress()
      );
    });

    it("After registry swap, role checks use the new registry", async function () {
      // Deploy new institution registry that has no knowledge of `university`
      const InstFactory2 = await ethers.getContractFactory("InstitutionRegistry");
      const newInstRegistry = await upgrades.deployProxy(
        InstFactory2,
        [admin.address],
        { initializer: "initialize", kind: "uups" }
      ) as unknown as InstitutionRegistry;
      await newInstRegistry.waitForDeployment();

      await empRegistry.connect(admin).setRegistries(
        await newInstRegistry.getAddress(),
        await certRegistry.getAddress()
      );

      // university is registered in the OLD instRegistry but not the new one.
      // EmployerRegistry now points at the new registry — so university looks
      // like a clean wallet and the "University cannot register" check passes.
      await expect(
        empRegistry.connect(university).registerEmployer("MIT Spinout", "VAT-MIT-001")
      ).to.not.be.reverted;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Multi-employer system state
  // ─────────────────────────────────────────────────────────────

  describe("Multi-employer system state", function () {
    it("Should track multiple employers and return them via getAllEmployers", async function () {
      await empRegistry.connect(employer).registerEmployer("TechCorp", "VAT-T-001");
      await empRegistry.connect(newUser).registerEmployer("BizCorp", "VAT-B-001");

      const all = await empRegistry.getAllEmployers();
      expect(all.length).to.equal(2);
      expect(all).to.include(employer.address);
      expect(all).to.include(newUser.address);

      expect(await empRegistry.totalEmployers()).to.equal(2);
    });

    it("totalEmployers count is unaffected by deactivation", async function () {
      await empRegistry.connect(employer).registerEmployer("TechCorp", "VAT-T-001");
      await empRegistry.connect(newUser).registerEmployer("BizCorp", "VAT-B-001");
      await empRegistry.connect(admin).deactivateEmployer(employer.address);

      // totalEmployers tracks registrations, not active status
      expect(await empRegistry.totalEmployers()).to.equal(2);
    });
  });
});
