// src/lib/web3Provider.ts
import { ethers } from 'ethers';

/**
 * Returns an ethers v5 provider wrapping the injected wallet (window.ethereum).
 * Centralizes the `window.ethereum as any` cast needed since the injected
 * provider isn't typed by default.
 */
export function getBrowserProvider(): ethers.providers.Web3Provider {
  return new ethers.providers.Web3Provider(window.ethereum as any);
}
