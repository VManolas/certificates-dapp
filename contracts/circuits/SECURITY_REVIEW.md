# Informal Security Review — `auth_login` circuit & `ZKAuthRegistry`

> **This is an informal internal review, not an external audit.** It was produced as part of
> preparing this project for thesis defense, by re-reading the circuit and contract line by line
> and reasoning about what each constraint and check does and doesn't guarantee. It has not been
> reviewed by a third party, has not used any automated formal-verification or fuzzing tooling
> beyond the project's own test suite, and should not be treated as a substitute for a
> professional external audit. **An external audit is recommended before any deployment beyond a
> local/testnet demo.**

Scope: `contracts/circuits/auth_login_groth16/auth_login.circom` and
`contracts/contracts/ZKAuthRegistry.sol`. See [`THREAT_MODEL.md`](./THREAT_MODEL.md) for the
broader adversary model and the Semaphore/zkLogin comparison this review feeds into.

## 1. Circuit soundness — no under-constrained signals

The circuit's three constraints (`auth_login.circom:34,42-46,49-52`):

```
component addrBits = Num2Bits(160);          // line 34 — range-checks walletAddress
addrBits.in <== walletAddress;

component commitmentHash = Poseidon(3);       // lines 42-46
commitmentHash.inputs[0] <== pubKeyHash.out;
commitmentHash.inputs[1] <== walletAddress;
commitmentHash.inputs[2] <== salt;
commitmentHash.out === commitment;

component nullifierHash = Poseidon(2);        // lines 49-52
nullifierHash.inputs[0] <== privateKey;
nullifierHash.inputs[1] <== nullifierNonce;
nullifierHash.out === nullifier;
```

`walletAddress` is range-checked (line 34) rather than left as a free signal, and both hash
outputs are constrained with `===` against the public `commitment`/`nullifier` signals — a prover
cannot satisfy the circuit without actually knowing a `privateKey`/`salt`/`walletAddress` triple
that hashes correctly. No signal in the circuit is declared but left unconstrained. This is a
correctly-specified knowledge-of-preimage relation for what it claims to prove.

## 2. What the relation does *not* bind: `msg.sender`

This is the precise, code-level version of the privacy finding in `THREAT_MODEL.md`.
`walletAddress` (line 25 of the circuit) is a **private** input — the `main` declaration
(`auth_login.circom:55`) only makes `commitment`, `nullifierNonce`, `nullifier` public. So the
proof establishes that *some* `walletAddress` was used to build the commitment; it never proves
anything about who is submitting the current transaction.

Checked directly against `ZKAuthRegistry.sol`: neither `registerCommitment` (lines 180-204) nor
`startSession` (lines 217-254) reads or checks `msg.sender` against any circuit input or output.
`msg.sender` is used in `startSession` as an ingredient of the `sessionId` hash (line 239) and as
the recorded `initiator` (line 248, part of the `Session` struct assignment at lines 244-249) —
and, since Track 1, that recorded `initiator` is what `endSession` (lines 261-269) checks
`msg.sender` against (line 264) to decide who may end the session. None of this ever checks
`msg.sender` against anything the ZK proof attests to.

Concretely: the "proof of wallet ownership" this system produces is a proof that *whoever
originally computed the commitment* knew a `walletAddress` (among other things). It is not a proof
that the current transaction's sender is that wallet. Any party who obtains a valid
`(commitment, proof, nullifierNonce, nullifier)` tuple — not only the wallet's holder — could
submit it from a different address, and the contract would accept it identically (the resulting
session would still be tied to the original `commitment`, so this isn't a privilege-escalation
path against a *different* commitment — but it does mean "submitted by the wallet holder" is not
an on-chain-enforced property).

## 3. Front-running `startSession` enables session/role impersonation — corrected during cross-review

**This finding's severity was understated in an earlier draft of this document, which described
it as griefing only.** An independent cross-review of this document caught the error; corrected
below.

`proof`, `nullifierNonce`, and `nullifier` are all plaintext function arguments — visible in the
mempool the moment a legitimate transaction is broadcast, and permanently visible in calldata
after it confirms. Anyone watching the mempool can copy the exact same tuple into their own
transaction and, if it lands first, consume the nullifier (`usedNullifiers[nullifier] = true` —
`registerCommitment` line 198, `startSession` line 237, `revokeCommitment` line 298) before the
original transaction is mined. The original transaction then reverts with `NullifierAlreadyUsed`.

For `registerCommitment`, that's the whole story: registration is idempotent per-commitment, so a
front-run registration attempt just fails and the legitimate user retries.

