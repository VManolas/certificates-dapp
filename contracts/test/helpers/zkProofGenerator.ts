// test/helpers/zkProofGenerator.ts
/**
 * ZK Proof Generation Helper for Tests
 * =====================================
 * 
 * This helper generates real ZK proofs for testing the authentication circuit.
 * It uses NoirJS and @aztec/bb.js (UltraPlonk backend) to create valid proofs
 * that can be verified by the UltraPlonkAuthVerifier contract.
 * 
 * Note: For Noir 1.0.0+, use @aztec/bb.js UltraPlonkBackend instead of deprecated @noir-lang/backend_barretenberg
 * 
 * Usage in tests:
 * ```typescript
 * import { generateAuthProof, computeCommitment } from './helpers/zkProofGenerator';
 * 
 * const privateKey = BigInt("12345678901234567890");
 * const walletAddress = await user.getAddress();
 * const salt = BigInt("98765432109876543210");
 * 
 * const commitment = computeCommitment(privateKey, walletAddress, salt);
 * const proof = await generateAuthProof(privateKey, walletAddress, salt, commitment);
 * ```
 */

import { Noir } from '@noir-lang/noir_js';
import { UltraPlonkBackend } from '@aztec/bb.js';
import { buildPoseidon } from 'circomlibjs';
import * as fs from 'fs';
import * as path from 'path';

// Load the compiled circuit
const circuitPath = path.join(__dirname, '../../circuits/auth_login/target/auth_login.json');
const authCircuit = JSON.parse(fs.readFileSync(circuitPath, 'utf-8'));

// Poseidon instance (initialized lazily)
let poseidonInstance: any = null;

/**
 * Initialize Poseidon hasher (circomlibjs)
 * This matches the Poseidon implementation used in the Noir circuit
 */
async function getPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }
  return poseidonInstance;
}

/**
 * Compute commitment from private key, wallet address, and salt
 * This matches the circuit's commitment computation:
 * commitment = poseidon_hash_3([public_key, wallet_address, salt])
 * where public_key = poseidon_hash_1([private_key])
 * 
 * @param privateKey - User's private authentication key
 * @param walletAddress - User's blockchain wallet address (as string)
 * @param salt - Random salt for uniqueness
 * @returns Commitment as hex string
 */
export async function computeCommitment(
  privateKey: bigint,
  walletAddress: string,
  salt: bigint
): Promise<string> {
  const poseidon = await getPoseidon();
  
  // Normalize wallet address (remove 0x, convert to lowercase)
  const normalizedAddress = walletAddress.toLowerCase().replace('0x', '');
  const walletAddressBigInt = BigInt('0x' + normalizedAddress);
  
  // Step 1: Derive public key from private key
  const publicKey = poseidon.F.toString(poseidon([privateKey]));
  
  // Step 2: Compute commitment
  const commitment = poseidon.F.toString(poseidon([
    BigInt(publicKey),
    walletAddressBigInt,
    salt
  ]));
  
  // Convert to hex with proper padding
  const commitmentHex = '0x' + BigInt(commitment).toString(16).padStart(64, '0');
  
  console.log('[Test Helper] Commitment computed:', {
    privateKey: privateKey.toString(),
    walletAddress: walletAddress,
    walletAddressBigInt: walletAddressBigInt.toString(),
    salt: salt.toString(),
    publicKey: publicKey,
    commitment: commitmentHex
  });
  
  return commitmentHex;
}

export interface AuthProofResult {
  proof: string;
  nullifier: string;
  nullifierNonce: string; // hex string (bytes32-compatible)
}

/**
 * Generate a ZK proof for authentication
 *
 * Returns the proof bytes AND the nullifier/nonce so callers can pass them to
 * the contract's registerCommitment / startSession functions.
 *
 * @param privateKey  - User's private authentication key
 * @param walletAddress - User's blockchain wallet address
 * @param salt        - Random salt
 * @param commitment  - Public commitment (hex string)
 * @param nullifierNonceSeed - Optional nonce; a random one is generated if omitted
 */
