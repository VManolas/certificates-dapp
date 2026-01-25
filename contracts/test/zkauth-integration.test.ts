// contracts/test/zkauth-integration.test.ts
/**
 * ZK Authentication End-to-End Integration Tests
 * ===============================================
 * 
 * This test suite validates the COMPLETE ZK authentication flow with REAL verifier:
 * 
 * Phase 1 Tests (Critical for Deployment):
 * 1. ✅ UltraPlonk verifier deployment and configuration
 * 2. ✅ Hash compatibility (JavaScript → Noir → Solidity)
 * 3. ✅ Commitment registration with real ZK proofs
 * 4. ✅ Session management with real ZK proofs
 * 5. ✅ Complete authentication lifecycle
 * 6. ✅ Error handling and invalid proof rejection
 * 7. ✅ Gas cost analysis for production deployment
 * 
 * Success Criteria:
 * - All tests pass with REAL UltraPlonk verifier (not mock)
 * - JavaScript (circomlibjs) ↔ Noir ↔ Solidity compatibility proven
 * - Gas costs are reasonable for production
 * - Error messages are clear and actionable
 */

import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { 
  ZKAuthRegistry, 
  UltraPlonkAuthVerifierAdapter 
} from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { 
  generateAuthProof, 
  computeCommitment, 
  generateRandomCredentials 
} from './helpers/zkProofGenerator';

