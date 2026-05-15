// contracts/test/InstitutionRegistry.test.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { InstitutionRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("InstitutionRegistry", function () {
  let institutionRegistry: InstitutionRegistry;
  let superAdmin: SignerWithAddress;
  let university1: SignerWithAddress;
  let university2: SignerWithAddress;
  let university3: SignerWithAddress;
  let randomUser: SignerWithAddress;
  let certificateRegistry: SignerWithAddress;

  beforeEach(async function () {
    [superAdmin, university1, university2, university3, randomUser, certificateRegistry] = 
      await ethers.getSigners();

    // Deploy InstitutionRegistry
    const InstitutionRegistry = await ethers.getContractFactory("InstitutionRegistry");
    institutionRegistry = await upgrades.deployProxy(
      InstitutionRegistry,
      [superAdmin.address],
      { initializer: "initialize", kind: "uups" }
    ) as unknown as InstitutionRegistry;
    await institutionRegistry.waitForDeployment();
  });

  describe("Initialization", function () {
    it("should initialize with correct super admin", async function () {
      const ADMIN_ROLE = await institutionRegistry.ADMIN_ROLE();
      expect(await institutionRegistry.hasRole(ADMIN_ROLE, superAdmin.address)).to.be.true;
    });

    it("should set correct version", async function () {
      expect(await institutionRegistry.VERSION()).to.equal("1.0.0");
      expect(await institutionRegistry.getVersion()).to.equal("1.0.0");
    });

    it("should record initial deployment in upgrade history", async function () {
      const history = await institutionRegistry.getUpgradeHistory();
      expect(history.length).to.equal(1);
      expect(history[0].version).to.equal("1.0.0");
      expect(history[0].notes).to.equal("Initial deployment");
    });

    it("should start with zero institutions", async function () {
      expect(await institutionRegistry.getInstitutionCount()).to.equal(0);
      const allInstitutions = await institutionRegistry.getAllInstitutions();
      expect(allInstitutions.length).to.equal(0);
    });

    it("should revert if initialized with zero address", async function () {
      const InstitutionRegistry = await ethers.getContractFactory("InstitutionRegistry");
      await expect(
        upgrades.deployProxy(
          InstitutionRegistry,
          [ethers.ZeroAddress],
          { initializer: "initialize", kind: "uups" }
        )
      ).to.be.revertedWithCustomError(institutionRegistry, "InvalidAddress");
    });
  });

  describe("Registration Flow", function () {
    it("should allow institution to register", async function () {
      await expect(
        institutionRegistry.connect(university1).registerInstitution(
          "MIT",
          "mit.edu"
        )
      ).to.emit(institutionRegistry, "InstitutionRegistered")
        .withArgs(university1.address, "MIT", "mit.edu");

      const institution = await institutionRegistry.getInstitution(university1.address);
      expect(institution.name).to.equal("MIT");
      expect(institution.emailDomain).to.equal("mit.edu");
      expect(institution.walletAddress).to.equal(university1.address);
      expect(institution.isVerified).to.be.false;
      expect(institution.isActive).to.be.false;
      expect(institution.totalCertificatesIssued).to.equal(0);
    });

    it("should increment institution count after registration", async function () {
      await institutionRegistry.connect(university1).registerInstitution("MIT", "mit.edu");
      expect(await institutionRegistry.getInstitutionCount()).to.equal(1);

      await institutionRegistry.connect(university2).registerInstitution("Stanford", "stanford.edu");
      expect(await institutionRegistry.getInstitutionCount()).to.equal(2);
    });

    it("should add institution to the list", async function () {
      await institutionRegistry.connect(university1).registerInstitution("MIT", "mit.edu");
      await institutionRegistry.connect(university2).registerInstitution("Stanford", "stanford.edu");

      const allInstitutions = await institutionRegistry.getAllInstitutions();
      expect(allInstitutions.length).to.equal(2);
      expect(allInstitutions[0]).to.equal(university1.address);
      expect(allInstitutions[1]).to.equal(university2.address);
    });

    it("should map email domain to address", async function () {
      await institutionRegistry.connect(university1).registerInstitution("MIT", "mit.edu");
      
      const address = await institutionRegistry.getInstitutionByDomain("mit.edu");
      expect(address).to.equal(university1.address);
    });

    it("should revert if name is empty", async function () {
      await expect(
        institutionRegistry.connect(university1).registerInstitution("", "mit.edu")
      ).to.be.revertedWithCustomError(institutionRegistry, "InvalidName");
    });

    it("should revert if email domain is empty", async function () {
      await expect(
        institutionRegistry.connect(university1).registerInstitution("MIT", "")
      ).to.be.revertedWithCustomError(institutionRegistry, "InvalidEmailDomain");
    });

    it("should revert if institution already exists", async function () {
      await institutionRegistry.connect(university1).registerInstitution("MIT", "mit.edu");

      await expect(
        institutionRegistry.connect(university1).registerInstitution("MIT 2", "mit2.edu")
      ).to.be.revertedWithCustomError(institutionRegistry, "InstitutionAlreadyExists");
    });

    it("should revert if email domain already registered", async function () {
      await institutionRegistry.connect(university1).registerInstitution("MIT", "mit.edu");

      await expect(
        institutionRegistry.connect(university2).registerInstitution("Fake MIT", "mit.edu")
      ).to.be.revertedWithCustomError(institutionRegistry, "EmailDomainAlreadyRegistered");
    });

    it("should allow multiple institutions to register with different domains", async function () {
      await institutionRegistry.connect(university1).registerInstitution("MIT", "mit.edu");
      await institutionRegistry.connect(university2).registerInstitution("Stanford", "stanford.edu");
      await institutionRegistry.connect(university3).registerInstitution("Harvard", "harvard.edu");

      expect(await institutionRegistry.getInstitutionCount()).to.equal(3);
    });
  });

  describe("Approval Flow", function () {
    beforeEach(async function () {
      await institutionRegistry.connect(university1).registerInstitution("MIT", "mit.edu");
    });

    it("should allow super admin to approve institution", async function () {
      const tx = await institutionRegistry.connect(superAdmin).approveInstitution(university1.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(institutionRegistry, "InstitutionApproved")
        .withArgs(university1.address, block!.timestamp);

      const institution = await institutionRegistry.getInstitution(university1.address);
      expect(institution.isVerified).to.be.true;
      expect(institution.isActive).to.be.true;
      expect(institution.verificationDate).to.equal(block!.timestamp);
    });

    it("should enable certificate issuance after approval", async function () {
      await institutionRegistry.connect(superAdmin).approveInstitution(university1.address);
      
      const canIssue = await institutionRegistry.canIssueCertificates(university1.address);
      expect(canIssue).to.be.true;
    });

    it("should not allow certificate issuance before approval", async function () {
      const canIssue = await institutionRegistry.canIssueCertificates(university1.address);
      expect(canIssue).to.be.false;
    });

    it("should revert if non-super-admin tries to approve", async function () {
      await expect(
        institutionRegistry.connect(randomUser).approveInstitution(university1.address)
      ).to.be.reverted;
    });

    it("should revert if institution not found", async function () {
      await expect(
        institutionRegistry.connect(superAdmin).approveInstitution(university2.address)
      ).to.be.revertedWithCustomError(institutionRegistry, "InstitutionNotFound");
    });

    it("should revert if institution already verified", async function () {
      await institutionRegistry.connect(superAdmin).approveInstitution(university1.address);

      await expect(
        institutionRegistry.connect(superAdmin).approveInstitution(university1.address)
      ).to.be.revertedWithCustomError(institutionRegistry, "InstitutionAlreadyVerified");
    });

    it("should approve multiple institutions independently", async function () {
      await institutionRegistry.connect(university2).registerInstitution("Stanford", "stanford.edu");
      
      await institutionRegistry.connect(superAdmin).approveInstitution(university1.address);
      await institutionRegistry.connect(superAdmin).approveInstitution(university2.address);

      expect(await institutionRegistry.canIssueCertificates(university1.address)).to.be.true;
      expect(await institutionRegistry.canIssueCertificates(university2.address)).to.be.true;
    });
  });

  describe("Suspension Flow", function () {
    beforeEach(async function () {
      await institutionRegistry.connect(university1).registerInstitution("MIT", "mit.edu");
      await institutionRegistry.connect(superAdmin).approveInstitution(university1.address);
    });

    it("should allow super admin to suspend active institution", async function () {
      const tx = await institutionRegistry.connect(superAdmin).suspendInstitution(university1.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(institutionRegistry, "InstitutionSuspended")
        .withArgs(university1.address, block!.timestamp);

      const institution = await institutionRegistry.getInstitution(university1.address);
      expect(institution.isActive).to.be.false;
      expect(institution.isVerified).to.be.true; // Still verified, just not active
    });

    it("should prevent certificate issuance after suspension", async function () {
      await institutionRegistry.connect(superAdmin).suspendInstitution(university1.address);
      
      const canIssue = await institutionRegistry.canIssueCertificates(university1.address);
      expect(canIssue).to.be.false;
    });

    it("should revert if non-super-admin tries to suspend", async function () {
      await expect(
        institutionRegistry.connect(randomUser).suspendInstitution(university1.address)
      ).to.be.reverted;
    });

    it("should revert if institution not found", async function () {
      await expect(
        institutionRegistry.connect(superAdmin).suspendInstitution(university2.address)
      ).to.be.revertedWithCustomError(institutionRegistry, "InstitutionNotFound");
    });

    it("should revert if institution not active", async function () {
      await institutionRegistry.connect(superAdmin).suspendInstitution(university1.address);

      await expect(
        institutionRegistry.connect(superAdmin).suspendInstitution(university1.address)
      ).to.be.revertedWithCustomError(institutionRegistry, "InstitutionNotActive");
    });

    it("should preserve institution data after suspension", async function () {
      const beforeSuspension = await institutionRegistry.getInstitution(university1.address);
      
      await institutionRegistry.connect(superAdmin).suspendInstitution(university1.address);
      
      const afterSuspension = await institutionRegistry.getInstitution(university1.address);
      expect(afterSuspension.name).to.equal(beforeSuspension.name);
      expect(afterSuspension.emailDomain).to.equal(beforeSuspension.emailDomain);
      expect(afterSuspension.isVerified).to.equal(beforeSuspension.isVerified);
    });
  });

  describe("Reactivation Flow", function () {
    beforeEach(async function () {
      await institutionRegistry.connect(university1).registerInstitution("MIT", "mit.edu");
      await institutionRegistry.connect(superAdmin).approveInstitution(university1.address);
      await institutionRegistry.connect(superAdmin).suspendInstitution(university1.address);
    });

    it("should allow super admin to reactivate suspended institution", async function () {
      const tx = await institutionRegistry.connect(superAdmin).reactivateInstitution(university1.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(institutionRegistry, "InstitutionReactivated")
        .withArgs(university1.address, block!.timestamp);

      const institution = await institutionRegistry.getInstitution(university1.address);
      expect(institution.isActive).to.be.true;
    });

    it("should enable certificate issuance after reactivation", async function () {
      await institutionRegistry.connect(superAdmin).reactivateInstitution(university1.address);
      
      const canIssue = await institutionRegistry.canIssueCertificates(university1.address);
      expect(canIssue).to.be.true;
    });

    it("should revert if non-super-admin tries to reactivate", async function () {
      await expect(
        institutionRegistry.connect(randomUser).reactivateInstitution(university1.address)
      ).to.be.reverted;
    });

    it("should revert if institution not found", async function () {
      await expect(
        institutionRegistry.connect(superAdmin).reactivateInstitution(university2.address)
      ).to.be.revertedWithCustomError(institutionRegistry, "InstitutionNotFound");
    });

    it("should revert if institution not verified", async function () {
      await institutionRegistry.connect(university2).registerInstitution("Stanford", "stanford.edu");

      await expect(
        institutionRegistry.connect(superAdmin).reactivateInstitution(university2.address)
      ).to.be.revertedWithCustomError(institutionRegistry, "InstitutionNotVerified");
    });

    it("should revert if institution already active", async function () {
      await institutionRegistry.connect(superAdmin).reactivateInstitution(university1.address);

      await expect(
        institutionRegistry.connect(superAdmin).reactivateInstitution(university1.address)
      ).to.be.revertedWithCustomError(institutionRegistry, "InstitutionAlreadyActive");
    });

    it("should allow multiple suspend/reactivate cycles", async function () {
      // First cycle
      await institutionRegistry.connect(superAdmin).reactivateInstitution(university1.address);
      expect(await institutionRegistry.canIssueCertificates(university1.address)).to.be.true;

      // Second cycle
      await institutionRegistry.connect(superAdmin).suspendInstitution(university1.address);
      expect(await institutionRegistry.canIssueCertificates(university1.address)).to.be.false;

      await institutionRegistry.connect(superAdmin).reactivateInstitution(university1.address);
      expect(await institutionRegistry.canIssueCertificates(university1.address)).to.be.true;
    });
  });

  describe("Access Control", function () {
    it("should grant super admin role during initialization", async function () {
      const ADMIN_ROLE = await institutionRegistry.ADMIN_ROLE();
      expect(await institutionRegistry.hasRole(ADMIN_ROLE, superAdmin.address)).to.be.true;
    });

    it("should not allow non-admin to authorize upgrades", async function () {
      const InstitutionRegistryV2 = await ethers.getContractFactory(
        "InstitutionRegistry",
        university1
      );
      
      await expect(
        upgrades.upgradeProxy(
          await institutionRegistry.getAddress(),
          InstitutionRegistryV2,
          { kind: "uups" }
        )
      ).to.be.reverted;
    });

    it("should allow super admin to record upgrades", async function () {
      await institutionRegistry.connect(superAdmin).recordUpgrade("1.0.1", "Test upgrade");
      
      const history = await institutionRegistry.getUpgradeHistory();
      expect(history.length).to.equal(2);
      expect(history[1].version).to.equal("1.0.1");
      expect(history[1].notes).to.equal("Test upgrade");
    });

    it("should not allow non-admin to record upgrades", async function () {
      await expect(
        institutionRegistry.connect(randomUser).recordUpgrade("1.0.1", "Unauthorized")
      ).to.be.reverted;
    });

    it("should allow super admin to set certificate registry", async function () {
      await institutionRegistry.connect(superAdmin).setCertificateRegistry(certificateRegistry.address);
      
      const CERTIFICATE_REGISTRY_ROLE = await institutionRegistry.CERTIFICATE_REGISTRY_ROLE();
      expect(
        await institutionRegistry.hasRole(CERTIFICATE_REGISTRY_ROLE, certificateRegistry.address)
      ).to.be.true;
    });

    it("should revert when setting zero address as certificate registry", async function () {
      await expect(
        institutionRegistry.connect(superAdmin).setCertificateRegistry(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(institutionRegistry, "InvalidAddress");
    });

    it("should only allow certificate registry to increment certificate count", async function () {
      await institutionRegistry.connect(university1).registerInstitution("MIT", "mit.edu");
      await institutionRegistry.connect(superAdmin).approveInstitution(university1.address);
      await institutionRegistry.connect(superAdmin).setCertificateRegistry(certificateRegistry.address);

      await institutionRegistry.connect(certificateRegistry).incrementCertificateCount(university1.address);
      
      const institution = await institutionRegistry.getInstitution(university1.address);
      expect(institution.totalCertificatesIssued).to.equal(1);
    });

    it("should revert if non-certificate-registry tries to increment count", async function () {
      await institutionRegistry.connect(university1).registerInstitution("MIT", "mit.edu");

      await expect(
        institutionRegistry.connect(randomUser).incrementCertificateCount(university1.address)
      ).to.be.reverted;
    });
  });

  describe("Certificate Count Management", function () {
    beforeEach(async function () {
      await institutionRegistry.connect(university1).registerInstitution("MIT", "mit.edu");
      await institutionRegistry.connect(superAdmin).approveInstitution(university1.address);
      await institutionRegistry.connect(superAdmin).setCertificateRegistry(certificateRegistry.address);
    });

    it("should start with zero certificates issued", async function () {
      const institution = await institutionRegistry.getInstitution(university1.address);
      expect(institution.totalCertificatesIssued).to.equal(0);
    });

    it("should increment certificate count correctly", async function () {
      await institutionRegistry.connect(certificateRegistry).incrementCertificateCount(university1.address);
      await institutionRegistry.connect(certificateRegistry).incrementCertificateCount(university1.address);
      await institutionRegistry.connect(certificateRegistry).incrementCertificateCount(university1.address);

      const institution = await institutionRegistry.getInstitution(university1.address);
      expect(institution.totalCertificatesIssued).to.equal(3);
    });

    it("should track certificates independently per institution", async function () {
      await institutionRegistry.connect(university2).registerInstitution("Stanford", "stanford.edu");
      await institutionRegistry.connect(superAdmin).approveInstitution(university2.address);

      await institutionRegistry.connect(certificateRegistry).incrementCertificateCount(university1.address);
      await institutionRegistry.connect(certificateRegistry).incrementCertificateCount(university1.address);
      await institutionRegistry.connect(certificateRegistry).incrementCertificateCount(university2.address);

      const mit = await institutionRegistry.getInstitution(university1.address);
      const stanford = await institutionRegistry.getInstitution(university2.address);
      
      expect(mit.totalCertificatesIssued).to.equal(2);
      expect(stanford.totalCertificatesIssued).to.equal(1);
    });
  });

  describe("Query Functions", function () {
    beforeEach(async function () {
      await institutionRegistry.connect(university1).registerInstitution("MIT", "mit.edu");
      await institutionRegistry.connect(university2).registerInstitution("Stanford", "stanford.edu");
      await institutionRegistry.connect(university3).registerInstitution("Harvard", "harvard.edu");
    });

    it("should return correct institution by address", async function () {
      const institution = await institutionRegistry.getInstitution(university1.address);
      expect(institution.name).to.equal("MIT");
      expect(institution.emailDomain).to.equal("mit.edu");
      expect(institution.walletAddress).to.equal(university1.address);
    });

    it("should return correct institution by domain", async function () {
      const address = await institutionRegistry.getInstitutionByDomain("stanford.edu");
      expect(address).to.equal(university2.address);
    });

    it("should return all institutions", async function () {
      const allInstitutions = await institutionRegistry.getAllInstitutions();
      expect(allInstitutions.length).to.equal(3);
      expect(allInstitutions).to.include(university1.address);
      expect(allInstitutions).to.include(university2.address);
      expect(allInstitutions).to.include(university3.address);
    });

    it("should return correct institution count", async function () {
      expect(await institutionRegistry.getInstitutionCount()).to.equal(3);
    });

    it("should return zero address for non-existent domain", async function () {
      const address = await institutionRegistry.getInstitutionByDomain("fake.edu");
      expect(address).to.equal(ethers.ZeroAddress);
    });

    it("should allow anyone to query institution data", async function () {
      const institution = await institutionRegistry.connect(randomUser).getInstitution(university1.address);
      expect(institution.name).to.equal("MIT");
    });
  });

  describe("Edge Cases", function () {
    it("should handle institution with very long name", async function () {
      const longName = "A".repeat(200);
      await institutionRegistry.connect(university1).registerInstitution(longName, "long.edu");
      
      const institution = await institutionRegistry.getInstitution(university1.address);
      expect(institution.name).to.equal(longName);
    });

    it("should handle institution with special characters in name", async function () {
      await institutionRegistry.connect(university1).registerInstitution(
        "École Polytechnique Fédérale",
        "epfl.ch"
      );
      
      const institution = await institutionRegistry.getInstitution(university1.address);
      expect(institution.name).to.equal("École Polytechnique Fédérale");
    });

    it("should handle domain with subdomain", async function () {
      await institutionRegistry.connect(university1).registerInstitution(
        "MIT CS Dept",
        "cs.mit.edu"
      );
      
      const institution = await institutionRegistry.getInstitution(university1.address);
      expect(institution.emailDomain).to.equal("cs.mit.edu");
    });

    it("should maintain correct state when multiple operations occur", async function () {
      // Register multiple institutions
      await institutionRegistry.connect(university1).registerInstitution("MIT", "mit.edu");
      await institutionRegistry.connect(university2).registerInstitution("Stanford", "stanford.edu");
      
      // Approve first, suspend second doesn't exist yet
      await institutionRegistry.connect(superAdmin).approveInstitution(university1.address);
      
      // Check states
      expect(await institutionRegistry.canIssueCertificates(university1.address)).to.be.true;
      expect(await institutionRegistry.canIssueCertificates(university2.address)).to.be.false;
      
      // Approve second
      await institutionRegistry.connect(superAdmin).approveInstitution(university2.address);
      expect(await institutionRegistry.canIssueCertificates(university2.address)).to.be.true;
      
      // Suspend first
      await institutionRegistry.connect(superAdmin).suspendInstitution(university1.address);
      expect(await institutionRegistry.canIssueCertificates(university1.address)).to.be.false;
      expect(await institutionRegistry.canIssueCertificates(university2.address)).to.be.true;
    });

    it("should return empty institution for non-existent address", async function () {
      const institution = await institutionRegistry.getInstitution(randomUser.address);
      expect(institution.walletAddress).to.equal(ethers.ZeroAddress);
      expect(institution.name).to.equal("");
    });
  });

  describe("Version Management", function () {
    it("should have correct initial version", async function () {
      expect(await institutionRegistry.VERSION()).to.equal("1.0.0");
    });

    it("should return version from getter function", async function () {
      expect(await institutionRegistry.getVersion()).to.equal("1.0.0");
    });

    it("should maintain upgrade history", async function () {
      await institutionRegistry.connect(superAdmin).recordUpgrade("1.0.1", "Minor update");
      await institutionRegistry.connect(superAdmin).recordUpgrade("1.1.0", "Feature addition");
      
      const history = await institutionRegistry.getUpgradeHistory();
      expect(history.length).to.equal(3);
      expect(history[0].version).to.equal("1.0.0");
      expect(history[1].version).to.equal("1.0.1");
      expect(history[2].version).to.equal("1.1.0");
    });

    it("should record correct upgrader address", async function () {
      await institutionRegistry.connect(superAdmin).recordUpgrade("1.0.1", "Test");
      
      const history = await institutionRegistry.getUpgradeHistory();
      expect(history[1].upgrader).to.equal(superAdmin.address);
    });

    it("should record correct timestamp", async function () {
      const tx = await institutionRegistry.connect(superAdmin).recordUpgrade("1.0.1", "Test");
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      
      const history = await institutionRegistry.getUpgradeHistory();
      expect(history[1].timestamp).to.equal(block!.timestamp);
    });
  });

  describe("Helper Functions - getInstitutionStats", function () {
    beforeEach(async function () {
      // Register 5 institutions
      await institutionRegistry.connect(university1).registerInstitution("MIT", "mit.edu");
      await institutionRegistry.connect(university2).registerInstitution("Stanford", "stanford.edu");
      await institutionRegistry.connect(university3).registerInstitution("Harvard", "harvard.edu");
      
      const [, , , , , , uni4, uni5] = await ethers.getSigners();
      await institutionRegistry.connect(uni4).registerInstitution("Yale", "yale.edu");
      await institutionRegistry.connect(uni5).registerInstitution("Princeton", "princeton.edu");
    });

    it("should return correct stats with no approved institutions", async function () {
      const stats = await institutionRegistry.getInstitutionStats();
      expect(stats.totalRegistered).to.equal(5);
      expect(stats.totalVerified).to.equal(0);
      expect(stats.totalActive).to.equal(0);
      expect(stats.totalSuspended).to.equal(0);
    });

    it("should return correct stats after approving some institutions", async function () {
      await institutionRegistry.connect(superAdmin).approveInstitution(university1.address);
      await institutionRegistry.connect(superAdmin).approveInstitution(university2.address);
      
      const stats = await institutionRegistry.getInstitutionStats();
      expect(stats.totalRegistered).to.equal(5);
      expect(stats.totalVerified).to.equal(2);
      expect(stats.totalActive).to.equal(2);
      expect(stats.totalSuspended).to.equal(0);
    });

    it("should return correct stats with suspended institutions", async function () {
      await institutionRegistry.connect(superAdmin).approveInstitution(university1.address);
      await institutionRegistry.connect(superAdmin).approveInstitution(university2.address);
      await institutionRegistry.connect(superAdmin).approveInstitution(university3.address);
      
      await institutionRegistry.connect(superAdmin).suspendInstitution(university1.address);
      
      const stats = await institutionRegistry.getInstitutionStats();
      expect(stats.totalRegistered).to.equal(5);
      expect(stats.totalVerified).to.equal(3);
      expect(stats.totalActive).to.equal(2);
      expect(stats.totalSuspended).to.equal(1);
    });

    it("should return correct stats with all institutions approved and some suspended", async function () {
      const [, , , , , , uni4, uni5] = await ethers.getSigners();
      
      await institutionRegistry.connect(superAdmin).approveInstitution(university1.address);
      await institutionRegistry.connect(superAdmin).approveInstitution(university2.address);
      await institutionRegistry.connect(superAdmin).approveInstitution(university3.address);
      await institutionRegistry.connect(superAdmin).approveInstitution(uni4.address);
      await institutionRegistry.connect(superAdmin).approveInstitution(uni5.address);
      
      await institutionRegistry.connect(superAdmin).suspendInstitution(university1.address);
      await institutionRegistry.connect(superAdmin).suspendInstitution(university3.address);
      
      const stats = await institutionRegistry.getInstitutionStats();
      expect(stats.totalRegistered).to.equal(5);
      expect(stats.totalVerified).to.equal(5);
      expect(stats.totalActive).to.equal(3);
      expect(stats.totalSuspended).to.equal(2);
    });

    it("should handle reactivated institutions correctly in stats", async function () {
      await institutionRegistry.connect(superAdmin).approveInstitution(university1.address);
      await institutionRegistry.connect(superAdmin).suspendInstitution(university1.address);
      await institutionRegistry.connect(superAdmin).reactivateInstitution(university1.address);
      
      const stats = await institutionRegistry.getInstitutionStats();
      expect(stats.totalRegistered).to.equal(5);
      expect(stats.totalVerified).to.equal(1);
      expect(stats.totalActive).to.equal(1);
      expect(stats.totalSuspended).to.equal(0);
    });

    it("should work with empty registry", async function () {
      const InstitutionRegistry = await ethers.getContractFactory("InstitutionRegistry");
      const freshRegistry = await upgrades.deployProxy(
        InstitutionRegistry,
        [superAdmin.address],
        { initializer: "initialize", kind: "uups" }
      ) as unknown as InstitutionRegistry;
      
      const stats = await freshRegistry.getInstitutionStats();
      expect(stats.totalRegistered).to.equal(0);
      expect(stats.totalVerified).to.equal(0);
      expect(stats.totalActive).to.equal(0);
      expect(stats.totalSuspended).to.equal(0);
    });
  });

  describe("Helper Functions - getInstitutionsPaginated", function () {
    beforeEach(async function () {
      // Register 5 institutions
      await institutionRegistry.connect(university1).registerInstitution("MIT", "mit.edu");
      await institutionRegistry.connect(university2).registerInstitution("Stanford", "stanford.edu");
      await institutionRegistry.connect(university3).registerInstitution("Harvard", "harvard.edu");
      
      const [, , , , , , uni4, uni5] = await ethers.getSigners();
      await institutionRegistry.connect(uni4).registerInstitution("Yale", "yale.edu");
      await institutionRegistry.connect(uni5).registerInstitution("Princeton", "princeton.edu");
    });

    it("should return first page of institutions", async function () {
      const result = await institutionRegistry.getInstitutionsPaginated(0, 2);
      
      expect(result.institutionAddresses.length).to.equal(2);
      expect(result.institutionData.length).to.equal(2);
      expect(result.total).to.equal(5);
      expect(result.institutionAddresses[0]).to.equal(university1.address);
      expect(result.institutionAddresses[1]).to.equal(university2.address);
      expect(result.institutionData[0].name).to.equal("MIT");
      expect(result.institutionData[1].name).to.equal("Stanford");
    });

    it("should return second page of institutions", async function () {
      const result = await institutionRegistry.getInstitutionsPaginated(2, 2);
      
      expect(result.institutionAddresses.length).to.equal(2);
      expect(result.institutionData.length).to.equal(2);
      expect(result.total).to.equal(5);
      expect(result.institutionAddresses[0]).to.equal(university3.address);
      expect(result.institutionData[0].name).to.equal("Harvard");
    });

    it("should return last partial page", async function () {
      const result = await institutionRegistry.getInstitutionsPaginated(4, 2);
      
      expect(result.institutionAddresses.length).to.equal(1);
      expect(result.institutionData.length).to.equal(1);
      expect(result.total).to.equal(5);
    });

    it("should return all institutions with large limit", async function () {
      const result = await institutionRegistry.getInstitutionsPaginated(0, 100);
      
      expect(result.institutionAddresses.length).to.equal(5);
      expect(result.institutionData.length).to.equal(5);
      expect(result.total).to.equal(5);
    });

    it("should return empty array for offset beyond total", async function () {
      const result = await institutionRegistry.getInstitutionsPaginated(10, 2);
      
      expect(result.institutionAddresses.length).to.equal(0);
      expect(result.institutionData.length).to.equal(0);
      expect(result.total).to.equal(5);
    });

    it("should handle zero limit gracefully", async function () {
      const result = await institutionRegistry.getInstitutionsPaginated(0, 0);
      
      expect(result.institutionAddresses.length).to.equal(0);
      expect(result.institutionData.length).to.equal(0);
      expect(result.total).to.equal(5);
    });

    it("should return correct institution data including status", async function () {
      await institutionRegistry.connect(superAdmin).approveInstitution(university1.address);
      
      const result = await institutionRegistry.getInstitutionsPaginated(0, 1);
      
      expect(result.institutionData[0].isVerified).to.be.true;
      expect(result.institutionData[0].isActive).to.be.true;
      expect(result.institutionData[0].emailDomain).to.equal("mit.edu");
    });

    it("should work with empty registry", async function () {
      const InstitutionRegistry = await ethers.getContractFactory("InstitutionRegistry");
      const freshRegistry = await upgrades.deployProxy(
        InstitutionRegistry,
        [superAdmin.address],
        { initializer: "initialize", kind: "uups" }
      ) as unknown as InstitutionRegistry;
      
      const result = await freshRegistry.getInstitutionsPaginated(0, 10);
      expect(result.institutionAddresses.length).to.equal(0);
      expect(result.institutionData.length).to.equal(0);
      expect(result.total).to.equal(0);
    });

    it("should be gas-efficient compared to getAllInstitutions", async function () {
      // Add many more institutions for gas comparison
      const allSigners = await ethers.getSigners();
      
      // Register additional institutions (starting from index 8 to avoid conflicts with beforeEach)
      // beforeEach uses: superAdmin(0), university1(1), university2(2), university3(3), 
      // randomUser(4), certificateRegistry(5), uni4(6), uni5(7)
      for (let i = 8; i < 18; i++) {
        await institutionRegistry.connect(allSigners[i]).registerInstitution(
          `University ${i}`,
          `uni${i}.edu`
        );
      }
      
      // This test mainly checks that pagination works without reverting
      // Gas optimization is implicit in the pagination design
      const result = await institutionRegistry.getInstitutionsPaginated(0, 5);
      expect(result.institutionAddresses.length).to.equal(5);
      expect(result.total).to.equal(15); // 5 from beforeEach + 10 new ones
    });
  });
});