export async function generateAuthProof(
  privateKey: bigint,
  walletAddress: string,
  salt: bigint,
  commitment: string,
  nullifierNonceSeed?: bigint
): Promise<AuthProofResult> {
  console.log('[Test Helper] Generating ZK proof...');

  const poseidon = await getPoseidon();

  const normalizedAddress = walletAddress.toLowerCase().replace('0x', '');
  const walletAddressBigInt = BigInt('0x' + normalizedAddress);
  const commitmentBigInt = BigInt(commitment);

  // Generate or use provided nonce
  const BN254 = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
  const nullifierNonce = nullifierNonceSeed !== undefined
    ? nullifierNonceSeed
    : BigInt('0x' + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')) % BN254;

  // Compute nullifier: Poseidon(privateKey, nullifierNonce)
  const nullifierField = poseidon([privateKey, nullifierNonce]);
  const nullifierBigInt = BigInt(poseidon.F.toString(nullifierField));
  const nullifierHex = '0x' + nullifierBigInt.toString(16).padStart(64, '0');

  const inputs = {
    private_key:     privateKey.toString(),
    wallet_address:  walletAddressBigInt.toString(),
    salt:            salt.toString(),
    commitment:      commitmentBigInt.toString(),
    nullifier_nonce: nullifierNonce.toString(),
    nullifier:       nullifierBigInt.toString(),
  };

  console.log('[Test Helper] Circuit inputs (non-secret):', {
    commitment: inputs.commitment,
    nullifier_nonce: inputs.nullifier_nonce.slice(0, 10) + '...',
    nullifier: inputs.nullifier.slice(0, 10) + '...',
  });

  const backend = new UltraPlonkBackend(authCircuit.bytecode);

  try {
    console.log('[Test Helper] Generating proof with Noir...');

    const noir = new Noir(authCircuit as any);
    const { witness } = await noir.execute(inputs);
    console.log('[Test Helper] Witness generated, creating proof...');

    const proof = await backend.generateProof(witness);
    console.log('[Test Helper] Proof generated successfully!');

    const proofBytes = proof.proof instanceof Uint8Array ? proof.proof : proof;
    console.log('[Test Helper] Proof length:', proofBytes.length);

    const proofHex = '0x' + Buffer.from(proofBytes).toString('hex');
    const nullifierNonceHex = '0x' + nullifierNonce.toString(16).padStart(64, '0');
    await backend.destroy();

    return { proof: proofHex, nullifier: nullifierHex, nullifierNonce: nullifierNonceHex };
  } catch (error) {
    console.error('[Test Helper] Proof generation failed:', error);
    await backend.destroy();
    throw error;
  }
}

/**
 * Generate random test credentials
 * Useful for creating unique test data
 * 
 * @returns Object with privateKey and salt
 */
export function generateRandomCredentials(): { privateKey: bigint; salt: bigint } {
  // Generate random 32-byte values
  const privateKey = BigInt('0x' + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')) % BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
  const salt = BigInt('0x' + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')) % BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
  
  return { privateKey, salt };
}

/**
 * Verify a proof locally (for debugging)
 *
 * @param proof          - Proof hex string
 * @param commitment     - Public commitment hex string
 * @param nullifierNonce - Nonce used when generating the proof (bigint)
 * @param nullifier      - Nullifier hex string
 */
export async function verifyProofLocally(
  proof: string,
  commitment: string,
  nullifierNonce: string, // hex string
  nullifier: string
): Promise<boolean> {
  console.log('[Test Helper] Verifying proof locally...');

  const backend = new UltraPlonkBackend(authCircuit.bytecode);

  try {
    const proofBytes = Uint8Array.from(Buffer.from(proof.replace('0x', ''), 'hex'));

    const isValid = await backend.verifyProof({
      proof: proofBytes,
      publicInputs: [
        commitment.replace('0x', ''),
        nullifierNonce.replace('0x', '').padStart(64, '0'),
        nullifier.replace('0x', ''),
      ],
    });

    console.log('[Test Helper] Proof verification result:', isValid);
    await backend.destroy();
    return isValid;
  } catch (error) {
    console.error('[Test Helper] Proof verification failed:', error);
    await backend.destroy();
    return false;
  }
}
