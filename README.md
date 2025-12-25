# Web3 Credentials

> Blockchain-verified educational credentials on zkSync Era

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![zkSync Era](https://img.shields.io/badge/zkSync-Era-8B5CF6)](https://zksync.io)

## Overview

zkCredentials is a decentralized platform for issuing, managing, and verifying educational credentials using blockchain technology. Built on zkSync Era for fast, low-cost transactions with Ethereum-level security.

### Key Features

- 🔐 **Tamper-Proof** - Certificates stored as cryptographic hashes on-chain
- ⚡ **Instant Verification** - Verify any certificate in seconds
- 🏛️ **Institution Management** - Verified institutions issue credentials
- 🔒 **Privacy-First** - Only document hashes stored, not content
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

### Quick Start - Localhost Development

**Automated setup (recommended):**

```bash
# 1. Run quick start script
./quick-start.sh

# 2. Start Hardhat node (Terminal 1)
cd contracts && npx hardhat node

# 3. Deploy and auto-configure (Terminal 2)
./deploy-and-configure.sh

# 4. Start frontend (Terminal 3)
cd frontend && npm run dev
```

**Your app will be running at http://localhost:5173** 🎉

> 📖 **See [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md) for detailed verification steps**

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

**For Localhost (Development):**
```bash
# Contracts - Use test private key
cd contracts
cat > .env << 'EOF'
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
EOF

# Frontend - Configure for localhost
cd ../frontend
# Will be auto-configured by ./deploy-and-configure.sh
# Or manually set VITE_CHAIN_ID=1337
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

> 📖 **See [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) for switching between environments**

### Development

```bash
# Compile contracts
cd contracts
npm run compile

# Run tests
npm test

# Deploy to testnet
npm run deploy:testnet

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

### For Educational Institutions

1. Connect wallet
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

- All contracts use OpenZeppelin's battle-tested libraries
- UUPS upgradeable pattern for contract upgrades
- AccessControl for role-based permissions
- ReentrancyGuard on state-changing functions
- Custom errors for gas-efficient reverts

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Links

- [zkSync Era Documentation](https://docs.zksync.io/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [wagmi Documentation](https://wagmi.sh/)

