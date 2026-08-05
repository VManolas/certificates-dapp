# zkCredentials ZK-Auth Threat Model

This document states, precisely, what the `auth_login` circuit and `ZKAuthRegistry` actually
achieve, what they don't, and how the scheme compares to the two systems it's most often confused
with — Semaphore and zkLogin. It exists because the codebase's own comments and docs previously
overclaimed a privacy property the system does not deliver; see [`SECURITY_REVIEW.md`](./SECURITY_REVIEW.md)
for the code-level detail behind each claim here.

## What's proven

The production circuit, [`auth_login_groth16/auth_login.circom`](./auth_login_groth16/auth_login.circom)
(lines 22-55), proves knowledge of a `privateKey` such that:

```
publicKey  = Poseidon(privateKey)
commitment = Poseidon(publicKey, walletAddress, salt)
nullifier  = Poseidon(privateKey, nullifierNonce)
```

with `commitment`, `nullifierNonce`, and `nullifier` public, and `privateKey`, `walletAddress`,
`salt` private. `walletAddress` is range-checked to 160 bits (line 34) but is **not** a public
signal — it is folded into the `commitment` hash and never surfaces on its own.

This is a well-defined knowledge-of-preimage relation with a session nullifier: structurally, a
minimal Semaphore-style commitment/nullifier scheme, not a toy circuit.

## What's achieved: key-secrecy

The private key never appears on-chain, in calldata, or in any transaction the contract accepts.
An observer who has the `commitment` cannot recover `privateKey` or `walletAddress` from it
(Poseidon preimage resistance), and cannot forge a valid proof without knowing `privateKey`.
This is the property the system actually delivers.

## What's NOT achieved: address-unlinkability

The circuit hiding `walletAddress` as a private input has no bearing on-chain, because
`registerCommitment` and `startSession` are called directly from the user's own connected wallet
(`frontend/src/hooks/useZKAuth.ts:217-222` and `:363-368`) — `msg.sender` on every such
transaction **is** the user's wallet. Any chain observer trivially links `commitment ⇄ wallet`
from the transaction sender field on the very first registration, independent of anything the
proof hides.

This is not a bug in the circuit — the circuit was never asked to prove `msg.sender ==
walletAddress`, and `ZKAuthRegistry.sol` never checks that equality either (see
`SECURITY_REVIEW.md`, finding 2). It is a fact about the deployed system that the codebase's
comments previously stated backwards. The corrected claim: **this system achieves key-secrecy,
not address-unlinkability.** Anywhere the docs said "students authenticate without revealing
their wallet address," that was wrong, and has been corrected.

### Path to real address-unlinkability (future work, not a current gap)

Address-unlinkability would require decoupling `msg.sender` from the prover — e.g. a
meta-transaction relayer that accepts a signed proof off-chain and submits
`registerCommitment`/`startSession` on the user's behalf. This is deliberately scoped as future
work rather than a fix, because a relayer is a new trust-model component, not a config change:
it introduces relayer liveness as a dependency, a potential censorship point (a relayer can
selectively refuse to submit), and a gas-sponsorship cost model that doesn't exist today. None of
that is implemented in this codebase.

## Comparison to Semaphore and zkLogin

| | This system | Semaphore | zkLogin |
|---|---|---|---|
| **What's proven** | Knowledge of a private key behind a registered commitment, plus a fresh session nullifier | Membership in a Merkle-tree group, plus a fresh signal nullifier | Knowledge of an OIDC JWT signed by a trusted issuer, binding an ephemeral address to an identity claim |
| **Anonymity set** | None — the registering wallet is always the tx sender | The group (all members of the Merkle tree) | The OIDC issuer's user base, bounded by issuer trust |
| **Trust root** | A single admin-set Groth16 verifier contract | A Merkle root committed on-chain by the group | An OIDC provider (Google, etc.) plus a trusted salt/JWK service |
| **Address-unlinkability** | Not achieved (see above) | Achieved, by design — the whole point is hiding *which* group member signaled | Not the goal — zkLogin binds an ephemeral address to an OIDC identity, it doesn't hide wallet-tx linkage either |

