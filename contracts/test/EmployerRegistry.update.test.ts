// test/EmployerRegistry.update.test.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { EmployerRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Tests for EmployerRegistry.updateEmployer() and the full deactivate/reactivate lifecycle.
 *
 * Known bug under test:
 *   updateEmployer() mutates employer.vatNumber in the struct but does NOT update the
 *   vatToWallet mapping.  After an update:
 *     - vatToWallet[oldVat]  still points to the employer  (old VAT locked permanently)
 *     - vatToWallet[newVat]  is address(0)                 (new VAT not registered)
 *     - isVatAvailable(newVat) returns true                (incorrect)
 *     - getEmployerByVat(newVat) returns address(0)        (incorrect)
 *   Tests that expose this behaviour are marked "BUG".
 */
describe("EmployerRegistry - updateEmployer & deactivate/reactivate lifecycle", function () {
  let registry: EmployerRegistry;
  let admin: SignerWithAddress;
  let employer1: SignerWithAddress;
  let employer2: SignerWithAddress;
  let randomUser: SignerWithAddress;

  beforeEach(async function () {
    [admin, employer1, employer2, randomUser] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("EmployerRegistry");
    registry = await upgrades.deployProxy(
      Factory,
      [admin.address],
      { initializer: "initialize", kind: "uups" }
    ) as unknown as EmployerRegistry;
    await registry.waitForDeployment();

    // Register employer1 so update tests have a subject
    await registry.connect(employer1).registerEmployer("Acme Corp", "VAT-ACME-001");
  });

  // ─────────────────────────────────────────────────────────────
  // updateEmployer — happy path
  // ─────────────────────────────────────────────────────────────

  describe("updateEmployer — happy path", function () {
    it("Should update companyName in the struct", async function () {
      await registry.connect(employer1).updateEmployer("Acme Corp Renamed", "VAT-ACME-001");

      const emp = await registry.getEmployer(employer1.address);
      expect(emp.companyName).to.equal("Acme Corp Renamed");
    });

    it("Should update vatNumber in the struct", async function () {
      await registry.connect(employer1).updateEmployer("Acme Corp", "VAT-ACME-NEW");

      const emp = await registry.getEmployer(employer1.address);
      expect(emp.vatNumber).to.equal("VAT-ACME-NEW");
    });

    it("Should emit EmployerUpdated with correct args", async function () {
      const tx = await registry.connect(employer1).updateEmployer(
        "Acme Corp v2",
        "VAT-ACME-002"
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(registry, "EmployerUpdated")
        .withArgs(employer1.address, "Acme Corp v2", "VAT-ACME-002", block!.timestamp);
    });

    it("Should not change walletAddress, registrationDate, or isActive", async function () {
      const before = await registry.getEmployer(employer1.address);

      await registry.connect(employer1).updateEmployer("New Name", "VAT-NEW");

      const after = await registry.getEmployer(employer1.address);
      expect(after.walletAddress).to.equal(before.walletAddress);
      expect(after.registrationDate).to.equal(before.registrationDate);
      expect(after.isActive).to.equal(before.isActive);
    });

    it("Should allow updating back to original values (idempotent)", async function () {
      await registry.connect(employer1).updateEmployer("Acme Corp", "VAT-ACME-001");
      const emp = await registry.getEmployer(employer1.address);
      expect(emp.companyName).to.equal("Acme Corp");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // updateEmployer — VAT mapping correctness (fixed)
  // ─────────────────────────────────────────────────────────────

  describe("updateEmployer — VAT mapping correctness", function () {
    it("Old VAT is freed in vatToWallet after update", async function () {
      await registry.connect(employer1).updateEmployer("Acme Corp", "VAT-ACME-NEW");

      expect(await registry.getEmployerByVat("VAT-ACME-001")).to.equal(ethers.ZeroAddress);
      expect(await registry.isVatAvailable("VAT-ACME-001")).to.be.true;
    });

    it("New VAT is registered in vatToWallet after update", async function () {
      await registry.connect(employer1).updateEmployer("Acme Corp", "VAT-ACME-NEW");

      expect(await registry.getEmployerByVat("VAT-ACME-NEW")).to.equal(employer1.address);
      expect(await registry.isVatAvailable("VAT-ACME-NEW")).to.be.false;
    });

    it("Another employer cannot register with the freed old VAT", async function () {
      await registry.connect(employer1).updateEmployer("Acme Corp", "VAT-ACME-NEW");

      // Old VAT is now free — employer2 can legitimately claim it
      await expect(
        registry.connect(employer2).registerEmployer("Rival Corp", "VAT-ACME-001")
      ).to.not.be.reverted;

      expect(await registry.getEmployerByVat("VAT-ACME-001")).to.equal(employer2.address);
    });

    it("Should revert when updating to a VAT already held by another employer", async function () {
      await registry.connect(employer2).registerEmployer("Rival Corp", "VAT-RIVAL-001");

      await expect(
        registry.connect(employer1).updateEmployer("Acme Corp", "VAT-RIVAL-001")
      ).to.be.revertedWith("VAT already registered");
    });

    it("Updating to the same VAT (no change) is a no-op on the mapping", async function () {
      await registry.connect(employer1).updateEmployer("Acme Corp Renamed", "VAT-ACME-001");

      // Mapping still intact
      expect(await registry.getEmployerByVat("VAT-ACME-001")).to.equal(employer1.address);
      expect(await registry.isVatAvailable("VAT-ACME-001")).to.be.false;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // updateEmployer — error cases
  // ─────────────────────────────────────────────────────────────

  describe("updateEmployer — error cases", function () {
    it("Should revert with 'Not registered' for unregistered address", async function () {
      await expect(
        registry.connect(randomUser).updateEmployer("Ghost Corp", "VAT-GHOST")
      ).to.be.revertedWith("Not registered");
    });

    it("Should revert with 'Account deactivated' after admin deactivates the employer", async function () {
      await registry.connect(admin).deactivateEmployer(employer1.address);

      await expect(
        registry.connect(employer1).updateEmployer("Post-Deactivation Name", "VAT-POST")
      ).to.be.revertedWith("Account deactivated");
    });

    it("Should revert with 'Company name required' for empty company name", async function () {
      await expect(
        registry.connect(employer1).updateEmployer("", "VAT-ACME-001")
      ).to.be.revertedWith("Company name required");
    });

    it("Should revert with 'VAT number required' for empty VAT", async function () {
      await expect(
        registry.connect(employer1).updateEmployer("Acme Corp", "")
      ).to.be.revertedWith("VAT number required");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // deactivateEmployer
  // ─────────────────────────────────────────────────────────────

  describe("deactivateEmployer", function () {
    it("Should set isActive to false", async function () {
      await registry.connect(admin).deactivateEmployer(employer1.address);

      const emp = await registry.getEmployer(employer1.address);
      expect(emp.isActive).to.be.false;
    });

    it("Should emit EmployerDeactivated with correct args", async function () {
      const tx = await registry.connect(admin).deactivateEmployer(employer1.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(registry, "EmployerDeactivated")
        .withArgs(employer1.address, block!.timestamp);
    });

    it("isEmployer should return false after deactivation", async function () {
      await registry.connect(admin).deactivateEmployer(employer1.address);

      expect(await registry.isEmployer(employer1.address)).to.be.false;
    });

    it("Should revert with 'Not registered' for unknown address", async function () {
      await expect(
        registry.connect(admin).deactivateEmployer(randomUser.address)
      ).to.be.revertedWith("Not registered");
    });

    it("Should revert with 'Already deactivated' on double deactivation", async function () {
      await registry.connect(admin).deactivateEmployer(employer1.address);

      await expect(
        registry.connect(admin).deactivateEmployer(employer1.address)
      ).to.be.revertedWith("Already deactivated");
    });

    it("Should revert when called by non-admin", async function () {
      await expect(
        registry.connect(randomUser).deactivateEmployer(employer1.address)
      ).to.be.reverted;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // reactivateEmployer
  // ─────────────────────────────────────────────────────────────

  describe("reactivateEmployer", function () {
    beforeEach(async function () {
      await registry.connect(admin).deactivateEmployer(employer1.address);
    });

    it("Should set isActive back to true", async function () {
      await registry.connect(admin).reactivateEmployer(employer1.address);

      const emp = await registry.getEmployer(employer1.address);
      expect(emp.isActive).to.be.true;
    });

    it("Should emit EmployerReactivated with correct args", async function () {
      const tx = await registry.connect(admin).reactivateEmployer(employer1.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(registry, "EmployerReactivated")
        .withArgs(employer1.address, block!.timestamp);
    });

    it("isEmployer should return true again after reactivation", async function () {
      await registry.connect(admin).reactivateEmployer(employer1.address);

      expect(await registry.isEmployer(employer1.address)).to.be.true;
    });

    it("Should allow employer to update after reactivation", async function () {
      await registry.connect(admin).reactivateEmployer(employer1.address);

      await expect(
        registry.connect(employer1).updateEmployer("Acme Reactivated", "VAT-REACT")
      ).to.not.be.reverted;
    });

    it("Should allow multiple deactivate/reactivate cycles", async function () {
      await registry.connect(admin).reactivateEmployer(employer1.address);
      expect(await registry.isEmployer(employer1.address)).to.be.true;

      await registry.connect(admin).deactivateEmployer(employer1.address);
      expect(await registry.isEmployer(employer1.address)).to.be.false;

      await registry.connect(admin).reactivateEmployer(employer1.address);
      expect(await registry.isEmployer(employer1.address)).to.be.true;
    });

    it("Should revert with 'Not registered' for unknown address", async function () {
      await expect(
        registry.connect(admin).reactivateEmployer(randomUser.address)
      ).to.be.revertedWith("Not registered");
    });

    it("Should revert with 'Already active' when employer is already active", async function () {
      await registry.connect(admin).reactivateEmployer(employer1.address);

      await expect(
        registry.connect(admin).reactivateEmployer(employer1.address)
      ).to.be.revertedWith("Already active");
    });

    it("Should revert when called by non-admin", async function () {
      await expect(
        registry.connect(randomUser).reactivateEmployer(employer1.address)
      ).to.be.reverted;
    });
  });
});
