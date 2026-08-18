# Thesis Defense Presentation Notes

Narrative script and slide-by-slide talking points for the examining committee.
Total target time: ~20 minutes presentation + Q&A.

---

## Opening (~1 min)

"Good morning. My thesis is titled *Privacy-Preserving Educational Credential Verification Using Zero-Knowledge Proofs on zkSync*.

In this thesis I designed and implemented a full-stack decentralised platform where universities issue tamper-proof academic credentials on-chain, and students authenticate to that platform using zero-knowledge proofs that hide their secret authentication key — using zero-knowledge proofs, not their wallet identity, which remains visible on-chain by design in this version.

The core contribution is not just blockchain-based verification, but a ZK authentication layer that replaces plaintext secret-key exposure with a commitment-and-nullifier scheme: a verifier learns that *someone* who registered a valid commitment knows the secret behind it, without that secret ever touching the chain. What a verifier still learns — and what I'll be precise about throughout this talk — is *which wallet* is doing the logging in, since every transaction is submitted from the user's own address. This system achieves key-secrecy, not wallet-level anonymity, and I'll spend part of this talk on exactly that boundary."

---

## 1. Problem Statement (~2 min)

**Why this problem matters:**
- Academic credentials are high-stakes: forgery, revocation, and privacy all matter.
- Existing systems are either centralised (trusted issuer, single point of failure) or naively on-chain (wallet address = identity, fully public).
- The gap: no open, on-chain system combining credential integrity *and* ZK-based private login in a single deployable prototype.

**Research question:**
> Can a zkEVM rollup host a credential registry with ZK-based private authentication while keeping the student's identity secret from on-chain observers?

**Honest answer this thesis gives:** mostly yes, with two documented residual gaps — wallet linkability via `msg.sender`, and a front-running vulnerability on `startSession` (Section 3) — both known, analysed, and scoped as future work.

---

## 2. System Architecture (~3 min)

**Three-tier design:**

```
React Frontend (Vite + wagmi + snarkjs WASM)
        │
        │  Groth16 proof generation (in-browser)
        │  AES-GCM credential decryption
        ▼
ZK Circuit (circom / Groth16 / BN254)
        │
        │  R1CS proof verification on-chain
        ▼
Smart Contracts on zkSync Era (Solidity 0.8.24, UUPS upgradeable)
  ├── InstitutionRegistry   — university whitelist
  ├── EmployerRegistry      — employer whitelist
  ├── CertificateRegistry   — credential issuance & revocation
  └── ZKAuthRegistry        — ZK commitment, session, nullifier management
```

**Key design choices to mention:**
- zkSync Era (not Ethereum L1): roughly three orders of magnitude cheaper per login transaction — ~220×–5,600× depending on gas-price/ETH-price assumptions, ~1,100× under matched conditions (see Section 5 for the full calculation; don't quote "500–2,500×" alone, that figure came from pairing a single L1 price-point with the full L2 range and isn't directly comparable).
- UUPS upgradeable proxies: post-deployment bugfixes without migrating state.
- Groth16 over PLONK/STARKs: smallest proof (256 bytes — 3 group elements) and cheapest on-chain verification (~210k gas for `startSession` on zkSync Sepolia), enabled by Ethereum/zkSync's native `ecPairing` precompile (EIP-196/197). Worth noting proactively: this wasn't a purely a-priori choice — the circuit was originally Noir/UltraPlonk, abandoned because the generated verifier (~140 KB bytecode) was incompatible with zksolc. The Noir circuit and its verifier are still in the repo as regression-test legacy code only; the deployed system uses Groth16 exclusively.
- Poseidon hash over keccak/SHA-256: an arithmetic, field-native hash that avoids the expensive bit-decomposition gadgets SHA-256/keccak need inside an R1CS circuit. The whole circuit (3 Poseidon calls + a 160-bit range check) compiles to 1,698 constraints total — don't quote a specific "Nx cheaper than SHA-256" ratio unless you have a citation for it; the constraint-count fact stands on its own.

---

## 3. The ZK Private Login Protocol (~4 min)

