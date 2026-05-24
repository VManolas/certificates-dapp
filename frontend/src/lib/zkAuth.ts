// frontend/src/lib/zkAuth.ts
/**
 * ZK Authentication Library for zkCredentials
 * ============================================
 *
 * Provides client-side cryptographic primitives for privacy-preserving
 * authentication using zero-knowledge proofs (Groth16/circom).
 *
 * Hash Function: Poseidon (BN254-compatible, matches circom circuit)
 * Proof System:  Groth16 (snarkjs, EVM-compatible including zkSync Era)
 */

import { encodeAbiParameters } from 'viem';
import { buildPoseidon } from 'circomlibjs';
import { logger } from './logger';

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
 * Poseidon hash instance (cached at module level)
 */
let poseidonInstance: any = null;

async function getPoseidon() {
  if (!poseidonInstance) {
    logger.debug('[ZK Auth] Initializing Poseidon hasher (circomlibjs)...');
    poseidonInstance = await buildPoseidon();
    logger.debug('[ZK Auth] ✅ Poseidon hasher initialized');
  }
  return poseidonInstance;
}

/**
 * Generate a secure random 256-bit key within the BN254 field modulus.
 */
export function generateRandomKey(): string {
  const BN254_FIELD_MODULUS = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  let keyBigInt = BigInt('0x' + Array.from(array).map(b => b.toString(16).padStart(2, '0')).join(''));

  if (keyBigInt >= BN254_FIELD_MODULUS) {
    keyBigInt = keyBigInt % BN254_FIELD_MODULUS;
  }

  return '0x' + keyBigInt.toString(16).padStart(64, '0');
}

/**
 * Compute commitment from credentials using Poseidon hash.
 *
 * Matches the circom circuit:
 *   publicKey  = Poseidon(privateKey)
 *   commitment = Poseidon(publicKey, walletAddress, salt)
 */
export async function computeCommitment(
  privateKey: string,
  walletAddress: string,
  salt: string
): Promise<string> {
  try {
    const poseidon = await getPoseidon();
    const normalizedAddress = walletAddress.toLowerCase();

    logger.debug('[ZK Auth] Computing commitment using Poseidon hash...', {
      walletAddress: normalizedAddress,
    });

    const privateKeyBigInt = BigInt(privateKey);
    const walletAddressBigInt = BigInt(normalizedAddress);
    const saltBigInt = BigInt(salt);

    const publicKeyField = poseidon([privateKeyBigInt]);
    const publicKeyBigInt = BigInt(poseidon.F.toString(publicKeyField));

    const commitmentField = poseidon([publicKeyBigInt, walletAddressBigInt, saltBigInt]);
    const commitmentBigInt = BigInt(poseidon.F.toString(commitmentField));

    const commitmentHex = '0x' + commitmentBigInt.toString(16).padStart(64, '0');
    logger.info('[ZK Auth] ✅ Commitment computed', { commitmentHex });
    return commitmentHex;
  } catch (error) {
    logger.error('[ZK Auth] Failed to compute commitment', error);
    throw new Error(`Failed to compute commitment: ${error}`);
  }
}

/**
 * Derive an AES-GCM CryptoKey from the wallet address.
 */
async function deriveAesKey(walletAddress: string): Promise<CryptoKey> {
  const keyMaterial = new TextEncoder().encode(
    `zkcredentials:zkauth:v3:${walletAddress.toLowerCase()}`
  );
  const rawKey = await crypto.subtle.digest('SHA-256', keyMaterial);
  return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Encrypt credentials with AES-GCM (256-bit key, 96-bit IV).
 * Stored format: "v3:<base64(12-byte IV || ciphertext+tag)>"
 */
export async function encryptCredentials(
  credentials: ZKCredentials,
  _signature: string,
  walletAddress: string
): Promise<string> {
  const key = await deriveAesKey(walletAddress);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(credentials));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  return 'v3:' + uint8ToBase64(combined);
}

/**
 * Decrypt credentials encrypted by encryptCredentials.
 * Legacy values without the "v3:" prefix are cleared and treated as outdated.
 */
