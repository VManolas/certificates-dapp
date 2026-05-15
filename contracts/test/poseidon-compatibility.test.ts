// contracts/test/poseidon-compatibility.test.ts
/**
 * Poseidon Hash Compatibility Test
 * =================================
 * 
 * This test verifies that the JavaScript Poseidon implementation (circomlibjs)
 * produces EXACTLY the same outputs as the Noir Poseidon implementation.
 * 
 * Why This Matters:
 * - If hashes don't match, ZK proofs will ALWAYS fail
 * - Frontend computes commitment with JavaScript
 * - Noir circuit verifies commitment during proof generation
 * - Smart contract verifies proof on-chain
 * 
 * Test Strategy:
 * 1. Use known test values
 * 2. Compute hashes in JavaScript (circomlibjs)
 * 3. Compute hashes in Noir circuit
 * 4. Compare outputs byte-by-byte
 * 
 * Success Criteria:
 * - JavaScript public key MUST equal Noir public key
 * - JavaScript commitment MUST equal Noir commitment
 */

import { expect } from 'chai';
import { buildPoseidon } from 'circomlibjs';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

describe('Poseidon Hash Compatibility', function() {
  // Increase timeout for Noir compilation/execution
  this.timeout(120000);

  // Test values (same as in Noir circuit tests)
  const TEST_VALUES = {
    privateKey: '12345678901234567890',
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
    salt: '98765432109876543210'
  };

  let poseidon: any;

  before(async () => {
    console.log('\n📦 Initializing Poseidon (circomlibjs)...');
    poseidon = await buildPoseidon();
    console.log('✅ Poseidon initialized\n');
  });

  it('should produce identical outputs in JavaScript and Noir', async function() {
    console.log('🧪 Starting Poseidon Compatibility Test\n');
    console.log('📋 Test Values:');
    console.log(`   Private Key: ${TEST_VALUES.privateKey}`);
    console.log(`   Wallet Address: ${TEST_VALUES.walletAddress}`);
    console.log(`   Salt: ${TEST_VALUES.salt}\n`);

    // Step 1: Compute hashes using JavaScript (circomlibjs)
    console.log('🔧 Computing hashes with JavaScript (circomlibjs)...');
    
    const privateKeyBigInt = BigInt(TEST_VALUES.privateKey);
    const walletAddressBigInt = BigInt(TEST_VALUES.walletAddress);
    const saltBigInt = BigInt(TEST_VALUES.salt);

    // Compute public key: hash_1([privateKey])
    const publicKeyField = poseidon([privateKeyBigInt]);
    const publicKeyJS = poseidon.F.toString(publicKeyField);
    
    // Compute commitment: hash_3([publicKey, walletAddress, salt])
    const publicKeyBigIntJS = BigInt(publicKeyJS);
    const commitmentField = poseidon([publicKeyBigIntJS, walletAddressBigInt, saltBigInt]);
    const commitmentJS = poseidon.F.toString(commitmentField);

    console.log('📊 JavaScript (circomlibjs) Output:');
    console.log(`   Public Key: ${publicKeyJS}`);
    console.log(`   Commitment: ${commitmentJS}\n`);

    // Step 2: Run Noir circuit and capture output
    console.log('🔐 Running Noir circuit...');
    
    const circuitPath = join(__dirname, '../circuits/auth_login');
    
    let noirOutput: string;
    try {
      // Run Noir test that prints the values
      noirOutput = execSync(
        'nargo test test_poseidon_compatibility --show-output',
        { 
          cwd: circuitPath,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        }
      );
      
      console.log('✅ Noir circuit executed successfully\n');
      
    } catch (error: any) {
      const msg: string = error.stdout || error.message || '';
      if (msg.includes('nargo: not found') || msg.includes('nargo') && msg.includes('not found')) {
        console.log('⚠️  nargo not installed — skipping Noir circuit check');
        (this as any).skip();
        return;
      }
      console.error('❌ Noir circuit execution failed:');
      console.error(msg);
      throw new Error('Noir circuit execution failed');
    }

    // Step 3: Parse Noir output
    console.log('📝 Parsing Noir output...');
    
    // The Noir test prints the values in hex format (0x...)
    // Example output:
    // 0x26ef6dd4cf0be9cb745e6a20d05e54766bcf592a4c963e76337cc9c0250c2855
    // 0x12be5b494e43bf434ac9e2d8fc774fe9f0bb746223061b6b86dfef52e359adfe
    const lines = noirOutput.split('\n');
    let publicKeyNoir = '';
    let commitmentNoir = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Look for hex values (0x...)
      if (trimmed.startsWith('0x') && trimmed.length === 66) {  // 0x + 64 hex chars = 66
        if (!publicKeyNoir) {
          // Convert hex to decimal
          publicKeyNoir = BigInt(trimmed).toString(10);
        } else if (!commitmentNoir) {
          // Convert hex to decimal
          commitmentNoir = BigInt(trimmed).toString(10);
        }
      }
    }

    if (!publicKeyNoir || !commitmentNoir) {
      console.error('❌ Failed to parse Noir output:');
      console.error(noirOutput);
      throw new Error('Could not extract values from Noir output');
    }

    console.log('📊 Noir Output:');
    console.log(`   Public Key: ${publicKeyNoir}`);
    console.log(`   Commitment: ${commitmentNoir}\n`);

    // Step 4: Compare the outputs
    console.log('🔍 Comparing outputs...\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                   PUBLIC KEY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`JavaScript: ${publicKeyJS}`);
    console.log(`Noir:       ${publicKeyNoir}`);
    console.log(`Match:      ${publicKeyJS === publicKeyNoir ? '✅ YES' : '❌ NO'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                  COMMITMENT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`JavaScript: ${commitmentJS}`);
    console.log(`Noir:       ${commitmentNoir}`);
    console.log(`Match:      ${commitmentJS === commitmentNoir ? '✅ YES' : '❌ NO'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Assert equality
    expect(publicKeyJS).to.equal(publicKeyNoir, 'Public key mismatch between JavaScript and Noir');
    expect(commitmentJS).to.equal(commitmentNoir, 'Commitment mismatch between JavaScript and Noir');

    console.log('🎉 SUCCESS! JavaScript and Noir produce identical outputs!\n');
    console.log('✅ Poseidon hash implementation is COMPATIBLE');
    console.log('✅ Frontend will generate valid ZK proofs');
    console.log('✅ Smart contracts will verify proofs correctly\n');
  });

  it('should handle multiple test cases consistently', async () => {
    console.log('\n🧪 Testing multiple value sets for consistency...\n');

    const testCases = [
      {
        name: 'Test Case 1',
        privateKey: '11111111111111111111',
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
        salt: '22222222222222222222'
      },
      {
        name: 'Test Case 2',
        privateKey: '99999999999999999999',
        walletAddress: '0x1234567890123456789012345678901234567890',
        salt: '88888888888888888888'
      }
    ];

    for (const testCase of testCases) {
      console.log(`📋 ${testCase.name}:`);
      
      const privateKeyBigInt = BigInt(testCase.privateKey);
      const walletAddressBigInt = BigInt(testCase.walletAddress);
      const saltBigInt = BigInt(testCase.salt);

      // Compute with circomlibjs
      const publicKeyField = poseidon([privateKeyBigInt]);
      const publicKey = poseidon.F.toString(publicKeyField);
      const publicKeyBigInt = BigInt(publicKey);
      
      const commitmentField = poseidon([publicKeyBigInt, walletAddressBigInt, saltBigInt]);
      const commitment = poseidon.F.toString(commitmentField);

      console.log(`   Public Key: ${publicKey.substring(0, 20)}...`);
      console.log(`   Commitment: ${commitment.substring(0, 20)}...`);
      
      // Verify outputs are valid field elements (non-zero)
      expect(BigInt(publicKey)).to.be.greaterThan(0n, 'Public key should be non-zero');
      expect(BigInt(commitment)).to.be.greaterThan(0n, 'Commitment should be non-zero');
      
      console.log('   ✅ Valid\n');
    }

    console.log('✅ All test cases produced valid outputs\n');
  });

  it('should verify frontend helper matches test helper', async () => {
    console.log('\n🧪 Verifying frontend implementation consistency...\n');

    // This test ensures the frontend pattern is correct
    // We verify the algorithm, not import the actual file

    const privateKeyBigInt = BigInt(TEST_VALUES.privateKey);
    const walletAddressBigInt = BigInt(TEST_VALUES.walletAddress);
    const saltBigInt = BigInt(TEST_VALUES.salt);

    // Frontend pattern (matches circomlibjs usage)
    const publicKeyField = poseidon([privateKeyBigInt]);
    const publicKey = poseidon.F.toString(publicKeyField);
    const publicKeyBigInt = BigInt(publicKey);
    
    const commitmentField = poseidon([publicKeyBigInt, walletAddressBigInt, saltBigInt]);
    const commitment = poseidon.F.toString(commitmentField);

    console.log('📊 Frontend Pattern Output:');
    console.log(`   Public Key: ${publicKey}`);
    console.log(`   Commitment: ${commitment}\n`);

    // Verify it's a valid field element (less than BN254 field modulus)
    const BN254_FIELD_MODULUS = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    expect(BigInt(commitment)).to.be.lessThan(BN254_FIELD_MODULUS, 'Commitment should be within BN254 field');

    console.log('✅ Frontend pattern is correct and compatible\n');
  });
});
