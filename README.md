# Web3 Credentials

> Blockchain-verified educational credentials on zkSync Era

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![zkSync Era](https://img.shields.io/badge/zkSync-Era-8B5CF6)](https://zksync.io)

## Overview

zkCredentials is a decentralized platform for issuing, managing, and verifying educational credentials using blockchain technology. Built on zkSync Era for fast, low-cost transactions with Ethereum-level security.

### Key Features

- 🔐 **Role-Based Authentication** - Guided auth methods optimized for each user type
- 🛡️ **Privacy-Preserving** - ZK-proof authentication for private login after one-time setup
- 🔒 **Tamper-Proof** - Certificates stored as cryptographic hashes on-chain
- ⚡ **Instant Verification** - Verify any certificate in seconds
- 🏛️ **Institution Management** - Verified institutions issue credentials
- 💰 **Low Cost** - zkSync Era enables affordable transactions

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│  Smart Contracts │────▶│   The Graph     │
│  React + wagmi  │     │  zkSync Era      │     │   Subgraph      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Smart Contracts

- **InstitutionRegistry** - Manages verified educational institutions
- **CertificateRegistry** - Issues and tracks certificates

### Tech Stack

| Layer | Technology |
|-------|------------|
| Blockchain | zkSync Era (Sepolia Testnet / Mainnet) |
| Smart Contracts | Solidity 0.8.24, OpenZeppelin 5.x |
| Frontend | React 18, TypeScript, Vite |
| Wallet | wagmi v2, RainbowKit |
| Styling | Tailwind CSS |
| Indexing | The Graph |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or compatible Web3 wallet
- (Optional) Testnet ETH for Sepolia deployment

### Quick Start - Local Development

**Recommended: Hardhat local (`localHardhat`, chain `1337`)**

```bash
# Terminal 1: start Hardhat local node
cd contracts && npx hardhat node

# Terminal 2: deploy and auto-configure frontend/.env.local
cd contracts && npm run deploy:local

# Terminal 3: start frontend
cd frontend && npm run dev
```

**Your app will be running at http://localhost:5173** 🎉

**Alternative local modes**

```bash
# zkSync in-memory node (anvil-zksync, chain 260)
cd contracts && npm run node:local:zksync
cd contracts && npm run deploy:local:zksync

# zkSync docker local L2 (chain 270)
cd contracts && npm run deploy:local:docker
```

> 📖 **See [docs/SETUP_CHECKLIST.md](docs/SETUP_CHECKLIST.md) for detailed verification steps**
>
> 📚 **Documentation index:** See [docs/README.md](docs/README.md) for the current authoritative guides and the historical-docs policy.

> ⚠️ **Development Mode**: The app includes a visual "Development Mode" indicator showing that ZK authentication is running with simplified proofs for testing. See [frontend/DEVELOPMENT_MODE.md](frontend/DEVELOPMENT_MODE.md) for details.

### Manual Installation

```bash
# Clone the repository
cd ~/src/zkp/project/zksync-zzlogin-dapp-Sep-2025-d

# Install contract dependencies
cd contracts
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Configuration

**For `localHardhat` (Development):**
```bash
# Contracts - Use test private key
cd contracts
cat > .env << 'EOF'
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
EOF

# Frontend
cd ../frontend
# Will be auto-configured by `cd ../contracts && npm run deploy:local`
```

**For Sepolia Testnet:**
```bash
cd contracts
cat > .env << 'EOF'
DEPLOYER_PRIVATE_KEY=your_actual_private_key_here
EOF

cd ../frontend
cat > .env.local << 'EOF'
VITE_WALLETCONNECT_PROJECT_ID=39e2e3d2a23e2049152548d5c1e9ad6a
VITE_CERTIFICATE_REGISTRY_ADDRESS=<deployed_address>
VITE_INSTITUTION_REGISTRY_ADDRESS=<deployed_address>
VITE_CHAIN_ID=300
EOF
```

> 📖 **See [docs/ENVIRONMENT_SETUP.md](docs/ENVIRONMENT_SETUP.md) for switching between environments**

### Development

```bash
# Compile contracts
cd contracts
npm run compile

# Run tests
npm test

# Deploy to testnet
npm run deploy:staging

# Start frontend
cd ../frontend
npm run dev
```

## Project Structure

```
zksync-zzlogin-dapp/
├── contracts/               # Smart contracts
│   ├── contracts/          # Solidity source files
│   ├── deploy/             # Deployment scripts
│   └── test/               # Contract tests
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # Utilities
│   │   ├── pages/          # Page components
│   │   └── store/          # Zustand stores
│   └── public/
├── subgraph/               # The Graph indexer
├── docs/                   # Documentation
└── .cursor/rules/          # Cursor AI rules
```

## User Flows

### Authentication

zkCredentials implements **role-based authentication** with guided defaults for optimal security and user experience.

#### Role-Based Auth Methods

| User Type | Default Method | Available Methods | Rationale |
|-----------|----------------|-------------------|-----------|
| **Admin** | Web3 Only | Web3 | Public accountability and transparency |
| **University** | Web3 Only | Web3 | Public institution + high transaction volume |
| **Student** | ZKP (Privacy) | ZKP, Web3 | Privacy for authentication after one-time setup |
| **Employer** | Web3 (Standard) | Web3, ZKP | Flexibility for different hiring contexts |

#### First-Time Users Flow

**For Students (Privacy-First):**
1. Connect Web3 wallet
2. System auto-detects student role (if certificate exists)
3. **Private Login (ZK)** shown by default
   - 🔐 One-time setup - wallet visible during registration
   - 🛡️ Private authentication - ZK proofs hide wallet during login
   - ⚙️ Setup takes ~30 seconds, then login forever privately
   - 💡 Pro Tip: Use a dedicated "registration wallet" for maximum privacy
4. Web3 fallback available if needed
5. Access student dashboard

**For Employers (Flexible):**
1. Connect Web3 wallet
2. **Standard Login (Web3)** shown by default
   - 🔑 Simple & Fast - no setup required
   - ⚡ Instant Access - login in seconds
3. Upgrade to ZKP for executive search/competitive hiring
4. Access verification dashboard

**For Universities:**
1. Connect Web3 wallet (required by admin)
2. **Standard Login (Web3)** only
   - Public accountability as educational institution
   - Cost-efficient for high-volume certificate issuance
3. Access institution dashboard

**For Admin:**
1. Connect Web3 wallet (predefined address)
2. **Standard Login (Web3)** only
   - Public accountability and transparency
   - Administrative oversight requires visibility
3. Access admin dashboard

> 📖 **See [DUAL-AUTH-SYSTEM.md](docs/DUAL-AUTH-SYSTEM.md) for detailed authentication guide**  
> 📖 **See [AUTH-WORKFLOWS-BY-USER-TYPE.md](docs/AUTH-WORKFLOWS-BY-USER-TYPE.md) for complete workflow definitions**

### For Educational Institutions

1. Choose authentication method
2. Connect wallet (if using Standard Login)
2. Register institution with name and email domain
3. Wait for admin approval
4. Issue certificates by uploading PDF and entering student wallet

### For Students/Employers

1. Upload certificate PDF
2. System generates SHA-256 hash
3. Hash is verified against blockchain
4. View certificate status (valid/invalid/revoked)

## Smart Contract Functions

### InstitutionRegistry

| Function | Description |
|----------|-------------|
| `registerInstitution(name, emailDomain)` | Register new institution |
| `approveInstitution(wallet)` | Admin approves institution |
| `suspendInstitution(wallet)` | Suspend an institution |
| `canIssueCertificates(wallet)` | Check if institution can issue |

### CertificateRegistry

| Function | Description |
|----------|-------------|
| `issueCertificate(hash, student, uri)` | Issue new certificate |
| `revokeCertificate(id, reason)` | Revoke a certificate |
| `isValidCertificate(hash)` | Verify certificate validity |
| `getCertificatesByStudent(wallet)` | Get student's certificates |

## Security

- **Role-Based Authentication** - ZK proofs for students, Web3 for institutions/admin
- **Zero-Knowledge Privacy Model**:
  - Setup Phase: Wallet visible during one-time commitment registration
  - Auth Phase: Login privately with ZK proofs (wallet hidden)
  - Usage Phase: User controls when to reveal wallet for specific actions
  - Best Practice: Use dedicated registration wallet for maximum privacy
- All contracts use OpenZeppelin's battle-tested libraries
- UUPS upgradeable pattern for contract upgrades
- AccessControl for role-based permissions
- ReentrancyGuard on state-changing functions
- Custom errors for gas-efficient reverts

> 📖 **See [DUAL-AUTH-SYSTEM.md](docs/DUAL-AUTH-SYSTEM.md) for security details**

### Privacy Best Practices

**For Maximum Privacy with ZK Authentication:**

1. **Use a Dedicated Registration Wallet**
   - Create a fresh wallet specifically for ZK registration
   - Don't use this wallet for any other transactions
   - After registration, only login using ZK proofs (wallet stays hidden)

2. **Understand the Privacy Model**
   ```
   Phase 1 - Registration (One-Time):
   ├─ Your wallet IS visible on-chain
   ├─ Commitment is registered publicly
   └─ This is a necessary step for cryptographic setup
   
   Phase 2 - Authentication (Every Login):
   ├─ Login using zero-knowledge proofs
   ├─ Your wallet is NOT revealed
   └─ Complete anonymity during authentication
   
   Phase 3 - Usage (Your Control):
   ├─ Choose when to reveal wallet
   ├─ Required for: receiving certificates, transactions
   └─ Optional for: viewing, verification
   ```

3. **Transaction Privacy Tips**
   - Use privacy-focused wallets for registration (e.g., fresh address)
   - Consider using a relayer service in the future (Phase 2)
   - Separate your "registration wallet" from your "usage wallet"

4. **What's Private vs. What's Public**
   
   **Private (Hidden):**
   - ✅ Login authentication (after setup)
   - ✅ Session management
   - ✅ Identity verification with ZK proofs
   - ✅ Your private keys (never leave browser)
   
   **Public (Visible):**
   - ⚠️ Registration transaction (commitment creation)
   - ⚠️ Wallet that registered the commitment
   - ⚠️ Any transactions you make after login (if you choose)

5. **Why This Model?**
   - One-time wallet exposure for cryptographic commitment is unavoidable in Phase 1
   - After setup, you gain **permanent private authentication**
   - Future enhancements (Phase 2) will add meta-transactions for truly anonymous registration
   - This is more private than standard Web3 auth (100% wallet exposure)

**Example Workflow:**
```bash
# 1. Create fresh wallet for registration
New Wallet: 0xABC... (dedicated for registration only)

# 2. Register with ZK Auth (wallet visible)
On-chain: 0xABC... → registerCommitment(commitment123)
Result: Public can see 0xABC registered commitment123

# 3. Login privately (wallet hidden)
ZK Proof: "I know the secret behind commitment123"
Result: No one knows which wallet is logging in!

# 4. Use the system
Future actions: You choose when to reveal wallet
```

> 💡 **Coming in Phase 2**: Meta-transaction support for truly anonymous registration via relayers

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Links

- [Role-Based Auth Workflows](docs/AUTH-WORKFLOWS-BY-USER-TYPE.md)
- [Dual Authentication Guide](docs/DUAL-AUTH-SYSTEM.md)
- [ZK Auth Phase 1 Report](docs/PHASE-1-COMPLETE.md)
- [Quick Start Guide](docs/QUICK-START.md)
- [zkSync Era Documentation](https://docs.zksync.io/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [wagmi Documentation](https://wagmi.sh/)