export async function decryptCredentials(
  encrypted: string,
  _signature: string,
  walletAddress: string
): Promise<ZKCredentials> {
  try {
    if (!encrypted.startsWith('v3:')) {
      clearStoredCredentials(walletAddress);
      throw new Error('CREDENTIALS_OUTDATED');
    }

    const combined = base64ToUint8(encrypted.slice(3));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const key = await deriveAesKey(walletAddress);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch (error) {
    if (error instanceof Error && error.message === 'CREDENTIALS_OUTDATED') throw error;
    logger.info('[ZK Auth] Clearing outdated or incompatible stored credentials (this is normal after updates)');
    clearStoredCredentials(walletAddress);
    throw new Error('CREDENTIALS_OUTDATED');
  }
}

export interface AuthProofResult {
  proof: string;
  nullifier: string;
  nullifierNonce: string;
}

/**
 * Generate a Groth16 ZK proof for authentication.
 *
 * Public inputs: [commitment, nullifierNonce, nullifier]
 * Proof encoding: abi.encode(uint[2] pA, uint[2][2] pB, uint[2] pC) = 256 bytes
 *
 * A fresh nullifierNonce is generated per call so each session yields a
 * distinct nullifier. The contract stores used nullifiers to prevent replay.
 */
export async function generateAuthProof(
  credentials: ZKCredentials,
  walletAddress: string
): Promise<AuthProofResult> {
  try {
    const normalizedAddress = walletAddress.toLowerCase();
    logger.debug('[ZK Auth] Generating Groth16 proof', { walletNormalized: normalizedAddress });

    // Fresh nonce for this session
    const nullifierNonceHex = generateRandomKey();
    const nullifierNonceBigInt = BigInt(nullifierNonceHex);

    // Compute nullifier client-side using Poseidon (must match circuit)
    const poseidon = await getPoseidon();
    const privateKeyBigInt = BigInt(credentials.privateKey);
    const nullifierField = poseidon([privateKeyBigInt, nullifierNonceBigInt]);
    const nullifierBigInt = BigInt(poseidon.F.toString(nullifierField));
    const nullifierHex = '0x' + nullifierBigInt.toString(16).padStart(64, '0');

    // Circuit inputs (decimal strings — circom field elements)
    const input = {
      privateKey:    privateKeyBigInt.toString(),
      walletAddress: BigInt(normalizedAddress).toString(),
      salt:          BigInt(credentials.salt).toString(),
      commitment:    BigInt(credentials.commitment).toString(),
      nullifierNonce: nullifierNonceBigInt.toString(),
      nullifier:     nullifierBigInt.toString(),
    };

    logger.info('[ZK Auth] Generating Groth16 proof (this may take a few seconds)...');

    // Circuit artifacts served from public/circuits/
    const base = import.meta.env.BASE_URL ?? '/';
    const wasmUrl = `${base}circuits/auth_login.wasm`;
    const zkeyUrl = `${base}circuits/auth_login_final.zkey`;

    // Dynamic import keeps snarkjs out of the initial bundle
    const snarkjs = await import('snarkjs');
    const { proof } = await snarkjs.groth16.fullProve(input, wasmUrl, zkeyUrl);

    logger.info('[ZK Auth] Proof generated successfully!');

    // ABI-encode as abi.encode(uint[2] pA, uint[2][2] pB, uint[2] pC)
    // pB coordinates are stored reversed in snarkjs output vs Solidity convention
    const pA: readonly [bigint, bigint] = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
    const pB: readonly [readonly [bigint, bigint], readonly [bigint, bigint]] = [
      [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
      [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
    ];
    const pC: readonly [bigint, bigint] = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];

    const proofHex = encodeAbiParameters(
      [
        { type: 'uint256[2]' },
        { type: 'uint256[2][2]' },
        { type: 'uint256[2]' },
      ],
      [pA, pB, pC]
    );

    logger.debug('[ZK Auth] Proof ABI-encoded', { proofBytes: (proofHex.length - 2) / 2 });

    return { proof: proofHex, nullifier: nullifierHex, nullifierNonce: nullifierNonceHex };

  } catch (error) {
    logger.error('[ZK Auth] Proof generation failed', error);

    if (error instanceof Error) {
      if (error.message.includes('assertion') || error.message.includes('constraint')) {
        throw new Error(
          'Proof generation failed: Commitment mismatch. ' +
          'The commitment in the circuit does not match the registered commitment. ' +
          'Try clearing your credentials and registering again.'
        );
      }
    }

    throw new Error(`Failed to generate ZK proof: ${error}`);
  }
}

const LEGACY_STORAGE_KEY = 'zkauth_encrypted_credentials';
const STORAGE_KEY_PREFIX = 'zkauth_encrypted_credentials_v2_';

function getStorageKey(walletAddress: string): string {
  return `${STORAGE_KEY_PREFIX}${walletAddress.toLowerCase()}`;
}

export function storeCredentials(encrypted: string, walletAddress: string): void {
  localStorage.setItem(getStorageKey(walletAddress), encrypted);
}

export function getStoredCredentials(walletAddress: string): string | null {
  return localStorage.getItem(getStorageKey(walletAddress));
}

export function clearStoredCredentials(walletAddress?: string): void {
  if (walletAddress) {
    localStorage.removeItem(getStorageKey(walletAddress));
    return;
  }
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export function hasStoredCredentials(walletAddress?: string | null): boolean {
  if (!walletAddress) return false;
  return localStorage.getItem(getStorageKey(walletAddress)) !== null;
}
