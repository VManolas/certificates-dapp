# 🔄 Environment Configuration Guide

Quick reference for switching between localhost, testnet, and mainnet.

---

## 📍 Available Environments

### 1️⃣ **localHardhat (Development)**
- **Chain ID**: 1337
- **RPC URL**: http://127.0.0.1:8545
- **Use Case**: Local testing, rapid development on vanilla Hardhat
- **Contract Deployment**: Every restart needs redeployment

### 2️⃣ **inMemoryNode (anvil-zksync)**
- **Chain ID**: 260
- **RPC URL**: http://127.0.0.1:8011
- **Use Case**: zkSync-specific local testing without docker

### 3️⃣ **localhost (zkSync docker local L2)**
- **Chain ID**: 270
- **RPC URL**: http://127.0.0.1:3050
- **Use Case**: local zkSync stack with separate L1/L2 services

### 4️⃣ **zkSync Sepolia Testnet**
- **Chain ID**: 300
- **RPC URL**: https://sepolia.era.zksync.dev
- **Explorer**: https://sepolia.explorer.zksync.io
- **Use Case**: Public testing, staging
- **Faucet**: https://faucet.quicknode.com/zksync/sepolia

### 5️⃣ **zkSync Mainnet**
- **Chain ID**: 324
- **RPC URL**: https://mainnet.era.zksync.io
- **Explorer**: https://explorer.zksync.io
- **Use Case**: Production deployment

---

## 🔧 Quick Switch Commands

### Switch to `localHardhat`

**1. Start Hardhat node:**
```bash
cd contracts
npm run node:local
```

**2. Deploy contracts (in new terminal):**
```bash
cd contracts
npm run deploy:local
```

This updates `frontend/.env.local` automatically with `VITE_CHAIN_ID=1337` and `VITE_RPC_URL=http://127.0.0.1:8545`.

### Switch to `inMemoryNode`

```bash
cd contracts
npm run node:local:zksync
```

```bash
cd contracts
npm run deploy:local:zksync
```

This updates `frontend/.env.local` automatically with `VITE_CHAIN_ID=260` and `VITE_RPC_URL=http://127.0.0.1:8011`.

### Switch to zkSync docker local (`localhost`)

```bash
cd contracts
npm run deploy:local:docker
```

This expects zkSync local L2 on `http://127.0.0.1:3050` and updates `frontend/.env.local` with `VITE_CHAIN_ID=270`.

---

### Switch to Sepolia Testnet

**1. Update `contracts/.env`:**
```bash
cd contracts
cat > .env << 'EOF'
# Your actual private key (NEVER commit this!)
DEPLOYER_PRIVATE_KEY=<YOUR_PRIVATE_KEY>
EOF
```

**2. Deploy to Sepolia:**
```bash
npm run deploy:staging
# Or manually:
npx hardhat deploy-zksync --script deploy-unified.ts --network zkSyncSepoliaTestnet
```

**3. Update `frontend/.env.local`:**
```bash
cd frontend
cat > .env.local << 'EOF'
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
VITE_CERTIFICATE_REGISTRY_ADDRESS=<TESTNET_DEPLOYED_ADDRESS>
VITE_INSTITUTION_REGISTRY_ADDRESS=<TESTNET_DEPLOYED_ADDRESS>
VITE_CHAIN_ID=300
VITE_SUBGRAPH_URL=
EOF
```

---

### Switch to Mainnet

**1. Ensure you have mainnet ETH and update `contracts/.env`:**
```bash
cd contracts
cat > .env << 'EOF'
# Your actual private key with mainnet ETH (NEVER commit this!)
DEPLOYER_PRIVATE_KEY=<YOUR_PRIVATE_KEY>
EOF
```

**2. Deploy to Mainnet:**
```bash
npm run deploy:production
# Or manually:
npx hardhat deploy-zksync --script deploy-unified.ts --network zkSyncMainnet
```

**3. Update `frontend/.env.local`:**
```bash
cd frontend
cat > .env.local << 'EOF'
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
VITE_CERTIFICATE_REGISTRY_ADDRESS=<MAINNET_DEPLOYED_ADDRESS>
VITE_INSTITUTION_REGISTRY_ADDRESS=<MAINNET_DEPLOYED_ADDRESS>
VITE_CHAIN_ID=324
VITE_SUBGRAPH_URL=
EOF
```

---

## 🧪 Testing Workflow Recommendation

```
┌─────────────────┐
│ 1. localHardhat │ ← Develop & debug here first
│   (1-2 days)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. Sepolia Test │ ← Test with real testnet
│   (3-5 days)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. Mainnet     │ ← Production deployment
│   (go live)     │
└─────────────────┘
```

---

## 🔐 Security Checklist

- [ ] **Never** commit `.env` files with private keys
- [ ] Use **separate wallets** for local/testnet/mainnet
- [ ] Test **all functionality** on `localHardhat` first
- [ ] Verify **all contracts** after deployment
- [ ] **Audit** contracts before mainnet deployment
- [ ] Use **hardware wallet** or secure key management for mainnet

---

## 🎯 Current Configuration Status

**Check your current setup:**

```bash
# Frontend
cat frontend/.env.local | grep VITE_CHAIN_ID
```

**Expected outputs:**
- `VITE_CHAIN_ID=1337` → `localHardhat`
- `VITE_CHAIN_ID=260` → `inMemoryNode`
- `VITE_CHAIN_ID=270` → zkSync docker local
- `VITE_CHAIN_ID=300` → Sepolia Testnet  
- `VITE_CHAIN_ID=324` → Mainnet

---

## 📚 Additional Resources

- **Hardhat Config**: `contracts/hardhat.config.ts`
- **Deployment Scripts**: `contracts/deploy/` and `contracts/scripts/`
- **wagmi Config**: `frontend/src/lib/wagmi.ts`
- **Testing Guide**: `LOCAL_TESTING_GUIDE.md`

---

## 🆘 Troubleshooting

### MetaMask shows wrong network
1. Open MetaMask
2. Click network dropdown
3. Select the correct network (or add it)
4. Refresh the page

### Contracts not deployed on current network
```bash
# Redeploy based on your VITE_CHAIN_ID
npm run deploy:local       # For localHardhat
# OR
npm run deploy:staging     # For Sepolia
```

### Frontend shows old contract addresses
1. Verify `.env.local` has correct addresses
2. Restart dev server: `npm run dev`
3. Hard refresh browser: Ctrl+Shift+R

---

**📝 Note**: Always keep backups of deployed contract addresses and deployment info!
