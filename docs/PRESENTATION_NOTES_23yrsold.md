# zkCredentials as a Threat-Modeling Case Study

## Why this document exists

You already know what a hash function is. You know what a nonce is for. You've probably built a
toy Diffie-Hellman exchange in an undergrad course and you can define "replay attack" without
looking it up. This document isn't going to re-teach you cryptographic primitives — it's going to
hand you a real, deployed (testnet) system and walk through it the way you'll spend the next two
years learning to walk through systems professionally: what does it claim to protect, what does it
actually protect, where's the gap between those two things, and how do you know the difference?

The system is zkCredentials: a ZK-authenticated credential registry on zkSync Era. It's small
enough to hold in your head completely (four contracts, one circuit, ~1,700 R1CS constraints),
which makes it a better teaching artifact than most of what you'll audit professionally — real
production systems are usually too large to reason about end-to-end. This one isn't. Use that.

Three things make it worth your specific attention as an incoming security MSc cohort, more than
the underlying cryptography does:

1. It ships its own **threat model document** and a separate **internal security review** —
   written by the same person who built the system, about their own system. That's a rare
   artifact. Most projects never write this down at all.
2. That threat model **corrects an earlier overclaim** the codebase itself made ("students
   authenticate without revealing their wallet address" — false, and said so in the code's own
   comments until someone caught it). You're about to spend two years reading other people's
   security claims skeptically. Here's a documented example of a team catching *itself* being
   wrong, in writing, with the correction dated and reasoned.
3. One specific finding — front-running on `startSession` — was **re-assessed upward in severity
   during cross-review**, from "Medium, just griefing" to "High, actual session impersonation."
   That correction is preserved in the docs, not silently edited away. Section 5 below is a
   full case study of exactly how that reclassification happened and why the first assessment was
   wrong. This is the single most useful part of this document for your coursework — it's a live
   example of severity misjudgment, caught and corrected, with the reasoning shown.

---

## 1. System under analysis, briefly

Four Solidity contracts, UUPS-upgradeable, deployed on zkSync Era (Sepolia testnet):

