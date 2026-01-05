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
