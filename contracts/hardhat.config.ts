// contracts/hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-node";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-verify";
import "@matterlabs/hardhat-zksync-upgradable";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
    overrides: {
      // Special settings for the UltraPlonk verifier (complex assembly)
      "contracts/UltraPlonkAuthVerifier.sol": {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,  // Lower runs for complex contracts
          },
          viaIR: false,  // Disable IR for assembly-heavy contracts
        },
      },
    },
  },
  zksolc: {
    version: "1.4.1",
    settings: {
      // Optimizer disabled: UltraPlonkAuthVerifier (2778-line assembly) causes
      // "stack layout after 1000 iterations" with any optimizer mode.
      // Unoptimized bytecode is acceptable for staging.
      optimizer: {
        enabled: false,
      },
    },
  },
  // anvil-zksync binary for `hardhat node-zksync` — use 0.6+ so bytecode format matches current zksolc (e.g. Version29).
  zksyncAnvil: {
    version: "0.6.*",
  },
  networks: {
    hardhat: {
      zksync: false, // Disable zkSync for local testing to avoid build info parsing issues
      chainId: 1337,
      blockGasLimit: 30000000, // Increase block gas limit for large batch operations
      allowUnlimitedContractSize: true, // Allow large contracts like UltraPlonk verifier
    },
    // Vanilla Hardhat JSON-RPC node for local MetaMask development.
    localHardhat: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
    // anvil-zksync in-memory node (`npx hardhat node-zksync`, default port 8011). Used by `npm run deploy:local`.
    inMemoryNode: {
      url: "http://127.0.0.1:8011",
      ethNetwork: "",
      zksync: true,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
    // zkSync docker stack (e.g. matter-labs/local-setup): L2 on 3050, L1 on 8545. Use `npm run deploy:local:docker`.
    localhost: {
      url: "http://127.0.0.1:3050",
      ethNetwork: "http://127.0.0.1:8545",
      zksync: true,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
    zkSyncSepoliaTestnet: {
      url: "https://sepolia.era.zksync.dev",
      ethNetwork: "sepolia",
      zksync: true,
      verifyURL: "https://explorer.sepolia.era.zksync.dev/contract_verification",
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
    zkSyncMainnet: {
      url: "https://mainnet.era.zksync.io",
      ethNetwork: "mainnet",
      zksync: true,
      verifyURL: "https://zksync2-mainnet-explorer.zksync.io/contract_verification",
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  defaultNetwork: "hardhat",
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};

export default config;

