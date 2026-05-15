// src/lib/__tests__/blockExplorer.test.ts
import { describe, expect, it } from 'vitest';
import {
  getAddressExplorerUrl,
  getChainName,
  getContractExplorerUrl,
  getTxExplorerUrl,
  hasBlockExplorer,
} from '@/lib/blockExplorer';

const HASH = '0x' + 'ab'.repeat(32);
const ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

describe('blockExplorer', () => {
  // ─── getTxExplorerUrl ────────────────────────────────────────────────────

  describe('getTxExplorerUrl', () => {
    it('returns a URL for zkSync Era mainnet (chainId 324)', () => {
      const url = getTxExplorerUrl(HASH, 324);
      expect(url).toBe(`https://explorer.zksync.io/tx/${HASH}`);
    });

    it('returns a URL for zkSync Sepolia testnet (chainId 300)', () => {
      const url = getTxExplorerUrl(HASH, 300);
      expect(url).toBe(`https://sepolia.explorer.zksync.io/tx/${HASH}`);
    });

    it('returns null for Hardhat local (chainId 1337)', () => {
      expect(getTxExplorerUrl(HASH, 1337)).toBeNull();
    });

    it('returns null for zkSync local L2 (chainId 270)', () => {
      expect(getTxExplorerUrl(HASH, 270)).toBeNull();
    });

    it('returns null for anvil-zksync in-memory (chainId 260)', () => {
      expect(getTxExplorerUrl(HASH, 260)).toBeNull();
    });

    it('returns null for an unknown chainId', () => {
      expect(getTxExplorerUrl(HASH, 999999)).toBeNull();
    });
  });

  // ─── getAddressExplorerUrl ───────────────────────────────────────────────

  describe('getAddressExplorerUrl', () => {
    it('returns an address URL for mainnet', () => {
      const url = getAddressExplorerUrl(ADDR, 324);
      expect(url).toBe(`https://explorer.zksync.io/address/${ADDR}`);
    });

    it('returns an address URL for testnet', () => {
      const url = getAddressExplorerUrl(ADDR, 300);
      expect(url).toBe(`https://sepolia.explorer.zksync.io/address/${ADDR}`);
    });

    it('returns null for local networks', () => {
      expect(getAddressExplorerUrl(ADDR, 1337)).toBeNull();
    });
  });

  // ─── getContractExplorerUrl ──────────────────────────────────────────────

  describe('getContractExplorerUrl', () => {
    it('delegates to getAddressExplorerUrl (same URL)', () => {
      expect(getContractExplorerUrl(ADDR, 324)).toBe(
        getAddressExplorerUrl(ADDR, 324),
      );
    });

    it('returns null for local chains', () => {
      expect(getContractExplorerUrl(ADDR, 1337)).toBeNull();
    });
  });

  // ─── getChainName ────────────────────────────────────────────────────────

  describe('getChainName', () => {
    it('returns "zkSync Era" for chainId 324', () => {
      expect(getChainName(324)).toBe('zkSync Era');
    });

    it('returns "zkSync Sepolia" for chainId 300', () => {
      expect(getChainName(300)).toBe('zkSync Sepolia');
    });

    it('returns "Hardhat Local" for chainId 1337', () => {
      expect(getChainName(1337)).toBe('Hardhat Local');
    });

    it('returns "zkSync Local L2" for chainId 270', () => {
      expect(getChainName(270)).toBe('zkSync Local L2');
    });

    it('returns "zkSync In-Memory (anvil)" for chainId 260', () => {
      expect(getChainName(260)).toBe('zkSync In-Memory (anvil)');
    });

    it('returns "Chain <N>" for an unknown chainId', () => {
      expect(getChainName(42161)).toBe('Chain 42161');
    });
  });

  // ─── hasBlockExplorer ────────────────────────────────────────────────────

  describe('hasBlockExplorer', () => {
    it('returns true for mainnet (324)', () => {
      expect(hasBlockExplorer(324)).toBe(true);
    });

    it('returns true for testnet (300)', () => {
      expect(hasBlockExplorer(300)).toBe(true);
    });

    it('returns false for Hardhat local (1337)', () => {
      expect(hasBlockExplorer(1337)).toBe(false);
    });

    it('returns false for zkSync local (270)', () => {
      expect(hasBlockExplorer(270)).toBe(false);
    });

    it('returns false for unknown chains', () => {
      expect(hasBlockExplorer(1)).toBe(false);
    });
  });
});