- `InstitutionRegistry` / `EmployerRegistry` — role registration with cross-registry conflict
  checks (an address can't simultaneously be a university, an employer, and a student).
- `CertificateRegistry` — stores SHA-256 hashes of credential documents (never the documents
  themselves) and revocation flags.
- `ZKAuthRegistry` — the interesting one. Commitment-and-nullifier ZK authentication: a user
  registers `commitment = Poseidon(Poseidon(sk), walletAddress, salt)`, then authenticates by
  proving knowledge of `sk` behind a registered commitment via a Groth16 proof, consuming a
  fresh nullifier each session.

The circuit (`auth_login.circom`, Circom 2.1, compiled to 1,698 R1CS constraints) enforces exactly
three relations: a range check on `walletAddress` (160 bits, so it can't overflow/wrap as a field
element), the commitment relation, and the nullifier relation. Verification happens on-chain via
a snarkjs-generated Groth16 verifier calling the BN254 `ecPairing` precompile (EIP-197),
measuring ~210,000 gas on zkSync Sepolia for a full `startSession` call.

That's the whole system. Now let's break it.

---

## 2. The cryptographic core: what's actually being assumed

Groth16's knowledge soundness rests on the **q-Power Knowledge of Exponent (q-PKE) assumption**
over BN254. Two things worth internalizing early in a security MSc, because you'll hit this
distinction constantly:

- **q-PKE is non-falsifiable.** Unlike discrete log or CDH, which admit reduction-based proofs
  against a concretely-defined hard problem, a knowledge-of-exponent assumption can't be disproven
  even in principle — it's closer to "we haven't found an attack and we don't expect to" than "we
  proved this is hard." This is a known, accepted characteristic of Groth16 in the literature, not
  a defect specific to this implementation, but it's exactly the kind of assumption you should be
  trained to *notice* and flag when you're doing a real review, rather than pattern-matching
  "SNARK = secure" and moving on.
- **BN254 provides roughly 100–110 bits of classical security** against discrete-log attacks — but
  a fault-tolerant quantum computer running Shor's algorithm solves ECDLP in polynomial time,
  breaking both the Groth16 soundness argument and Poseidon's field-arithmetic security
  simultaneously. There's no currently-existing hardware that does this. There's also no
  cryptographic reason to assume there won't be, eventually, which is exactly why post-quantum
  migration paths (STARKs, which rest only on hash-function security, are the usual answer) are a
  standard line item in any serious system's future-work section — including this one's.

The formal security goals this system claims (labeled SG-1 through SG-5 in the source thesis, so
you can go find the actual reduction arguments):

| Goal | Claim | What breaks it |
|---|---|---|
| SG-1 Commitment binding | Can't produce a valid proof for a commitment you didn't generate | Poseidon collision |
| SG-2 Commitment hiding | Commitment reveals nothing about `sk` | Salt gives 254-bit blinding; *computational* hiding only, not information-theoretic — contrast with Pedersen commitments, which are unconditionally hiding |
| SG-3 Proof soundness | No PPT adversary without `sk` forges an accepted proof | q-PKE on BN254 |
| SG-4 Replay resistance | A captured proof can't be resubmitted to open a second session | `usedNullifiers` mapping |
| SG-5 Nullifier unlinkability | Two sessions from the same user don't share a nullifier | Fresh nonce per session |

Notice what's *not* on that list — there's no SG-6 for "wallet unlinkability." That's not an
oversight. Read on.

---

## 3. Threat modeling methodology: how this project built its own

A good exercise before you read the project's actual `THREAT_MODEL.md` and `SECURITY_REVIEW.md`
(both in `contracts/circuits/`): try to construct the adversary model yourself first, then compare.

**Assets.** What is this system actually trying to protect? Three things, explicitly enumerated:
the secret key `sk` (must never be recoverable by an observer), the binding between a credential
and its holder (the commitment ties a ZK identity to a wallet), and certificate-record integrity
(hashes, revocation status, issuing institution).

**Adversary capabilities, explicitly scoped.** The threat model assumes an adversary who can
passively read all on-chain data, submit arbitrary transactions, and reorder/delay/front-run
pending mempool transactions. It explicitly does *not* model: an adversary who compromises the
trusted setup (assumes at least one honest Powers-of-Tau participant — a real assumption worth
scrutinizing given what you'll see in section 6), side-channel attacks on the client device,
front-running of *credential issuance* (distinct from commitment registration front-running, which
*is* in scope), and social engineering against institution staff. This scoping-out is not laziness
— every threat model has to draw a boundary somewhere, and a good one states the boundary
explicitly rather than leaving you to guess what's covered. When you write your own threat models
this semester, this is the standard to hold yourself to: readers should never have to infer scope.

**The self-correction, specifically.** Here's the part worth slowing down for. `THREAT_MODEL.md`
opens with this sentence: *"It exists because the codebase's own comments and docs previously
overclaimed a privacy property the system does not deliver."* The overclaim: earlier versions of
`ZKAuthRegistry.sol`'s comments and this project's docs stated that ZK authentication let students
log in "without revealing their wallet address." That's false — `registerCommitment` and
`startSession` are called directly from the user's connected wallet, so `msg.sender` links
`commitment ⇄ wallet` on the very first transaction, independent of anything the proof itself
hides. The corrected framing, stated precisely: **this system achieves key-secrecy, not
address-unlinkability.** Two different properties, and conflating them is exactly the kind of
mistake that turns a defensible security claim into an indefensible one. When you write a security
advisory or a design doc in your career, that distinction — *what specific property did we
achieve, versus what did we imply we achieved* — is the whole job.

---

## 4. Trust boundaries: what a single compromised key actually gets you

Two single points of trust worth mapping precisely, because "where does trust actually
concentrate" is the first question in any real system review.

**The admin key.** `ADMIN_ROLE` (via OpenZeppelin `AccessControl`) can call `_authorizeUpgrade` on
any of the four UUPS proxies (replace the entire contract logic) and `setVerifier()` on
`ZKAuthRegistry` (swap the Groth16 verifier for an arbitrary contract). A compromised admin key
doesn't need to break Groth16 at all — it can just point `authVerifier` at a verifier that always
returns `true`, and every future proof submission is trivially forgeable. This is explicitly
flagged as the project's **most significant residual risk** in its own security review, mitigated
in a production deployment by a multi-sig + timelock, neither of which is implemented in the
version under review. Notice the shape of this risk: it's not a cryptographic weakness at all,
it's a key-management and access-control weakness sitting *next to* strong cryptography. This
pattern — strong crypto, weak surrounding trust architecture — is the single most common real-world
finding in production security reviews. Don't let an elegant zk-SNARK distract you from asking
"who can call `setVerifier`, and how is that key stored?"

**The trusted setup ceremony.** Groth16 requires a circuit-specific structured reference string.
This project's: Powers of Tau at power 11 (2¹¹ = 2,048-constraint capacity, comfortably above the
circuit's 1,698), Phase 2 with **exactly one contributor**, no transcript, no public beacon, no
attestation — reproducible locally via `contracts/scripts/ceremony.sh`. If that single contributor
retained the "toxic waste" (the secret randomness that should be destroyed after contributing),
they could forge arbitrary proofs indefinitely, and nothing in the deployed system would detect it.
The project is explicit that this is adequate *only* for demonstrating the architecture, not for
anything holding real value — production would require either a genuine multi-party ceremony or
substituting a public, audited Powers-of-Tau file (e.g., the Hermez Network's perpetual ceremony).
Ask yourself: how would you even *detect*, as an external auditor, whether a single-contributor
ceremony's toxic waste was destroyed? (You mostly can't. That's exactly why multi-party ceremonies
exist — they convert an undetectable trust assumption into a collusion-resistance argument across
independent parties.)

**Local key custody.** The secret key lives in browser `localStorage`, AES-GCM encrypted, with the
AES key derived via HKDF from a wallet signature produced at login time. A passive read of
`localStorage` yields ciphertext only — but an active attacker (XSS, malicious extension,
compromised device) can intercept the signature at the moment it's produced and derive the same
key, at which point the encryption provides no protection at all. The security boundary here is
**the integrity of the browser execution environment**, not the confidentiality of stored
ciphertext — a distinction worth naming precisely, since "it's encrypted" is not, by itself, a
security property; it's only as strong as the boundary protecting the key.

There is also **no forward secrecy**. If an attacker obtains `sk` at any point — via the above, or
any other route — they can (a) compute the victim's commitment and confirm the link, (b) forge
proofs and authenticate as the victim indefinitely from any wallet, since the contract never binds
`msg.sender` to the commitment cryptographically, and (c) retroactively de-anonymize every past
session: for each publicly-visible `nullifierNonce` ever used, recompute `Poseidon(sk, nonce)` and
match it against the on-chain nullifier list, identifying every session that user ever opened.
Key compromise is total and retroactive, mitigated only by prompt revocation (`revokeCommitment()`,
v1.3.0) and re-registration under a fresh, unlinkable identity — which itself requires the victim
to still possess the *old* key long enough to prove ownership and revoke it. If the key is fully
lost rather than merely compromised-but-known, there's no recovery path at all.

---

## 5. Case study: front-running `startSession` — a severity reclassification

This is the finding worth studying closely, because the process that found it is more instructive
than the finding itself.

**The mechanism.** `startSession(commitment, proof, nullifierNonce, nullifier)` takes `proof`,
`nullifierNonce`, and `nullifier` as plaintext calldata arguments — visible in the public mempool
the instant a legitimate login transaction is broadcast, before it confirms. An attacker watching
the mempool copies that exact tuple into their own transaction and gets it mined first. Since the
nullifier hasn't been spent yet at that point, the copy is a *first use*, not a rejected duplicate
— it succeeds.

**The consequence.** `startSession` records `initiator: msg.sender` — the attacker's own address —
on the resulting session (`ZKAuthRegistry.sol:244-249`). `validateSession(sessionId)` performs
**no caller check whatsoever** — it takes only a `sessionId` and returns `(isValid, role,
commitment)` to anyone who asks (confirmed by reading every caller, including the frontend's
`useZKSessionRevalidation.ts`). So the attacker walks away holding a genuinely `active` session,
tied to the *victim's* role and commitment, usable for up to the 24-hour `SESSION_DURATION` —
without ever learning `sk`. The victim's own transaction simply reverts with
`NullifierAlreadyUsed`, which looks to them like an ordinary failed login. The actual consequence
— someone else now authenticated as them — is invisible from the victim's side entirely.

**Why the first-pass severity assessment was wrong.** An earlier draft of this project's own
security review classified this as "Medium — griefing only," reasoning by analogy to the adjacent,
genuinely-lower-severity finding: front-running *registration* (`registerCommitment`) is indeed
just griefing, because registration is idempotent and requires knowledge of `sk` to produce a
usable identity — a front-runner who copies a pending registration just causes the legitimate
user's transaction to revert with `CommitmentAlreadyExists`; nobody's authenticated as anyone.
That reasoning is correct for registration. **It is not correct for `startSession`**, because a
session is not idempotent and not identity-gated the same way — it's a bearer credential that
`validateSession` hands out to whoever holds the `sessionId`, with zero verification of who's
asking. The error in the first-pass assessment was **pattern-matching two superficially similar
attacks (front-running two different functions) without independently re-deriving the actual
downstream consequence of each.** An independent cross-review caught this and corrected the
severity to **High**, with the corrected reasoning documented in place, not silently overwritten —
`SECURITY_REVIEW.md` §3 literally states: *"This finding's severity was understated in an earlier
draft of this document, which described it as griefing only. An independent cross-review of this
document caught the error; corrected below."*

**Takeaway for your own reviews.** Two similar-looking attack surfaces (front-run function A,
front-run function B) can have completely different severities if the *state* each function
manipulates has different properties. "This looks like that other thing I already assessed" is
exactly the reasoning shortcut that produces exactly this kind of misclassification. Independent
cross-review exists specifically to catch it — which is why it caught it here, and why you should
never skip that step on your own work, however confident you feel.

**Status and remediation.** Documented, regression-tested (`contracts/test/groth16-integration.test.ts`,
"Front-running / nullifier griefing" section — the test literally demonstrates the attacker
successfully calling `validateSession` on the resulting session), not fixed in the version under
review. The recommended remediation is small and contained: bind session-consuming reads/actions
to `msg.sender == session.initiator`, mirroring the ownership check already applied to
`endSession`. A meta-transaction relayer (see section 3's `msg.sender`/wallet-linkage discussion)
would also close this specific window as a side effect, by removing `startSession`'s plaintext
calldata from the public mempool entirely — but that's a substantially larger architectural change
to solve a problem the smaller, targeted fix solves directly.

Compare the project's full severity table (from `SECURITY_REVIEW.md`) — this is the register you
should be writing findings in by the end of this semester:

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Circuit soundness (under-constraint check) | — | No issue found |
| 2 | `msg.sender` not bound to `walletAddress` on-chain | Critical (privacy) | Documented; not fixable without a relayer (future work) |
| 3 | Front-running `startSession` → session/role impersonation | **High** (corrected up from initial "Medium/griefing" during cross-review) | Documented + regression-tested; fix scoped as future work |
| 4 | Proof malleability (stock snarkjs verifier lacks extra subgroup checks) | Medium | Accepted library limitation; no dedicated test |
| 5 | `verify()` executes before nullifier-spent write; a stale comment implied otherwise | Low (latent, not exploitable under current trust assumptions) | **Fixed** — comment corrected; `nonReentrant` guard recommended as future hardening |

Also worth a second look: the `role` parameter (Student/Employer) passed to `registerCommitment` is
plain calldata — not a circuit-constrained public input at all. The circuit proves knowledge of
`sk`; it says nothing about role eligibility. A user can register any role regardless of actual
status, since role cross-checking against `EmployerRegistry`/`CertificateRegistry` only happens on
the separate Web3 (non-ZK) auth path. This isn't in the severity table above — it's a design gap,
not a bug — but it's exactly the kind of thing worth asking about in a real review: *what did the
circuit actually constrain, versus what did the surrounding system assume it constrained?*

---

## 6. Comparative threat models

Useful to hold side by side, because the interesting differences are architectural, not
cryptographic:

| | This system | Semaphore | Zerocash/Zcash |
|---|---|---|---|
| Commitment storage | `mapping(bytes32 => bool)` | Merkle tree | Merkle tree of note commitments |
| Anonymity set | None — registering wallet is always the tx sender | The full group (all tree members) | The full shielded pool |
| What's proven | Knowledge of `sk` behind a registered commitment + fresh nullifier | Merkle membership + fresh signal nullifier | Note ownership + value conservation, no linkage to spender |
| Trust root | Single admin-set Groth16 verifier | On-chain Merkle root | Multi-party trusted setup (historically also single-ceremony risk in early Zcash) |

The nullifier concept itself traces to Zerocash — a one-time tag revealed on spend, preventing
double-spend without linking spends to the same owner. Semaphore adapted the same core idea to
anonymous group signaling. This system applies the identical pattern to authentication, but
**deliberately declines the Merkle-tree anonymity set** in favor of a flat mapping — cheaper to
deploy and query, at the direct cost of the anonymity-set property Semaphore is built specifically
to provide. That's a legitimate engineering trade-off *if it's stated as one*, which is exactly
what this project's corrected documentation now does. The failure mode to watch for in your own
future reviews isn't "they didn't build a Merkle tree" — it's "they built a flat mapping and
described it as if it had a Merkle tree's anonymity properties." The first is a design choice.
The second is the overclaim this project caught itself making and fixed.

---

## 7. Exercises

Work these before you read the project's own writeups on them — you'll get more out of the
comparison.

1. **Reclassify finding 4.** The stock snarkjs verifier lacks extra malleability-hardening checks
   beyond the pairing equation. Sketch what a proof-of-malleability test would actually need to
   demonstrate (constructing a second, distinct valid proof for the same statement by manipulating
   curve points), and argue whether "Medium" is the right severity given the trust model in
   section 4 — does a malleable proof actually gain an attacker anything beyond what a front-runner
   in section 5 already gets for free?
2. **Design the relayer fix, then threat-model the relayer.** Section 3/4 note that a meta-tx
   relayer closes the `msg.sender` linkage gap. It also introduces a new trusted party. Write the
   adversary model for the relayer itself: what can a malicious or coerced relayer do that the
   current design cannot?
3. **Attack the role gap.** Section 5's closing paragraph notes `role` isn't circuit-constrained.
   Construct a concrete scenario where an unconstrained role field causes a real authorization
   failure elsewhere in the system (hint: look at what `EmployerRegistry`'s role-conflict checks
   assume about how a wallet obtained its role).
4. **Rewrite the severity-correction paragraph as a disclosure timeline.** Section 5 describes an
   internal cross-review catching a severity misclassification. Practice writing this as you would
   an external vulnerability disclosure: discovery date (hypothetical), initial assessment,
   corrected assessment, vendor response, remediation timeline. This is the actual documentation
   skill a security MSc is training you in.

---

## 8. The meta-lesson

The most valuable thing in this repository is not the zk-SNARK. It's `THREAT_MODEL.md`'s opening
sentence and `SECURITY_REVIEW.md`'s §3, both of which say, in effect, *"we said something wrong,
here's exactly what, here's who caught it, here's the correction."* Almost nothing you'll read
professionally will be this honest about its own mistakes — most security documentation you'll
encounter in industry is written to close a ticket, not to teach the next reader how the finding
was actually reached. Hold your own writeups, starting this semester, to the standard this project
holds itself to: state the claim precisely, state what would have to be true for the claim to be
false, and if you find out it *was* false, write that down too, dated, instead of quietly editing
it away.

---

## Further reading (primary sources for everything above)

- `contracts/circuits/THREAT_MODEL.md` — the corrected threat model and Semaphore/zkLogin
  comparison in full.
- `contracts/circuits/SECURITY_REVIEW.md` — the line-by-line internal review, including the
  full severity-correction narrative for finding 3.
- `contracts/test/groth16-integration.test.ts` — the regression test proving the front-running
  mechanism, including the attacker successfully calling `validateSession`.
- `contracts/contracts/ZKAuthRegistry.sol` — read `startSession` and `validateSession` side by
  side; the whole finding in section 5 is visible in about 40 lines of Solidity.
- The project's thesis and companion research paper (this repository) for the full formal
  security-reduction arguments behind SG-1 through SG-5.
