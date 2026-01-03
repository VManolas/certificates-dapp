// frontend/src/lib/zkAuth.ts
/**
 * ZK Authentication Library for zkCredentials
 * ============================================
 * 
 * This library provides client-side cryptographic primitives for
 * privacy-preserving authentication using zero-knowledge proofs.
 * 
 * Key Features:
 * - Generate keypairs locally (never touch blockchain)
 * - Compute commitments for registration using Poseidon hash
 * - Encrypt/decrypt credentials with wallet signatures
 * - Generate ZK proofs for authentication using Noir
 * 
 * Security:
 * - Private keys stored encrypted in localStorage
 * - Encryption key derived from wallet signature
 * - No sensitive data leaves the browser unencrypted
 * 
 * Hash Function: Poseidon (matching Noir circuit, BN254-compatible)
 */

import { ethers } from 'ethers';
import { Noir } from '@noir-lang/noir_js';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import authCircuit from './circuits/auth_login.json';
// Import poseidon functions from subpath exports (named exports)
import { poseidon1 } from 'poseidon-lite/poseidon1';
import { poseidon3 } from 'poseidon-lite/poseidon3';

/**
 * User credentials stored locally (encrypted)
 */
export interface ZKCredentials {
  privateKey: string;
  salt: string;
  commitment: string;
  role: 'student' | 'university' | 'employer';
}

/**
 * Generate a secure random 256-bit key that fits within the BN254 field modulus
 * 
 * CRITICAL: The key must be less than the BN254 field modulus used by Noir
 * to ensure it can be used in ZK circuits.
 * 
 * @returns Hex-encoded private key (guaranteed to be < field modulus)
 */
export function generateRandomKey(): string {
  const BN254_FIELD_MODULUS = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
  
  // Generate random bytes
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  
  // Convert to BigInt
  let keyBigInt = BigInt(ethers.utils.hexlify(array));
  
  // If the key exceeds the field modulus, reduce it
  // This is safe because:
  // 1. The modulo operation preserves randomness
  // 2. The resulting key is still cryptographically secure
  // 3. The key space is still enormous (> 2^250 possible values)
  if (keyBigInt >= BN254_FIELD_MODULUS) {
    keyBigInt = keyBigInt % BN254_FIELD_MODULUS;
    console.log('[ZK Auth] Generated key exceeded field modulus, applied modulo reduction');
  }
  
  // Convert back to hex
  const keyHex = keyBigInt.toString(16);
  const result = '0x' + keyHex.padStart(64, '0');
  
  console.log('[ZK Auth] Generated random key within field bounds');
  
  return result;
}

/**
 * Helper function to convert hex string to Field-compatible string
 * Noir Field expects decimal string representation
 */
function hexToFieldString(hex: string): string {
  // Remove '0x' prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  // Convert to BigInt then to string
  return BigInt('0x' + cleanHex).toString(10);
}

/**
 * Helper function to convert Ethereum address to Field-compatible string
 */
function addressToFieldString(address: string): string {
  // Remove '0x' prefix and convert to BigInt
  const cleanAddr = address.startsWith('0x') ? address.slice(2) : address;
  return BigInt('0x' + cleanAddr).toString(10);
}

/**
 * Compute commitment from credentials using Poseidon hash
 * 
 * This matches the Noir circuit implementation exactly:
 * 1. public_key = poseidon_hash_1([private_key])
 * 2. commitment = poseidon_hash_3([public_key, wallet_address, salt])
 * 
 * Both JavaScript (poseidon-lite) and Noir (noir-lang/poseidon) use the same
 * Poseidon implementation compatible with BN254 curve.
 * 
 * @param privateKey User's private authentication key (hex string)
 * @param walletAddress User's blockchain wallet (hex string)
 * @param salt Random salt (hex string)
 * @returns Commitment (hex string)
 */
