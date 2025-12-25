// src/lib/wagmi.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { zksync, zksyncSepoliaTestnet, localhost } from 'wagmi/chains';
import { http } from 'wagmi';

/**
 * wagmi configuration for zkSync Era
 * 
 * Environment Variables:
 * - VITE_WALLETCONNECT_PROJECT_ID: WalletConnect Cloud project ID
 * - VITE_CHAIN_ID: "324" for mainnet, "300" for Sepolia testnet, "1337" for localhost
 */

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';
const chainId = parseInt(import.meta.env.VITE_CHAIN_ID || '300');

// For localhost testing, provide a fallback project ID if not set
// This prevents the error when testing locally
const effectiveProjectId = projectId || (chainId === 1337 ? 'localhost-testing' : '');

// Determine which chain to use based on environment
const activeChain = 
  chainId === 324 ? zksync : 
  chainId === 300 ? zksyncSepoliaTestnet : 
  chainId === 1337 ? localhost :
  zksyncSepoliaTestnet;

// Configure with all chains to prevent "Wrong network" warnings
// The active chain will be determined by VITE_CHAIN_ID
const allChains = [localhost, zksyncSepoliaTestnet, zksync] as const;

export const config = getDefaultConfig({
  appName: 'zkCredentials',
  projectId: effectiveProjectId,
  chains: allChains,
  transports: {
    [zksync.id]: http('https://mainnet.era.zksync.io', {
      retryCount: 3,
      retryDelay: 1000,
      timeout: 30_000,
    }),
    [zksyncSepoliaTestnet.id]: http('https://sepolia.era.zksync.dev', {
      retryCount: 3,
      retryDelay: 1000,
      timeout: 30_000,
    }),
    [localhost.id]: http('http://127.0.0.1:8545', {
      retryCount: 2,
      retryDelay: 500,
      timeout: 10_000,
    }),
  },
  ssr: false,
  // Enable automatic reconnection
  multiInjectedProviderDiscovery: true,
});

// Contract addresses from environment
export const CERTIFICATE_REGISTRY_ADDRESS = import.meta.env
  .VITE_CERTIFICATE_REGISTRY_ADDRESS as `0x${string}` | undefined;

export const INSTITUTION_REGISTRY_ADDRESS = import.meta.env
  .VITE_INSTITUTION_REGISTRY_ADDRESS as `0x${string}` | undefined;

// Subgraph URL
export const SUBGRAPH_URL = import.meta.env.VITE_SUBGRAPH_URL || '';

// Export chain info
export { activeChain };

