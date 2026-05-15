# zkCredentials Noir Circuits

Zero-knowledge proof circuits for privacy-preserving authentication in the zkCredentials platform.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Circuit Architecture](#circuit-architecture)
3. [Getting Started](#getting-started)
4. [auth_login Circuit](#auth_login-circuit)
5. [Testing](#testing)
6. [Deployment](#deployment)
7. [Integration](#integration)
8. [Security](#security)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### What are ZK Circuits?

Zero-knowledge circuits allow users to prove they know certain information (like a password or private key) **without revealing that information**. In zkCredentials, this enables:

- 🔐 **Privacy-Preserving Login**: Students authenticate without revealing their wallet address
- 🛡️ **Credential Privacy**: Only necessary information is shared with employers
- ✅ **Cryptographic Security**: Mathematical guarantees instead of trust

### Why Noir?

[Noir](https://noir-lang.org/) is a domain-specific language for writing zero-knowledge circuits:

- ✅ **Readable**: Looks like Rust, not cryptographic math
- ✅ **Safe**: Type-checked and compile-time validated
- ✅ **Efficient**: Optimized for ZK-SNARK proof generation
- ✅ **Auditable**: Security researchers can understand the logic

---

## Circuit Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     zkCredentials Platform                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User Registration (Frontend)                            │
│     - Generate privateKey, salt locally                     │
│     - Compute commitment = H(H(privateKey), wallet, salt)   │
│     - Generate ZK proof of commitment                       │
│     ↓                                                        │
│  2. On-Chain Storage (Smart Contract)                       │
│     - Store commitment (public)                             │
│     - Store user role (student/employer/etc)                │
│     ↓                                                        │
│  3. User Login (Frontend)                                   │
│     - Decrypt stored credentials                            │
│     - Generate ZK proof: "I know secrets for commitment"    │
│     ↓                                                        │
│  4. On-Chain Verification (Verifier Contract)               │
│     - Verify ZK proof against commitment                    │
│     - Create session if valid                               │
│     ✅ User authenticated without revealing private key!    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Commitment Scheme

```
privateKey (256-bit)
    ↓ Pedersen Hash
publicKey = H(privateKey)
    ↓ Pedersen Hash with wallet + salt
commitment = H(publicKey, walletAddress, salt)
    ↓ Store on-chain
```

**Security Properties:**
- **One-way**: Can't derive privateKey from commitment
- **Collision-resistant**: Different keys → different commitments
- **Binding**: Links to specific wallet address
- **Unlinkable**: Different salts → different commitments

---

## Getting Started

### Prerequisites

1. **Install Noir** (see [NOIR_SETUP.md](./NOIR_SETUP.md)):
   ```bash
   curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
   noirup
   ```

2. **Verify Installation**:
   ```bash
   nargo --version
   # Expected: nargo version = 0.23.0+
   ```

### Quick Start

```bash
# Navigate to circuit directory
cd contracts/circuits/auth_login

# Compile circuit
nargo compile

# Run tests
nargo test

# Generate proof (with Prover.toml)
nargo prove

# Verify proof
nargo verify
```

---

## auth_login Circuit

### Purpose

Proves that a user knows the private key and wallet address corresponding to a registered commitment **without revealing them**.

### Inputs

| Name | Type | Visibility | Description |
|------|------|------------|-------------|
| `private_key` | Field | Private | User's secret authentication key (256-bit) |
| `wallet_address` | Field | Private | User's Ethereum address (160-bit) |
| `salt` | Field | Private | Random salt for uniqueness (256-bit) |
| `commitment` | Field | **Public** | On-chain commitment to verify against |

### Circuit Logic

```noir
fn main(private_key, wallet_address, salt, commitment) {
    // Step 1: Derive public key
    let public_key = pedersen_hash([private_key]);
    
    // Step 2: Compute commitment
    let computed = pedersen_hash([public_key, wallet_address, salt]);
    
    // Step 3: Verify match
    assert(computed == commitment);
}
```

### Security Guarantees

1. **Zero-Knowledge**: No information about private inputs is revealed
2. **Soundness**: Cannot create valid proof without knowing secrets
3. **Completeness**: Valid secrets always produce valid proofs
4. **Binding**: Commitment is tied to specific wallet address

### Circuit Statistics

```bash
nargo info
```

**Expected Output:**
```
Circuit: auth_login
├─ Gates: ~15-20 (very efficient!)
├─ Public Inputs: 1 (commitment)
├─ Private Inputs: 3 (privateKey, wallet, salt)
└─ Proving Time: ~2-3 seconds
```

---

## Testing

### Run All Tests

```bash
cd contracts/circuits/auth_login
nargo test
```

### Test Coverage

| Test | Purpose |
|------|---------|
| `test_valid_authentication_proof` | Valid credentials → successful proof |
| `test_different_keys_different_commitments` | Collision resistance |
| `test_same_key_different_salts` | Unlinkability |
| `test_same_key_different_wallets` | Wallet binding |
| `test_deterministic_commitment` | Reproducibility |
| `test_edge_case_zero_private_key` | Boundary: zero value |
| `test_edge_case_max_field_value` | Boundary: maximum value |

### Run Specific Test

```bash
nargo test test_valid_authentication_proof
```

### Test with Output

```bash
nargo test --show-output
```

---

## Deployment

### Step 1: Compile Circuit

```bash
cd contracts/circuits/auth_login
nargo compile
```

**Output**: `target/auth_login.json` (circuit artifact)

### Step 2: Generate Verifier Contract

```bash
nargo codegen-verifier
```

**Output**: `contract.sol` (Solidity verifier)

### Step 3: Deploy Verifier

```bash
cd ../../  # Back to contracts/
npx hardhat run scripts/deploy-verifier.ts --network localhost
```

### Step 4: Update ZKAuthRegistry

Update `ZKAuthRegistry.sol` to use the deployed verifier address:

```solidity
// contracts/contracts/ZKAuthRegistry.sol
function initialize(address admin, address _authVerifier) public initializer {
    authVerifier = IAuthVerifier(_authVerifier);
    // ... rest of initialization
}
```

---

## Integration

### Frontend Integration

#### 1. Install Dependencies

```bash
cd frontend
npm install @noir-lang/noir_js @noir-lang/backend_barretenberg
```

#### 2. Import Circuit Artifact

```typescript
// frontend/src/lib/zkAuth.ts
import { Noir } from '@noir-lang/noir_js';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import circuit from '@/contracts/circuits/auth_login/target/auth_login.json';
```

#### 3. Generate Proof

```typescript
export async function generateAuthProof(credentials: ZKCredentials) {
  // Initialize Noir backend
  const backend = new BarretenbergBackend(circuit);
  const noir = new Noir(circuit, backend);
  
  // Convert inputs to proper format
  const inputs = {
    private_key: credentials.privateKey,
    wallet_address: await getWalletAddress(),
    salt: credentials.salt,
    commitment: credentials.commitment,
  };
  
  // Generate proof
  const { proof, publicInputs } = await noir.generateProof(inputs);
  
  return ethers.hexlify(proof);
}
```

#### 4. Verify On-Chain

```typescript
// Submit proof to smart contract
await zkAuthRegistry.registerCommitment(
  commitment,
  roleEnum,
  proof  // Real ZK proof, not mock!
);
```

---

## Security

### Threat Model

**What the circuit protects against:**
- ✅ Private key exposure
- ✅ Wallet address leakage
- ✅ Credential replay attacks (via salt)
- ✅ Commitment forgery

**What the circuit does NOT protect against:**
- ❌ Front-end compromise (if attacker has access to decrypted credentials)
- ❌ Wallet signature phishing (social engineering)
- ❌ On-chain commitment analysis (commitment is public)

### Best Practices

1. **Never log private inputs**:
   ```typescript
   // ❌ BAD
   console.log('Private key:', privateKey);
   
   // ✅ GOOD
   logger.debug('Generating proof for commitment');
   ```

2. **Use secure randomness**:
   ```typescript
   // ✅ Use crypto.getRandomValues
   const salt = ethers.hexlify(crypto.getRandomValues(new Uint8Array(32)));
   ```

3. **Encrypt stored credentials**:
   ```typescript
   // ✅ Use AES-GCM in production (not XOR)
   const encrypted = await encryptWithAES(credentials, encryptionKey);
   ```

4. **Validate inputs before proving**:
   ```typescript
   if (!isValidPrivateKey(privateKey)) {
     throw new Error('Invalid private key format');
   }
   ```

### Audit Checklist

- [ ] Circuit logic reviewed by security expert
- [ ] All tests passing
- [ ] No private data in logs
- [ ] Verifier contract deployed correctly
- [ ] Frontend proof generation tested
- [ ] Gas costs optimized
- [ ] Error handling implemented

---

## Troubleshooting

### "nargo: command not found"

**Solution:**
```bash
source ~/.bashrc  # Reload shell
export PATH="$HOME/.nargo/bin:$PATH"
```

### "Compilation failed: Unknown function"

**Solution:** Check Noir version compatibility
```bash
nargo --version  # Should be 0.23.0+
noirup  # Update if needed
```

### "Proof generation failed"

**Solution:** Verify inputs match commitment
```bash
# Run tests to compute expected commitment
nargo test test_valid_authentication_proof --show-output
```

### "Verifier contract reverts"

**Possible causes:**
1. Proof was generated with wrong circuit version
2. Public inputs don't match on-chain data
3. Verifier not deployed correctly

**Solution:**
```bash
# Regenerate verifier
nargo codegen-verifier
# Redeploy
npx hardhat run scripts/deploy-verifier.ts --network localhost
```

### "Proving time too long (>10 seconds)"

**Solutions:**
1. Use release build: `nargo compile --release`
2. Reduce circuit complexity
3. Use hardware acceleration (if available)

---

## Resources

### Noir Documentation
- **Official Docs**: https://noir-lang.org/
- **Tutorial**: https://noir-lang.org/getting-started
- **Standard Library**: https://noir-lang.org/docs/standard_library

### ZK-SNARKs Learning
- **Intro to SNARKs**: https://z.cash/technology/zksnarks/
- **Pedersen Hash**: https://iden3-docs.readthedocs.io/en/latest/iden3_repos/research/publications/zkproof-standards-workshop-2/pedersen-hash/pedersen.html
- **BN254 Curve**: https://hackmd.io/@jpw/bn254

### Community
- **Noir Discord**: https://discord.gg/noir
- **GitHub Issues**: https://github.com/noir-lang/noir/issues
- **zkCredentials Discussions**: [Link to your repo]

---

## Next Steps

After setting up the circuits:

1. ✅ Compile and test locally
2. ✅ Generate and deploy verifier contract
3. ✅ Update ZKAuthRegistry with verifier address
4. ✅ Integrate proof generation in frontend
5. ✅ Test end-to-end registration and login
6. ✅ Deploy to testnet
7. ✅ Security audit
8. ✅ Deploy to mainnet

---

**Questions?** Check [NOIR_SETUP.md](./NOIR_SETUP.md) or ask in Discord!