**Conclusion**: this system's actual research contribution is applying a minimal Semaphore-style
commitment/nullifier scheme to role-gated on-chain authentication for an educational-credentials
platform — not a new address-privacy mechanism, and not a reimplementation of Semaphore's
group-membership anonymity set (there is no Merkle tree here; every commitment is checked
individually via `commitments[commitment]`). It should be framed and defended as that: a targeted
application of an existing cryptographic pattern to a new domain, with an honestly-scoped privacy
property (key-secrecy), rather than as a privacy-preserving-identity system in the Semaphore or
zkLogin sense.

## Trusted setup

The Groth16 proving/verification key pair for `auth_login` was generated via:

- Powers of Tau: `pot11_0000.ptau → pot11_0001.ptau → pot11_final.ptau`
- Phase-2 (circuit-specific): `auth_login_0000.zkey → auth_login_final.zkey`

Both show exactly **one contributor** and no transcript, beacon, or attestation. This is a
single-party development ceremony. Whoever ran that single contribution could, in principle,
have retained the toxic waste and forged proofs — the entire point of a multi-party ceremony is
to make that require collusion across independent, non-colluding participants, and this ceremony
has none of that. This is adequate for a prototype and a thesis defense, where the deployed
system's purpose is to demonstrate the architecture, not to hold real value. It would need a
genuine multi-party ceremony (or reuse of a public, audited Powers-of-Tau file, e.g. Hermez's or
the Perpetual Powers of Tau) before this circuit's proving key could be trusted for anything
beyond a demo/testnet deployment.

## Adversary model

- **Chain observer** (anyone reading blocks/mempool): can link every `commitment` to the wallet
  that registered/used it, per "What's NOT achieved" above. Cannot recover `privateKey` or forge
  proofs.
- **Front-runner** (sees a pending, unconfirmed `startSession` transaction): can resubmit the
  identical `(commitment, proof, nullifierNonce, nullifier)` tuple first. This is not merely a
  griefing/DoS vector — `startSession` records `initiator: msg.sender` (the front-runner's own
  address) on the resulting session, and `validateSession(sessionId)` has no caller check at all
  (it takes only `sessionId` and returns `(isValid, role, commitment)` to anyone who calls it).
  So the front-runner ends up holding a genuinely valid, on-chain session authenticated as the
  victim's `role`/`commitment` — for up to `SESSION_DURATION` (24h) — without ever learning the
  private key. That is real (if pseudonymous) session/role impersonation via front-running, not
  just a forced retry. The victim's original transaction still reverts with
  `NullifierAlreadyUsed`, so from the victim's side it looks like a failed login, but the deeper
  consequence is that the attacker is now authenticated as them. See `SECURITY_REVIEW.md` finding
  3 (severity corrected during cross-review — an earlier draft of this document understated this
  as "griefing, not impersonation," which was wrong) and the regression test in
  `contracts/test/groth16-integration.test.ts`. **Recommended follow-up fix** (not implemented in
  this pass, scoped as future work): bind session-consuming actions to `msg.sender ==
  session.initiator`, the same pattern already applied to `endSession` — see Track 1 of this
  project's fixes.
- **Compromised/malicious admin**: `ZKAuthRegistry.ADMIN_ROLE` can call `setVerifier()` to swap
  the verifier contract entirely. A malicious verifier could accept forged proofs. This is the
  same admin-key trust assumption that applies to every `UUPSUpgradeable` contract in this
  codebase (the admin can also just upgrade the implementation) — it is not specific to the ZK
  auth path and is not re-litigated in depth here.

## Summary

| Property | Status |
|---|---|
| Private-key secrecy | ✅ Achieved |
| Nullifier-based replay protection (within one context: register / session / revoke) | ✅ Achieved |
| Wallet-address unlinkability | ❌ Not achieved — `msg.sender` reveals it on every tx |
| Front-running resistance on `startSession` | ❌ Not achieved — a front-runner can obtain a valid session authenticated as the victim's role/commitment (see Adversary model above) |
| Trusted-setup integrity | ⚠️ Single-party dev ceremony — prototype-grade only |
| Proof malleability resistance | ⚠️ Stock snarkjs verifier — known library-level limitation |