export async function computeCommitment(
  privateKey: string,
  walletAddress: string,
  salt: string
): Promise<string> {
  try {
    // Normalize wallet address to lowercase to ensure consistency
    const normalizedAddress = walletAddress.toLowerCase();
    
    console.log('[ZK Auth] Computing commitment using Poseidon hash...');
    console.log('[ZK Auth] Inputs (HEX):', {
      privateKey: privateKey,
      walletAddressOriginal: walletAddress,
      walletAddress: normalizedAddress,
      salt: salt
    });
    
    // Convert inputs to BigInt for Poseidon
    const privateKeyBigInt = BigInt(privateKey);
    const walletAddressBigInt = BigInt(normalizedAddress);
    const saltBigInt = BigInt(salt);
    
    console.log('[ZK Auth] BigInt inputs (DECIMAL):', {
      privateKey: privateKeyBigInt.toString(),
      wallet: walletAddressBigInt.toString(),
      salt: saltBigInt.toString()
    });
    
    // Step 1: Derive public key from private key using Poseidon single-input hash
    // Matches: let public_key = poseidon_hash_1([private_key]);
    const publicKeyBigInt = poseidon1([privateKeyBigInt]);
    console.log('[ZK Auth] Public key computed (DECIMAL):', publicKeyBigInt.toString());
    console.log('[ZK Auth] Public key computed (HEX):', '0x' + publicKeyBigInt.toString(16));
    
    // Step 2: Compute commitment from public key, wallet address, and salt
    // Matches: let commitment = poseidon_hash_3([public_key, wallet_address, salt]);
    const commitmentBigInt = poseidon3([publicKeyBigInt, walletAddressBigInt, saltBigInt]);
    console.log('[ZK Auth] Commitment computed (DECIMAL):', commitmentBigInt.toString());
    console.log('[ZK Auth] Commitment computed (HEX):', '0x' + commitmentBigInt.toString(16));
    
    // Convert to hex string with proper padding (32 bytes = 64 hex chars)
    const commitment = '0x' + commitmentBigInt.toString(16).padStart(64, '0');
    
    console.log('[ZK Auth] ✅ Final Commitment (Poseidon):', commitment);
    
    return commitment;
    
  } catch (error) {
    console.error('[ZK Auth] Failed to compute commitment:', error);
    throw new Error(`Failed to compute commitment: ${error}`);
  }
}

/**
 * Encrypt credentials with wallet signature
 * 
 * @param credentials Credentials to encrypt
 * @param signature Wallet signature for encryption key
 * @returns Encrypted hex string
 */
export async function encryptCredentials(
  credentials: ZKCredentials,
  signature: string
): Promise<string> {
  // Derive encryption key from signature
  const key = ethers.utils.keccak256(signature);
  
  // Simple XOR encryption (in production, use AES-GCM)
  const data = JSON.stringify(credentials);
  const encrypted = xorEncrypt(data, key);
  
  // Return as hex string (not UTF-8, since result is binary data)
  return ethers.utils.hexlify(encrypted);
}

/**
 * Decrypt credentials with wallet signature
 * 
 * @param encrypted Encrypted hex string
 * @param signature Wallet signature for decryption key
 * @returns Decrypted credentials
 */
export async function decryptCredentials(
  encrypted: string,
  signature: string
): Promise<ZKCredentials> {
  try {
    const key = ethers.utils.keccak256(signature);
    
    // Convert hex string back to bytes
    const encryptedBytes = ethers.utils.arrayify(encrypted);
    
    // XOR decrypt
    const decrypted = xorEncrypt(encryptedBytes, key);
    
    // Convert decrypted bytes to string and parse JSON
    const decryptedString = ethers.utils.toUtf8String(decrypted);
    
    return JSON.parse(decryptedString);
  } catch (error) {
    // If decryption fails, credentials might be from old format or wrong wallet
    // Silently clear them - this is expected during version upgrades or wallet switches
    console.info('[ZK Auth] Clearing outdated or incompatible stored credentials (this is normal after updates)');
    clearStoredCredentials();
    // Don't throw - just return null to indicate no valid credentials
    throw new Error('CREDENTIALS_OUTDATED');
  }
}

/**
 * Simple XOR encryption (for demo - use AES in production)
 * Works with byte arrays to avoid UTF-8 encoding issues
 */
