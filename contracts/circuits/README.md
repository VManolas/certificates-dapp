# zkCredentials ZK Circuits

Zero-knowledge proof circuits for key-secrecy authentication in the zkCredentials platform.

> **Production path: Circom + Groth16** (`auth_login_groth16/`). The Noir/UltraPlonk
> implementation (`auth_login/`) was the original design but is **deprecated for zkSync Era
> deployment** — see [Why two circuit implementations?](#why-two-circuit-implementations)
> below. Everything in this document describes the Groth16 path unless a section is
> explicitly marked legacy.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Why two circuit implementations?](#why-two-circuit-implementations)
3. [Circuit Architecture](#circuit-architecture)
4. [Getting Started](#getting-started)
5. [auth_login Circuit](#auth_login-circuit)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [Integration](#integration)
9. [Security](#security)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What are ZK circuits, here?

Zero-knowledge circuits let a user prove they know certain secret information (a private key)
**without revealing that information itself**. In zkCredentials, this circuit lets a student or
employer prove they control the private key behind a previously-registered commitment, without
that private key ever touching the blockchain or leaving the browser.

**Be precise about what this buys you.** This is a **key-secrecy** guarantee, not an
address-privacy one:

- ✅ **Key secrecy**: the private key never appears on-chain, in calldata, or in any transaction.
- ❌ **Not wallet-address unlinkability**: `registerCommitment`/`startSession` are called directly
  from the user's own connected wallet (`frontend/src/hooks/useZKAuth.ts`), so `msg.sender` links
  `commitment ⇄ wallet` on-chain for anyone watching, regardless of what the proof itself hides.

Earlier versions of this document (and of `ZKAuthRegistry.sol`'s comments) claimed "students
authenticate without revealing their wallet address" — that was wrong, and has been corrected
here and in the contract. See [`THREAT_MODEL.md`](./THREAT_MODEL.md) for the full analysis,
including how this compares to Semaphore and zkLogin, and what a design that actually achieved
address-unlinkability would require (a relayer — not implemented in this codebase).

---

## Why two circuit implementations?

This repo contains two implementations of the same underlying proof (knowledge of a private key
behind a Poseidon/Pedersen commitment, with a session nullifier):

| | `auth_login_groth16/` (Circom) | `auth_login/` (Noir) |
|---|---|---|
| **Status** | **Production** | **Deprecated for zkSync Era** |
| Proving system | Groth16 (via `snarkjs`) | UltraPlonk (via Barretenberg) |
| Hash function | Poseidon | Pedersen |
| Deployed to zkSync Era | Yes | No — never shipped |
| Solidity verifier | `Groth16AuthVerifier.sol` (snarkjs-generated `Groth16Verifier` contract) + `Groth16AuthVerifierAdapter.sol` | `UltraPlonkAuthVerifier.sol` + `UltraPlonkAuthVerifierAdapter.sol` (kept for reference/regression tests only) |

The Noir/UltraPlonk path was the original design. It was abandoned for two distinct, compounding
reasons, both visible in `contracts/hardhat.config.ts`'s zksolc settings comments:
1. `UltraPlonkAuthVerifier`'s generated inline assembly (2,778 lines) hits a zksolc optimizer bug
   — "stack layout after 1000 iterations" — with *any* optimizer mode enabled. This alone makes
   UltraPlonk impractical to compile with an optimized build.
2. zksolc's `forceEVMLA` setting was previously enabled (needed for UltraPlonk's assembly), but it
   caused a *separate* "stack too deep" failure in the **Groth16** verifier's inline assembly
   (`ecPairing` precompile calls) whenever both verifiers were compiled together. Once UltraPlonk
   was no longer deployed, `forceEVMLA` was removed entirely — Groth16 compiles cleanly on
   zksolc's default Yul IR path without it.

See `contracts/hardhat.config.ts` and
`contracts/contracts/UltraPlonkAuthVerifierAdapter.sol` (top-of-file status comment) for the full
rationale in the code itself.

The Noir circuit and its test suite (`contracts/test/zkauth-integration.test.ts`) are kept as
regression coverage for the abandoned adapter contract, not as documentation of the deployed
system. **Any gas cost, proving time, or "production-ready" language associated with the Noir
path is stale and should not be cited** — see [Testing](#testing) below for which suite to use
instead.

---

## Circuit Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     zkCredentials Platform                   │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  1. User Registration (Frontend, frontend/src/lib/zkAuth.ts)  │
│     - Generate privateKey, salt locally                       │
│     - commitment = Poseidon(Poseidon(privateKey), wallet, salt)│
│     - Generate Groth16 proof of the commitment relation        │
│     ↓                                                          │
│  2. On-Chain Storage (ZKAuthRegistry.sol)                       │
│     - Store commitment (public) + role                          │
│     - msg.sender is the calling wallet — NOT hidden (see above) │
│     ↓                                                          │
│  3. User Login (Frontend)                                      │
│     - Decrypt locally-stored credentials                        │
│     - Generate a fresh proof + fresh session nullifier           │
│     ↓                                                          │
│  4. On-Chain Verification (Groth16AuthVerifierAdapter)            │
│     - Verify proof against commitment + public inputs              │
│     - Create session if valid; nullifier consumed to block replay   │
│     ✅ Private key never leaves the browser.                          │
│     ⚠️  Wallet address is still linked via msg.sender — see THREAT_MODEL.md│
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### Commitment scheme

```
privateKey (field element)
    ↓ Poseidon(privateKey)
publicKey = Poseidon(privateKey)
    ↓ Poseidon(publicKey, walletAddress, salt)
commitment = Poseidon(publicKey, walletAddress, salt)
    ↓ stored on-chain (public)

privateKey + nullifierNonce (fresh per session)
    ↓ Poseidon(privateKey, nullifierNonce)
nullifier = Poseidon(privateKey, nullifierNonce)
    ↓ consumed on-chain (prevents replay)
```

**Security properties, stated precisely:**
- **One-way**: Poseidon preimage resistance — an observer with `commitment` can't recover
  `privateKey` or `walletAddress`.
- **Collision-resistant**: different `(privateKey, salt)` pairs produce different commitments
  with overwhelming probability.
- **Nullifier-unlinkable across sessions**: each session uses a fresh `nullifierNonce`, so two
  sessions from the same commitment don't share a nullifier value — but both sessions' underlying
  transactions still share the same `msg.sender`, so this does **not** provide wallet-level
  unlinkability (see Overview above).
- **walletAddress is bound inside the hash, not checked against `msg.sender`**: the circuit never
  asserts `walletAddress == msg.sender`; that binding only exists at the moment the commitment
  was originally computed. See [`SECURITY_REVIEW.md`](./SECURITY_REVIEW.md) finding 2 for the
  precise implication.

---

## Getting Started

### Production path (Circom + Groth16)

Prerequisites: [`circom`](https://docs.circom.io/getting-started/installation/) 2.1+ and
[`snarkjs`](https://github.com/iden3/snarkjs) (already a dependency of both `contracts/` and
`frontend/`).

```bash
cd contracts/circuits/auth_login_groth16

# Compile the circuit to R1CS + WASM witness generator
circom auth_login.circom --r1cs --wasm --sym -o .

# (Trusted setup — already done in this repo; see Deployment below for what
# pot11_*.ptau / auth_login_*.zkey actually are and their current status)

# Generate a proof for a test input
node auth_login_js/generate_witness.js auth_login_js/auth_login.wasm test_input.json witness.wtns
snarkjs groth16 prove auth_login_final.zkey witness.wtns proof.json public.json

# Verify it locally
snarkjs groth16 verify verification_key.json public.json proof.json
```

### Legacy path (Noir/UltraPlonk — not deployed, kept for reference)

```bash
cd contracts/circuits/auth_login
nargo compile
nargo test
```

Requires [Noir](https://noir-lang.org/) (`noirup` installer). This path is not used in any
deployed environment; see [Why two circuit implementations?](#why-two-circuit-implementations).

---

## auth_login Circuit

### Purpose

Proves knowledge of a `privateKey` such that a public `commitment` and `nullifier` were derived
from it correctly, without revealing `privateKey`, `walletAddress`, or `salt`.

### Inputs (production Circom circuit)

| Name | Visibility | Description |
|------|------------|-------------|
| `privateKey` | Private | User's secret authentication key |
| `walletAddress` | Private | User's Ethereum address, range-checked to 160 bits — **not** checked against `msg.sender` on-chain |
| `salt` | Private | Random value chosen at registration |
| `commitment` | **Public** | `Poseidon(Poseidon(privateKey), walletAddress, salt)` |
| `nullifierNonce` | **Public** | Fresh random value chosen per proof |
| `nullifier` | **Public** | `Poseidon(privateKey, nullifierNonce)` |

### Circuit logic (`auth_login.circom`, production)

```circom
template AuthLogin() {
    // Private inputs
    signal input privateKey;
    signal input walletAddress;
    signal input salt;

    // Public inputs
    signal input commitment;
    signal input nullifierNonce;
    signal input nullifier;

    // Range check — walletAddress must fit in 160 bits
    component addrBits = Num2Bits(160);
    addrBits.in <== walletAddress;

    // publicKey = Poseidon(privateKey)
    component pubKeyHash = Poseidon(1);
    pubKeyHash.inputs[0] <== privateKey;

    // commitment = Poseidon(publicKey, walletAddress, salt)
    component commitmentHash = Poseidon(3);
    commitmentHash.inputs[0] <== pubKeyHash.out;
    commitmentHash.inputs[1] <== walletAddress;
    commitmentHash.inputs[2] <== salt;
    commitmentHash.out === commitment;

    // nullifier = Poseidon(privateKey, nullifierNonce)
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== privateKey;
    nullifierHash.inputs[1] <== nullifierNonce;
    nullifierHash.out === nullifier;
}

component main { public [commitment, nullifierNonce, nullifier] } = AuthLogin();
```

This is the actual, current contents of `auth_login_groth16/auth_login.circom` — see
[`SECURITY_REVIEW.md`](./SECURITY_REVIEW.md) §1 for a line-by-line soundness discussion.

### Circuit statistics

1,698 R1CS constraints (measured via `snarkjs r1cs info`), well within the `pot11` Powers-of-Tau
ceremony's 2^11-constraint capacity. Proof size is the standard Groth16 minimum: 3 group elements
(2 in G1, 1 in G2 of the BN254 curve), 256 bytes uncompressed. Real, measured proof-generation
time and on-chain gas figures are in [Testing](#testing) below — do not use the circuit-statistics
numbers from older drafts of this document (they described the Noir circuit and don't apply here).

---

## Testing

**Use `contracts/test/groth16-integration.test.ts`** — this is the production path. It covers:
deployment, registration and session-start with real Groth16 proofs, invalid-proof rejection, a
**real gas + proof-generation-time benchmark** ("Gas & Performance Analysis" suite — these are the
numbers to cite for the thesis/paper), and a **front-running/nullifier-griefing regression test**
documenting the risk described in `SECURITY_REVIEW.md`/`THREAT_MODEL.md`.

```bash
cd contracts
npx hardhat test test/groth16-integration.test.ts
```

`contracts/test/zkauth-integration.test.ts` exercises the **deprecated UltraPlonk path** — its
header comment states this explicitly. It's kept for regression coverage of the legacy adapter
contract; don't cite its gas/timing numbers as representative of the deployed system.

---

## Deployment

### Step 1: Trusted setup status (already performed in this repo — read before reusing)

The Groth16 proving/verification keys already exist in this repo:
`pot11_0000.ptau → pot11_0001.ptau → pot11_final.ptau` (Powers of Tau) and
`auth_login_0000.zkey → auth_login_final.zkey` (circuit-specific phase 2). **Both ceremonies show
exactly one contributor and no transcript/beacon** — this is a single-party development ceremony,
adequate for a prototype/thesis defense, not for anything holding real value. See
[`THREAT_MODEL.md`](./THREAT_MODEL.md#trusted-setup) for the full discussion. Do not reuse these
keys for a deployment beyond a local/testnet demo without re-running a genuine multi-party
ceremony (or substituting a public, audited Powers-of-Tau file).

### Step 2: Deploy the verifier + adapter + registry

`contracts/lib/deployment-core.ts`'s `deployCoreContracts` handles this end-to-end (deploys
`Groth16Verifier`, `Groth16AuthVerifierAdapter`, and `ZKAuthRegistry` wired together); see
`contracts/scripts/deploy-unified.ts` (Hardhat) / `contracts/deploy/deploy-unified.ts` (zkSync)
for the entry points used by `npm run deploy:local` / `npm run deploy:staging` /
`npm run deploy:production` (see the root `contracts/package.json` and the repo's
`docs/ENVIRONMENT_SETUP.md`).

### Step 3: Point the frontend at the deployed circuit artifacts

The frontend fetches the compiled `.wasm` witness generator and the final `.zkey` at proof-gen
time (see `frontend/public/circuits/`) and the verifier ABI from `frontend/src/contracts/abis/`.
If the circuit changes, regenerate both and copy them into place — see
[`SECURITY_REVIEW.md`](./SECURITY_REVIEW.md) for what would need re-review if the circuit's
constraints ever change.

---

## Integration

### Frontend

Proof generation lives in `frontend/src/lib/zkAuth.ts` (`generateAuthProof`), which:
1. Computes `publicKey`/`commitment`/`nullifier` locally via `circomlibjs`'s Poseidon
   implementation (matching the circuit exactly).
2. Calls `snarkjs.groth16.fullProve(...)` against the compiled `.wasm`/`.zkey` (dynamically
   imported to keep `snarkjs` out of the initial bundle).
3. Transposes the resulting `pi_b` coordinates (snarkjs's G2 point ordering differs from the
   Solidity/EIP-197 convention) and ABI-encodes the proof for the on-chain call.

`frontend/src/hooks/useZKAuth.ts` then submits the encoded proof via `registerCommitment` /
`startSession` on `ZKAuthRegistry`, directly from the connected wallet — which is exactly why the
wallet-address-linkage caveat in [Overview](#overview) applies to every real submission.

---

## Security

See the two dedicated documents for the full analysis:

- [**`THREAT_MODEL.md`**](./THREAT_MODEL.md) — what's proven, what's achieved (key-secrecy) vs.
  not (address-unlinkability), comparison to Semaphore and zkLogin, trusted-setup status,
  adversary model.
- [**`SECURITY_REVIEW.md`**](./SECURITY_REVIEW.md) — an **informal internal** line-by-line review
  of the circuit and `ZKAuthRegistry.sol` (explicitly not a substitute for an external audit).

Summary:

| Property | Status |
|---|---|
| Private-key secrecy | ✅ Achieved |
| Nullifier-based replay protection | ✅ Achieved |
| Wallet-address unlinkability | ❌ Not achieved — corrected from earlier (wrong) claims in this doc |
| Front-running resistance on `startSession` | ❌ Not achieved — a front-runner can obtain a session authenticated as the victim's role/commitment; see `THREAT_MODEL.md` |
| Trusted-setup integrity | ⚠️ Single-party dev ceremony |
| Proof malleability resistance | ⚠️ Stock snarkjs verifier limitation |

### Best practices (still apply)

1. **Never log private inputs** — `privateKey`, `salt`, raw credentials.
2. **Use secure randomness** for `salt` and `nullifierNonce` (`crypto.getRandomValues`).
3. **Encrypt stored credentials** at rest (this codebase uses AES-GCM with an HKDF key derived
   from a wallet signature — see `frontend/src/lib/zkAuth.ts`).
4. **Validate inputs before proving** rather than letting a malformed input fail deep inside
   `snarkjs`.

### Audit checklist (honest status)

- [x] Circuit logic reviewed internally (`SECURITY_REVIEW.md`) — **not** a substitute for an
      external audit
- [x] Threat model documented (`THREAT_MODEL.md`)
- [x] Front-running/griefing risk documented and regression-tested
- [x] Trusted-setup status documented as single-party/dev-only
- [x] Real gas + proof-generation-time benchmarks measured against the deployed path
- [ ] External/professional circuit audit — **not done**, recommended before any deployment
      beyond a local/testnet demo
- [ ] Multi-party trusted-setup ceremony — **not done**, current ceremony is single-party
- [ ] Meta-transaction relayer for real address-unlinkability — **not implemented**, scoped as
      future work in `THREAT_MODEL.md`

---

## Troubleshooting

### Groth16 / Circom path

**"Proof generation failed" / proof doesn't verify**
- Confirm the JS-side Poseidon computation (`circomlibjs`) actually matches the circuit's inputs
  — regenerate `commitment`/`nullifier` and compare against `contracts/test/groth16-integration.test.ts`'s
  helper functions, which are known-good.
- Confirm you're using the matching `.wasm`/`.zkey` pair for the currently-deployed verifier —
  if the circuit was ever recompiled, a stale `.zkey` will produce proofs the on-chain verifier
  rejects with `InvalidProof`.

**"Verifier contract reverts with InvalidProof"**
- Public inputs (`commitment`, `nullifierNonce`, `nullifier`) passed to the contract must exactly
  match what was used to generate the proof, in the same order.
- Confirm `ZKAuthRegistry.authVerifier` actually points at the `Groth16AuthVerifierAdapter`
  wrapping the correct `Groth16Verifier`, not a stale/different deployment.

**"NullifierAlreadyUsed" unexpectedly**
- Each proof needs a fresh `nullifierNonce`; reusing one (including retrying a failed transaction
  with the exact same inputs) will collide. This is also the mechanism behind the documented
  front-running/griefing risk — see `THREAT_MODEL.md`.

### Noir/UltraPlonk path (legacy — not deployed)

**"nargo: command not found"**
```bash
source ~/.bashrc
export PATH="$HOME/.nargo/bin:$PATH"
```

This tooling is only relevant to the deprecated path; a missing `nargo` install does not affect
the production Groth16 circuit or its tests.

---

## Resources

- **Circom docs**: https://docs.circom.io/
- **snarkjs**: https://github.com/iden3/snarkjs
- **Groth16 paper**: Groth, J. (2016), "On the Size of Pairing-Based Non-interactive Arguments"
- **Poseidon hash**: Grassi et al. (2021), USENIX Security — https://www.usenix.org/conference/usenixsecurity21/presentation/grassi
- **Semaphore**: https://semaphore.pse.dev/ (comparison in `THREAT_MODEL.md`)
- **zkLogin**: https://docs.sui.io/concepts/cryptography/zklogin (comparison in `THREAT_MODEL.md`)
- **Noir** (legacy path only): https://noir-lang.org/
