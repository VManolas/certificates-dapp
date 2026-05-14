// test/EmployerRegistry.queries.test.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { EmployerRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("EmployerRegistry - getAllEmployers & getEmployersPaginated", function () {
  let registry: EmployerRegistry;
  let admin: SignerWithAddress;
  let emp1: SignerWithAddress;
  let emp2: SignerWithAddress;
  let emp3: SignerWithAddress;
  let emp4: SignerWithAddress;
  let emp5: SignerWithAddress;

  beforeEach(async function () {
    [admin, emp1, emp2, emp3, emp4, emp5] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("EmployerRegistry");
    registry = await upgrades.deployProxy(
      Factory,
      [admin.address],
      { initializer: "initialize", kind: "uups" }
    ) as unknown as EmployerRegistry;
    await registry.waitForDeployment();
  });

  // ─────────────────────────────────────────────────────────────
  // getEmployer error cases
  // ─────────────────────────────────────────────────────────────

  describe("getEmployer — error cases", function () {
    it("Should revert with 'Not registered' for unregistered address", async function () {
      await expect(
        registry.getEmployer(emp1.address)
      ).to.be.revertedWith("Not registered");
    });

    it("Should revert for zero address", async function () {
      await expect(
        registry.getEmployer(ethers.ZeroAddress)
      ).to.be.revertedWith("Not registered");
    });

    it("Should return data for a deactivated employer (still registered)", async function () {
      await registry.connect(emp1).registerEmployer("Corp A", "VAT-A");
      await registry.connect(admin).deactivateEmployer(emp1.address);

      const emp = await registry.getEmployer(emp1.address);
      expect(emp.walletAddress).to.equal(emp1.address);
      expect(emp.isActive).to.be.false;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getAllEmployers
  // ─────────────────────────────────────────────────────────────

  describe("getAllEmployers", function () {
    it("Should return empty array when no employers are registered", async function () {
      const result = await registry.getAllEmployers();
      expect(result.length).to.equal(0);
    });

    it("Should return all registered employer addresses", async function () {
      await registry.connect(emp1).registerEmployer("Corp A", "VAT-A");
      await registry.connect(emp2).registerEmployer("Corp B", "VAT-B");
      await registry.connect(emp3).registerEmployer("Corp C", "VAT-C");

      const result = await registry.getAllEmployers();
      expect(result.length).to.equal(3);
      expect(result).to.include(emp1.address);
      expect(result).to.include(emp2.address);
      expect(result).to.include(emp3.address);
    });

    it("Should preserve insertion order", async function () {
      await registry.connect(emp1).registerEmployer("Corp A", "VAT-A");
      await registry.connect(emp2).registerEmployer("Corp B", "VAT-B");

      const result = await registry.getAllEmployers();
      expect(result[0]).to.equal(emp1.address);
      expect(result[1]).to.equal(emp2.address);
    });

    it("Should include deactivated employers in the list", async function () {
      await registry.connect(emp1).registerEmployer("Corp A", "VAT-A");
      await registry.connect(emp2).registerEmployer("Corp B", "VAT-B");
      await registry.connect(admin).deactivateEmployer(emp1.address);

      const result = await registry.getAllEmployers();
      expect(result.length).to.equal(2);
      expect(result).to.include(emp1.address);
    });

    it("Should be callable by anyone", async function () {
      await registry.connect(emp1).registerEmployer("Corp A", "VAT-A");

      const result = await registry.connect(emp2).getAllEmployers();
      expect(result.length).to.equal(1);
    });

    it("totalEmployers should match getAllEmployers length", async function () {
      await registry.connect(emp1).registerEmployer("Corp A", "VAT-A");
      await registry.connect(emp2).registerEmployer("Corp B", "VAT-B");

      const total = await registry.totalEmployers();
      const all = await registry.getAllEmployers();
      expect(total).to.equal(BigInt(all.length));
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getEmployersPaginated
  // ─────────────────────────────────────────────────────────────

  describe("getEmployersPaginated", function () {
    beforeEach(async function () {
      // Register 5 employers
      await registry.connect(emp1).registerEmployer("Corp A", "VAT-A");
      await registry.connect(emp2).registerEmployer("Corp B", "VAT-B");
      await registry.connect(emp3).registerEmployer("Corp C", "VAT-C");
      await registry.connect(emp4).registerEmployer("Corp D", "VAT-D");
      await registry.connect(emp5).registerEmployer("Corp E", "VAT-E");
    });

    it("Should return first page correctly", async function () {
      const result = await registry.getEmployersPaginated(0, 2);
      expect(result.length).to.equal(2);
      expect(result[0]).to.equal(emp1.address);
      expect(result[1]).to.equal(emp2.address);
    });

    it("Should return middle page correctly", async function () {
      const result = await registry.getEmployersPaginated(2, 2);
      expect(result.length).to.equal(2);
      expect(result[0]).to.equal(emp3.address);
      expect(result[1]).to.equal(emp4.address);
    });

    it("Should return last partial page correctly", async function () {
      const result = await registry.getEmployersPaginated(4, 2);
      expect(result.length).to.equal(1);
      expect(result[0]).to.equal(emp5.address);
    });

    it("Should return all items when limit exceeds total", async function () {
      const result = await registry.getEmployersPaginated(0, 100);
      expect(result.length).to.equal(5);
    });

    it("Should return single item with limit 1", async function () {
      const result = await registry.getEmployersPaginated(3, 1);
      expect(result.length).to.equal(1);
      expect(result[0]).to.equal(emp4.address);
    });

    it("Should include deactivated employers in paginated results", async function () {
      await registry.connect(admin).deactivateEmployer(emp2.address);

      const result = await registry.getEmployersPaginated(0, 5);
      expect(result.length).to.equal(5);
      expect(result).to.include(emp2.address);
    });

    it("Should revert when offset equals total length (unlike InstitutionRegistry)", async function () {
      // NOTE: EmployerRegistry.getEmployersPaginated reverts on offset >= length,
      // whereas InstitutionRegistry.getInstitutionsPaginated returns an empty array.
      // This asymmetry is worth noting for callers.
      await expect(
        registry.getEmployersPaginated(5, 2)
      ).to.be.revertedWith("Offset out of bounds");
    });

    it("Should revert when offset exceeds total length", async function () {
      await expect(
        registry.getEmployersPaginated(10, 2)
      ).to.be.revertedWith("Offset out of bounds");
    });

    it("Should return empty array for limit 0", async function () {
      const result = await registry.getEmployersPaginated(0, 0);
      expect(result.length).to.equal(0);
    });

    it("Should be callable by anyone", async function () {
      const result = await registry.connect(emp1).getEmployersPaginated(0, 3);
      expect(result.length).to.equal(3);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getEmployersPaginated on empty registry
  // ─────────────────────────────────────────────────────────────

  describe("getEmployersPaginated on empty registry", function () {
    it("Should revert on empty registry (offset 0 >= length 0)", async function () {
      // Unlike InstitutionRegistry, EmployerRegistry reverts even on offset=0
      // when no employers are registered.
      await expect(
        registry.getEmployersPaginated(0, 5)
      ).to.be.revertedWith("Offset out of bounds");
    });
  });
});
