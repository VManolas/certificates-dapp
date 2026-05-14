// src/lib/wagmi.ts
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  // Lazy load other wallets only when needed
  // walletConnectWallet,
  // coinbaseWallet,
  // rainbowWallet,
  // injectedWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import {
  zksync,
  zksyncSepoliaTestnet,
  localhost,
  zksyncLocalNode,
  zksyncInMemoryNode,
} from 'wagmi/chains';

/**
 * wagmi configuration for zkSync Era
 *
 * Wallet Configuration:
 * - MetaMask: Fully enabled and recommended (working and tested)
 * - Other wallets: Commented out to reduce bundle size and improve load time
 *   To enable: uncomment imports above and add to connectors array below
 *
 * Performance Optimizations:
 * - Only MetaMask wallet is loaded initially
 * - Other wallet connectors can be lazy-loaded if needed
 * - Reduced initial bundle size by ~2-3MB
 *
 * Environment Variables:
 * - VITE_WALLETCONNECT_PROJECT_ID: WalletConnect Cloud project ID
 * - VITE_CHAIN_ID: "324" mainnet, "300" Sepolia, "270" zkSync docker local (L2), "260" anvil-zksync in-memory, "1337" vanilla Hardhat L1
 * - VITE_RPC_URL: optional override (e.g. http://127.0.0.1:3050 for zkSync local L2)
 */

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';
const chainId = parseInt(import.meta.env.VITE_CHAIN_ID || '300');
const viteRpcUrl = (import.meta.env.VITE_RPC_URL as string | undefined)?.trim();

// For local testing, provide a fallback project ID if not set
const effectiveProjectId =
  projectId || (chainId === 1337 || chainId === 270 || chainId === 260 ? 'localhost-testing' : '');

// Determine which chain to use based on environment
const activeChain =
  chainId === 324
    ? zksync
    : chainId === 300
      ? zksyncSepoliaTestnet
      : chainId === 1337
        ? localhost
        : chainId === 270
          ? zksyncLocalNode
          : chainId === 260
            ? zksyncInMemoryNode
            : zksyncSepoliaTestnet;

// Only include the active chain to reduce initial load
// Other chains can be switched to manually if needed
const allChains = [activeChain] as const;

// Wallet configuration - ONLY MetaMask for optimal performance
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [
        metaMaskWallet,
      ],
    },
    // Other wallets commented out to improve load time
    // Uncomment and add imports above if you need them:
    // {
    //   groupName: 'Coming Soon',
    //   wallets: [
    //     walletConnectWallet,
    //     coinbaseWallet,
    //     rainbowWallet,
    //     injectedWallet,
    //   ],
    // },
  ],
  {
    appName: 'zkCredentials',
    projectId: effectiveProjectId,
  }
);

export const config = createConfig({
  connectors,
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
    [localhost.id]: http(viteRpcUrl || 'http://127.0.0.1:8545', {
      retryCount: 3,
      retryDelay: 100,
      timeout: 10_000,
      batch: {
        wait: 0,
      },
    }),
    [zksyncLocalNode.id]: http(viteRpcUrl || 'http://127.0.0.1:3050', {
      retryCount: 3,
      retryDelay: 100,
      timeout: 30_000,
    }),
    [zksyncInMemoryNode.id]: http(viteRpcUrl || 'http://127.0.0.1:8011', {
      retryCount: 3,
      retryDelay: 100,
      timeout: 30_000,
    }),
  },
  ssr: false,
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

