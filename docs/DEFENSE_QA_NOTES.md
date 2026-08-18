# Thesis Defense Q&A Notes: ZK Private Login

Working notes for compiling the thesis presentation for the examining committee.
Source: analysis of `frontend/src/hooks/useZKAuth.ts` and `contracts/contracts/ZKAuthRegistry.sol`.

## Q: How is zero-knowledge proof and private login achieved for a student, given the wallet must be reconnected on every private login attempt?

The wallet connects each time only to sign a fixed message locally, which derives an AES key that decrypts the student's stored secret credentials (a `privateKey`, `salt`, and `commitment`) — the wallet itself is not what gets verified on-chain, it's just the local unlock mechanism (`useZKAuth.ts:63-358`).

Using those decrypted secrets, the frontend generates a Groth16 zk-SNARK proof (via a circom circuit) that proves knowledge of a `privateKey` matching a previously registered `commitment = Poseidon(Poseidon(privateKey), walletAddress, salt)`, plus a fresh session `nullifier = Poseidon(privateKey, nullifierNonce)` — so the student proves "I own this registered identity" without revealing the private key itself, and each login uses a new nullifier to prevent replaying an old proof.

The `ZKAuthRegistry.sol` contract verifies the proof against the public `commitment`/`nullifier` and marks the nullifier spent, but note it's not fully wallet-anonymous: `startSession` is still sent as a transaction from the connected wallet, so `msg.sender` links wallet-to-commitment on every login even though the private key never leaves the client (acknowledged as a residual privacy gap in the contract's own comments, `ZKAuthRegistry.sol:38-43`).

## Diagram: private login flow

```mermaid
sequenceDiagram
    actor S as Student
    participant W as Wallet
    participant C as Client (browser)
    participant P as Prover (circom/snarkjs, in-browser)
    participant R as ZKAuthRegistry (contract)

    Note over C: Encrypted credentials already stored locally<br/>(privateKey, salt, commitment) from prior registration

    S->>W: Connect wallet
    C->>W: Request signature of fixed message<br/>(ZKAUTH_SIGNING_MESSAGE)
    W->>S: Prompt to sign
    S->>W: Approve signature
    W-->>C: Signature

    C->>C: Derive AES key via HKDF(signature)
    C->>C: Decrypt privateKey, salt, commitment
    C->>C: Pick fresh nullifierNonce

    C->>P: privateKey, walletAddress, salt,<br/>commitment, nullifierNonce (inputs)
    P->>P: Compute nullifier = Poseidon(privateKey, nullifierNonce)
    P->>P: Generate Groth16 proof that<br/>commitment == Poseidon(Poseidon(privateKey), walletAddress, salt)
    P-->>C: proof, [commitment, nullifierNonce, nullifier]

    C->>W: Request tx: startSession(commitment, proof, nullifierNonce, nullifier)
    W->>R: Submit transaction (msg.sender = student's wallet)

    R->>R: Verify Groth16 proof against public inputs
    R->>R: Check usedNullifiers[nullifier] == false
    R->>R: Mark usedNullifiers[nullifier] = true
    R->>R: Record session {initiator: msg.sender, expiry, ...}
    R-->>C: Session started (event / tx receipt)

    Note over R: msg.sender is visible on-chain every time —<br/>wallet↔commitment link is NOT hidden (see gap below)
```

**Reading the diagram:** the wallet's only two jobs are (1) sign a fixed message so the client can decrypt locally-stored secrets, and (2) submit the resulting proof as a transaction. The private key never leaves the client; the contract only ever sees `commitment`, `nullifierNonce`, `nullifier`, and the proof — plus, unavoidably today, `msg.sender`.

## Q: How does it protect against msg.sender linking each login?

It doesn't. This is an explicitly documented, unmitigated gap, not something the design defends against.

`startSession` is a plain `external` call — no ERC-2771/relayer/meta-tx path — so `msg.sender` is always the connected wallet, and the frontend always uses that same wallet's signer to submit it (`ZKAuthRegistry.sol:217-254`, `useZKAuth.ts:318,364-366`). The contract's own docstring says so directly: "wallet-address unlinkability... NOT achieved... nothing in this contract (or the frontend that calls it) decouples the transaction sender from the prover" (`ZKAuthRegistry.sol:38-43`).

