# zkCredentials: Research Memo for a Reading Group

No preamble needed on primitives, threat models, or why front-running matters — see this folder's
other three notes if you want the pedagogical scaffolding. This one assumes you review for the
venues this work would need to clear, and it's written the way I'd circulate a memo before a lab
meeting: opinionated, citation-anchored where I'm confident, hedged where I'm not, and aimed at
finding the actual open problem rather than re-explaining the system.

The thesis under discussion: a Groth16 commitment/nullifier authentication scheme
(`ZKAuthRegistry`), Poseidon over BN254, 1,698 R1CS constraints, deployed zkSync Era Sepolia,
composed with a conventional on-chain credential-issuance system. The two companion docs already
covered the design-science self-critique, the n=5 evaluation weakness, and the "integration gap
vs. construction gap" novelty question. I want to raise four things those didn't: whether a
zk-SNARK is even the right primitive here, whether Groth16 is the right SNARK given the circuit
size, a formal reframing of the front-running finding against the order-fairness literature, and a
position-paper-shaped observation about a missing primitive definition in the field.

---

## 1. Was a zk-SNARK the right tool, or the default one?

State plainly what's actually being proven: knowledge of `sk` such that
`Poseidon(Poseidon(sk), addr, salt) = C`, plus a correctly-derived nullifier, non-interactively,
succinctly, on-chain. That's the whole functional requirement. A zk-SNARK is *sufficient* for
this. Is it *necessary*, or does it bring machinery (trusted setup, a 1,272ms median client-side
proving cost, an external verifier contract, a whole second implementation attempt in Noir that
had to be abandoned for compiler-compatibility reasons) that a lighter primitive would avoid
entirely for the same functional guarantee?

Consider **linkable ring signatures** (the CryptoNote/Monero lineage) or a **group signature
scheme with revocation** (Camenisch-Lysyanskaya-style, or a BBS+-based construction). Both give
you: prove membership in a registered set, produce a per-session tag that's unlinkable across
sessions unless intentionally linked, no per-circuit trusted setup, and — this is the part worth
sitting with — **no SNARK at all**, just standard discrete-log-based signature machinery most
implementers and auditors already know how to reason about. The trade-off moves elsewhere: ring
signatures need the full ring published per signature (linear in ring size, though this system's
ring is effectively "everyone ever registered," so that's a real cost at scale), and revocation in
group-signature schemes is its own hard sub-problem (this thesis's ZK path punts on revocation
entirely — `revokeCommitment()` just kills the commitment, it doesn't prove non-membership in a
revocation set to a verifier the way an accumulator-based group signature scheme would).

The honest comparison this thesis doesn't run: **for exactly this functional spec — single-secret
re-authentication with per-session unlinkability, no anonymity-set requirement beyond
key-secrecy — is Groth16 doing meaningfully more work than a linkable ring signature would, for
worse trusted-setup properties?** I don't think the answer is obvious either way, which is exactly
why it's worth someone actually running the comparison rather than defaulting to "SNARK" because
that's the ecosystem's current center of gravity. This reads to me as the strongest single
follow-up: a systematic cost/trust-model comparison of SNARK-based vs. signature-based
constructions for the *specific* functional requirement "commitment-bound, nullifier-tagged
re-authentication," independent of whether an anonymity set is also required. If the answer is
"the signature-based construction dominates for this exact spec," that's a genuinely useful,
somewhat uncomfortable result for the ZK-auth ecosystem to hear, and worth writing up as such.

---

## 2. Given a SNARK was chosen, was Groth16 the right SNARK at this circuit size?

1,698 constraints is small. Small enough that Groth16's headline advantage — smallest
proof, cheapest verification, dominant when circuit size is large and proof size/verification
cost matters most — may not actually be doing much work relative to what a **transparent-setup**
system would cost at this scale. A STARK's larger proof (tens of KB vs. Groth16's 256 bytes) still
costs meaningfully more gas to verify on-chain, so Groth16's cost advantage is real and measured
in this thesis (~210k gas Sepolia vs. an unmeasured-but-plausibly-much-higher STARK verification
cost) — I'm not arguing the choice was wrong on cost grounds. I'm flagging that the choice
*eliminates* the trusted-setup problem entirely as a side effect, and this thesis's actual residual
risk profile (single-contributor Phase 2 ceremony, admin key can swap the verifier and forge
proofs trivially) makes "eliminates trusted setup" a non-trivial thing to trade away for a gas
saving that, at zkSync's L2 prices, is already in the sub-cent range either way. Put differently:
**the marginal gas saving from Groth16 over a transparent alternative may be economically
irrelevant at zkSync's fee levels, while the marginal trust-assumption cost (single-party ceremony)
is not irrelevant at all.** That's worth an actual number, not an intuition — recompute the
STARK-verification gas estimate for this exact circuit and compare against the trust-cost this
thesis already quantifies qualitatively (Table 4.3's "most significant residual risk" framing for
the admin key, which is *entangled with* the trusted-setup risk since the same admin can swap the
verifier regardless of which proof system it wraps).