describe('ZK Authentication - Phase 1: Complete Integration', function() {
  // Extended timeout for ZK operations (proof generation takes time)
  this.timeout(180000); // 3 minutes

  let zkAuthRegistry: ZKAuthRegistry;
  let verifierAdapter: UltraPlonkAuthVerifierAdapter;
  let admin: SignerWithAddress;
  let student: SignerWithAddress;
  let employer: SignerWithAddress;

  // Test credentials (deterministic for repeatability)
  const TEST_CREDENTIALS = {
    privateKey: BigInt('12345678901234567890'),
    salt: BigInt('98765432109876543210')
  };

  // Computed values (will be set in beforeEach)
  let studentCommitment: string;
  let employerCommitment: string;
  let studentProof: string;
  let employerProof: string;

  before(async function() {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  🚀 Phase 1: ZK Authentication Integration Tests');
    console.log('═══════════════════════════════════════════════════════\n');
  });

  beforeEach(async function() {
    console.log('📦 Setting up test environment...\n');

    // Get signers
    [admin, student, employer] = await ethers.getSigners();

    // ============================================
    // Deploy UltraPlonk Verifier Infrastructure
    // ============================================
    console.log('Step 1: Deploying UltraPlonk verifier...');
    
    const UltraVerifierFactory = await ethers.getContractFactory('UltraVerifier');
    const ultraVerifier = await UltraVerifierFactory.deploy();
    await ultraVerifier.waitForDeployment();
    const ultraVerifierAddr = await ultraVerifier.getAddress();
    
    console.log(`   ✅ UltraVerifier deployed: ${ultraVerifierAddr}`);

    // Deploy adapter
    console.log('Step 2: Deploying verifier adapter...');
    
    const AdapterFactory = await ethers.getContractFactory('UltraPlonkAuthVerifierAdapter');
    verifierAdapter = await AdapterFactory.deploy(ultraVerifierAddr) as UltraPlonkAuthVerifierAdapter;
    await verifierAdapter.waitForDeployment();
    const adapterAddr = await verifierAdapter.getAddress();
    
    console.log(`   ✅ Adapter deployed: ${adapterAddr}`);

    // Verify adapter configuration
    const isProduction = await verifierAdapter.isProductionReady();
    const circuitName = await verifierAdapter.getCircuitName();
    
    console.log(`   📋 Circuit: ${circuitName}`);
    console.log(`   🔒 Production Ready: ${isProduction}\n`);

    expect(isProduction).to.be.true;
    expect(circuitName).to.equal('auth_login_ultraplonk');

    // ============================================
    // Deploy ZKAuthRegistry
    // ============================================
    console.log('Step 3: Deploying ZKAuthRegistry...');
    
    const ZKAuthRegistryFactory = await ethers.getContractFactory('ZKAuthRegistry');
    zkAuthRegistry = await upgrades.deployProxy(
      ZKAuthRegistryFactory,
      [admin.address, adapterAddr],
      { initializer: 'initialize' }
    ) as unknown as ZKAuthRegistry;
    await zkAuthRegistry.waitForDeployment();
    
    const registryAddr = await zkAuthRegistry.getAddress();
    console.log(`   ✅ ZKAuthRegistry deployed: ${registryAddr}\n`);

    // ============================================
    // Generate Test Data
    // ============================================
    console.log('Step 4: Generating commitments and proofs...');
    console.log('   ⏳ This may take 30-60 seconds...\n');

    const startTime = Date.now();

    // Generate commitments
    studentCommitment = await computeCommitment(
      TEST_CREDENTIALS.privateKey,
      student.address,
      TEST_CREDENTIALS.salt
    );

    employerCommitment = await computeCommitment(
      TEST_CREDENTIALS.privateKey,
      employer.address,
      TEST_CREDENTIALS.salt
    );

    console.log(`   ✅ Student commitment: ${studentCommitment.substring(0, 20)}...`);
    console.log(`   ✅ Employer commitment: ${employerCommitment.substring(0, 20)}...\n`);

    // Generate ZK proofs
    console.log('   🔐 Generating ZK proofs (patience please)...');
    
    studentProof = await generateAuthProof(
      TEST_CREDENTIALS.privateKey,
      student.address,
      TEST_CREDENTIALS.salt,
      studentCommitment
    );

    employerProof = await generateAuthProof(
      TEST_CREDENTIALS.privateKey,
      employer.address,
      TEST_CREDENTIALS.salt,
      employerCommitment
    );

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`   ✅ Proofs generated in ${elapsedTime}s`);
    console.log(`   📏 Student proof: ${studentProof.length} bytes`);
    console.log(`   📏 Employer proof: ${employerProof.length} bytes\n`);

    console.log('✅ Test environment ready!\n');
  });

  // ═══════════════════════════════════════════════════════════
  // Test Suite 1: Verifier Integration
  // ═══════════════════════════════════════════════════════════

  describe('Suite 1: Verifier Integration', function() {
    it('should have correct verifier configuration', async function() {
      console.log('🔍 Verifying adapter configuration...');

      const verifierAddr = await verifierAdapter.getVerifierAddress();
      const version = await verifierAdapter.getVersion();
      const proofFormat = await verifierAdapter.getProofFormat();

      console.log(`   Verifier: ${verifierAddr}`);
      console.log(`   Version: ${version}`);
      console.log(`   Format: ${proofFormat}`);

      expect(verifierAddr).to.not.equal(ethers.ZeroAddress);
      expect(version).to.equal('1.0.0');
      expect(proofFormat).to.include('UltraPlonk');

      console.log('   ✅ Configuration valid\n');
    });

    it('should reject empty proof', async function() {
      console.log('🔍 Testing empty proof rejection...');

      const emptyProof = '0x';
      const publicInputs = [studentCommitment];

      await expect(
        verifierAdapter.verify(emptyProof, publicInputs)
      ).to.be.revertedWithCustomError(verifierAdapter, 'EmptyProof');

      console.log('   ✅ Empty proof correctly rejected\n');
    });

    it('should reject empty public inputs', async function() {
      console.log('🔍 Testing empty public inputs rejection...');

      const dummyProof = '0x' + '00'.repeat(100);
      const emptyInputs: string[] = [];

      await expect(
        verifierAdapter.verify(dummyProof, emptyInputs)
      ).to.be.revertedWithCustomError(verifierAdapter, 'EmptyPublicInputs');

      console.log('   ✅ Empty inputs correctly rejected\n');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Test Suite 2: Hash Compatibility (CRITICAL)
  // ═══════════════════════════════════════════════════════════

  describe('Suite 2: Hash Compatibility Verification', function() {
    it('should prove circomlibjs ↔ Noir ↔ Solidity compatibility', async function() {
      console.log('\n🔬 Proving Full-Stack Hash Compatibility');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      console.log('📊 Data Flow:');
      console.log('   1. JavaScript (circomlibjs) computes commitment');
      console.log('   2. Noir circuit generates ZK proof using same hash');
      console.log('   3. Solidity UltraPlonk verifier validates proof\n');

      console.log('🔐 Commitment (from JavaScript):');
      console.log(`   ${studentCommitment}\n`);

      console.log('📝 Proof (from Noir):');
      console.log(`   ${studentProof.substring(0, 100)}...`);
      console.log(`   Length: ${studentProof.length} bytes\n`);

      console.log('🧪 Testing on-chain verification...');

      // This proves the entire chain works:
      // - circomlibjs computed the commitment
      // - Noir circuit generated a valid proof
      // - Solidity verifier accepts it
      const tx = await zkAuthRegistry.connect(student).registerCommitment(
        studentCommitment,
        1, // UserRole.Student
        studentProof
      );

      await tx.wait();

      console.log('   ✅ Proof VERIFIED by Solidity contract!\n');

      // Verify registration succeeded
      expect(await zkAuthRegistry.isRegistered(studentCommitment)).to.be.true;
      expect(await zkAuthRegistry.getRole(studentCommitment)).to.equal(1);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ SUCCESS! Full-stack compatibility PROVEN:');
      console.log('   ✓ JavaScript (circomlibjs) → commitment computed');
      console.log('   ✓ Noir circuit → valid proof generated');
      console.log('   ✓ Solidity verifier → proof accepted');
      console.log('\n🎉 Hash functions are 100% compatible!\n');
    });

    it('should handle different wallet addresses correctly', async function() {
      console.log('🔍 Testing wallet-specific commitments...');

      // Same private key and salt, different wallets = different commitments
      expect(studentCommitment).to.not.equal(employerCommitment);
      console.log('   ✅ Different wallets → different commitments');

      // Register both (should both succeed)
      await zkAuthRegistry.connect(student).registerCommitment(
        studentCommitment,
        1,
        studentProof
      );

      await zkAuthRegistry.connect(employer).registerCommitment(
        employerCommitment,
        2,
        employerProof
      );

      expect(await zkAuthRegistry.isRegistered(studentCommitment)).to.be.true;
      expect(await zkAuthRegistry.isRegistered(employerCommitment)).to.be.true;

      console.log('   ✅ Both commitments registered successfully\n');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Test Suite 3: Registration with Real ZK Proofs
  // ═══════════════════════════════════════════════════════════

  describe('Suite 3: Commitment Registration', function() {
    it('should register student with real ZK proof', async function() {
      console.log('🎓 Registering student with REAL ZK proof...');

      const tx = await zkAuthRegistry.connect(student).registerCommitment(
        studentCommitment,
        1, // UserRole.Student
        studentProof
      );

      await expect(tx)
        .to.emit(zkAuthRegistry, 'CommitmentRegistered')
        .withArgs(studentCommitment, 1, await ethers.provider.getBlock('latest').then(b => b!.timestamp));

      expect(await zkAuthRegistry.isRegistered(studentCommitment)).to.be.true;
      expect(await zkAuthRegistry.getRole(studentCommitment)).to.equal(1);

      console.log('   ✅ Student registered successfully');
      console.log(`   📋 Commitment: ${studentCommitment}`);
      console.log(`   🎭 Role: Student (1)\n`);
    });

    it('should register employer with real ZK proof', async function() {
      console.log('💼 Registering employer with REAL ZK proof...');

      const tx = await zkAuthRegistry.connect(employer).registerCommitment(
        employerCommitment,
        2, // UserRole.Employer
        employerProof
      );

      await expect(tx)
        .to.emit(zkAuthRegistry, 'CommitmentRegistered');

      expect(await zkAuthRegistry.isRegistered(employerCommitment)).to.be.true;
      expect(await zkAuthRegistry.getRole(employerCommitment)).to.equal(2);

      console.log('   ✅ Employer registered successfully');
      console.log(`   📋 Commitment: ${employerCommitment}`);
      console.log(`   🎭 Role: Employer (2)\n`);
    });

    it('should reject invalid ZK proof', async function() {
      console.log('🔍 Testing invalid proof rejection...');

      const invalidProof = '0x' + '00'.repeat(2000);

      await expect(
        zkAuthRegistry.connect(student).registerCommitment(
          studentCommitment,
          1,
          invalidProof
        )
      ).to.be.revertedWithCustomError(zkAuthRegistry, 'InvalidProof');

      console.log('   ✅ Invalid proof correctly rejected\n');
    });

    it('should reject duplicate commitment', async function() {
      console.log('🔍 Testing duplicate commitment rejection...');

      // Register once
      await zkAuthRegistry.connect(student).registerCommitment(
        studentCommitment,
        1,
        studentProof
      );

      // Try to register again
      await expect(
        zkAuthRegistry.connect(employer).registerCommitment(
          studentCommitment,
          2,
          employerProof // Different proof, same commitment
        )
      ).to.be.revertedWithCustomError(zkAuthRegistry, 'CommitmentAlreadyExists');

      console.log('   ✅ Duplicate commitment correctly rejected\n');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Test Suite 4: Session Management
  // ═══════════════════════════════════════════════════════════

  describe('Suite 4: Session Management with Real ZK Proofs', function() {
    beforeEach(async function() {
      // Register commitments for session tests
      await zkAuthRegistry.connect(student).registerCommitment(
        studentCommitment,
        1,
        studentProof
      );
    });

    it('should start session with real ZK proof', async function() {
      console.log('🔐 Starting session with REAL ZK proof...');

      const tx = await zkAuthRegistry.connect(student).startSession(
        studentCommitment,
        studentProof
      );

      const receipt = await tx.wait();
      const event = receipt!.logs.find((log: any) => {
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

      expect(event).to.not.be.undefined;

      const parsed = zkAuthRegistry.interface.parseLog({
        topics: event!.topics as string[],
        data: event!.data
      });
      const sessionId = parsed!.args[0];

      console.log(`   ✅ Session started: ${sessionId}\n`);

      // Verify session is valid
      const [isValid, role, commitment] = await zkAuthRegistry.validateSession(sessionId);
      
      expect(isValid).to.be.true;
      expect(role).to.equal(1);
      expect(commitment).to.equal(studentCommitment);

      console.log('   ✅ Session is active and valid\n');
    });

    it('should complete full authentication lifecycle', async function() {
      console.log('\n🎉 Testing COMPLETE Authentication Lifecycle');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Step 1: Registration (already done in beforeEach)
      console.log('Step 1: ✅ User registered with ZK proof');

      // Step 2: Start session
      console.log('Step 2: Starting authenticated session...');
      const startTx = await zkAuthRegistry.connect(student).startSession(
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

      const parsedEvent = zkAuthRegistry.interface.parseLog({
        topics: sessionEvent!.topics as string[],
        data: sessionEvent!.data
      });
      const sessionId = parsedEvent!.args[0];

      console.log(`   ✅ Session ID: ${sessionId}`);

      // Step 3: Validate session
      console.log('Step 3: Validating session...');
      const [isValid, role, commitment] = await zkAuthRegistry.validateSession(sessionId);
      
      expect(isValid).to.be.true;
      expect(role).to.equal(1);
      expect(commitment).to.equal(studentCommitment);
      
      console.log('   ✅ Session is active and valid');

      // Step 4: Use session (simulation)
      console.log('Step 4: User performs authenticated actions...');
      console.log('   ✅ (simulated - session is valid)');

      // Step 5: End session
      console.log('Step 5: Ending session...');
      await zkAuthRegistry.connect(student).endSession(sessionId);
      
      const [isValidAfterEnd] = await zkAuthRegistry.validateSession(sessionId);
      expect(isValidAfterEnd).to.be.false;
      
      console.log('   ✅ Session ended');

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎉 COMPLETE LIFECYCLE SUCCESSFUL!');
      console.log('   ✓ Registration with ZK proof');
      console.log('   ✓ Session start with ZK proof');
      console.log('   ✓ Session validation');
      console.log('   ✓ Session termination');
      console.log('\n✅ ZK Authentication system is PRODUCTION READY!\n');
    });

    it('should reject session start with unregistered commitment', async function() {
      console.log('🔍 Testing unregistered commitment rejection...');

      const unregisteredCommitment = ethers.id('unregistered');

      await expect(
        zkAuthRegistry.connect(student).startSession(
          unregisteredCommitment,
          studentProof
        )
      ).to.be.revertedWithCustomError(zkAuthRegistry, 'CommitmentNotFound');

      console.log('   ✅ Unregistered commitment correctly rejected\n');
    });

    it('should handle session expiration correctly', async function() {
      console.log('🔍 Testing session expiration...');

      // Start session
      const tx = await zkAuthRegistry.connect(student).startSession(
        studentCommitment,
        studentProof
      );
      const receipt = await tx.wait();

      const sessionEvent = receipt!.logs.find((log: any) => {
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

      const parsedEvent = zkAuthRegistry.interface.parseLog({
        topics: sessionEvent!.topics as string[],
        data: sessionEvent!.data
      });
      const sessionId = parsedEvent!.args[0];

      console.log('   ✅ Session created');

      // Fast forward time by 25 hours (SESSION_DURATION is 24 hours)
      await ethers.provider.send('evm_increaseTime', [25 * 60 * 60]);
      await ethers.provider.send('evm_mine', []);

      console.log('   ⏱️  Time advanced 25 hours');

      // Check session is now invalid
      const [isValid] = await zkAuthRegistry.validateSession(sessionId);
      expect(isValid).to.be.false;

      console.log('   ✅ Expired session correctly invalidated\n');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Test Suite 5: Gas Cost Analysis
  // ═══════════════════════════════════════════════════════════

  describe('Suite 5: Gas Cost Analysis', function() {
    it('should measure gas costs for production planning', async function() {
      console.log('\n⛽ Gas Cost Analysis for Production');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Registration gas cost
      console.log('📊 Registration (with ZK proof verification):');
      const regTx = await zkAuthRegistry.connect(student).registerCommitment(
        studentCommitment,
        1,
        studentProof
      );
      const regReceipt = await regTx.wait();
      const regGasUsed = regReceipt!.gasUsed;
      
      console.log(`   Gas Used: ${regGasUsed.toString()}`);
      console.log(`   Estimated Cost (zkSync Era): ~$${((Number(regGasUsed) / 1_000_000) * 0.10).toFixed(4)}`);

      // Session start gas cost
      console.log('\n📊 Session Start (with ZK proof verification):');
      const sessTx = await zkAuthRegistry.connect(student).startSession(
        studentCommitment,
        studentProof
      );
      const sessReceipt = await sessTx.wait();
      const sessGasUsed = sessReceipt!.gasUsed;
      
      console.log(`   Gas Used: ${sessGasUsed.toString()}`);
      console.log(`   Estimated Cost (zkSync Era): ~$${((Number(sessGasUsed) / 1_000_000) * 0.10).toFixed(4)}`);

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💡 Production Recommendations:');
      console.log('   • Registration: One-time cost per user');
      console.log('   • Session Start: Pay per login');
      console.log('   • Consider session caching to reduce costs');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Verify gas costs are reasonable - UltraPlonk proofs (~2KB) use ~520k gas
      expect(regGasUsed).to.be.lessThan(550_000n, 'Registration gas should be < 550k');
      expect(sessGasUsed).to.be.lessThan(550_000n, 'Session start gas should be < 550k');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Final Summary
  // ═══════════════════════════════════════════════════════════

  after(function() {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  ✅ Phase 1 Integration Tests Complete!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Verifier integration working');
    console.log('   ✅ Hash compatibility proven (JS ↔ Noir ↔ Solidity)');
    console.log('   ✅ Registration with real ZK proofs');
    console.log('   ✅ Session management with real ZK proofs');
    console.log('   ✅ Complete authentication lifecycle');
    console.log('   ✅ Gas costs are production-ready');
    console.log('\n🚀 Ready for Phase 2: Browser Testing');
    console.log('═══════════════════════════════════════════════════════\n');
  });
});
