// test/ZKAuthRegistry.test.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { ZKAuthRegistry, MockAuthVerifier } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ZKAuthRegistry", function () {
  let zkAuthRegistry: ZKAuthRegistry;
  let mockVerifier: MockAuthVerifier;
  let admin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  // Test commitments (simulating hash(publicKey, walletAddress, salt))
  const studentCommitment = ethers.id("student_commitment_1");
  const universityCommitment = ethers.id("university_commitment_1");
  const employerCommitment = ethers.id("employer_commitment_1");
  
  // Mock proof (in production, this would be a real ZK proof)
  const mockProof = "0x1234567890abcdef";

  beforeEach(async function () {
    [admin, user1, user2] = await ethers.getSigners();

    // Deploy mock verifier
    const MockVerifierFactory = await ethers.getContractFactory("MockAuthVerifier");
    mockVerifier = await MockVerifierFactory.deploy();
    await mockVerifier.waitForDeployment();

    // Deploy ZKAuthRegistry as upgradeable proxy
    const ZKAuthRegistryFactory = await ethers.getContractFactory("ZKAuthRegistry");
    zkAuthRegistry = await upgrades.deployProxy(
      ZKAuthRegistryFactory,
      [admin.address, await mockVerifier.getAddress()],
      { initializer: "initialize" }
    ) as unknown as ZKAuthRegistry;
    await zkAuthRegistry.waitForDeployment();
  });

  describe("Initialization", function () {
    it("Should set admin role correctly", async function () {
      const ADMIN_ROLE = await zkAuthRegistry.ADMIN_ROLE();
      expect(await zkAuthRegistry.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("Should set verifier address", async function () {
      const verifierAddress = await zkAuthRegistry.authVerifier();
      expect(verifierAddress).to.equal(await mockVerifier.getAddress());
    });

    it("Should have correct version", async function () {
      expect(await zkAuthRegistry.VERSION()).to.equal("1.0.0");
    });
  });

  describe("Commitment Registration", function () {
    it("Should register a student commitment with valid proof", async function () {
      const tx = await zkAuthRegistry.connect(user1).registerCommitment(
        studentCommitment,
        1, // UserRole.Student
        mockProof
      );
      
      await expect(tx)
        .to.emit(zkAuthRegistry, "CommitmentRegistered");

      expect(await zkAuthRegistry.isRegistered(studentCommitment)).to.be.true;
      expect(await zkAuthRegistry.getRole(studentCommitment)).to.equal(1);
    });

    it("Should register a university commitment", async function () {
      await zkAuthRegistry.connect(user1).registerCommitment(
        universityCommitment,
        2, // UserRole.University
        mockProof
      );

      expect(await zkAuthRegistry.isRegistered(universityCommitment)).to.be.true;
      expect(await zkAuthRegistry.getRole(universityCommitment)).to.equal(2);
    });

    it("Should register an employer commitment", async function () {
      await zkAuthRegistry.connect(user1).registerCommitment(
        employerCommitment,
        3, // UserRole.Employer
        mockProof
      );

      expect(await zkAuthRegistry.isRegistered(employerCommitment)).to.be.true;
      expect(await zkAuthRegistry.getRole(employerCommitment)).to.equal(3);
    });

    it("Should reject duplicate commitment", async function () {
      await zkAuthRegistry.connect(user1).registerCommitment(
        studentCommitment,
        1,
        mockProof
      );

      await expect(
        zkAuthRegistry.connect(user2).registerCommitment(
          studentCommitment,
          1,
          mockProof
        )
      ).to.be.revertedWithCustomError(zkAuthRegistry, "CommitmentAlreadyExists");
    });

    it("Should reject None role", async function () {
      await expect(
        zkAuthRegistry.connect(user1).registerCommitment(
          studentCommitment,
          0, // UserRole.None
          mockProof
        )
      ).to.be.revertedWithCustomError(zkAuthRegistry, "InvalidRole");
    });

    it("Should reject Admin role from non-admin", async function () {
      await expect(
        zkAuthRegistry.connect(user1).registerCommitment(
          studentCommitment,
          4, // UserRole.Admin
          mockProof
        )
      ).to.be.revertedWithCustomError(zkAuthRegistry, "InvalidRole");
    });

    it("Should reject registration with invalid proof", async function () {
      // Configure mock verifier to fail
      await mockVerifier.setAlwaysPass(false);

      await expect(
        zkAuthRegistry.connect(user1).registerCommitment(
          studentCommitment,
          1,
          mockProof
        )
      ).to.be.revertedWithCustomError(zkAuthRegistry, "InvalidProof");

      // Reset for other tests
      await mockVerifier.setAlwaysPass(true);
    });
  });

  describe("Session Management", function () {
    beforeEach(async function () {
      // Register commitment first
      await zkAuthRegistry.connect(user1).registerCommitment(
        studentCommitment,
        1,
        mockProof
      );
    });

    it("Should start a session with valid proof", async function () {
      const tx = await zkAuthRegistry.connect(user1).startSession(
        studentCommitment,
        mockProof
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => {
          try {
            return zkAuthRegistry.interface.parseLog(log)?.name === "SessionStarted";
          } catch {
            return false;
          }
        }
      );

      expect(event).to.not.be.undefined;
    });

    it("Should return valid session info", async function () {
      const tx = await zkAuthRegistry.connect(user1).startSession(
        studentCommitment,
        mockProof
      );
      const receipt = await tx.wait();
      
      // Extract sessionId from event
      const event = receipt?.logs.find((log: any) => {
        try {
          return zkAuthRegistry.interface.parseLog(log)?.name === "SessionStarted";
        } catch {
          return false;
        }
      });
      
      const parsed = zkAuthRegistry.interface.parseLog(event!);
      const sessionId = parsed!.args[0];

      const [isValid, role, commitment] = await zkAuthRegistry.validateSession(sessionId);

      expect(isValid).to.be.true;
      expect(role).to.equal(1); // Student
      expect(commitment).to.equal(studentCommitment);
    });

    it("Should end session successfully", async function () {
      const tx = await zkAuthRegistry.connect(user1).startSession(
        studentCommitment,
        mockProof
      );
      const receipt = await tx.wait();
      
      const event = receipt?.logs.find((log: any) => {
        try {
          return zkAuthRegistry.interface.parseLog(log)?.name === "SessionStarted";
        } catch {
          return false;
        }
      });
      
      const parsed = zkAuthRegistry.interface.parseLog(event!);
      const sessionId = parsed!.args[0];

      await expect(zkAuthRegistry.connect(user1).endSession(sessionId))
        .to.emit(zkAuthRegistry, "SessionEnded")
        .withArgs(sessionId);

      const [isValid] = await zkAuthRegistry.validateSession(sessionId);
      expect(isValid).to.be.false;
    });

    it("Should reject starting session with unregistered commitment", async function () {
      const unregisteredCommitment = ethers.id("unregistered");

      await expect(
        zkAuthRegistry.connect(user1).startSession(
          unregisteredCommitment,
          mockProof
        )
      ).to.be.revertedWithCustomError(zkAuthRegistry, "CommitmentNotFound");
    });

    it("Should reject starting session with invalid proof", async function () {
      await mockVerifier.setAlwaysPass(false);

      await expect(
        zkAuthRegistry.connect(user1).startSession(
          studentCommitment,
          mockProof
        )
      ).to.be.revertedWithCustomError(zkAuthRegistry, "InvalidProof");

      await mockVerifier.setAlwaysPass(true);
    });

    it("Should invalidate expired sessions", async function () {
      const tx = await zkAuthRegistry.connect(user1).startSession(
        studentCommitment,
        mockProof
      );
      const receipt = await tx.wait();
      
      const event = receipt?.logs.find((log: any) => {
        try {
          return zkAuthRegistry.interface.parseLog(log)?.name === "SessionStarted";
        } catch {
          return false;
        }
      });
      
      const parsed = zkAuthRegistry.interface.parseLog(event!);
      const sessionId = parsed!.args[0];

      // Fast forward time by 25 hours
      await ethers.provider.send("evm_increaseTime", [25 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      const [isValid] = await zkAuthRegistry.validateSession(sessionId);
      expect(isValid).to.be.false;
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to update verifier", async function () {
      const NewVerifierFactory = await ethers.getContractFactory("MockAuthVerifier");
      const newVerifier = await NewVerifierFactory.deploy();
      await newVerifier.waitForDeployment();

      await expect(
        zkAuthRegistry.connect(admin).setVerifier(await newVerifier.getAddress())
      )
        .to.emit(zkAuthRegistry, "VerifierUpdated")
        .withArgs(
          await mockVerifier.getAddress(),
          await newVerifier.getAddress()
        );

      expect(await zkAuthRegistry.authVerifier()).to.equal(
        await newVerifier.getAddress()
      );
    });

    it("Should reject verifier update from non-admin", async function () {
      const NewVerifierFactory = await ethers.getContractFactory("MockAuthVerifier");
      const newVerifier = await NewVerifierFactory.deploy();

      const ADMIN_ROLE = await zkAuthRegistry.ADMIN_ROLE();
      
      await expect(
        zkAuthRegistry.connect(user1).setVerifier(await newVerifier.getAddress())
      ).to.be.reverted; // AccessControl revert
    });

    it("Should reject zero address for verifier", async function () {
      await expect(
        zkAuthRegistry.connect(admin).setVerifier(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(zkAuthRegistry, "InvalidAddress");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await zkAuthRegistry.connect(user1).registerCommitment(
        studentCommitment,
        1,
        mockProof
      );
    });

    it("Should return correct role", async function () {
      expect(await zkAuthRegistry.getRole(studentCommitment)).to.equal(1);
    });

    it("Should return zero role for unregistered commitment", async function () {
      const unregistered = ethers.id("unregistered");
      expect(await zkAuthRegistry.getRole(unregistered)).to.equal(0);
    });

    it("Should check registration status", async function () {
      expect(await zkAuthRegistry.isRegistered(studentCommitment)).to.be.true;
      expect(await zkAuthRegistry.isRegistered(ethers.id("unregistered"))).to.be.false;
    });
  });

  describe("Upgradeability", function () {
    it("Should be upgradeable by admin", async function () {
      const ZKAuthRegistryV2Factory = await ethers.getContractFactory("ZKAuthRegistry");
      
      const upgraded = await upgrades.upgradeProxy(
        await zkAuthRegistry.getAddress(),
        ZKAuthRegistryV2Factory
      );
      
      expect(await upgraded.getAddress()).to.equal(await zkAuthRegistry.getAddress());
      expect(await upgraded.VERSION()).to.equal("1.0.0");
    });
  });
});

