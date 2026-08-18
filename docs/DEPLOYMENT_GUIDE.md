# Deployment & Configuration Guide

Complete guide for deploying zkCredentials smart contracts and frontend application.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Configuration Files](#configuration-files)
4. [Deploying to Local Development Networks](#deploying-to-local-development-networks)
5. [Deploying to zkSync Sepolia Testnet](#deploying-to-zksync-sepolia-testnet)
6. [Deploying to zkSync Mainnet](#deploying-to-zksync-mainnet)
7. [Frontend Deployment](#frontend-deployment)
8. [Verification](#verification)
9. [Troubleshooting](#troubleshooting)
10. [Upgrade Procedures](#upgrade-procedures)

---

## Prerequisites

### Required Software

```bash
# Node.js 18+ and npm
node --version  # v18.0.0 or higher
npm --version   # v8.0.0 or higher

# Git
git --version
```

### Required Accounts

1. **MetaMask or compatible wallet** - For contract deployment
2. **WalletConnect Project ID** (optional) - For mobile wallet support
   - Get one at: https://cloud.walletconnect.com/
3. **zkSync Era Sepolia ETH** (for testnet) - Get from faucet:
   - https://portal.zksync.io/faucet
   - https://learnweb3.io/faucets/zksync_sepolia

### Initial Setup

```bash
# Clone repository
cd ~/src/zkp/project
cd zksync-zzlogin-dapp-Sep-2025-d

# Install dependencies
cd contracts && npm install
cd ../frontend && npm install
```

---

## Local Development Setup

### Quick Start (Recommended)

The fastest way to get started with local development:

```bash
# Terminal 1: Start Hardhat local node
cd contracts
npm run node:local
# Runs on http://127.0.0.1:8545 (network: localHardhat, chainId: 1337)
# DO NOT close this terminal

# Terminal 2: Deploy contracts
cd contracts
npm run deploy:local
# This deploys all contracts to localHardhat and updates frontend config

# Terminal 3: Start frontend
cd frontend
npm run dev
# Access at http://localhost:5173
```

### Alternative: zkSync Local Node (anvil-zksync)

For testing zkSync-specific features:

```bash
# Terminal 1: Start anvil-zksync node
cd contracts
npm run node:local:zksync
# Runs on http://127.0.0.1:8011 (network: inMemoryNode, chainId: 260)

# Terminal 2: Deploy to zkSync node
cd contracts
npm run deploy:local:zksync

# Optional: dockerized zkSync local L2
cd contracts
npm run deploy:local:docker
# Expects L2 on http://127.0.0.1:3050 (network: localhost, chainId: 270)

# Terminal 3: Start frontend
cd frontend
npm run dev
```

### Default Test Accounts

Hardhat provides pre-funded test accounts:

```javascript
// Account #0 (Deployer/Admin)
Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
Balance: 10000 ETH

// Account #1
Address: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
Balance: 10000 ETH

// ... more accounts available
```

### Importing Test Account to MetaMask

1. Open MetaMask
2. Click account icon → Import Account
3. Paste private key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
4. Add Custom Network:
   - Network Name: Localhost 8545
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 1337
   - Currency Symbol: ETH

---

## Configuration Files

### Contract Configuration

**File:** `/contracts/.env`

```bash
# Deployer private key (NEVER commit real keys to git!)
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

**For localhost:** Use default Hardhat test key above
**For testnet/mainnet:** Use your actual private key (keep secure!)

### Frontend Configuration

**File:** `/frontend/.env.local`

```bash
# Network Configuration
VITE_CHAIN_ID=1337  # localHardhat: 1337, inMemoryNode: 260, zkSync docker local: 270, Sepolia: 300, mainnet: 324

# Contract Addresses (auto-configured by deployment script)
VITE_CERTIFICATE_REGISTRY_ADDRESS=0x...
VITE_INSTITUTION_REGISTRY_ADDRESS=0x...
VITE_EMPLOYER_REGISTRY_ADDRESS=0x...
VITE_ZK_AUTH_REGISTRY_ADDRESS=0x...

# WalletConnect (optional, for mobile wallets)
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

> The ZK verifier type (`groth16` default, or `ultraplonk`) is chosen at contract deploy time via the `VERIFIER_TYPE` env var passed to the `contracts` package (see `contracts/config/deployment.config.ts`) — it is not a frontend `VITE_*` setting. The "Development Mode" banner (`frontend/src/components/DevModeBanner.tsx`) is currently always rendered; it is not gated by an env var.

### Network IDs Reference

| Network | Chain ID | RPC URL |
|---------|----------|---------|
| localHardhat (Hardhat L1) | 1337 | http://127.0.0.1:8545 |
| inMemoryNode (anvil-zksync) | 260 | http://127.0.0.1:8011 |
| localhost (zkSync docker local L2) | 270 | http://127.0.0.1:3050 |
| zkSync Sepolia | 300 | https://sepolia.era.zksync.dev |
| zkSync Mainnet | 324 | https://mainnet.era.zksync.io |

---

## Deploying to Local Development Networks

### Step-by-Step Process

#### 1. Start `localHardhat`

```bash
cd contracts
npm run node:local
```

**Expected output:**
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
...
```

#### 2. Deploy Contracts to `localHardhat`

In a new terminal:

```bash
cd contracts
npm run deploy:local
```

**What this does:**
1. Compiles all Solidity contracts
2. Deploys contracts in order:
   - InstitutionRegistry (proxy + implementation)
   - EmployerRegistry (proxy + implementation)
   - ZKAuthRegistry (proxy + implementation)
   - UltraPlonkVerifier (or MockVerifier)
   - CertificateRegistry (proxy + implementation)
3. Links contracts together
4. Auto-configures frontend `.env.local` with `VITE_CHAIN_ID=1337` and `VITE_RPC_URL=http://127.0.0.1:8545`

**Expected output:**
```
🚀 Starting zkCredentials Unified Deployment (Hardhat)...

✅ InstitutionRegistry deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
✅ EmployerRegistry deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
✅ ZKAuthRegistry deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
✅ Verifier deployed to: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
✅ CertificateRegistry deployed to: 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9

📝 Frontend configuration updated at: ../frontend/.env.local

✅ Deployment completed successfully!
```

#### 3. Verify Contracts are Accessible

```bash
# Check admin role
npx hardhat run scripts/check-admin.ts --network localHardhat

# List institutions (should be empty initially)
npx hardhat run scripts/list-institutions.ts --network localHardhat
```

#### 4. Start Frontend

```bash
cd frontend
npm run dev
```

**Expected output:**
```
  VITE v7.3.0  ready in 523 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h to show help
```

#### 5. Access Application

1. Open browser: http://localhost:5173
2. Connect MetaMask to Localhost 8545
3. Use test account (0xf39F...)
4. Application should load successfully

### Using Mock vs. Production Verifier

**Mock Verifier (Development - Default):**
```bash
# Faster deployment, no ZK proof verification
npm run deploy:local
```

**UltraPlonk Verifier (Production-like):**
```bash
# Slower deployment, real ZK proof verification
VERIFIER_TYPE=ultraplonk npm run deploy:local
```

---

## Deploying to zkSync Sepolia Testnet

### Prerequisites

1. **Get Sepolia ETH:**
   - Bridge from Ethereum Sepolia: https://portal.zksync.io/bridge
   - Or use faucets: https://learnweb3.io/faucets/zksync_sepolia

2. **Prepare Private Key:**
   - Export from MetaMask (Account → Details → Export Private Key)
   - **NEVER share or commit to git!**

### Deployment Steps

#### 1. Configure Environment

Create `/contracts/.env`:

```bash
DEPLOYER_PRIVATE_KEY=0x<your_actual_private_key_here>
```

**Security:** Ensure `.env` is in `.gitignore`!

#### 2. Compile Contracts

```bash
cd contracts
npm run compile
```

#### 3. Deploy to Testnet

```bash
cd contracts
npm run deploy:staging
```

This runs: `hardhat deploy-zksync --script deploy-unified.ts --network zkSyncSepoliaTestnet`

**Deployment time:** ~2-5 minutes

**Expected output:**
```
🚀 Starting zkCredentials Unified Deployment (zkSync)...

✅ InstitutionRegistry deployed to: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5
✅ EmployerRegistry deployed to: 0x831153c6b9537d0e133c1D8A2d1D67E1e2e3e4c8
...

💰 Deployment costs:
   InstitutionRegistry: 0.002 ETH
   EmployerRegistry: 0.0015 ETH
   CertificateRegistry: 0.003 ETH
   Total: 0.0095 ETH

✅ Deployment completed successfully!
```

#### 4. Update Frontend Configuration

Update `/frontend/.env.local`:

```bash
VITE_CHAIN_ID=300
VITE_CERTIFICATE_REGISTRY_ADDRESS=<deployed_address>
VITE_INSTITUTION_REGISTRY_ADDRESS=<deployed_address>
VITE_EMPLOYER_REGISTRY_ADDRESS=<deployed_address>
VITE_ZK_AUTH_REGISTRY_ADDRESS=<deployed_address>
```

(Deploy contracts with `VERIFIER_TYPE=ultraplonk` — see note above; there is no corresponding frontend `VITE_*` variable.)

#### 5. Test Deployment

```bash
# Check admin
npx hardhat run scripts/check-admin.ts --network zkSyncSepoliaTestnet

# List institutions
npx hardhat run scripts/list-institutions.ts --network zkSyncSepoliaTestnet
```

#### 6. Verify Contracts (Optional but Recommended)

```bash
npx hardhat verify --network zkSyncSepoliaTestnet <CONTRACT_ADDRESS>
```

This makes the contract source code viewable on zkSync Era Explorer.

---

## Deploying to zkSync Mainnet

**⚠️ WARNING:** Mainnet deployment uses real funds. Double-check everything!

### Pre-Deployment Checklist

- [ ] All tests passing (`npm test` in contracts)
- [ ] Security audit completed
- [ ] Smart contracts audited by professional firm
- [ ] Frontend thoroughly tested on testnet
- [ ] Multi-sig wallet prepared for admin role
- [ ] Emergency procedures documented
- [ ] Team trained on contract upgrade process
- [ ] Sufficient ETH for deployment (~0.05-0.1 ETH recommended)
- [ ] Backup of all private keys in secure location

### Deployment Steps

#### 1. Final Testing on Testnet

Deploy and test on Sepolia testnet first to verify everything works.

#### 2. Prepare Mainnet Configuration

```bash
# contracts/.env
DEPLOYER_PRIVATE_KEY=<secure_mainnet_private_key>

# Recommended: Use hardware wallet (Ledger/Trezor)
```

#### 3. Deploy to Mainnet

```bash
cd contracts
npm run deploy:production
```

This runs: `hardhat deploy-zksync --script deploy-unified.ts --network zkSyncMainnet`

#### 4. Verify Deployment

```bash
# Verify each contract
npx hardhat verify --network zkSyncMainnet <InstitutionRegistry_ADDRESS>
npx hardhat verify --network zkSyncMainnet <CertificateRegistry_ADDRESS>
# ... verify all contracts
```

#### 5. Transfer Admin Role to Multi-Sig

**CRITICAL:** Transfer admin role from deployer to multi-sig wallet:

```bash
# Using Hardhat console
npx hardhat console --network zkSyncMainnet

# In console:
const InstitutionRegistry = await ethers.getContractAt(
  "InstitutionRegistry",
  "<INSTITUTION_REGISTRY_ADDRESS>"
);

const ADMIN_ROLE = await InstitutionRegistry.ADMIN_ROLE();
const multiSigAddress = "<MULTI_SIG_ADDRESS>";

// Grant admin role to multi-sig
await InstitutionRegistry.grantRole(ADMIN_ROLE, multiSigAddress);

// Revoke admin from deployer (after confirming multi-sig works)
await InstitutionRegistry.revokeRole(ADMIN_ROLE, "<DEPLOYER_ADDRESS>");
```

#### 6. Update Frontend for Mainnet

```bash
# frontend/.env.production
VITE_CHAIN_ID=324
VITE_CERTIFICATE_REGISTRY_ADDRESS=<mainnet_address>
VITE_INSTITUTION_REGISTRY_ADDRESS=<mainnet_address>
VITE_EMPLOYER_REGISTRY_ADDRESS=<mainnet_address>
VITE_ZK_AUTH_REGISTRY_ADDRESS=<mainnet_address>
VITE_WALLETCONNECT_PROJECT_ID=<your_project_id>
```

(Deploy contracts with `VERIFIER_TYPE=ultraplonk` — see note above; there is no corresponding frontend `VITE_*` variable.)

---

## Frontend Deployment

### Development Build (Testnet)

```bash
cd frontend
npm run build

# Output: dist/ folder
# Deploy dist/ to your hosting provider
```

### Production Build (Mainnet)

```bash
cd frontend

# Set production environment
export NODE_ENV=production

# Build
npm run build

# Output: dist/ folder (optimized)
```

### Hosting Options

#### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel

# Follow prompts to configure
```

**Vercel Configuration:**
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

#### Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
cd frontend
netlify deploy --prod

# Select dist folder
```

#### IPFS/Fleek (Decentralized)

1. Build: `npm run build`
2. Upload `dist/` folder to IPFS via Fleek
3. Configure ENS domain (optional)

---

## Verification

### Smart Contract Verification

After deployment, verify contracts on zkSync Era Explorer:

```bash
# Automatic verification
npx hardhat verify --network zkSyncSepoliaTestnet <ADDRESS>

# With constructor arguments
npx hardhat verify --network zkSyncSepoliaTestnet <ADDRESS> "arg1" "arg2"
```

**Explorer URLs:**
- Sepolia: https://sepolia.explorer.zksync.io/
- Mainnet: https://explorer.zksync.io/

### Deployment Verification Checklist

- [ ] All contracts deployed successfully
- [ ] Contract addresses updated in frontend config
- [ ] Admin has correct role
- [ ] Institution Registry accepts registrations
- [ ] Certificate issuance works end-to-end
- [ ] Verification page displays certificates correctly
- [ ] ZK auth registration works (if enabled)
- [ ] Batch upload functions properly
- [ ] Revocation works as expected
- [ ] All contract events are emitted correctly

---

## Troubleshooting

### Common Issues

#### "Insufficient funds for gas"

**Solution:** Add more ETH to deployer wallet.

```bash
# Check balance
npx hardhat run scripts/list-accounts.ts --network <network>
```

#### "Nonce too high" or "Nonce too low"

**Solution:** Reset MetaMask account:
1. Settings → Advanced → Reset Account
2. Try deployment again

#### "Contract deployment failed"

**Solutions:**
1. Check Solidity version matches (0.8.24)
2. Ensure all dependencies installed: `npm ci`
3. Clean and recompile: `npx hardhat clean && npx hardhat compile`
4. Check network connection

#### Frontend shows "Wrong Network"

**Solution:** Update `VITE_CHAIN_ID` in `.env.local` to match deployed network.

#### "Transaction reverted" during deployment

**Solution:**
1. Check deployer has enough ETH
2. Verify constructor arguments are correct
3. Check for conflicting deployments (contracts already deployed)

#### Contracts deployed but frontend can't connect

**Solutions:**
1. Verify contract addresses in `.env.local` match deployed addresses
2. Ensure correct network selected in MetaMask
3. Clear browser cache and reload
4. Check browser console for errors

---

## Upgrade Procedures

### Upgrading Smart Contracts

zkCredentials contracts use UUPS upgradeable pattern.

#### 1. Prepare New Implementation

```solidity
// contracts/CertificateRegistryV2.sol
contract CertificateRegistryV2 is CertificateRegistry {
    // Increment VERSION
    string public constant VERSION = "2.0.0";

    // Add new storage variables at the end only
    uint256 public newVariable;

    // Add new functions
    function newFunction() external { ... }

    // Adjust storage gap
    uint256[46] private __gap; // Reduced from 50 to account for newVariable
}
```

#### 2. Deploy New Implementation

```bash
npx hardhat run scripts/upgrade-certificate-registry.ts --network <network>
```

#### 3. Upgrade Proxy

```javascript
// scripts/upgrade-certificate-registry.ts
const { ethers, upgrades } = require("hardhat");

async function main() {
  const proxyAddress = "<PROXY_ADDRESS>";

  const CertificateRegistryV2 = await ethers.getContractFactory("CertificateRegistryV2");

  console.log("Upgrading CertificateRegistry...");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, CertificateRegistryV2);
  await upgraded.deployed();

  console.log("CertificateRegistry upgraded successfully");

  // Record upgrade
  await upgraded.recordUpgrade("2.0.0", "Added new feature XYZ");
}

main();
```

#### 4. Verify Upgrade

```bash
# Check version
npx hardhat console --network <network>

# In console:
const registry = await ethers.getContractAt("CertificateRegistryV2", "<PROXY_ADDRESS>");
console.log(await registry.VERSION()); // Should show "2.0.0"
console.log(await registry.getUpgradeHistory()); // Should show upgrade record
```

### Upgrade Safety Rules

**❌ NEVER:**
- Reorder storage variables
- Delete storage variables
- Change variable types
- Remove public functions

**✓ ALWAYS:**
- Append new variables at the end
- Adjust storage gap accordingly
- Increment VERSION constant
- Call `recordUpgrade()` after upgrade
- Test on testnet first

---

## Monitoring & Maintenance

### Contract Events Monitoring

Use tools to monitor contract events:

**The Graph (Recommended):**
- Create subgraph for indexing events
- Query via GraphQL API

**Tenderly:**
- Real-time monitoring
- Alert on reverts
- Gas analysis

**Custom Scripts:**
```javascript
// scripts/monitor-events.ts
const registry = await ethers.getContractAt("CertificateRegistry", address);

registry.on("CertificateIssued", (certId, student, institution, hash, date) => {
  console.log(`Certificate ${certId} issued to ${student}`);
  // Send notification, log to database, etc.
});
```

### Health Checks

Periodically verify:
- All contracts accessible
- Admin role configured correctly
- No unexpected reverts
- Gas prices reasonable
- Frontend deployed and accessible

---

## Security Best Practices

1. **Never commit private keys** - Use `.env` files (in `.gitignore`)
2. **Use hardware wallets** for mainnet admin operations
3. **Multi-sig for admin role** on mainnet
4. **Test everything** on testnet before mainnet
5. **Verify contracts** on block explorer (transparency)
6. **Monitor events** for suspicious activity
7. **Regular security audits** for contract upgrades
8. **Backup deployment scripts** and configurations
9. **Document emergency procedures**
10. **Rate limit frontend** API calls if using backend

---

## Support

For deployment issues:
- Check documentation: `/docs`
- Review existing issues: GitHub Issues
- Check logs: Browser console, Hardhat output
- Verify configurations: `.env` files

---

## License

MIT License - See LICENSE file for details.