There's a more interesting angle if you're willing to go further out on the frontier: **folding
schemes** (Nova, HyperNova, Protostar-family constructions) are built exactly for the case this
system has and doesn't exploit — repeated, related computation (the same user re-proving the same
relation every login) that an incrementally-verifiable-computation (IVC) construction can amortize
across sessions rather than re-proving from scratch every time. This thesis treats every login as
an independent, from-scratch Groth16 proof. A folding-scheme construction could, in principle, let
a user accumulate a running proof across a session history and only pay the marginal cost of
*extending* it each login, rather than a full proof each time — and folding schemes are
transparent-setup by construction, closing the trusted-setup question as a side effect of solving
the amortization question. Whether that actually nets out favorably for a *single*-login use case
(as opposed to a long session chain) is genuinely unclear to me and worth someone's actual FLOPs.
This is a legitimate systems-crypto research thread, not a hand-wave: "IVC/folding for repeated ZK
re-authentication, amortized cost analysis vs. from-scratch Groth16 per session."

---

## 3. Reframe the front-running finding through the order-fairness literature, formally

The prior document treated this as a case study in severity-reclassification (worth reading for
the process lesson). Here, treat it as an instance of a studied phenomenon and push toward a
formal statement.

This is squarely inside the territory Daian et al. mapped for financial MEV, and — more precisely
relevant here, since the harm isn't extraction of value but *identity misappropriation* — inside
the territory Kelkar et al.'s work on Byzantine order-fairness opened: the harm isn't "the
attacker profits from reordering," it's "the attacker's transaction, ordered ahead of the victim's
semantically-prior transaction, produces a *different and attacker-favorable binding* than
intent-preserving ordering would have produced." Order-fairness protocols are built to guarantee
transactions are ordered consistent with when they were *received* by honest parties, independent
of miner/sequencer incentive — which, if this system's sequencer implemented it, would close this
specific exploit *as a side effect of a general property*, rather than via the contract-level
patch (`msg.sender == session.initiator`) this thesis proposes. That's worth stating precisely as
two independent remediation layers with different generality:

- **Contract-level (this thesis's proposal):** binds session consumption to the recorded
  initiator. Fixes *this* function. Doesn't generalize to any other stateful artifact a future
  contract might create from a front-runnable proof submission.
- **Sequencing-level (order-fairness):** would fix the *general* pattern — any front-running of any
  proof-submission transaction on this rollup — but requires the L2's sequencer to implement an
  order-fairness guarantee, which zkSync Era does not currently provide and which is itself an
  open deployment question for rollups generally (order-fairness has real throughput/latency
  costs, and no major rollup sequencer implements it as a first-class guarantee as far as I'm
  aware — worth confirming against current zkSync Era documentation rather than taking my word for
  it, since sequencer designs move fast).

The genuinely formalizable open question, stated as a game: define an adversary who observes the
mempool and may submit at most one adaptively-chosen transaction before the honest party's
transaction confirms; define the winning condition as "adversary's transaction results in a
session/credential bound to the adversary's identifier, using proof material generated by the
honest party." Prove the naive `startSession` construction loses this game (trivial — the exploit
is the proof). Prove the proposed fix (`msg.sender == session.initiator`) wins it. Then ask the
harder question: **does the fix's security argument generalize to a construction lemma** — "any
contract function `f` that (a) accepts a ZK proof as a plaintext argument and (b) creates a
persistent artifact indexed by a value derivable from public inputs, is vulnerable to this attack
class unless it additionally binds artifact consumption to the original submitter" — **or is each
instance a one-off patch?** If the lemma holds generally, that's a genuinely citable,
system-agnostic contribution: a design principle for ZK-authenticated smart contracts, derived
from a concrete instance, stated and proven once. That's the difference between "we found a bug in
our contract" and "we found a bug class and a closure condition." The former is this thesis. The
latter is a paper.

