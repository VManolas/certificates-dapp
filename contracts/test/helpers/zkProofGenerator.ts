// test/helpers/zkProofGenerator.ts
/**
 * ZK Proof Generation Helper for Tests
 * =====================================
 * 
 * This helper generates real ZK proofs for testing the authentication circuit.
 * It uses NoirJS and Barretenberg to create valid proofs that can be verified
 * by the UltraPlonkAuthVerifier contract.
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
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
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

/**
 * Generate a ZK proof for authentication
 * 
 * @param privateKey - User's private authentication key
 * @param walletAddress - User's blockchain wallet address (as string)
 * @param salt - Random salt
 * @param commitment - Public commitment to verify against
 * @returns Proof as hex string
 */
export async function generateAuthProof(
  privateKey: bigint,
  walletAddress: string,
  salt: bigint,
  commitment: string
): Promise<string> {
  console.log('[Test Helper] Generating ZK proof...');
  
  // Normalize wallet address
  const normalizedAddress = walletAddress.toLowerCase().replace('0x', '');
  const walletAddressBigInt = BigInt('0x' + normalizedAddress);
  
  // Remove 0x prefix from commitment
  const commitmentBigInt = BigInt(commitment);
  
  // Prepare circuit inputs (all as decimal strings)
  const inputs = {
    private_key: privateKey.toString(),
    wallet_address: walletAddressBigInt.toString(),
    salt: salt.toString(),
    commitment: commitmentBigInt.toString()
  };
  
  console.log('[Test Helper] Circuit inputs:', inputs);
  
  // Initialize backend - pass the circuit artifact directly
  const backend = new BarretenbergBackend(authCircuit as any);
  const noir = new Noir(authCircuit as any, backend);
  
  try {
    // Generate proof - NoirJS v1.0.0-beta.0 API
    console.log('[Test Helper] Generating proof with Noir...');
    
    // Execute the circuit to get witness
    const { witness } = await noir.execute(inputs);
    console.log('[Test Helper] Witness generated, creating proof...');
    
    // Generate proof from witness
    const proof = await backend.generateProof(witness);
    
    console.log('[Test Helper] Proof generated successfully!');
    console.log('[Test Helper] Proof length:', proof.proof.length);
    
    // Convert to hex string
    const proofHex = '0x' + Buffer.from(proof.proof).toString('hex');
    
    // Cleanup
    await backend.destroy();
    
    return proofHex;
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
 * @param proof - Proof to verify (hex string)
 * @param commitment - Public commitment (hex string)
 * @returns True if proof is valid
 */
export async function verifyProofLocally(
  proof: string,
  commitment: string
): Promise<boolean> {
  console.log('[Test Helper] Verifying proof locally...');
  
  const backend = new BarretenbergBackend(authCircuit as any);
  const noir = new Noir(authCircuit as any, backend);
  
  try {
    // Convert hex proof to Uint8Array
    const proofBytes = Uint8Array.from(
      Buffer.from(proof.replace('0x', ''), 'hex')
    );
    
    // Verify proof
    const isValid = await noir.verifyProof({
      proof: proofBytes,
      publicInputs: [commitment.replace('0x', '')]
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
