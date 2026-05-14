// test/InstitutionRegistry.registerByAdmin.test.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { InstitutionRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("InstitutionRegistry - registerInstitutionByAdmin", function () {
  let registry: InstitutionRegistry;
  let admin: SignerWithAddress;
  let university1: SignerWithAddress;
  let university2: SignerWithAddress;
  let randomUser: SignerWithAddress;

  beforeEach(async function () {
    [admin, university1, university2, randomUser] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("InstitutionRegistry");
    registry = await upgrades.deployProxy(
      Factory,
      [admin.address],
      { initializer: "initialize", kind: "uups" }
    ) as unknown as InstitutionRegistry;
    await registry.waitForDeployment();
  });

  // ─────────────────────────────────────────────────────────────
  // Happy path
  // ─────────────────────────────────────────────────────────────

  describe("Happy path", function () {
    it("Should register and auto-approve the institution in one call", async function () {
      await registry.connect(admin).registerInstitutionByAdmin(
        university1.address,
        "MIT",
        "mit.edu"
      );

      const inst = await registry.getInstitution(university1.address);
      expect(inst.walletAddress).to.equal(university1.address);
      expect(inst.name).to.equal("MIT");
      expect(inst.emailDomain).to.equal("mit.edu");
      expect(inst.isVerified).to.be.true;
      expect(inst.isActive).to.be.true;
      expect(inst.totalCertificatesIssued).to.equal(0);
    });

    it("Should set verificationDate to block.timestamp", async function () {
      const tx = await registry.connect(admin).registerInstitutionByAdmin(
        university1.address,
        "MIT",
        "mit.edu"
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      const inst = await registry.getInstitution(university1.address);
      expect(inst.verificationDate).to.equal(block!.timestamp);
    });

    it("Should emit InstitutionRegistered with correct args", async function () {
      await expect(
        registry.connect(admin).registerInstitutionByAdmin(
          university1.address,
          "MIT",
          "mit.edu"
        )
      )
        .to.emit(registry, "InstitutionRegistered")
        .withArgs(university1.address, "MIT", "mit.edu");
    });

    it("Should emit InstitutionApproved with correct args", async function () {
      const tx = await registry.connect(admin).registerInstitutionByAdmin(
        university1.address,
        "MIT",
        "mit.edu"
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(registry, "InstitutionApproved")
        .withArgs(university1.address, block!.timestamp);
    });

    it("Should add institution to institutionList and count", async function () {
      await registry.connect(admin).registerInstitutionByAdmin(
        university1.address,
        "MIT",
        "mit.edu"
      );

      expect(await registry.getInstitutionCount()).to.equal(1);
      const all = await registry.getAllInstitutions();
      expect(all).to.include(university1.address);
    });

    it("Should register emailDomain → address mapping", async function () {
      await registry.connect(admin).registerInstitutionByAdmin(
        university1.address,
        "MIT",
        "mit.edu"
      );

      expect(await registry.getInstitutionByDomain("mit.edu")).to.equal(university1.address);
    });

    it("Should allow immediately issuing certificates after admin registration", async function () {
      await registry.connect(admin).registerInstitutionByAdmin(
        university1.address,
        "MIT",
        "mit.edu"
      );

      expect(await registry.canIssueCertificates(university1.address)).to.be.true;
    });

    it("Should allow registering multiple institutions in sequence", async function () {
      await registry.connect(admin).registerInstitutionByAdmin(
        university1.address,
        "MIT",
        "mit.edu"
      );
      await registry.connect(admin).registerInstitutionByAdmin(
        university2.address,
        "Stanford",
        "stanford.edu"
      );

      expect(await registry.getInstitutionCount()).to.equal(2);
      expect(await registry.canIssueCertificates(university1.address)).to.be.true;
      expect(await registry.canIssueCertificates(university2.address)).to.be.true;
    });

    it("Should coexist with self-registered institutions in the same list", async function () {
      // One self-registers, one is admin-registered
      await registry.connect(university1).registerInstitution("MIT", "mit.edu");
      await registry.connect(admin).registerInstitutionByAdmin(
        university2.address,
        "Stanford",
        "stanford.edu"
      );

      expect(await registry.getInstitutionCount()).to.equal(2);

      // Admin-registered is immediately active; self-registered is not
      expect(await registry.canIssueCertificates(university1.address)).to.be.false;
      expect(await registry.canIssueCertificates(university2.address)).to.be.true;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Access control
  // ─────────────────────────────────────────────────────────────

  describe("Access control", function () {
    it("Should revert when called by a non-admin", async function () {
      await expect(
        registry.connect(randomUser).registerInstitutionByAdmin(
          university1.address,
          "MIT",
          "mit.edu"
        )
      ).to.be.reverted;
    });

    it("Should revert when the institution itself tries to call it", async function () {
      await expect(
        registry.connect(university1).registerInstitutionByAdmin(
          university1.address,
          "MIT",
          "mit.edu"
        )
      ).to.be.reverted;
    });

    it("Should revert when admin tries to register their own address", async function () {
      await expect(
        registry.connect(admin).registerInstitutionByAdmin(
          admin.address,
          "Admin Uni",
          "admin.edu"
        )
      ).to.be.revertedWithCustomError(registry, "AdminCannotRegisterAsInstitution");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Input validation errors
  // ─────────────────────────────────────────────────────────────

  describe("Input validation", function () {
    it("Should revert with InvalidAddress for zero wallet", async function () {
      await expect(
        registry.connect(admin).registerInstitutionByAdmin(
          ethers.ZeroAddress,
          "MIT",
          "mit.edu"
        )
      ).to.be.revertedWithCustomError(registry, "InvalidAddress");
    });

    it("Should revert with InvalidName for empty name", async function () {
      await expect(
        registry.connect(admin).registerInstitutionByAdmin(
          university1.address,
          "",
          "mit.edu"
        )
      ).to.be.revertedWithCustomError(registry, "InvalidName");
    });

    it("Should revert with InvalidEmailDomain for empty domain", async function () {
      await expect(
        registry.connect(admin).registerInstitutionByAdmin(
          university1.address,
          "MIT",
          ""
        )
      ).to.be.revertedWithCustomError(registry, "InvalidEmailDomain");
    });

    it("Should revert with InstitutionAlreadyExists if wallet already registered", async function () {
      await registry.connect(admin).registerInstitutionByAdmin(
        university1.address,
        "MIT",
        "mit.edu"
      );

      await expect(
        registry.connect(admin).registerInstitutionByAdmin(
          university1.address,
          "MIT v2",
          "mit2.edu"
        )
      ).to.be.revertedWithCustomError(registry, "InstitutionAlreadyExists");
    });

    it("Should revert with InstitutionAlreadyExists if wallet self-registered before admin call", async function () {
      await registry.connect(university1).registerInstitution("MIT", "mit.edu");

      await expect(
        registry.connect(admin).registerInstitutionByAdmin(
          university1.address,
          "MIT Official",
          "mit.edu"
        )
      ).to.be.revertedWithCustomError(registry, "InstitutionAlreadyExists");
    });

    it("Should revert with EmailDomainAlreadyRegistered if domain taken by another wallet", async function () {
      await registry.connect(admin).registerInstitutionByAdmin(
        university1.address,
        "MIT",
        "mit.edu"
      );

      await expect(
        registry.connect(admin).registerInstitutionByAdmin(
          university2.address,
          "Fake MIT",
          "mit.edu"
        )
      ).to.be.revertedWithCustomError(registry, "EmailDomainAlreadyRegistered");
    });

    it("Should revert EmailDomainAlreadyRegistered if domain taken by a self-registered institution", async function () {
      await registry.connect(university1).registerInstitution("MIT", "mit.edu");

      await expect(
        registry.connect(admin).registerInstitutionByAdmin(
          university2.address,
          "MIT Clone",
          "mit.edu"
        )
      ).to.be.revertedWithCustomError(registry, "EmailDomainAlreadyRegistered");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Interaction with other admin operations
  // ─────────────────────────────────────────────────────────────

  describe("Interaction with other admin operations", function () {
    it("Should not allow approveInstitution on an admin-registered institution (already verified)", async function () {
      await registry.connect(admin).registerInstitutionByAdmin(
        university1.address,
        "MIT",
        "mit.edu"
      );

      await expect(
        registry.connect(admin).approveInstitution(university1.address)
      ).to.be.revertedWithCustomError(registry, "InstitutionAlreadyVerified");
    });

    it("Should allow suspending an admin-registered institution", async function () {
      await registry.connect(admin).registerInstitutionByAdmin(
        university1.address,
        "MIT",
        "mit.edu"
      );

      await registry.connect(admin).suspendInstitution(university1.address);

      expect(await registry.canIssueCertificates(university1.address)).to.be.false;
    });

    it("Should allow reactivating after suspension of admin-registered institution", async function () {
      await registry.connect(admin).registerInstitutionByAdmin(
        university1.address,
        "MIT",
        "mit.edu"
      );
      await registry.connect(admin).suspendInstitution(university1.address);
      await registry.connect(admin).reactivateInstitution(university1.address);

      expect(await registry.canIssueCertificates(university1.address)).to.be.true;
    });
  });
});