`contracts/circuits/THREAT_MODEL.md:34-67` confirms this is a known, accepted limitation: any chain observer can trivially link `commitment ⇄ wallet` from the tx sender, the anonymity set is "None," and a meta-tx relayer to fix it is listed as future work, not implemented.

So today, the ZK proof hides the *private key* behind the commitment, but not *which wallet* is doing the logging in — that's visible on every transaction.

## Q: What if someone front-runs a pending `startSession` transaction?

**This is the most severe unmitigated finding in the codebase and is documented in the thesis itself (Table 4.3, Section 7.6, Section 8.2) — expect this question.**

`proof`, `nullifierNonce`, and `nullifier` are all plaintext function arguments to `startSession`, visible in the public mempool the instant a legitimate login transaction is broadcast, before it confirms. An attacker who copies that exact tuple into their own transaction and gets it mined first consumes the nullifier themselves — their copy is a *first* use, not a rejected duplicate, so it succeeds (`ZKAuthRegistry.sol:217-254`).

The consequence is worse than a forced retry: `startSession` records `initiator: msg.sender` — the *front-runner's own address* — on the resulting session (`ZKAuthRegistry.sol:244-249`), and `validateSession(sessionId)` takes only `sessionId` with **no caller check at all** (`ZKAuthRegistry.sol:311-335`; confirmed the same way in `frontend/src/hooks/useZKSessionRevalidation.ts:58`). So the front-runner ends up holding a genuinely `active` session tied to the *victim's* `role` and `commitment` — usable as if they were the victim for up to the 24-hour `SESSION_DURATION` — without ever learning `privateKey`. This is real (pseudonymous) session/role impersonation via front-running, not merely denial-of-service. The victim's own transaction simply reverts with `NullifierAlreadyUsed`, so from their side it looks like an ordinary failed login; the fact that someone else is now authenticated as them is invisible to the victim.

Note the asymmetry with `registerCommitment`: front-running *registration* is only griefing (the original registrant's tx reverts with `CommitmentAlreadyExists`, but the attacker can't authenticate without the private key, so the impact is limited to wasted gas and a retry). Front-running *`startSession`* is qualitatively worse because a session, unlike a commitment, is a bearer credential nobody re-checks against a wallet.

**Status:** documented, not fixed. A regression test proving the attacker can call `validateSession` on the resulting session lives in `contracts/test/groth16-integration.test.ts`. The recommended fix — binding session-consuming reads/actions to `msg.sender == session.initiator`, the same ownership pattern already applied to `endSession` — is listed as a near-term priority in the thesis (Section 8.2), not implemented in the version being defended. A meta-tx relayer (see below) would also close this window, since it stops exposing `startSession`'s plaintext calldata to a public mempool at all.

## Note: how a meta-tx relayer would fix this

The gap exists because the student's own wallet must pay gas and submit `startSession` directly, making `msg.sender` the student's wallet on every call. A meta-transaction relayer removes that requirement by splitting "who authorizes the call" from "who submits it on-chain":

1. **Student side (off-chain):** instead of sending the transaction, the student's client signs a message authorizing the call (target contract, calldata, nonce) and hands the ZK proof plus this signed authorization to a relayer — no on-chain action from the student's wallet.
2. **Relayer side (on-chain):** a relayer (or rotating pool of relayers) submits the actual transaction, paying gas itself. From the contract's point of view, `msg.sender` is now the relayer, not the student.
3. **Contract side:** `ZKAuthRegistry` would need an ERC-2771-style trusted-forwarder pattern (or equivalent EIP-712 signed-call verification) so it recovers the "logical" caller from the signed message for authorization purposes, while `msg.sender` stays the relayer for linkability purposes. The ZK proof/nullifier check stays exactly as-is — only the transaction-submission path changes.

This breaks the wallet↔commitment link an observer currently gets for free: many different students' sessions would all appear to come from the same relayer address(es), so watching the chain no longer reveals which wallet is behind a given login. Remaining considerations worth noting for the committee:
- The relayer sees the student's real wallet address and signed request at submission time, so it becomes a trusted (or semi-trusted) party — using multiple independent/rotating relayers, or a decentralized relayer network, reduces this single point of trust.
- Gas sponsorship economics (who pays, and how relayers are compensated) need a policy, since students no longer pay directly.
- This is listed as future work in `contracts/circuits/THREAT_MODEL.md:34-58` and is not implemented in the current codebase.

