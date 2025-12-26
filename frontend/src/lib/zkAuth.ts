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
 * - Compute commitments for registration
 * - Encrypt/decrypt credentials with wallet signatures
 * - Generate ZK proofs for authentication
 * 
 * Security:
 * - Private keys stored encrypted in localStorage
 * - Encryption key derived from wallet signature
 * - No sensitive data leaves the browser unencrypted
 */

import { ethers } from 'ethers';

/**
 * User credentials stored locally (encrypted)
 */
export interface ZKCredentials {
  privateKey: string;
  salt: string;
  commitment: string;
}

/**
 * Generate a secure random 256-bit key
 * @returns Hex-encoded private key
 */
export function generateRandomKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return ethers.hexlify(array);
}

/**
 * Compute commitment from credentials
 * 
 * commitment = hash(hash(privateKey), walletAddress, salt)
 * 
 * @param privateKey User's private authentication key
 * @param walletAddress User's blockchain wallet
 * @param salt Random salt
 * @returns Commitment (bytes32)
 */
export async function computeCommitment(
  privateKey: string,
  walletAddress: string,
  salt: string
): Promise<string> {
  // Step 1: Derive public key from private key
  const publicKey = ethers.keccak256(privateKey);
  
  // Step 2: Hash with wallet and salt
  const commitment = ethers.keccak256(
    ethers.solidityPacked(
      ['bytes32', 'address', 'bytes32'],
      [publicKey, walletAddress, salt]
    )
  );
  
  return commitment;
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
  const key = ethers.keccak256(signature);
  
  // Simple XOR encryption (in production, use AES-GCM)
  const data = JSON.stringify(credentials);
  const encrypted = xorEncrypt(data, key);
  
  // Return as hex string (not UTF-8, since result is binary data)
  return ethers.hexlify(encrypted);
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
    const key = ethers.keccak256(signature);
    
    // Convert hex string back to bytes
    const encryptedBytes = ethers.getBytes(encrypted);
    
    // XOR decrypt
    const decrypted = xorEncrypt(encryptedBytes, key);
    
    // Convert decrypted bytes to string and parse JSON
    const decryptedString = ethers.toUtf8String(decrypted);
    
    return JSON.parse(decryptedString);
  } catch (error) {
    // If decryption fails, credentials might be from old format
    // Clear them and ask user to re-register
    console.error('Failed to decrypt credentials:', error);
    clearStoredCredentials();
    throw new Error('Stored credentials are corrupted or from an old version. Please clear credentials and register again.');
  }
}

/**
 * Simple XOR encryption (for demo - use AES in production)
 * Works with byte arrays to avoid UTF-8 encoding issues
 */
function xorEncrypt(data: string | Uint8Array, key: string): Uint8Array {
  const keyBytes = ethers.getBytes(key);
  const dataBytes = typeof data === 'string' ? ethers.toUtf8Bytes(data) : data;
  const result = new Uint8Array(dataBytes.length);
  
  for (let i = 0; i < dataBytes.length; i++) {
    result[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return result;
}

/**
 * Generate ZK proof for authentication
 * 
 * NOTE: In production, this will use @noir-lang/noir_js to generate
 * actual ZK-SNARK proofs. For now, it returns a mock proof.
 * 
 * @param credentials User credentials
 * @returns ZK proof (bytes)
 */
export async function generateAuthProof(
  credentials: ZKCredentials
): Promise<string> {
  // TODO: Replace with real Noir proof generation
  // const { proof } = await generateProof({
  //   circuit: auth_login,
  //   inputs: {
  //     privateKey: credentials.privateKey,
  //     walletAddress: await getWalletAddress(),
  //     salt: credentials.salt,
  //     commitment: credentials.commitment,
  //   },
  // });
  
  // For now, return mock proof
  const mockProof = ethers.keccak256(
    ethers.solidityPacked(
      ['bytes32', 'bytes32', 'bytes32'],
      [credentials.privateKey, credentials.salt, credentials.commitment]
    )
  );
  
  return mockProof;
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