### Registration (once)
1. Client generates a random `privateKey` and `salt`.
2. Computes `commitment = Poseidon(Poseidon(privateKey), walletAddress, salt)`.
3. Signs a fixed message with the wallet → derives AES-GCM key via HKDF → encrypts `{privateKey, salt, commitment}` into `localStorage`.
4. Submits `commitment` on-chain via `registerCommitment(commitment, role, proof, nullifierNonce, nullifier)` — contract verifies the Groth16 proof and marks the nullifier spent. Note `role` (Student/Employer) is plain calldata, not something the circuit constrains — a real, separate limitation worth knowing if asked (role eligibility isn't cryptographically proven on the ZK path).

### Login (every session)
1. Student reconnects wallet, signs the same fixed message → re-derives AES key → decrypts credentials.
2. Picks a fresh `nullifierNonce`; computes `nullifier = Poseidon(privateKey, nullifierNonce)`.
3. Browser generates a Groth16 proof (1,698 R1CS constraints, ~2–8 s on commodity hardware).
4. Submits `startSession(commitment, proof, nullifierNonce, nullifier)` — contract verifies proof, checks `usedNullifiers[nullifier] == false`, marks it spent, opens session.

**Known unmitigated gap in this step:** `proof`, `nullifierNonce`, and `nullifier` are plaintext arguments visible in the mempool before confirmation. A front-runner can copy the pending tuple and get it mined first — their copy is a first use of the nullifier, not a rejected duplicate, so it succeeds. `startSession` records the front-runner's own address as `session.initiator`, and `validateSession` has no caller check at all, so the front-runner walks away with a genuinely valid session authenticated as the victim's role and commitment — for up to the 24-hour session duration, without ever learning the private key. This is documented as a High-severity, unmitigated finding in the thesis (Table 4.3, Section 7.6) with a regression test in `groth16-integration.test.ts`; the fix (bind session consumption to `msg.sender == session.initiator`) is scoped as near-term future work, not implemented in the version being defended.

**What the circuit proves (zero-knowledge):**
- I know a `privateKey` such that `Poseidon(Poseidon(privateKey), walletAddress, salt) == commitment` (I own this identity).
- `nullifier == Poseidon(privateKey, nullifierNonce)` (this nonce is bound to my key, preventing forgery).

**What is hidden:** the `privateKey` and `salt` never leave the client.
**What is visible on-chain:** `msg.sender`, `commitment`, `nullifierNonce`, `nullifier`. Wallet-to-commitment linkage is visible — this is the documented residual gap.

### Sequence diagram reference
See `DEFENSE_QA_NOTES.md` for the full Mermaid sequence diagram of the login flow.

---

## 4. Implementation Highlights (~3 min)

### Circuit (circom)
- 1,698 R1CS constraints — compact enough for in-browser proving (1–8 s across tested hardware, see Section 5).
- Migrated from Noir/UltraPlonk (abandoned: ~140 KB verifier bytecode, incompatible with zksolc) to Groth16/circom. Mention this proactively if asked why an UltraPlonk verifier still exists in the repo: it's retained only as regression-test legacy code, not a live alternative.
- Trusted setup: Powers of Tau at power 11 (2¹¹ = 2,048 constraints, sufficient for this circuit's 1,698), single Phase-2 contributor — a single-party development ceremony, reproducible via `contracts/scripts/ceremony.sh`. Adequate to demonstrate the architecture; a production deployment would need a genuine multi-party ceremony or a public audited Powers-of-Tau file (e.g. Hermez's).
- *(If you have a sourced comparison to Semaphore's or a SHA-256-based circuit's constraint count, cite it here with the source — don't state a specific number from memory; I couldn't find one in the thesis, paper, or repo to back a claim like "~8,200" or "~25,000+".)*

### Smart contracts
- All four registries: UUPS upgradeable + AccessControl + custom Solidity errors.
- `ZKAuthRegistry` v1.3.0 adds commitment revocation (requires a valid ZK proof — you prove ownership to revoke, so only the key holder can revoke).
- Nullifier system prevents replay: each session uses a fresh `nullifierNonce`; spent nullifiers stored in `usedNullifiers` mapping on-chain.

### Frontend
- Proof generation: snarkjs `groth16.fullProve` running WASM in-browser.
- Credential storage: AES-GCM encrypted, key derived from wallet signature (HKDF), never stored in plaintext.
- wagmi v2 + RainbowKit for wallet connection; Vite + React + TypeScript strict mode throughout.

### Testing
- 63 tests for `ZKAuthRegistry` alone (38 core + 25 edge-case); ~87% overall contract coverage.
- NFRs met: Lighthouse 4G first load ~2.8 s, TypeScript strict, no inline assembly outside the verifier.

---

## 5. Evaluation (~3 min)

### Performance (proof generation)

**Replaced below with the actual measured data (thesis Table 7.3) — the previous draft's three devices (Apple M1 Pro, Intel i7-10750H, Intel i5-8265U) don't correspond to any measurement in the thesis, the paper, or anywhere else in this repo. If those numbers come from a real run you haven't documented yet, get them into the thesis/reproducible-benchmark record before using them on a slide — right now they'd be unverifiable if a committee member asked for the source.**

| Device | CPU | Trials | Witness | Proof gen |
|---|---|---|---|---|
| Development laptop | Intel Core i7-1185G7 | 5 (mean) | ~45 ms | ~3,200 ms |
| Mid-range desktop | AMD Ryzen 5 5600 | 5 (mean) | ~35 ms | ~2,100 ms |
| Mobile (Android) | Snapdragon 778G | 5 (mean) | ~120 ms | ~7,800 ms |
| Supplementary | Intel Core i7-6700HQ | 25 (median/mean/σ) | not separately timed | median 1,244 ms; mean 1,272 ms; σ=221 ms |

**Key point:** sub-8 s on all tested hardware; acceptable for a login flow. Flag the methodology honestly if asked: the original three rows are 5-trial means (prototype-level evidence), which is why the supplementary i7-6700HQ row exists — n=25, reporting median/mean/stdev, reproducible via `npm run benchmark:proof-generation` in `contracts/`.

### Gas costs (measured — thesis Table 7.4)
| Operation | Hardhat (gas) | zkSync Sepolia (gas) |
|---|---|---|
| `registerCommitment` | ~48,000 | ~36,000 |
| `startSession` (Groth16 verify) | ~280,000 | ~210,000 |
| `registerInstitution` | ~85,000 | ~62,000 |

Note `startSession` costs roughly 6× `registerCommitment` — it's the one running the full Groth16 pairing check, not just a storage write. Both are well within the thesis's own NFR-02 budget (<350,000 gas). At representative zkSync gas prices, `startSession` costs approximately $0.01–0.05.

**L1 comparison:** the same `startSession` on Ethereum mainnet would cost approximately $11–56 at 20–50 gwei (ETH $2,000–$4,000), versus $0.01–0.05 on zkSync — a reduction of roughly 220×–5,600× depending on which price extremes are paired, or ~1,100× under matched (equally cheap or equally expensive) conditions. Don't quote "500–2,500×" against this $11–56 range — that multiplier was computed from a single $25.20 point estimate at one specific gas price, not this range; pick one pairing and state it consistently.

---

## 6. Privacy Analysis — What is Achieved and What is Not (~2 min)

### Achieved
| Property | Status |
|---|---|
| `privateKey` hidden from chain observers | ✅ ZK proof hides it |
| Per-session nullifier unlinkability (proof replay prevented) | ✅ Nullifier system |
| Credential contents not revealed *by the auth transaction itself* | ✅ Auth proves key knowledge only, carries no credential data (see note below on what this does *not* cover) |
| Commitment revocation without revealing `privateKey` | ✅ v1.3.0 |

### Not fully achieved
| Property | Gap | Mitigation path |
|---|---|---|
| Wallet-identity unlinkability | `msg.sender` links wallet↔commitment on every tx | Meta-tx relayer (ERC-2771) — future work |
| Registration unlinkability | First `registerCommitment` tx reveals wallet+commitment | Same relayer fix |
| **Front-running resistance on `startSession`** | **High severity, distinct from the two rows above:** a front-runner can steal a genuinely valid, role-authenticated session without ever learning the private key (see Section 3) | Bind session consumption to `msg.sender == session.initiator` — near-term priority per thesis §8.2, not a deep research question |
| Cross-device credential portability | Encrypted blob in localStorage is not portable | Export/import UI — future work |
| Key recovery | Lost `privateKey`/`salt` = permanently locked commitment | Hardware-backed WebAuthn/FIDO2 keys, or threshold secret sharing — future work (thesis's actual proposed directions) |

**One-slide summary:**

```
┌───────────────────────────────────────────────────────────┐
│                Privacy & Security: Achieved vs Gap         │
├────────────────────────────┬────────────────────────────────┤
│ Achieved now               │ Not yet / Future work           │
├────────────────────────────┼────────────────────────────────┤
│ Secret key never on-chain  │ Wallet unlinkability            │
│ Nullifier replay-prevention│  → meta-tx relayer needed       │
│ Commitment revocation      │ Front-running on startSession   │
│ (proof-gated, no sk reveal)│  → bind to session.initiator    │
│                            │    (near-term priority)         │
│                            │ Cross-device portability        │
│                            │ Key recovery mechanism           │
│                            │ Selective disclosure ZK          │
└────────────────────────────┴────────────────────────────────┘
```

Note what's deliberately *not* in the achieved column: credential-content privacy at login is real (the auth transaction carries no credential data), but that's different from credential-*holding* privacy — `CertificateRegistry.getCertificatesByStudent()` is a public, unrestricted lookup, so once the wallet is known (which it always is), an observer can trivially see which credentials it holds. Don't claim this system hides that; it doesn't, and it doesn't need to.

---

## 7. Limitations & Future Work (~1 min)

1. **Bind session consumption to its initiator** (near-term priority, not a deep research question) — closes the front-running/session-impersonation gap on `startSession` by requiring `msg.sender == session.initiator`, mirroring the ownership check already applied to `endSession`. A regression test already exists (`groth16-integration.test.ts`); this is a contained contract change, listed as the most immediate fix in thesis §8.2.
2. **Meta-tx relayer** — closes the `msg.sender` wallet linkability gap (ERC-2771 / EIP-712 signed calls; relayer pool pays gas, student signs authorization off-chain). A deeper architectural change than item 1 above.
3. **Multi-party trusted setup ceremony** — the current Phase-2 ceremony has exactly one contributor (single-party development ceremony); production requires a public multi-party ceremony or migration to a universal-setup system (PLONK/Halo2).
4. **Circuit formal verification** — no under-constraint checker (e.g. Ecne) was run; future work.
5. **Credential selective disclosure** — ZK proofs for certificate attributes (e.g. "I have a degree" without revealing grade or institution) are not implemented.
6. **Key rotation / recovery** — lost credentials are irrecoverable today (`revokeCommitment()` itself requires the very key that's lost, so it's unusable exactly when needed most). Thesis's proposed directions: hardware-backed WebAuthn/FIDO2 keys, or threshold secret sharing.

---

## 8. Conclusion (~1 min)

"This thesis demonstrates that a full-stack ZK credential platform is deployable on a zkEVM rollup today, with sub-cent login costs and sub-8-second in-browser proof generation on commodity hardware.

The ZK private login layer successfully hides the student's private key from all observers. Two residual gaps are fully documented, analysed, and scoped with concrete fixes: wallet-to-commitment linkage via `msg.sender`, which needs a meta-tx relayer to close, and a front-running vulnerability on `startSession` that lets an attacker steal a valid session without learning the key, which needs a much smaller, near-term contract change to close. Naming both, rather than only the first, is itself part of this thesis's contribution — the codebase's own threat model was written specifically to stop overclaiming privacy properties it doesn't deliver, and I've tried to hold this talk to that same standard.

The codebase, circuit, and deployment scripts are open-source, reproducible, and covered by an 87% contract test suite. I consider this a rigorously-evaluated research prototype with a clearly scoped path to production — not yet production-ready itself, given the single-contributor trusted setup and the two gaps above — and a concrete foundation for the future work items I just described."

---

## Handling Q&A

For detailed prepared answers to the most likely committee questions, see `DEFENSE_QA_NOTES.md`.

**The four questions most likely to come first:**
1. Why Groth16? → smaller proof, cheapest on-chain verification, and — if pressed — the honest engineering history: it followed the abandoned Noir/UltraPlonk attempt, not a purely a-priori cost/benefit choice. Trade-off is the per-circuit trusted setup.
2. The `msg.sender` gap — is this a flaw? → No, it is an explicitly documented, accepted limitation with a known mitigation path (relayer). The ZK proof still hides the private key; the gap is at the transaction layer, not the cryptographic layer.
3. What if someone front-runs a pending `startSession`? → Expect this one. Say plainly: this is the most severe unmitigated finding in the codebase, documented in the thesis itself (Table 4.3, §7.6, §8.2), not fixed in the version being defended, with a regression test already proving the mechanism. Don't minimize it as "just griefing" — it's real, pseudonymous session/role impersonation.
4. What is the novel contribution? → End-to-end ZK private login on a zkEVM, with a nullifier system, in-browser Groth16 proving, and a formally documented privacy and security boundary (both gaps named, not just the more comfortable one) — as a single deployable open-source prototype.
