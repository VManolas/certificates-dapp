// test/ZKAuthRegistry.edge-cases.test.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { ZKAuthRegistry, MockAuthVerifier } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ZKAuthRegistry - Edge Cases", function () {
  let zkAuthRegistry: ZKAuthRegistry;
  let mockVerifier: MockAuthVerifier;
  let admin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let attacker: SignerWithAddress;

  const mockProof = "0x1234567890abcdef";
  const commitment1 = ethers.id("commitment_user1");
  const commitment2 = ethers.id("commitment_user2");
  const TWENTY_FOUR_HOURS = 24 * 60 * 60;

  async function extractSessionId(
    registry: ZKAuthRegistry,
    receipt: Awaited<ReturnType<Awaited<ReturnType<typeof registry.startSession>>["wait"]>>
  ): Promise<string> {
    const event = receipt!.logs.find((log: any) => {
      try {
        return registry.interface.parseLog(log)?.name === "SessionStarted";
      } catch {
        return false;
      }
    });
    const parsed = registry.interface.parseLog(event!);
    return parsed!.args[0] as string;
  }

  beforeEach(async function () {
    [admin, user1, user2, attacker] = await ethers.getSigners();

    const MockVerifierFactory = await ethers.getContractFactory("MockAuthVerifier");
    mockVerifier = await MockVerifierFactory.deploy();
    await mockVerifier.waitForDeployment();

    const ZKAuthRegistryFactory = await ethers.getContractFactory("ZKAuthRegistry");
    zkAuthRegistry = await upgrades.deployProxy(
      ZKAuthRegistryFactory,
      [admin.address, await mockVerifier.getAddress()],
      { initializer: "initialize" }
    ) as unknown as ZKAuthRegistry;
    await zkAuthRegistry.waitForDeployment();
  });

  // ─────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────

  describe("Initialization edge cases", function () {
    it("Should revert initialize with zero admin address", async function () {
      const Factory = await ethers.getContractFactory("ZKAuthRegistry");
      await expect(
        upgrades.deployProxy(
          Factory,
          [ethers.ZeroAddress, await mockVerifier.getAddress()],
          { initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(zkAuthRegistry, "InvalidAddress");
    });

    it("Should revert initialize with zero verifier address", async function () {
      const Factory = await ethers.getContractFactory("ZKAuthRegistry");
      await expect(
        upgrades.deployProxy(
          Factory,
          [admin.address, ethers.ZeroAddress],
          { initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(zkAuthRegistry, "InvalidAddress");
    });

    it("Should revert on double initialization", async function () {
      await expect(
        zkAuthRegistry.initialize(admin.address, await mockVerifier.getAddress())
      ).to.be.reverted;
    });

    it("SESSION_DURATION constant should equal 24 hours", async function () {
      expect(await zkAuthRegistry.SESSION_DURATION()).to.equal(TWENTY_FOUR_HOURS);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Registration
  // ─────────────────────────────────────────────────────────────

  describe("Registration edge cases", function () {
    it("Should record registrationTime as block.timestamp", async function () {
      const tx = await zkAuthRegistry.connect(user1).registerCommitment(
        commitment1,
        1, // Student
        mockProof
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      const recorded = await zkAuthRegistry.registrationTime(commitment1);
      expect(recorded).to.equal(block!.timestamp);
    });

    it("Should emit CommitmentRegistered with correct role and timestamp", async function () {
      const tx = await zkAuthRegistry.connect(user1).registerCommitment(
        commitment1,
        1, // Student
        mockProof
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(zkAuthRegistry, "CommitmentRegistered")
        .withArgs(commitment1, 1, block!.timestamp);
    });

    it("Should prevent re-registration of same commitment after full session lifecycle", async function () {
      await zkAuthRegistry.connect(user1).registerCommitment(commitment1, 1, mockProof);

      const tx = await zkAuthRegistry.connect(user1).startSession(commitment1, mockProof);
      const receipt = await tx.wait();
      const sessionId = await extractSessionId(zkAuthRegistry, receipt);

      await zkAuthRegistry.connect(user1).endSession(sessionId);

      await expect(
        zkAuthRegistry.connect(user1).registerCommitment(commitment1, 1, mockProof)
      ).to.be.revertedWithCustomError(zkAuthRegistry, "CommitmentAlreadyExists");
    });

    it("Should allow zero-value bytes32 commitment to be registered (no guard)", async function () {
      const zeroCommitment = ethers.ZeroHash;
      await expect(
        zkAuthRegistry.connect(user1).registerCommitment(zeroCommitment, 1, mockProof)
      ).to.not.be.reverted;

      expect(await zkAuthRegistry.isRegistered(zeroCommitment)).to.be.true;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Session boundary conditions
  // ─────────────────────────────────────────────────────────────

  describe("Session expiry boundary", function () {
    let sessionId: string;

    beforeEach(async function () {
      await zkAuthRegistry.connect(user1).registerCommitment(commitment1, 1, mockProof);
      const tx = await zkAuthRegistry.connect(user1).startSession(commitment1, mockProof);
      const receipt = await tx.wait();
      sessionId = await extractSessionId(zkAuthRegistry, receipt);
    });

    it("Should be valid at exactly SESSION_DURATION (expiry not yet passed)", async function () {
      await ethers.provider.send("evm_increaseTime", [TWENTY_FOUR_HOURS]);
      await ethers.provider.send("evm_mine", []);

      // block.timestamp == expiry: contract checks `> expiry`, so still valid
      const [isValid] = await zkAuthRegistry.validateSession(sessionId);
      expect(isValid).to.be.true;
    });

    it("Should be invalid one second after SESSION_DURATION", async function () {
      await ethers.provider.send("evm_increaseTime", [TWENTY_FOUR_HOURS + 1]);
      await ethers.provider.send("evm_mine", []);

      const [isValid] = await zkAuthRegistry.validateSession(sessionId);
      expect(isValid).to.be.false;
    });

    it("Should emit SessionStarted with expiry equal to block.timestamp + SESSION_DURATION", async function () {
      const tx2 = await zkAuthRegistry.connect(user1).startSession(commitment1, mockProof);
      const receipt2 = await tx2.wait();
      const block = await ethers.provider.getBlock(receipt2!.blockNumber);
      const expectedExpiry = block!.timestamp + TWENTY_FOUR_HOURS;

      const event = receipt2!.logs.find((log: any) => {
        try {
          return zkAuthRegistry.interface.parseLog(log)?.name === "SessionStarted";
        } catch {
          return false;
        }
      });
      const parsed = zkAuthRegistry.interface.parseLog(event!);

      expect(parsed!.args[2]).to.equal(expectedExpiry);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Multiple concurrent sessions
  // ─────────────────────────────────────────────────────────────

  describe("Multiple concurrent sessions per commitment", function () {
    beforeEach(async function () {
      await zkAuthRegistry.connect(user1).registerCommitment(commitment1, 1, mockProof);
    });

    it("Should allow multiple active sessions for the same commitment", async function () {
      const tx1 = await zkAuthRegistry.connect(user1).startSession(commitment1, mockProof);
      const receipt1 = await tx1.wait();
      const sessionId1 = await extractSessionId(zkAuthRegistry, receipt1);

      // mine a block so blockhash differs
      await ethers.provider.send("evm_mine", []);

      const tx2 = await zkAuthRegistry.connect(user1).startSession(commitment1, mockProof);
      const receipt2 = await tx2.wait();
      const sessionId2 = await extractSessionId(zkAuthRegistry, receipt2);

      expect(sessionId1).to.not.equal(sessionId2);

      const [valid1] = await zkAuthRegistry.validateSession(sessionId1);
      const [valid2] = await zkAuthRegistry.validateSession(sessionId2);
      expect(valid1).to.be.true;
      expect(valid2).to.be.true;
    });

    it("Should invalidate sessions independently", async function () {
      const tx1 = await zkAuthRegistry.connect(user1).startSession(commitment1, mockProof);
      const receipt1 = await tx1.wait();
      const sessionId1 = await extractSessionId(zkAuthRegistry, receipt1);

      await ethers.provider.send("evm_mine", []);

      const tx2 = await zkAuthRegistry.connect(user1).startSession(commitment1, mockProof);
      const receipt2 = await tx2.wait();
      const sessionId2 = await extractSessionId(zkAuthRegistry, receipt2);

      await zkAuthRegistry.connect(user1).endSession(sessionId1);

      const [valid1] = await zkAuthRegistry.validateSession(sessionId1);
      const [valid2] = await zkAuthRegistry.validateSession(sessionId2);
      expect(valid1).to.be.false;
      expect(valid2).to.be.true;
    });

    it("Should validate each session with its own commitment's role", async function () {
      await zkAuthRegistry.connect(user2).registerCommitment(commitment2, 2, mockProof); // Employer

      const tx1 = await zkAuthRegistry.connect(user1).startSession(commitment1, mockProof);
      const receipt1 = await tx1.wait();
      const sessionId1 = await extractSessionId(zkAuthRegistry, receipt1);

      const tx2 = await zkAuthRegistry.connect(user2).startSession(commitment2, mockProof);
      const receipt2 = await tx2.wait();
      const sessionId2 = await extractSessionId(zkAuthRegistry, receipt2);

      const [, role1] = await zkAuthRegistry.validateSession(sessionId1);
      const [, role2] = await zkAuthRegistry.validateSession(sessionId2);

      expect(role1).to.equal(1); // Student
      expect(role2).to.equal(2); // Employer
    });
  });

  // ─────────────────────────────────────────────────────────────
  // endSession error cases
  // ─────────────────────────────────────────────────────────────

  describe("endSession error cases", function () {
    it("Should revert when ending a session that was never created", async function () {
      const nonExistentSessionId = ethers.id("phantom_session");
      await expect(
        zkAuthRegistry.connect(user1).endSession(nonExistentSessionId)
      ).to.be.revertedWithCustomError(zkAuthRegistry, "SessionNotFound");
    });

    it("Should revert when ending an already-ended session", async function () {
      await zkAuthRegistry.connect(user1).registerCommitment(commitment1, 1, mockProof);
      const tx = await zkAuthRegistry.connect(user1).startSession(commitment1, mockProof);
      const receipt = await tx.wait();
      const sessionId = await extractSessionId(zkAuthRegistry, receipt);

      await zkAuthRegistry.connect(user1).endSession(sessionId);

      await expect(
        zkAuthRegistry.connect(user1).endSession(sessionId)
      ).to.be.revertedWithCustomError(zkAuthRegistry, "SessionNotFound");
    });

    it("Any address can end any session (no ownership guard)", async function () {
      await zkAuthRegistry.connect(user1).registerCommitment(commitment1, 1, mockProof);
      const tx = await zkAuthRegistry.connect(user1).startSession(commitment1, mockProof);
      const receipt = await tx.wait();
      const sessionId = await extractSessionId(zkAuthRegistry, receipt);

      // attacker ends user1's session — contract does not prevent this
      await expect(
        zkAuthRegistry.connect(attacker).endSession(sessionId)
      ).to.emit(zkAuthRegistry, "SessionEnded").withArgs(sessionId);

      const [isValid] = await zkAuthRegistry.validateSession(sessionId);
      expect(isValid).to.be.false;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // validateSession / getSession on non-existent IDs
  // ─────────────────────────────────────────────────────────────

  describe("Query functions on non-existent data", function () {
    it("validateSession returns (false, None, 0) for non-existent session", async function () {
      const phantomId = ethers.id("ghost");
      const [isValid, role, commitment] = await zkAuthRegistry.validateSession(phantomId);
      expect(isValid).to.be.false;
      expect(role).to.equal(0); // UserRole.None
      expect(commitment).to.equal(ethers.ZeroHash);
    });

    it("getSession returns zero-value struct for non-existent session", async function () {
      const phantomId = ethers.id("ghost");
      const session = await zkAuthRegistry.getSession(phantomId);
      expect(session.commitment).to.equal(ethers.ZeroHash);
      expect(session.expiry).to.equal(0);
      expect(session.active).to.be.false;
    });

    it("getRole returns None for unregistered commitment", async function () {
      const unregistered = ethers.id("never_registered");
      expect(await zkAuthRegistry.getRole(unregistered)).to.equal(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Verifier upgrade interaction with active sessions
  // ─────────────────────────────────────────────────────────────

  describe("Verifier upgrade during active session", function () {
    it("Active session remains valid after verifier is changed", async function () {
      await zkAuthRegistry.connect(user1).registerCommitment(commitment1, 1, mockProof);
      const tx = await zkAuthRegistry.connect(user1).startSession(commitment1, mockProof);
      const receipt = await tx.wait();
      const sessionId = await extractSessionId(zkAuthRegistry, receipt);

      // Deploy a new (rejecting) verifier
      const MockVerifierFactory = await ethers.getContractFactory("MockAuthVerifier");
      const rejectingVerifier = await MockVerifierFactory.deploy();
      await rejectingVerifier.waitForDeployment();
      await rejectingVerifier.setAlwaysPass(false);

      await zkAuthRegistry.connect(admin).setVerifier(await rejectingVerifier.getAddress());

      // validateSession does not call the verifier; session should still be active
      const [isValid, role] = await zkAuthRegistry.validateSession(sessionId);
      expect(isValid).to.be.true;
      expect(role).to.equal(1);
    });

    it("New registrations are rejected after verifier is switched to rejecting mode", async function () {
      const MockVerifierFactory = await ethers.getContractFactory("MockAuthVerifier");
      const rejectingVerifier = await MockVerifierFactory.deploy();
      await rejectingVerifier.waitForDeployment();
      await rejectingVerifier.setAlwaysPass(false);

      await zkAuthRegistry.connect(admin).setVerifier(await rejectingVerifier.getAddress());

      await expect(
        zkAuthRegistry.connect(user1).registerCommitment(commitment1, 1, mockProof)
      ).to.be.revertedWithCustomError(zkAuthRegistry, "InvalidProof");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Upgradeability access control
  // ─────────────────────────────────────────────────────────────

  describe("Upgradeability access control", function () {
    it("Should revert upgrade attempt from non-admin", async function () {
      const ZKAuthRegistryFactory = await ethers.getContractFactory("ZKAuthRegistry");
      await expect(
        upgrades.upgradeProxy(
          await zkAuthRegistry.getAddress(),
          ZKAuthRegistryFactory.connect(user1)
        )
      ).to.be.reverted;
    });
  });
});