function xorEncrypt(data: string | Uint8Array, key: string): Uint8Array {
  const keyBytes = ethers.utils.arrayify(key);
  const dataBytes = typeof data === 'string' ? ethers.utils.toUtf8Bytes(data) : data;
  const result = new Uint8Array(dataBytes.length);
  
  for (let i = 0; i < dataBytes.length; i++) {
    result[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return result;
}

/**
 * Generate ZK proof for authentication using Noir circuit
 * 
 * This function generates a cryptographic proof that the user knows the privateKey,
 * walletAddress, and salt that produce the given commitment, without revealing them.
 * 
 * The proof is generated using the Barretenberg backend and matches the circuit's
 * Pedersen hash implementation.
 * 
 * @param credentials User credentials
 * @param walletAddress Current wallet address
 * @returns ZK proof (hex-encoded bytes)
 */
export async function generateAuthProof(
  credentials: ZKCredentials,
  walletAddress: string
): Promise<string> {
  try {
    // CRITICAL: Normalize wallet address to lowercase to match commitment computation
    // This MUST match the normalization in computeCommitment()
    const normalizedAddress = walletAddress.toLowerCase();
    
    console.log('[ZK Auth] ==========================================');
    console.log('[ZK Auth] Generating proof...');
    console.log('[ZK Auth] Wallet (original):', walletAddress);
    console.log('[ZK Auth] Wallet (normalized):', normalizedAddress);
    console.log('[ZK Auth] ==========================================');
    
    // Initialize the Barretenberg backend
    const backend = new BarretenbergBackend(authCircuit as any);
    
    // Initialize Noir with the circuit
    const noir = new Noir(authCircuit as any);
    
    // Prepare inputs for the circuit
    // Convert all inputs to Field-compatible format (decimal strings)
    // IMPORTANT: Use normalized address to match commitment
    const inputs = {
      private_key: hexToFieldString(credentials.privateKey),
      wallet_address: addressToFieldString(normalizedAddress),
      salt: hexToFieldString(credentials.salt),
      commitment: hexToFieldString(credentials.commitment)
    };
    
    console.log('[ZK Auth] ==========================================');
    console.log('[ZK Auth] Circuit inputs (DECIMAL STRINGS):');
    console.log('[ZK Auth]   private_key:', inputs.private_key);
    console.log('[ZK Auth]   wallet_address:', inputs.wallet_address);
    console.log('[ZK Auth]   salt:', inputs.salt);
    console.log('[ZK Auth]   commitment:', inputs.commitment);
    console.log('[ZK Auth] ==========================================');
    console.log('[ZK Auth] Circuit inputs (converted back to HEX for verification):');
    console.log('[ZK Auth]   private_key:', '0x' + BigInt(inputs.private_key).toString(16));
    console.log('[ZK Auth]   wallet_address:', '0x' + BigInt(inputs.wallet_address).toString(16));
    console.log('[ZK Auth]   salt:', '0x' + BigInt(inputs.salt).toString(16));
    console.log('[ZK Auth]   commitment:', '0x' + BigInt(inputs.commitment).toString(16));
    console.log('[ZK Auth] ==========================================');
    console.log('[ZK Auth] Generating proof (this may take a few seconds)...');
    
    // Generate the witness
    const { witness } = await noir.execute(inputs);
    
    console.log('[ZK Auth] Witness generated, creating proof...');
    
    // Generate the proof using the backend
    const proof = await backend.generateProof(witness);
    
    console.log('[ZK Auth] Proof generated successfully!');
    console.log('[ZK Auth] Proof length:', proof.proof.length);
    
    // Convert proof to hex string for contract submission
    const proofHex = ethers.utils.hexlify(proof.proof);
    
    // Cleanup
    await backend.destroy();
    
    return proofHex;
    
  } catch (error) {
    console.error('[ZK Auth] Proof generation failed:', error);
    
    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('assertion') || error.message.includes('constraint')) {
        throw new Error(
          'Proof generation failed: Commitment mismatch. ' +
          'The commitment computed in the circuit does not match the provided commitment. ' +
          'This could indicate a hash function mismatch, corrupted credentials, or wallet address mismatch. ' +
          'Try clearing your credentials and registering again.'
        );
      }
    }
    
    throw new Error(`Failed to generate ZK proof: ${error}`);
  }
}

/**
 * Local storage key for encrypted credentials
 */
const STORAGE_KEY = 'zkauth_encrypted_credentials';

/**
 * Store encrypted credentials in localStorage
 */
export function storeCredentials(encrypted: string): void {
  localStorage.setItem(STORAGE_KEY, encrypted);
}

/**
 * Retrieve encrypted credentials from localStorage
 */
export function getStoredCredentials(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Clear stored credentials (logout)
 */
export function clearStoredCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if user has stored credentials
 */
export function hasStoredCredentials(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}
