// src/lib/__tests__/zkAuth.test.ts
/**
 * Tests for the pure / localStorage functions in zkAuth.ts.
 * The heavy crypto functions (computeCommitment, generateAuthProof) depend on
 * circomlibjs (Poseidon), Noir, and @aztec/bb.js which are not available in
 * jsdom. Those are integration-tested by the useZKAuth hook tests via mocks.
 *
 * This file covers:
 *  - generateRandomKey        (uses Web Crypto + ethers utils)
 *  - encryptCredentials +
 *    decryptCredentials        (XOR roundtrip, ethers utils)
 *  - storeCredentials          (localStorage write)
 *  - getStoredCredentials      (localStorage read)
 *  - clearStoredCredentials    (localStorage remove, with + without address)
 *  - hasStoredCredentials      (boolean localStorage check)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Heavy dependency mocks (must come before the import) ─────────────────────

vi.mock('@noir-lang/noir_js', () => ({ Noir: vi.fn() }));
vi.mock('@aztec/bb.js', () => ({ UltraPlonkBackend: vi.fn() }));
vi.mock('circomlibjs', () => ({ buildPoseidon: vi.fn(async () => ({})) }));
vi.mock('@/lib/circuits/auth_login.json', () => ({ default: { bytecode: '' }, bytecode: '' }));

// Minimal ethers mock — only the utils actually called by the tested functions
vi.mock('ethers', () => {
  const toUtf8Bytes = (str: string) => new TextEncoder().encode(str);
  const arrayify = (hex: string) => {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  };
  const hexlify = (bytes: Uint8Array | number[]) =>
    '0x' +
    Array.from(typeof bytes === 'object' && !ArrayBuffer.isView(bytes) ? new Uint8Array(bytes as number[]) : bytes as Uint8Array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  const keccak256 = (_bytes: Uint8Array) => '0x' + 'ab'.repeat(32);
  const toUtf8String = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

  return {
    ethers: {
      utils: { toUtf8Bytes, arrayify, hexlify, keccak256, toUtf8String },
    },
  };
});

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import {
  clearStoredCredentials,
  decryptCredentials,
  encryptCredentials,
  generateRandomKey,
  getStoredCredentials,
  hasStoredCredentials,
  storeCredentials,
  type ZKCredentials,
} from '@/lib/zkAuth';

// ─── Constants ────────────────────────────────────────────────────────────────

const WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const WALLET_LOWER = WALLET.toLowerCase();
const STORAGE_KEY = `zkauth_encrypted_credentials_v2_${WALLET_LOWER}`;
const LEGACY_KEY = 'zkauth_encrypted_credentials';

const SAMPLE_CREDENTIALS: ZKCredentials = {
  privateKey: '0x' + 'a1'.repeat(32),
  salt: '0x' + 'b2'.repeat(32),
  commitment: '0x' + 'c3'.repeat(32),
  role: 'student',
};

describe('zkAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── generateRandomKey ───────────────────────────────────────────────────

  describe('generateRandomKey', () => {
    it('returns a string starting with 0x', () => {
      const key = generateRandomKey();
      expect(key.startsWith('0x')).toBe(true);
    });

    it('returns a 66-character string (0x + 64 hex chars)', () => {
      const key = generateRandomKey();
      expect(key).toHaveLength(66);
    });

    it('returns only valid hex characters after the 0x prefix', () => {
      const key = generateRandomKey();
      expect(/^0x[0-9a-fA-F]{64}$/.test(key)).toBe(true);
    });

    it('generates different keys on successive calls', () => {
      const keys = new Set(Array.from({ length: 5 }, () => generateRandomKey()));
      expect(keys.size).toBeGreaterThan(1);
    });

    it('produces a key within the BN254 field (less than modulus)', () => {
      const BN254 = BigInt(
        '21888242871839275222246405745257275088548364400416034343698204186575808495617',
      );
      const key = generateRandomKey();
      const keyBigInt = BigInt(key);
      expect(keyBigInt < BN254).toBe(true);
    });
  });

  // ─── encrypt / decrypt roundtrip ─────────────────────────────────────────

  describe('encryptCredentials + decryptCredentials', () => {
    it('roundtrips credentials correctly', async () => {
      const encrypted = await encryptCredentials(SAMPLE_CREDENTIALS, 'sig', WALLET);
      expect(typeof encrypted).toBe('string');
      expect(encrypted.startsWith('0x')).toBe(true);

      const decrypted = await decryptCredentials(encrypted, 'sig', WALLET);
      expect(decrypted.privateKey).toBe(SAMPLE_CREDENTIALS.privateKey);
      expect(decrypted.salt).toBe(SAMPLE_CREDENTIALS.salt);
      expect(decrypted.commitment).toBe(SAMPLE_CREDENTIALS.commitment);
      expect(decrypted.role).toBe(SAMPLE_CREDENTIALS.role);
    });

    it('encryption is deterministic for the same wallet (same derived key)', async () => {
      const enc1 = await encryptCredentials(SAMPLE_CREDENTIALS, 'sig1', WALLET);
      const enc2 = await encryptCredentials(SAMPLE_CREDENTIALS, 'sig2', WALLET);
      // The XOR key is derived from wallet address, not signature → same result
      expect(enc1).toBe(enc2);
    });

    it('decryptCredentials throws CREDENTIALS_OUTDATED for tampered ciphertext', async () => {
      await expect(
        decryptCredentials('0xdeadbeef', 'sig', WALLET)
      ).rejects.toThrow('CREDENTIALS_OUTDATED');
    });
  });

  // ─── storeCredentials / getStoredCredentials ─────────────────────────────

  describe('storeCredentials', () => {
    it('saves the encrypted string in localStorage under a wallet-scoped key', () => {
      storeCredentials('0xencrypted', WALLET);
      expect(localStorage.getItem(STORAGE_KEY)).toBe('0xencrypted');
    });

    it('normalises the wallet address to lowercase in the storage key', () => {
      storeCredentials('0xdata', WALLET.toUpperCase());
      expect(localStorage.getItem(STORAGE_KEY)).toBe('0xdata');
    });
  });

  describe('getStoredCredentials', () => {
    it('returns the stored string for a known wallet', () => {
      localStorage.setItem(STORAGE_KEY, '0xstored');
      expect(getStoredCredentials(WALLET)).toBe('0xstored');
    });

    it('returns null for a wallet with no stored credentials', () => {
      expect(getStoredCredentials(WALLET)).toBeNull();
    });

    it('is case-insensitive on the wallet address', () => {
      localStorage.setItem(STORAGE_KEY, '0xstored');
      expect(getStoredCredentials(WALLET.toUpperCase())).toBe('0xstored');
    });
  });

  // ─── clearStoredCredentials ───────────────────────────────────────────────

  describe('clearStoredCredentials', () => {
    it('removes the wallet-scoped key when a wallet address is provided', () => {
      localStorage.setItem(STORAGE_KEY, '0xstored');
      clearStoredCredentials(WALLET);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('does not remove other wallets\' credentials', () => {
      const otherKey = `zkauth_encrypted_credentials_v2_0x${'0'.repeat(40)}`;
      localStorage.setItem(STORAGE_KEY, '0xA');
      localStorage.setItem(otherKey, '0xB');
      clearStoredCredentials(WALLET);
      expect(localStorage.getItem(otherKey)).toBe('0xB');
    });

    it('removes the legacy key when no wallet address is provided', () => {
      localStorage.setItem(LEGACY_KEY, '0xlegacy');
      clearStoredCredentials();
      expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    });

    it('does not throw when there is nothing to clear', () => {
      expect(() => clearStoredCredentials(WALLET)).not.toThrow();
      expect(() => clearStoredCredentials()).not.toThrow();
    });
  });

  // ─── hasStoredCredentials ─────────────────────────────────────────────────

  describe('hasStoredCredentials', () => {
    it('returns true when credentials are stored for the wallet', () => {
      localStorage.setItem(STORAGE_KEY, '0xencrypted');
      expect(hasStoredCredentials(WALLET)).toBe(true);
    });

    it('returns false when no credentials are stored', () => {
      expect(hasStoredCredentials(WALLET)).toBe(false);
    });

    it('returns false when walletAddress is null', () => {
      localStorage.setItem(STORAGE_KEY, '0xencrypted');
      expect(hasStoredCredentials(null)).toBe(false);
    });

    it('returns false when walletAddress is undefined', () => {
      expect(hasStoredCredentials(undefined)).toBe(false);
    });

    it('is case-insensitive on wallet address', () => {
      localStorage.setItem(STORAGE_KEY, '0xencrypted');
      expect(hasStoredCredentials(WALLET.toUpperCase())).toBe(true);
    });
  });
});