## Note: how nullifiers prevent replay attacks

A replay attack here would mean: someone captures a previously-submitted valid proof (or the calldata carrying it) and resubmits it to open another session or re-register, without knowing the student's `privateKey`.

**Why a bare proof isn't enough on its own.** A Groth16 proof for the statement `commitment == Poseidon(Poseidon(privateKey), walletAddress, salt)` is valid forever — the circuit only checks a mathematical relationship, it has no built-in concept of "already used." If the contract only checked proof validity, a captured proof (from a public mempool, an explorer, or a leaked request) could be resubmitted indefinitely to keep opening authenticated sessions, with no need to ever learn `privateKey`.

**What the nullifier adds.** Each login proof is bound to a fresh, single-use value: `nullifier = Poseidon(privateKey, nullifierNonce)`, where `nullifierNonce` is chosen per attempt. Because `nullifier` is a public input to the same proof, the contract can check "has this exact nullifier been consumed before" without ever seeing `privateKey`:

1. `usedNullifiers` is an on-chain mapping recording which nullifiers have already been spent (`ZKAuthRegistry.sol:83-98`).
2. On `registerCommitment` / `startSession` / `revokeCommitment`, the contract first verifies the Groth16 proof against `[commitment, nullifierNonce, nullifier]`, then checks `usedNullifiers[nullifier]` is false, then immediately marks it spent (`ZKAuthRegistry.sol:190-198, 225-237`).
3. Because `nullifier` is derived from `privateKey` (known only to the student) and `nullifierNonce` (fresh per attempt), an attacker who intercepts a proof and its calldata can resubmit the identical transaction, but it will carry the identical `nullifier` — which is now marked spent — so the second submission reverts.
4. To log in again legitimately, the student's client picks a new `nullifierNonce` and generates a brand-new proof with a brand-new `nullifier`, which is why replaying an old transaction can never produce a "fresh" login: the attacker cannot compute a new valid `nullifier` without `privateKey`.

**What this does and doesn't protect.** This binds each proof to single-use, preventing verbatim replay of a captured transaction. It does not, by itself, hide the wallet submitting the transaction (see the relayer note above) — nullifier-based replay protection and sender-unlinkability are separate properties addressed by separate mechanisms.

---

## Additional Questions the Committee May Ask

### ZK Proof System & Cryptography

## Q: Why Groth16 over alternatives (PLONK, STARKs, Bulletproofs)?

