// contracts/test/EmployerRegistry.vat-uniqueness.test.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { 
  EmployerRegistry, 
  InstitutionRegistry, 
  CertificateRegistry 
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("EmployerRegistry - VAT Uniqueness Enforcement", function () {
  let employerRegistry: EmployerRegistry;
  let institutionRegistry: InstitutionRegistry;
  let certificateRegistry: CertificateRegistry;
  let admin: SignerWithAddress;
  let employer1: SignerWithAddress;
  let employer2: SignerWithAddress;
  let employer3: SignerWithAddress;

  beforeEach(async function () {
    [admin, employer1, employer2, employer3] = await ethers.getSigners();

    // Deploy InstitutionRegistry
    const InstitutionRegistry = await ethers.getContractFactory("InstitutionRegistry");
    institutionRegistry = await upgrades.deployProxy(
      InstitutionRegistry,
      [admin.address],
      { initializer: "initialize", kind: "uups" }
    ) as unknown as InstitutionRegistry;
    await institutionRegistry.waitForDeployment();

    // Deploy CertificateRegistry
    const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
    certificateRegistry = await upgrades.deployProxy(
      CertificateRegistry,
      [admin.address, await institutionRegistry.getAddress()],
      { initializer: "initialize", kind: "uups" }
    ) as unknown as CertificateRegistry;
    await certificateRegistry.waitForDeployment();

    // Deploy EmployerRegistry
    const EmployerRegistry = await ethers.getContractFactory("EmployerRegistry");
    employerRegistry = await upgrades.deployProxy(
      EmployerRegistry,
      [admin.address],
      { initializer: "initialize", kind: "uups" }
    ) as unknown as EmployerRegistry;
    await employerRegistry.waitForDeployment();

    // Link registries
    await institutionRegistry.connect(admin).setCertificateRegistry(
      await certificateRegistry.getAddress()
    );
    
    await employerRegistry.connect(admin).setRegistries(
      await institutionRegistry.getAddress(),
      await certificateRegistry.getAddress()
    );
  });

  describe("VAT Uniqueness Validation", function () {
    it("should allow first registration with a VAT number", async function () {
      await expect(
        employerRegistry.connect(employer1).registerEmployer("Company A", "VAT123456")
      ).to.not.be.reverted;

      const employer = await employerRegistry.getEmployer(employer1.address);
      expect(employer.vatNumber).to.equal("VAT123456");
    });

    it("should prevent duplicate VAT registration from different wallet", async function () {
      // First registration
      await employerRegistry.connect(employer1).registerEmployer("Company A", "VAT123456");

      // Second registration with same VAT should fail
      await expect(
        employerRegistry.connect(employer2).registerEmployer("Company B", "VAT123456")
      ).to.be.revertedWith("VAT already registered");
    });

    it("should allow different VAT numbers for different employers", async function () {
      await expect(
        employerRegistry.connect(employer1).registerEmployer("Company A", "VAT111111")
      ).to.not.be.reverted;

      await expect(
        employerRegistry.connect(employer2).registerEmployer("Company B", "VAT222222")
      ).to.not.be.reverted;

      await expect(
        employerRegistry.connect(employer3).registerEmployer("Company C", "VAT333333")
      ).to.not.be.reverted;

      expect(await employerRegistry.totalEmployers()).to.equal(3);
    });

    it("should prevent registration with empty VAT", async function () {
      await expect(
        employerRegistry.connect(employer1).registerEmployer("Company A", "")
      ).to.be.revertedWith("VAT number required");
    });
  });

  describe("VAT Query Functions", function () {
    beforeEach(async function () {
      await employerRegistry.connect(employer1).registerEmployer("Company A", "VAT123456");
      await employerRegistry.connect(employer2).registerEmployer("Company B", "VAT789012");
    });

    it("should check if VAT is available", async function () {
      expect(await employerRegistry.isVatAvailable("VAT123456")).to.be.false;
      expect(await employerRegistry.isVatAvailable("VAT789012")).to.be.false;
      expect(await employerRegistry.isVatAvailable("VAT999999")).to.be.true;
    });

    it("should get employer by VAT number", async function () {
      expect(await employerRegistry.getEmployerByVat("VAT123456")).to.equal(employer1.address);
      expect(await employerRegistry.getEmployerByVat("VAT789012")).to.equal(employer2.address);
      expect(await employerRegistry.getEmployerByVat("VAT999999")).to.equal(ethers.ZeroAddress);
    });

    it("should return zero address for non-existent VAT", async function () {
      const unknownVatAddress = await employerRegistry.getEmployerByVat("UNKNOWN");
      expect(unknownVatAddress).to.equal(ethers.ZeroAddress);
    });
  });

  describe("VAT Mapping Integrity", function () {
    it("should maintain VAT-to-wallet mapping after registration", async function () {
      await employerRegistry.connect(employer1).registerEmployer("Tech Corp", "VAT555555");
      
      // Verify mapping
      expect(await employerRegistry.vatToWallet("VAT555555")).to.equal(employer1.address);
      
      // Verify through helper function
      expect(await employerRegistry.getEmployerByVat("VAT555555")).to.equal(employer1.address);
    });

    it("should correctly report VAT availability before and after registration", async function () {
      const testVat = "VAT777777";
      
      // Before registration
      expect(await employerRegistry.isVatAvailable(testVat)).to.be.true;
      
      // Register
      await employerRegistry.connect(employer1).registerEmployer("New Corp", testVat);
      
      // After registration
      expect(await employerRegistry.isVatAvailable(testVat)).to.be.false;
    });
  });

  describe("Edge Cases", function () {
    it("should handle VAT with special characters", async function () {
      const specialVat = "VAT-123.456/789";
      await expect(
        employerRegistry.connect(employer1).registerEmployer("Special Corp", specialVat)
      ).to.not.be.reverted;

      expect(await employerRegistry.isVatAvailable(specialVat)).to.be.false;
    });

    it("should treat VAT as case-sensitive", async function () {
      await employerRegistry.connect(employer1).registerEmployer("Company A", "VAT123");
      
      // Different case should be treated as different VAT
      await expect(
        employerRegistry.connect(employer2).registerEmployer("Company B", "vat123")
      ).to.not.be.reverted;

      expect(await employerRegistry.getEmployerByVat("VAT123")).to.equal(employer1.address);
      expect(await employerRegistry.getEmployerByVat("vat123")).to.equal(employer2.address);
    });

    it("should handle very long VAT numbers", async function () {
      const longVat = "VAT" + "1".repeat(100);
      await expect(
        employerRegistry.connect(employer1).registerEmployer("Long VAT Corp", longVat)
      ).to.not.be.reverted;

      expect(await employerRegistry.isVatAvailable(longVat)).to.be.false;
    });
  });

  describe("Combined Validations", function () {
    it("should enforce both role conflicts and VAT uniqueness", async function () {
      // Register first employer with VAT
      await employerRegistry.connect(employer1).registerEmployer("Company A", "VAT111");

      // Try to register admin with same VAT (should fail on admin check first)
      await expect(
        employerRegistry.connect(admin).registerEmployer("Admin Corp", "VAT111")
      ).to.be.revertedWith("Admin cannot register as employer");

      // Try to register another employer with same VAT (should fail on VAT check)
      await expect(
        employerRegistry.connect(employer2).registerEmployer("Company B", "VAT111")
      ).to.be.revertedWith("VAT already registered");
    });

    it("should allow deactivated employer's VAT to remain reserved", async function () {
      // Register employer
      await employerRegistry.connect(employer1).registerEmployer("Company A", "VAT222");

      // Admin deactivates employer
      await employerRegistry.connect(admin).deactivateEmployer(employer1.address);

      // VAT should still be unavailable
      expect(await employerRegistry.isVatAvailable("VAT222")).to.be.false;

      // Different wallet cannot register with same VAT
      await expect(
        employerRegistry.connect(employer2).registerEmployer("Company B", "VAT222")
      ).to.be.revertedWith("VAT already registered");
    });
  });

  describe("Gas Efficiency", function () {
    it("should efficiently check VAT availability", async function () {
      await employerRegistry.connect(employer1).registerEmployer("Company A", "VAT001");
      
      const tx = await employerRegistry.isVatAvailable("VAT002");
      // View functions are free, but verify the call works
      expect(tx).to.be.true;
    });

    it("should register with VAT uniqueness check in reasonable gas", async function () {
      const tx = await employerRegistry.connect(employer1).registerEmployer(
        "Gas Test Corp", 
        "VATGAS001"
      );
      const receipt = await tx.wait();
      
      // With VAT check added, gas should still be reasonable
      // Actual: ~280k gas (includes admin check, institution check, certificate check, VAT check)
      expect(receipt?.gasUsed).to.be.lessThan(300000);
    });
  });
});