**For `startSession`, the consequence is worse than a forced retry.** `startSession` records
`initiator: msg.sender` (line 248) — the *front-runner's own address* — on the resulting session,
and `validateSession(sessionId)` (lines 303-325) takes only `sessionId` and returns
`(isValid, role, commitment)` with **no check on who is calling it**. Confirmed by reading every
caller: the frontend's `useZKSessionRevalidation.ts:58` calls `validateSession` the same way. So a
front-runner who wins the race ends up holding a `sessionId` for a session that is genuinely
`active`, tied to the *victim's* `role` and `commitment` — and can use it (or query it) as if they
were the victim, for up to `SESSION_DURATION` (24 hours), without ever learning the private key.
This is real (pseudonymous) session/role impersonation via front-running, not merely a
denial-of-service. The victim's original transaction still reverts with `NullifierAlreadyUsed`,
so from the victim's point of view it looks like a failed login — the deeper problem (the
attacker now holds a valid session as them) is not visible to the victim at all.

A regression test demonstrating this mechanism — including the attacker successfully calling
`validateSession` on the resulting session — lives in `contracts/test/groth16-integration.test.ts`
("Front-running / nullifier griefing" section). **Recommended fix** (not implemented in this
documentation pass, scoped as future work — see `THREAT_MODEL.md`'s adversary model): bind
session-consuming reads/actions to `msg.sender == session.initiator`, the same ownership pattern
already applied to `endSession` as part of this project's Track 1 fixes. Alternatively, or
additionally, a meta-transaction relayer (see `THREAT_MODEL.md`) would remove the front-runnable
window entirely by not exposing `startSession`'s plaintext calldata to a public mempool in the
first place.

## 4. Proof malleability (Medium, checklist item)

The stock `snarkjs`-generated verifier used in this project — `contract Groth16Verifier` in
`contracts/circuits/auth_login_groth16/Groth16AuthVerifier.sol` (also present as a `build/`
artifact copy named `Groth16Verifier.sol`) — implements the standard pairing check but does not
add the additional malleability-hardening checks some production Groth16 deployments layer on top
(e.g. explicit low-order/subgroup checks on proof points beyond what the pairing check itself
enforces). This is a known characteristic of the unmodified `snarkjs` verifier template, not a
defect introduced by this project.

This is documented but **not covered by a dedicated regression test** in this pass: demonstrating
malleability requires actually constructing a second, distinct valid proof for the same statement
by manipulating curve points (exploiting the pairing equation's structure), which is a nontrivial
piece of cryptographic engineering distinct from the rest of this test suite — writing a
convincing test for it is a reasonable candidate for the actual external audit recommended above,
rather than something to approximate with a fake/trivial test here. Out of scope to patch without
forking and modifying the generated verifier template.

## 5. `startSession`'s ordering comment didn't match the actual order (fixed)

`startSession`'s comment originally read (before this review):

```
// Mark nullifier as spent before creating the session (checks-effects-interactions)
usedNullifiers[nullifier] = true;
```

The label was about "before creating the session" (true — this write does precede
`sessions[sessionId] = Session({...})` at line 244), but the more relevant ordering for a
checks-effects-interactions argument is relative to the *external call*: `authVerifier.verify()`
runs at line 231, and the nullifier-spent write happens at line 237 — **after** that external
call, not before it. The same pattern appears in `registerCommitment` (verify at line 196, write
at line 198) and `revokeCommitment` (verify at line 296, write at line 298).

This is not exploitable today: `authVerifier` is a fixed, admin-set contract
(`Groth16AuthVerifierAdapter` in production), its `verify()` implementation is a pairing check
with no callback into `ZKAuthRegistry`, and only `ADMIN_ROLE` can change it (`setVerifier`, lines
381-391). But the comment's framing was worth correcting so a future reader doesn't assume the
external call is safely sandwiched between checks and effects — it isn't. If `authVerifier` were
ever pointed at a verifier implementation that could reenter (which would require a compromised
or malicious admin, already a modeled threat per `THREAT_MODEL.md`), a reentrant `verify()` call
could observe `usedNullifiers[nullifier]` still `false` on a nested call with the same nullifier.

**Status: fixed.** The comment at `startSession` (lines 233-236) now states the actual ordering
and points here for the reentrancy assumption it relies on. A `nonReentrant` guard on these three
functions remains a reasonable future hardening step, since it would remove the "trusted verifier"
assumption entirely rather than just documenting it.

## Summary table

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Circuit soundness | — | No issue found |
| 2 | `msg.sender` not bound to `walletAddress` on-chain | Critical (privacy) | Documented in `THREAT_MODEL.md`; not a fixable "bug" without a relayer (future work) |
| 3 | Front-running `startSession` → session/role impersonation | **High** (corrected up from an initial "Medium/griefing-only" assessment during cross-review) | Documented + regression test added; fix (bind to `session.initiator`) scoped as future work |
| 4 | Proof malleability (stock snarkjs verifier) | Medium | Documented as accepted library limitation; no dedicated test (see §4) |
| 5 | `verify()` ran before nullifier-spent write, comment said otherwise | Low (latent, not exploitable under current trust assumptions) | **Fixed** — comment corrected; `nonReentrant` guard recommended as future hardening |
