# ✅ Environment Configuration Checklist

Use this checklist to verify your setup before starting development or testing.

---

## 📋 Pre-Development Checklist

### ✅ System Requirements

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] Git installed (`git --version`)
- [ ] MetaMask or compatible wallet installed

### ✅ Project Setup

- [ ] Dependencies installed in `/contracts` (`npm install`)
- [ ] Dependencies installed in `/frontend` (`npm install`)
- [ ] No TypeScript errors in wagmi config (fixed ✅)

---

## 🔧 For Localhost Development

### ✅ Configuration Files

- [ ] `contracts/.env` exists with test private key
- [ ] `frontend/.env.local` exists with:
  - ✅ `VITE_CHAIN_ID=1337`
  - ✅ `VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id`
  - 📝 Contract addresses (will be filled after deployment)

### ✅ Services Running

- [ ] Hardhat node running in terminal 1:
  ```bash
  cd contracts && npx hardhat node
  ```
  **Expected**: See "Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/"

- [ ] Contracts deployed (terminal 2):
  ```bash
  cd contracts && npm run deploy:local
  ```
  **Expected**: See contract addresses printed

- [ ] Frontend dev server running (terminal 3):
  ```bash
  cd frontend && npm run dev
  ```
  **Expected**: App running on http://localhost:5173

### ✅ MetaMask Configuration

- [ ] Network added: Localhost 8545
  - Network Name: `Localhost 8545`
  - RPC URL: `http://127.0.0.1:8545`
  - Chain ID: `1337`
  - Currency Symbol: `ETH`

- [ ] Test account imported:
  - Private Key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
  - This account has 10,000 ETH on localhost
  - This account is both Super Admin and an approved institution

### ✅ Verification Steps

- [ ] Can connect wallet to app
- [ ] Can switch to correct network in MetaMask
- [ ] Account balance shows correctly
- [ ] No console errors in browser dev tools
- [ ] Contract addresses visible in frontend

---

## 🌐 For Sepolia Testnet

### ✅ Configuration Files

- [ ] `contracts/.env` has your **real** private key (NEVER commit this!)
- [ ] `frontend/.env.local` updated with:
  - ✅ `VITE_CHAIN_ID=300`
  - ✅ Sepolia contract addresses
  - ✅ `VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id`

### ✅ Wallet Preparation

- [ ] Have Sepolia ETH (get from faucet)
- [ ] Faucet URL: https://faucet.quicknode.com/zksync/sepolia
- [ ] Private key in `contracts/.env` has sufficient balance

### ✅ Deployment

- [ ] Contracts deployed to Sepolia:
  ```bash
  cd contracts
  npm run deploy:staging
  ```

- [ ] Contract addresses saved to `frontend/.env.local`
- [ ] Contracts verified on explorer (optional but recommended)

### ✅ MetaMask Configuration

- [ ] zkSync Sepolia network added:
  - Network Name: `zkSync Sepolia Testnet`
  - RPC URL: `https://sepolia.era.zksync.dev`
  - Chain ID: `300`
  - Currency Symbol: `ETH`
  - Block Explorer: `https://sepolia.explorer.zksync.io`

### ✅ Verification Steps

- [ ] Can connect wallet on Sepolia network
- [ ] Transactions complete successfully
- [ ] Can view transactions on explorer
- [ ] Gas fees are minimal (zkSync advantage!)

---

## 🚀 For Mainnet (Production)

### ⚠️ Critical Security Checklist

- [ ] **Contracts audited** by professional security firm
- [ ] **Private key secured** (hardware wallet recommended)
- [ ] **Sufficient mainnet ETH** for deployment
- [ ] **All testing completed** on localhost and testnet
- [ ] **Backup plan** in case of issues
- [ ] **Monitoring setup** for production

### ✅ Configuration

- [ ] `contracts/.env` has production wallet private key
- [ ] `frontend/.env.local` configured:
  - ✅ `VITE_CHAIN_ID=324`
  - ✅ Mainnet contract addresses
  - ✅ `VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id`

### ✅ Deployment

- [ ] Contracts deployed to mainnet:
  ```bash
  cd contracts
  npm run deploy:production
  ```

- [ ] Contracts verified on zkSync explorer
- [ ] Emergency pause functionality tested
- [ ] Admin roles properly configured

---

## 🛠️ Quick Fix Commands

### Reset Localhost Environment
```bash
# Kill hardhat node (Ctrl+C in terminal)
# Restart node
cd contracts && npx hardhat node

# In new terminal, redeploy
cd contracts && npm run deploy:local
```

### Check Current Configuration
```bash
# What network am I configured for?
cat frontend/.env.local | grep VITE_CHAIN_ID

# What contract addresses do I have?
cat frontend/.env.local | grep ADDRESS
```

### Verify wagmi Configuration
```bash
# Check for TypeScript errors
cd frontend
npx tsc --noEmit | grep wagmi
```

---

## 📊 Status Summary

**Current Project Status:**

| Component | Status | Notes |
|-----------|--------|-------|
| TypeScript Config | ✅ Fixed | wagmi imports corrected |
| Vite Environment Types | ✅ Added | `vite-env.d.ts` created |
| Smart Contracts | ✅ Ready | Tests passing, upgradeable |
| Deployment Scripts | ✅ Ready | Local & testnet scripts exist |
| Frontend Setup | ✅ Ready | Dependencies installed |
| Documentation | ✅ Complete | Guides created |

**Current Configuration:**
- Environment: **Localhost (Chain ID: 1337)**
- Contract Addresses: **Need fresh deployment**
- WalletConnect: **Configured**

---

## 🎯 Recommended Next Steps

1. **For Local Development:**
   ```bash
   # Terminal 1
   cd contracts && npx hardhat node
   
   # Terminal 2
   cd contracts && npm run deploy:local
   
   # Terminal 3
   cd frontend && npm run dev
   ```

2. **Configure MetaMask** with localhost network and import test account

3. **Start Testing** the dApp functionality

4. **When ready for testnet**, follow Sepolia checklist above

---

**Need Help?** Check:
- `LOCAL_TESTING_GUIDE.md` - Detailed local testing instructions
- `ENVIRONMENT_SETUP.md` - Environment switching guide
- `README.md` - General project overview