---

## 4. A missing primitive definition, and a position-paper-shaped observation

Step back from this specific system. The ZK-identity literature has well-developed formal
treatments for two things: **anonymous credentials** (prove possession of an attribute-bearing
credential without revealing which one — Camenisch-Lysyanskaya, Idemix, and the Polygon
ID/Iden3-style production descendants) and **anonymous group signaling** (prove membership in a
registered set, hide which member — Semaphore's formalization, ring signatures generally). zkLogin
(Sui) formalizes a third thing: binding an ephemeral on-chain key to an OIDC identity assertion,
under an OIDC-provider trust root.

What this thesis actually builds doesn't cleanly fit any of the three. It's not proving attribute
possession (no credential content is proven — this thesis is explicit that the ZK circuit
authenticates the *user*, not credential *possession*, and flags extending to the latter as future
work). It's not anonymous group signaling (no anonymity set is claimed or achieved — `msg.sender`
links every session to a specific registrant from the first transaction). It's not OIDC-bound. It's
a fourth thing: **re-authentication to a persistent, single-owner commitment, with key-secrecy but
explicitly without an anonymity-set claim** — call it, provisionally, "committed re-authentication"
or "key-secret session renewal." As far as I can tell from this thesis's own literature review
(which doesn't attempt this framing), **there's no crisp formal definition in the literature for
exactly this primitive, distinct from anonymous credentials and from group signaling.** That gap
might be exactly why this thesis's own documentation drifted into overclaiming an anonymity-set
property it never actually targeted — without a formal definition to check the design against, it's
easy for prose to slide from "we hide the key" into "we hide the user," because informal language
doesn't force the distinction the way a game-based definition would.

That's a genuinely publishable observation on its own, independent of this specific system: a
short position/SoK paper arguing the ZK-identity literature has a gap between "anonymous
credentials," "anonymous group signaling," and what a large fraction of *deployed* ZK-auth systems
actually implement (single-commitment re-authentication, explicitly not anonymity-set-bearing),
and that the absence of a named, formalized primitive for the third case is plausibly *why*
overclaiming keeps happening across the ecosystem — you can't precisely claim what you haven't
precisely defined. Pair it with the empirical audit already proposed in the companion document (N
open-source ZK-auth projects, documentation-vs-code privacy-claim drift) and you have a two-part
paper: Part 1, formalize the missing primitive; Part 2, empirically show how many deployed systems
conflate it with the stronger primitives the field *does* have names for. That's SoK-shaped,
tractable, and doesn't require you to out-engineer anyone — it requires you to notice a definition
nobody wrote down, which is a different and often higher-leverage kind of contribution than
building a faster construction.

---

## 5. Where I'd actually place this, if I were shepherding it

Not a systems/security main-track paper as it stands — the novelty is compositional, the
evaluation isn't powered for the claims, and the front-running finding, however well-documented, is
plausibly an instance rather than a class until someone runs the related-work check in §3. Three
shapes I'd encourage instead, roughly in order of how quickly each could actually get written:

1. A short **experience/artifact report** on the `forceEVMLA`/zksolc compiler-interaction finding
   alone — genuinely novel, reproducible, immediately useful to anyone targeting zkEVMs with
   generated verifier contracts, and currently buried in an implementation chapter where almost no
   one reviewing ZK-auth research will ever find it.
2. The **missing-primitive position paper** from §4, on its own or paired with the overclaiming
   audit — lowest technical risk, genuinely field-relevant, and it's the one idea in this memo that
   doesn't depend on this specific thesis's system being important; it uses the system as *one*
   motivating instance among many.
3. If someone wants the harder technical bet: formalize and prove the general construction lemma
   from §3 (front-running closure condition for ZK-authenticated stateful artifacts), and pair it
   with the primitive-choice comparison from §1 (SNARK vs. linkable-ring-signature cost/trust
   analysis for this exact functional spec) as the empirical half of the same paper. That's the
   version of this work that clears a strong venue, and it's also the version that requires
   actually building the comparison system, not just citing why you didn't.

Happy to argue any of the above is wrong in the room. That's the point of circulating this before
the meeting rather than after.
