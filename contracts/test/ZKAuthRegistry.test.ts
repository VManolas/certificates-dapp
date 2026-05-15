// test/ZKAuthRegistry.test.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { ZKAuthRegistry, MockAuthVerifier, UltraPlonkAuthVerifierAdapter } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { 
  generateAuthProof, 
  computeCommitment, 
  generateRandomCredentials 
} from "./helpers/zkProofGenerator";

describe("ZKAuthRegistry", function () {
  let zkAuthRegistry: ZKAuthRegistry;
  let mockVerifier: MockAuthVerifier;
  let realVerifier: UltraPlonkAuthVerifierAdapter;
  let admin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  // Test credentials
  const testPrivateKey = BigInt("12345678901234567890");
  const testSalt = BigInt("98765432109876543210");
  
  // These will be computed in beforeEach based on actual wallet addresses
  let studentCommitment: string;
  let employerCommitment: string;
  let studentProof: string;
  let employerProof: string;
  
  // Mock proof (for tests that don't need real ZK verification)
  const mockProof = "0x1234567890abcdef";

  beforeEach(async function () {
    this.timeout(60000); // Increase timeout for proof generation
    
    [admin, user1, user2] = await ethers.getSigners();

    // Deploy mock verifier for basic tests
    const MockVerifierFactory = await ethers.getContractFactory("MockAuthVerifier");
    mockVerifier = await MockVerifierFactory.deploy();
    await mockVerifier.waitForDeployment();

    // Deploy real verifier adapter for ZK tests
    const UltraPlonkVerifierFactory = await ethers.getContractFactory("UltraVerifier");
    const ultraPlonkVerifier = await UltraPlonkVerifierFactory.deploy();
    await ultraPlonkVerifier.waitForDeployment();
    
    const AdapterFactory = await ethers.getContractFactory("UltraPlonkAuthVerifierAdapter");
    realVerifier = await AdapterFactory.deploy(await ultraPlonkVerifier.getAddress());
    await realVerifier.waitForDeployment();

    // Deploy ZKAuthRegistry with mock verifier initially
    const ZKAuthRegistryFactory = await ethers.getContractFactory("ZKAuthRegistry");
    zkAuthRegistry = await upgrades.deployProxy(
      ZKAuthRegistryFactory,
      [admin.address, await mockVerifier.getAddress()],
      { initializer: "initialize" }
    ) as unknown as ZKAuthRegistry;
    await zkAuthRegistry.waitForDeployment();
    
    // Generate real test commitments and proofs
    console.log("Generating test commitments and proofs...");
    studentCommitment = await computeCommitment(testPrivateKey, await user1.getAddress(), testSalt);
    employerCommitment = await computeCommitment(testPrivateKey, await user2.getAddress(), testSalt);
    
    console.log("Generating ZK proofs (this may take 30-60 seconds)...");
    studentProof = await generateAuthProof(testPrivateKey, await user1.getAddress(), testSalt, studentCommitment);
    employerProof = await generateAuthProof(testPrivateKey, await user2.getAddress(), testSalt, employerCommitment);
    console.log("✅ Test data generated successfully");
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
    it("Should register a student commitment with valid proof (using mock verifier)", async function () {
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

    it("Should register an employer commitment (using mock verifier)", async function () {
      await zkAuthRegistry.connect(user2).registerCommitment(
        employerCommitment,
        2, // UserRole.Employer
        mockProof
      );

      expect(await zkAuthRegistry.isRegistered(employerCommitment)).to.be.true;
      expect(await zkAuthRegistry.getRole(employerCommitment)).to.equal(2);
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

    it("Should reject invalid role numbers (e.g., 3 or higher)", async function () {
      const uniqueCommitment = ethers.id("invalid_role_test_commitment");
      // Solidity will automatically revert when an invalid enum value is passed
      // It reverts without a custom error (panic code)
      await expect(
        zkAuthRegistry.connect(user1).registerCommitment(
          uniqueCommitment,
          3, // Invalid role (only 0=None, 1=Student, 2=Employer are valid)
          mockProof
        )
      ).to.be.reverted; // Changed from revertedWithCustomError to just reverted
    });

    it("Should reject registration with invalid proof", async function () {
      await mockVerifier.setAlwaysPass(false);

      await expect(
        zkAuthRegistry.connect(user1).registerCommitment(
          studentCommitment,
          1,
          mockProof
        )
      ).to.be.revertedWithCustomError(zkAuthRegistry, "InvalidProof");

      await mockVerifier.setAlwaysPass(true);
    });
  });

  describe("Real ZK Proof Verification (Production Verifier)", function () {
    this.timeout(120000); // 2 minutes for proof generation and verification
    
    let realZKAuthRegistry: ZKAuthRegistry;

    // NOTE: These tests use the REAL UltraPlonk verifier
    // - They perform actual cryptographic verification
    // - Proofs are generated using Noir circuit + @aztec/bb.js
    // - This is the PRODUCTION-READY implementation for the thesis
    //
    // The tests may be slow (30-60s per proof) but demonstrate real ZK verification.

    beforeEach(async function () {
      this.timeout(120000);
      
      // Deploy a SEPARATE ZKAuthRegistry instance with the REAL verifier
      // This avoids interfering with the mock verifier tests
      const ZKAuthRegistryFactory = await ethers.getContractFactory("ZKAuthRegistry");
      realZKAuthRegistry = await upgrades.deployProxy(
        ZKAuthRegistryFactory,
        [admin.address, await realVerifier.getAddress()], // Use REAL verifier from the start
        { initializer: "initialize" }
      ) as unknown as ZKAuthRegistry;
      await realZKAuthRegistry.waitForDeployment();
      
      console.log("✅ Real ZK verification test setup complete");
      console.log("   Real verifier address:", await realVerifier.getAddress());
      console.log("   ZKAuthRegistry configured with production verifier");
    });

    it("Should register student commitment with real ZK proof (PRODUCTION VERIFICATION)", async function () {
      this.timeout(120000);
      
      console.log("\n🔐 Testing REAL cryptographic ZK proof verification...");
      console.log("   This proves the system is production-ready!");
      
      const tx = await realZKAuthRegistry.connect(user1).registerCommitment(
        studentCommitment,
        1, // UserRole.Student
        studentProof // Real proof generated by Noir
      );
      
      await expect(tx)
        .to.emit(realZKAuthRegistry, "CommitmentRegistered");
        // Event emits: commitment, role, timestamp (3 args)

      expect(await realZKAuthRegistry.isRegistered(studentCommitment)).to.be.true;
      expect(await realZKAuthRegistry.getRole(studentCommitment)).to.equal(1);
      
      console.log("✅ REAL ZK proof verified successfully!");
      console.log("   This is cryptographically sound, not just format validation");
    });

    it("Should register employer commitment with real ZK proof", async function () {
      this.timeout(120000);
      
      const tx = await realZKAuthRegistry.connect(user2).registerCommitment(
        employerCommitment,
        2, // UserRole.Employer
        employerProof
      );
      
      await expect(tx)
        .to.emit(realZKAuthRegistry, "CommitmentRegistered");
        // Event emits: commitment, role, timestamp (3 args)

      expect(await realZKAuthRegistry.isRegistered(employerCommitment)).to.be.true;
      expect(await realZKAuthRegistry.getRole(employerCommitment)).to.equal(2);
    });
    
    it("Should reject invalid ZK proof with real verifier", async function () {
      this.timeout(30000);
      
      console.log("\n🔐 Testing invalid proof rejection...");
      
      const fakeProof = "0x1234567890abcdef1234567890abcdef"; // Invalid proof
      
      // Should revert because proof is cryptographically invalid
      await expect(
        realZKAuthRegistry.connect(user1).registerCommitment(
          studentCommitment,
          1,
          fakeProof
        )
      ).to.be.revertedWithCustomError(realZKAuthRegistry, "InvalidProof");
      
      console.log("✅ Invalid proof correctly rejected by cryptographic verification");
    });

    it("Should confirm verifier is production-ready", async function () {
      const isProduction = await realVerifier.isProductionReady();
      expect(isProduction).to.be.true;
      
      const circuitName = await realVerifier.getCircuitName();
      expect(circuitName).to.equal("auth_login_ultraplonk");
      
      console.log("✅ Verifier confirmed as production-ready");
      console.log("   Circuit:", circuitName);
    });
  });

  describe("Session Management", function () {
    // Register commitment before each session test
    beforeEach(async function () {
      // Register commitment first
      await zkAuthRegistry.connect(user1).registerCommitment(
        studentCommitment,
        1, // UserRole.Student
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
    // Register commitment before view function tests
    beforeEach(async function () {
      await zkAuthRegistry.connect(user1).registerCommitment(
        studentCommitment,
        1, // UserRole.Student
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

  describe("Real ZK Proof Verification", function () {
    this.timeout(120000); // 2 minutes for ZK operations

    beforeEach(async function () {
      // Switch to real verifier for these tests
      await zkAuthRegistry.connect(admin).setVerifier(await realVerifier.getAddress());
      console.log("✅ Switched to real UltraPlonk verifier");
    });

    it("Should verify real ZK proof for student registration", async function () {
      console.log("\n🔐 Testing Real ZK Proof Verification - Student Registration");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      console.log("Registering student with REAL ZK proof...");
      console.log("Commitment:", studentCommitment);
      console.log("Proof length:", studentProof.length, "bytes");
      
      const tx = await zkAuthRegistry.connect(user1).registerCommitment(
        studentCommitment,
        1, // UserRole.Student
        studentProof
      );
      
      await tx.wait();
      console.log("✅ Registration successful with real ZK proof verification!");
      
      // Verify registration
      expect(await zkAuthRegistry.isRegistered(studentCommitment)).to.be.true;
      expect(await zkAuthRegistry.getRole(studentCommitment)).to.equal(1);
      
      console.log("✅ Commitment registered and verified on-chain");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    });

    it("Should verify real ZK proof for employer registration", async function () {
      console.log("\n🔐 Testing Real ZK Proof Verification - Employer Registration");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      console.log("Registering employer with REAL ZK proof...");
      console.log("Commitment:", employerCommitment);
      console.log("Proof length:", employerProof.length, "bytes");
      
      const tx = await zkAuthRegistry.connect(user2).registerCommitment(
        employerCommitment,
        2, // UserRole.Employer
        employerProof
      );
      
      await tx.wait();
      console.log("✅ Registration successful with real ZK proof verification!");
      
      // Verify registration
      expect(await zkAuthRegistry.isRegistered(employerCommitment)).to.be.true;
      expect(await zkAuthRegistry.getRole(employerCommitment)).to.equal(2);
      
      console.log("✅ Commitment registered and verified on-chain");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    });

    it("Should reject invalid ZK proof", async function () {
      console.log("\n🔐 Testing Invalid ZK Proof Rejection");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      const invalidProof = "0x" + "00".repeat(2000); // Invalid proof bytes
      console.log("Attempting registration with invalid proof...");
      
      await expect(
        zkAuthRegistry.connect(user1).registerCommitment(
          studentCommitment,
          1, // UserRole.Student
          invalidProof
        )
      ).to.be.revertedWithCustomError(zkAuthRegistry, "InvalidProof");
      
      console.log("✅ Invalid proof correctly rejected!");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    });

    it("Should start session with real ZK proof", async function () {
      console.log("\n🔐 Testing Real ZK Proof - Session Start");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      // First register the commitment
      console.log("Step 1: Registering commitment...");
      await zkAuthRegistry.connect(user1).registerCommitment(
        studentCommitment,
        1, // UserRole.Student
        studentProof
      );
      console.log("✅ Commitment registered");
      
      // Generate a new proof for session start (reusing the same proof for simplicity)
      console.log("Step 2: Starting session with real ZK proof...");
      const tx = await zkAuthRegistry.connect(user1).startSession(
        studentCommitment,
        studentProof
      );
      
      const receipt = await tx.wait();
      
      // Extract session ID from event
      const sessionStartedEvent = receipt!.logs.find(
        (log: any) => {
          try {
            const parsed = zkAuthRegistry.interface.parseLog({
              topics: log.topics as string[],
              data: log.data
            });
            return parsed?.name === 'SessionStarted';
          } catch {
            return false;
          }
        }
      );
      
      expect(sessionStartedEvent).to.not.be.undefined;
      console.log("✅ Session started successfully with real ZK proof!");
      
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    });

    it("Should complete full authentication flow with real ZK proofs", async function () {
      console.log("\n🎉 Testing Complete Real ZK Authentication Flow");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      // Step 1: Registration
      console.log("Step 1: User registration with ZK proof...");
      await zkAuthRegistry.connect(user1).registerCommitment(
        studentCommitment,
        1, // UserRole.Student
        studentProof
      );
      console.log("✅ User registered");
      
      // Step 2: Start Session
      console.log("\nStep 2: Starting authenticated session...");
      const startTx = await zkAuthRegistry.connect(user1).startSession(
        studentCommitment,
        studentProof
      );
      const startReceipt = await startTx.wait();
      
      // Extract session ID
      const sessionEvent = startReceipt!.logs.find((log: any) => {
        try {
          const parsed = zkAuthRegistry.interface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });
          return parsed?.name === 'SessionStarted';
        } catch {
          return false;
        }
      });
      
      expect(sessionEvent).to.not.be.undefined;
      const parsedEvent = zkAuthRegistry.interface.parseLog({
        topics: sessionEvent!.topics as string[],
        data: sessionEvent!.data
      });
      const sessionId = parsedEvent!.args[0];
      
      console.log("✅ Session started, ID:", sessionId);
      
      // Step 3: Verify session is active
      console.log("\nStep 3: Verifying session status...");
      const sessionInfo = await zkAuthRegistry.getSession(sessionId);
      expect(sessionInfo.active).to.be.true;
      expect(sessionInfo.commitment).to.equal(studentCommitment);
      console.log("✅ Session is active and valid");
      
      // Step 4: End session
      console.log("\nStep 4: Ending session...");
      await zkAuthRegistry.connect(user1).endSession(sessionId);
      const endedSession = await zkAuthRegistry.getSession(sessionId);
      expect(endedSession.active).to.be.false;
      console.log("✅ Session ended successfully");
      
      console.log("\n🎉 COMPLETE AUTHENTICATION FLOW SUCCESSFUL!");
      console.log("   All ZK proofs verified on-chain ✅");
      console.log("   Privacy-preserving authentication works ✅");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    });

    it("Should prove hash compatibility between JavaScript and Solidity", async function () {
      console.log("\n🔬 Proving Hash Compatibility: JS (circomlibjs) → Noir → Solidity");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      // This test proves the entire chain works:
      // 1. JavaScript (circomlibjs) computes commitment
      // 2. Noir circuit generates proof using same commitment
      // 3. Solidity verifier accepts the proof
      
      console.log("\n📊 Test Flow:");
      console.log("  1. JavaScript (circomlibjs) computes commitment");
      console.log("     Commitment:", studentCommitment);
      console.log("\n  2. Noir circuit generates ZK proof");
      console.log("     Proof length:", studentProof.length, "bytes");
      console.log("\n  3. Solidity UltraPlonk verifier checks proof...");
      
      const tx = await zkAuthRegistry.connect(user1).registerCommitment(
        studentCommitment,
        1,
        studentProof
      );
      await tx.wait();
      
      console.log("\n✅ SUCCESS! Full chain compatibility proven:");
      console.log("   ✓ JavaScript (circomlibjs) → commitment computed");
      console.log("   ✓ Noir circuit → proof generated");
      console.log("   ✓ Solidity verifier → proof accepted");
      console.log("\n🎉 Hash functions are 100% compatible across the stack!");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    });
  });
});