**Important framing point: this wasn't a purely a-priori cost/benefit choice — it followed a real, documented engineering failure, which is itself one of the thesis's practical findings.** The project originally implemented the circuit in Noir (Aztec's ZK DSL) targeting UltraPlonk via the Barretenberg backend. The UltraPlonk verifier Noir/Barretenberg generated was incompatible with zkSync Era's zkEVM: the generated verifier contract needed roughly 140 KB of bytecode and used assembly patterns `zksolc` could not compile. That incompatibility drove the migration to Circom/Groth16, which does compile under `zksolc`. The Noir/UltraPlonk circuit (`contracts/circuits/auth_login/src/main.nr`) and its verifier (`UltraPlonkAuthVerifier.sol`/`UltraPlonkAuthVerifierAdapter.sol`) are still in the repo, but only as regression coverage (`zkauth-integration.test.ts`) for legacy code — **the deployed system uses Groth16 exclusively; no gas/timing/"production-ready" figures from the UltraPlonk suite describe what's actually deployed.** If asked "why is there an UltraPlonk verifier in the repo," this is the honest answer — it is not a live, selectable alternative.

Independent of that compatibility finding, Groth16 is also the right choice on cost grounds for this use case: it has the smallest proof size of any general-purpose SNARK (exactly 3 group elements — 2 in G₁, 1 in G₂ on BN254 — 256 bytes total), and Ethereum/zkSync natively support the `ecPairing` precompile (EIP-196/197) that makes verifying it cheap (~170,000–260,000 gas for the pairing check alone; ~210k gas measured end-to-end on zkSync Sepolia for `startSession`, Table 7.4). The trade-off is the per-circuit trusted setup (below). PLONK/UltraPlonk uses a universal, updatable setup instead, at the cost of larger proofs (~768 bytes) and higher verification gas. STARKs need no trusted setup and are post-quantum secure, but proofs run 40–200 KB, which would cost far more gas to verify on-chain than a Groth16 pairing check. Bulletproofs need no trusted setup either, but verification is linear in circuit size rather than constant, which rules them out for on-chain use. Since every login here is an on-chain transaction, verification cost dominates, and that's what makes Groth16 the right call even setting the zkEVM-compatibility issue aside.

## Q: What are the security assumptions of Groth16?

Groth16's knowledge soundness relies on the q-Power Knowledge of Exponent (q-PKE) assumption in a bilinear group — BN254 in this stack. q-PKE is *non-falsifiable*: unlike standard assumptions such as discrete log or CDH, it cannot be disproved even in principle, only either accepted as folklore or eventually broken. This is a known, accepted property of Groth16 in the literature, not a weakness specific to this implementation. (An alternative using PLONK would rest on the algebraic group model plus the random oracle model instead — a marginally cleaner theoretical footing — at the cost of the larger proofs/gas noted above.)

Separately, Groth16 requires a per-circuit trusted setup: a two-phase ceremony (universal Powers-of-Tau, then a circuit-specific Phase 2) that produces the proving/verification keypair. If any participant in either phase retains their randomness ("toxic waste") without destroying it, they can forge proofs that pass verification. For this thesis, Powers of Tau was run locally at power 11 (2¹¹ = 2,048 max constraints — sufficient for the circuit's 1,698 constraints), and Phase 2 had exactly **one contributor** — a single-party development ceremony with no transcript or attestation, reproducible via `contracts/scripts/ceremony.sh`. That is adequate to demonstrate the architecture for a thesis defense, but it means the proving key's integrity currently rests on that one party's honesty; a production deployment would need either a genuine multi-party ceremony or reuse of a public, audited Powers-of-Tau file (e.g. Hermez's perpetual ceremony).

## Q: Why Poseidon hash instead of SHA-256 or keccak?

Poseidon is designed specifically for ZK-circuit efficiency: it's an arithmetic (field-native) hash built from additions and a low-degree S-box, evaluated directly over the BN254 scalar field, whereas SHA-256/keccak are bit-oriented designs (XOR, rotation, bitwise logic) that must be emulated with expensive bit-decomposition gadgets inside an R1CS circuit — costing thousands of constraints per call. This project's whole circuit — 3 Poseidon calls plus a 160-bit range check on `walletAddress` — compiles to 1,698 constraints total; a single SHA-256 call alone would likely exceed that. This constraint-efficiency is why Poseidon is the standard choice for in-circuit hashing in Groth16-based systems (commitment schemes, Semaphore, etc.).

## Q: Why is the commitment nested — `Poseidon(Poseidon(privateKey), walletAddress, salt)`?

The inner hash `Poseidon(privateKey)` hides the raw `privateKey` even from an adversary who knows `walletAddress` and `salt` — they cannot invert the outer hash to recover `privateKey` because they only see its image. The outer hash then binds the identity to a specific wallet, so a commitment is only valid for the registering address. Without the nesting, knowing `walletAddress` and `salt` plus the commitment preimage structure could allow offline brute-forcing of a short or weakly-random `privateKey`.

---

### Credential & Key Management

## Q: What happens if a student loses their `privateKey` or `salt`?

They cannot log in and cannot generate a valid revocation proof — `revokeCommitment()` itself requires a valid ZK proof of knowing the *same* `privateKey` that's now lost, so it's unusable precisely when it would be needed most. The commitment is permanently locked on-chain with no owner who can act on it. This is the most critical limitation for any real-world deployment: unlike a wallet seed phrase, a lost or compromised ZK secret key cannot be revoked or rotated without abandoning the identity and registering a brand-new, unlinkable commitment. There is no recovery path in the current implementation. The thesis names two concrete directions for future work rather than leaving this abstract: hardware-backed key storage (WebAuthn/FIDO2-bound keys, so the secret never lives in plain browser storage to begin with) or threshold secret sharing (splitting the secret across trusted shares so a threshold can reconstruct it) — either would need dedicated design work before production use.

## Q: What is the trust assumption on browser localStorage?

The credentials are stored encrypted (AES-GCM), so a passive read of localStorage yields only ciphertext. However, the AES key is derived from a wallet signature at login time; if a device is compromised by malware or an XSS vulnerability, the attacker can intercept the signature at the moment it is produced and derive the same key. The security boundary is therefore the integrity of the browser environment, not merely the confidentiality of stored data.

## Q: What if the user switches browsers or devices?

The encrypted credential blob lives in the origin's localStorage and is not automatically portable. A user on a new device has no way to log in until the encrypted blob is exported and imported manually. The current implementation does not provide an export/import UI, making cross-device use a practical limitation that would need to be addressed before production deployment.

---

### Smart Contract Architecture

## Q: Why UUPS upgradeable proxy rather than a transparent proxy or an immutable contract?

Transparent proxies store an admin slot and perform an extra storage read on every call to decide whether to delegate. UUPS moves the upgrade logic into the implementation itself, eliminating that overhead and saving gas on every interaction. The trade-off is safety: a buggy UUPS implementation that removes or breaks the `_authorizeUpgrade` function can permanently brick the proxy with no recovery. Immutable contracts would be safer but would make fixing post-deployment bugs impossible; given the early stage of the project, upgradeability was prioritised.

## Q: Can a registered commitment be revoked, and what if a student's wallet is compromised?

`revokeCommitment` exists in `ZKAuthRegistry` and requires a valid Groth16 proof, so revocation itself is ZK-protected — the student proves knowledge of the `privateKey` behind the commitment without revealing it. However, if the wallet is compromised and the attacker also has access to the locally stored credentials (or can intercept the decryption signature), they can revoke the legitimate user's commitment or generate new sessions. The system has no out-of-band revocation path that bypasses proof knowledge.

## Q: What prevents a malicious actor from registering a commitment on behalf of someone else?

`registerCommitment` requires a valid Groth16 proof that `commitment == Poseidon(Poseidon(privateKey), walletAddress, salt)`. An attacker who does not know `privateKey` cannot produce a valid proof for someone else's commitment, so they cannot register an identity as someone else. They can register their own commitment from their own wallet, but that is normal use.

Two nuances worth being precise about if pressed: (1) `walletAddress` is a *private* circuit input folded into the commitment hash, not a public input — the circuit never checks it against `msg.sender`, and neither does the contract (see the front-running note above for why that matters). (2) The `role` argument (Student/Employer) passed to `registerCommitment` is plain calldata, not something the circuit constrains at all — a user can register as either role regardless of their actual status, since role eligibility is cross-checked against `EmployerRegistry`/`CertificateRegistry` only on the Web3 auth path, not the ZK path. This is a known, named gap (not something to claim is prevented).

---

### Privacy & Threat Model

## Q: What is the exact privacy guarantee — what can a chain observer learn?

A chain observer sees: (1) `msg.sender` — the student's wallet address, on every registration and login; (2) the `commitment` — a hash that is stable across sessions for the same student, so sessions are trivially linkable to each other and to the wallet; (3) `nullifierNonce` and `nullifier` — per-session values that reveal nothing about `privateKey`; (4) session metadata (expiry, block timestamp). What the observer cannot learn: the `privateKey` or `salt`. The privacy guarantee is therefore limited to hiding the ZK credential secret, not hiding participation or wallet identity.

## Q: What if the Groth16 verifier contract has a bug?

If the on-chain verifier accepts proofs it should reject (a soundness bug), any attacker could forge a proof and open a session for any registered commitment without knowing `privateKey`. The verifier contract in this project is generated from the Groth16 verification key by snarkjs; it was not independently formally verified. In production, the verifier should be audited or formally verified (e.g. with a tool like Circom's r1cs export + constraint checker, or an independent auditor reviewing the Solidity output).

## Q: What if the circom circuit is under-constrained?

An under-constrained circuit allows witness values that satisfy the R1CS system without satisfying the intended logical statement — a well-known class of circom bugs. The consequence here would be that a prover could construct a proof that passes on-chain verification while using a `privateKey` that does not match the registered `commitment`. The circuit in this project was reviewed manually; it was not run through a formal under-constraint checker (e.g. `circom --inspect` or a dedicated tool like Ecne). This is an acknowledged limitation for a prototype.

---

### zkSync-Specific Choices

## Q: Why zkSync rather than Ethereum mainnet, Polygon, or another L2?

zkSync Era is an EVM-compatible ZK rollup, which means: (1) gas costs are lower than mainnet (relevant since every login is a transaction); (2) the L2 itself uses ZK proofs for state validity, aligning with the thesis theme of ZK-based systems; (3) the zkSync hardhat plugin and deploy toolchain were sufficiently mature for a research prototype. The trade-off is ecosystem immaturity relative to Polygon PoS and a smaller developer community than Optimism/Arbitrum.

## Q: Does zkSync's own ZK validity proof interact with the application-level Groth16 proofs?

No — these are entirely independent layers. zkSync produces a ZK proof (using PLONK-based proofs) that the L2 state transition from one block to the next was computed correctly; this proof is verified on Ethereum L1. The application's Groth16 proof proves that a specific user knows the secret behind a commitment; this proof is verified inside `ZKAuthRegistry` on the L2. The two proof systems share no state and have no cryptographic dependency on each other.

## Q: What are the gas costs for registration and login?

**Use the thesis's own measured figures here (Table 7.4), not the rough estimates in `LOCAL_TESTING_GUIDE.md` — the two disagree and the thesis numbers are the ones a committee member is likely to have just read.** Measured via `hardhat-gas-reporter` locally and zkSync Sepolia transaction receipts after actual deployment:

| Operation | Hardhat (gas) | zkSync Sepolia (gas) |
|---|---|---|
| `registerCommitment` | ~48,000 | ~36,000 |
| `startSession` (ZK verify) | ~280,000 | ~210,000 |

`startSession` costs roughly 5–6× `registerCommitment` because it runs the full Groth16 pairing check on every login, not just a storage write. Both are well within the thesis's own NFR-02 budget of <350,000 gas for ZK verification. At representative zkSync L2 gas prices (0.05–0.25 Gwei), a `startSession` call costs approximately $0.01–0.05; the same operation is estimated at roughly $11–56 on Ethereum L1 at 20–50 Gwei and $2,000–4,000/ETH — a reduction of about three orders of magnitude, which is the thesis's actual evidence for L2 viability (RO-4), not just a qualitative "gas is cheaper on L2" claim.

---

### Comparison to Related Work

## Q: How does this compare to W3C Verifiable Credentials / SSI systems?

W3C VCs are issuer-signed JSON-LD documents presented off-chain; verification is typically a signature check, not a ZK proof, so the verifier learns the full credential contents. This system is complementary: the ZK login layer proves identity without revealing the private key, but the credential issuance layer (CertificateRegistry) is not ZK-protected in the same way — institutions issue certificates that are readable on-chain. A full VC+ZK system would also apply selective-disclosure proofs to the credential contents, which is out of scope here.

## Q: How does this compare to Semaphore, Polygon ID/Iden3, or Zcash?

**Stick to what the thesis actually argues here (Section 3.5) — don't reach for WorldID or zkLogin, neither is discussed or researched in the thesis, and improvising a comparison under questioning is riskier than saying "out of scope."**

**Semaphore** directly inspired this system's commitment/nullifier pattern: users register `Poseidon(identityTrapdoor, identityNullifier)` in a Merkle tree, then prove Merkle membership plus reveal a nullifier to signal anonymously. The key architectural difference is commitment storage: Semaphore's Merkle tree hides *which* commitment is signalling, giving full anonymity within the group; this system uses a plain `mapping(bytes32 => bool)`, which is cheaper (no on-chain tree updates, no Merkle-path circuit arguments) but ties each commitment explicitly to the registering wallet. That trade-off is deliberate — wallet-level anonymity was never a design goal here — and the mapping could be swapped for a Semaphore-style tree in a future upgrade without changing the circuit's commitment/nullifier structure.

**Polygon ID/Iden3** is the most directly comparable production system: a decentralised identity framework with W3C Verifiable Credential support and ZK *selective disclosure* over Groth16, deployed on Polygon PoS. It's production-grade and proves *credential possession*, which this system's circuit does not do (this circuit authenticates the user; credential validity is checked separately via registry lookup) — but it doesn't target zkSync Era, and its JSON-LD claim schema and issuer infrastructure are considerably more complex than a single-institution academic-credential use case needs.

**Zcash/Zerocash** is the origin of the nullifier concept itself: a nullifier derived from a spent note's private key prevents double-spending without linking spends to the same owner — directly analogous to this system's session nullifier (the "note" is the identity credential, "spending" is logging in). Zcash's Sapling upgrade (2018) adopted Groth16 in production, which is real-world evidence for the proof system's viability here. The structural difference is that Zcash's circuit also proves value conservation (irrelevant for authentication) and uses a Merkle tree of note commitments for anonymity, which — same as with Semaphore — this system trades for simpler, cheaper commitment storage.

None of these three were extended or forked; this thesis implements the commitment/nullifier construction directly in Circom, which is the next question.

## Q: Why implement this directly in Circom rather than extending Semaphore or a similar library?

Two reasons, and it's worth being honest that one is pedagogical and one is substantive. Pedagogically: implementing the circuit, trusted setup, proof generation, and on-chain verifier from scratch demonstrates full-stack understanding of the ZK pipeline — using Semaphore's library would abstract away exactly the components the thesis investigates. Substantively: none of the surveyed systems (Semaphore, Polygon ID) integrate ZK-based authentication *with* an on-chain credential-issuance/management system the way this thesis does — that integration gap is a named contribution, not something an existing library provides off the shelf. The trade-off is that a from-scratch construction has not been audited at the level of a widely-deployed library like Semaphore, which is an accepted limitation of a research prototype and part of why an external audit is listed as required before any production use.

---

### Contribution & Limitations

## Q: What is the novel contribution of this thesis?

Frame this the way the thesis itself does (Chapter 1's gap analysis), not as a generic "full-stack prototype" claim — a committee will read the latter as vague. The specific gap: none of the surveyed related-work systems integrate ZK-based authentication with on-chain credential issuance and management — Semaphore and Polygon ID each do one half (anonymous signalling, or credential presentation) but not both together. The contribution is a Groth16-based ZK authentication protocol (Poseidon commitments, session nullifiers, implemented in Circom and integrated via snarkjs into a React frontend) integrated end-to-end with a credential-issuance system (institution/certificate/employer registries) on zkSync Era — with the residual privacy gap (wallet-level linkability via `msg.sender`, plus the front-running finding above) explicitly measured and documented rather than glossed over, and a concrete, scoped path to closing the linkability gap via a meta-tx relayer. The UUPS-upgradeable registries and encrypted local storage are supporting engineering, not the contribution itself — don't lead with them if asked "what's novel here."

## Q: What would be required to take this from prototype to production?

At minimum, roughly in priority order: (1) bind session consumption to `msg.sender == session.initiator` to close the `startSession` front-running gap — the smallest, most contained fix, already has a regression test, listed as the near-term priority in thesis §8.2; (2) a public trusted setup ceremony for the Groth16 circuit; (3) a security audit of the circom circuit and Solidity contracts; (4) a meta-tx relayer to close the `msg.sender` linkability gap — a larger architectural change than (1); (5) a cross-device credential export/import or recovery mechanism; (6) formal under-constraint checking for the circuit; (7) a mainnet deployment with a multi-sig admin and a rehearsed upgrade procedure.

## Q: What is the anonymity set for a logged-in student today (without the relayer)?

None — say it exactly that way, matching the codebase's own threat model and the thesis's terminology, rather than "one," since a committee member who has read either could reasonably read "one" as hedging. Because `msg.sender` is the student's wallet on every `startSession` call, and the `commitment` is stable across sessions and is itself a public input to `startSession`, any on-chain observer can trivially link every session back to a single wallet — from the very first registration transaction, with nothing further to compute. The ZK proof hides only `privateKey` (and, via the commitment, `salt`); it provides no unlinkability at the transaction-sender level. Precisely: this system achieves *nullifier unlinkability* (an observer can't correlate sessions from nullifier values alone, since each is `Poseidon(privateKey, freshNonce)`) but not *registration/wallet unlinkability* — two formally distinct properties, and it's worth naming both by name if asked, since conflating them is the exact mistake this project's own docs made and later had to correct.
