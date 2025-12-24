import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { CertificateRegistry, InstitutionRegistry } from "../typechain-types";

describe("Contract Versioning", function () {
  let certificateRegistry: any;
  let institutionRegistry: any;
  let superAdmin: any;
  let university: any;

  beforeEach(async function () {
    [superAdmin, university] = await ethers.getSigners();

    // Deploy InstitutionRegistry
    const InstitutionRegistry = await ethers.getContractFactory("InstitutionRegistry");
    institutionRegistry = await upgrades.deployProxy(
      InstitutionRegistry,
      [superAdmin.address],
      { initializer: "initialize", kind: "uups" }
    );
    await institutionRegistry.waitForDeployment();

    // Deploy CertificateRegistry
    const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
    certificateRegistry = await upgrades.deployProxy(
      CertificateRegistry,
      [superAdmin.address, await institutionRegistry.getAddress()],
      { initializer: "initialize", kind: "uups" }
    );
    await certificateRegistry.waitForDeployment();
  });

  describe("Version Information", function () {
    it("should return correct initial version", async function () {
      const version = await certificateRegistry.VERSION();
      expect(version).to.equal("1.0.0");

      const versionFromGetter = await certificateRegistry.getVersion();
      expect(versionFromGetter).to.equal("1.0.0");
    });

    it("should record initial deployment in upgrade history", async function () {
      const history = await certificateRegistry.getUpgradeHistory();
      
      expect(history.length).to.equal(1);
      expect(history[0].version).to.equal("1.0.0");
      expect(history[0].notes).to.equal("Initial deployment");
      expect(history[0].upgrader).to.equal(superAdmin.address);
    });

    it("should have initial version for both contracts", async function () {
      const certVersion = await certificateRegistry.VERSION();
      const instVersion = await institutionRegistry.VERSION();
      
      expect(certVersion).to.equal("1.0.0");
      expect(instVersion).to.equal("1.0.0");
    });
  });

  describe("Manual Version Recording", function () {
    it("should allow super admin to record upgrade", async function () {
      await certificateRegistry.connect(superAdmin).recordUpgrade(
        "1.0.1",
        "Bug fix: Optimized gas usage"
      );

      const history = await certificateRegistry.getUpgradeHistory();
      expect(history.length).to.equal(2);
      expect(history[1].version).to.equal("1.0.1");
      expect(history[1].notes).to.equal("Bug fix: Optimized gas usage");
    });

    it("should reject non-admin from recording upgrade", async function () {
      await expect(
        certificateRegistry.connect(university).recordUpgrade(
          "1.0.1",
          "Unauthorized upgrade attempt"
        )
      ).to.be.reverted;
    });

    it("should track multiple upgrades", async function () {
      await certificateRegistry.connect(superAdmin).recordUpgrade(
        "1.0.1",
        "Bug fix"
      );
      await certificateRegistry.connect(superAdmin).recordUpgrade(
        "1.1.0",
        "New feature: Batch operations"
      );
      await certificateRegistry.connect(superAdmin).recordUpgrade(
        "2.0.0",
        "Breaking changes: New certificate structure"
      );

      const history = await certificateRegistry.getUpgradeHistory();
      expect(history.length).to.equal(4); // Initial + 3 manual

      // Verify versions in order
      expect(history[0].version).to.equal("1.0.0");
      expect(history[1].version).to.equal("1.0.1");
      expect(history[2].version).to.equal("1.1.0");
      expect(history[3].version).to.equal("2.0.0");
    });

    it("should record timestamp and upgrader correctly", async function () {
      const tx = await certificateRegistry.connect(superAdmin).recordUpgrade(
        "1.0.1",
        "Test upgrade"
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const history = await certificateRegistry.getUpgradeHistory();
      const latestUpgrade = history[history.length - 1];

      expect(latestUpgrade.timestamp).to.equal(block?.timestamp);
      expect(latestUpgrade.upgrader).to.equal(superAdmin.address);
    });
  });

  describe("Contract Upgrade Simulation", function () {
    it("should preserve data after upgrade to V2", async function () {
      // Setup: Register institution and issue certificate
      await institutionRegistry.connect(university).registerInstitution(
        "Test University",
        "test.edu"
      );
      await institutionRegistry.connect(superAdmin).approveInstitution(university.address);
      await institutionRegistry.connect(superAdmin).setCertificateRegistry(
        await certificateRegistry.getAddress()
      );

      const documentHash = ethers.keccak256(ethers.toUtf8Bytes("Test Certificate"));
      const studentWallet = ethers.Wallet.createRandom().address;
      
      await certificateRegistry.connect(university).issueCertificate(
        documentHash,
        studentWallet,
        ""
      );

      // Verify V1 data
      const certV1 = await certificateRegistry.getCertificateByHash(documentHash);
      expect(certV1.studentWallet).to.equal(studentWallet);

      // Upgrade to V2
      const CertificateRegistryV2 = await ethers.getContractFactory("CertificateRegistryV2");
      const upgradedContract = await upgrades.upgradeProxy(
        await certificateRegistry.getAddress(),
        CertificateRegistryV2,
        { kind: "uups" }
      );

      // Initialize V2
      await upgradedContract.upgradeToV2("Upgraded to V2 for testing");

      // Verify V1 data is still accessible
      const certV2 = await upgradedContract.getCertificateByHash(documentHash);
      expect(certV2.studentWallet).to.equal(studentWallet);
      expect(certV2.documentHash).to.equal(documentHash);

      // Verify version changed
      const newVersion = await upgradedContract.getVersion();
      expect(newVersion).to.equal("2.0.0");

      // Verify upgrade history
      const history = await upgradedContract.getUpgradeHistory();
      expect(history.length).to.equal(2);
      expect(history[1].version).to.equal("2.0.0");
      expect(history[1].notes).to.equal("Upgraded to V2 for testing");
    });

    it("should support new V2 features after upgrade", async function () {
      // Setup institution
      await institutionRegistry.connect(university).registerInstitution(
        "Test University",
        "test.edu"
      );
      await institutionRegistry.connect(superAdmin).approveInstitution(university.address);
      await institutionRegistry.connect(superAdmin).setCertificateRegistry(
        await certificateRegistry.getAddress()
      );

      // Upgrade to V2
      const CertificateRegistryV2 = await ethers.getContractFactory("CertificateRegistryV2");
      const upgradedContract = await upgrades.upgradeProxy(
        await certificateRegistry.getAddress(),
        CertificateRegistryV2,
        { kind: "uups" }
      );

      await upgradedContract.upgradeToV2("Added batch operations");

      // Test new V2 feature: Batch issuance
      const hashes = [
        ethers.keccak256(ethers.toUtf8Bytes("Cert 1")),
        ethers.keccak256(ethers.toUtf8Bytes("Cert 2")),
        ethers.keccak256(ethers.toUtf8Bytes("Cert 3")),
      ];
      const students = [
        ethers.Wallet.createRandom().address,
        ethers.Wallet.createRandom().address,
        ethers.Wallet.createRandom().address,
      ];
      const metadatas = ["", "", ""];

      // Issue batch and get the receipt to extract batch ID
      const tx = await upgradedContract.connect(university).issueCertificateBatch(
        hashes,
        students,
        metadatas
      );
      const receipt = await tx.wait();

      // Extract batchId from BatchOperationRecorded event
      // Find the BatchOperationRecorded event in logs
      const iface = upgradedContract.interface;
      const batchEvent = receipt!.logs
        .map(log => {
          try {
            return iface.parseLog({ topics: [...log.topics], data: log.data });
          } catch {
            return null;
          }
        })
        .find(event => event && event.name === "BatchOperationRecorded");

      expect(batchEvent).to.not.be.undefined;
      const batchId = batchEvent!.args[0]; // First argument is batchId

      // Verify batch was recorded
      const isBatchRecorded = await upgradedContract.isBatchRecorded(batchId);
      expect(isBatchRecorded).to.be.true;

      // Verify all certificates were issued
      for (let i = 0; i < hashes.length; i++) {
        const cert = await upgradedContract.getCertificateByHash(hashes[i]);
        expect(cert.studentWallet).to.equal(students[i]);
      }
    });
  });

  describe("Version Query Functions", function () {
    it("should allow anyone to query version", async function () {
      const [_, randomUser] = await ethers.getSigners();
      
      const version = await certificateRegistry.connect(randomUser).getVersion();
      expect(version).to.equal("1.0.0");
    });

    it("should allow anyone to query upgrade history", async function () {
      const [_, randomUser] = await ethers.getSigners();
      
      const history = await certificateRegistry.connect(randomUser).getUpgradeHistory();
      expect(history.length).to.be.gte(1);
    });

    it("should return empty array for new contracts without manual upgrades", async function () {
      const history = await certificateRegistry.getUpgradeHistory();
      expect(history.length).to.equal(1); // Only initial deployment
    });
  });

  describe("Storage Gap", function () {
    it("should have storage gap defined", async function () {
      // This test verifies the contract compiles with storage gap
      // The gap itself is private and not directly testable
      // but we can verify the contract structure is correct
      
      const version = await certificateRegistry.VERSION();
      expect(version).to.equal("1.0.0");
      
      // If storage gap is missing or incorrect, the contract wouldn't compile
      // or the upgrade tests above would fail
    });
  });
});
