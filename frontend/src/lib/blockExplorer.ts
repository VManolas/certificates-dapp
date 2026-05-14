// src/lib/blockExplorer.ts

const EXPLORERS: Record<number, string> = {
  324: 'https://explorer.zksync.io',           // zkSync Era Mainnet
  300: 'https://sepolia.explorer.zksync.io',   // zkSync Sepolia Testnet
  1337: '',                                     // Hardhat L1 (no explorer)
  270: '',                                     // zkSync local L2 (docker / CLI)
  260: '',                                     // anvil-zksync in-memory
};

export function getTxExplorerUrl(txHash: string, chainId: number): string | null {
  const base = EXPLORERS[chainId];
  if (!base) return null;
  return `${base}/tx/${txHash}`;
}

export function getAddressExplorerUrl(address: string, chainId: number): string | null {
  const base = EXPLORERS[chainId];
  if (!base) return null;
  return `${base}/address/${address}`;
}

export function getContractExplorerUrl(address: string, chainId: number): string | null {
  return getAddressExplorerUrl(address, chainId);
}

export function getChainName(chainId: number): string {
  const names: Record<number, string> = {
    324: 'zkSync Era',
    300: 'zkSync Sepolia',
    1337: 'Hardhat Local',
    270: 'zkSync Local L2',
    260: 'zkSync In-Memory (anvil)',
  };
  return names[chainId] || `Chain ${chainId}`;
}

export function hasBlockExplorer(chainId: number): boolean {
  return !!EXPLORERS[chainId];
}
