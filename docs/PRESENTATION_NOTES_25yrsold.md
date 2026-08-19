# zkCredentials as a Dissertation-Readiness Exercise

## Who this is for, and what mode to read it in

You just finished an MSc in cybersecurity. You might start a PhD next month. This document isn't
going to teach you what a zk-SNARK is, or walk you through a threat model, or explain why
front-running matters — you already know all of that, and if you don't, the two companion
documents in this same folder (`PRESENTATION_NOTES_20yrsold.md`, `_23yrsold.md`) cover it. This
one asks a harder question, the one an advisor actually asks in a first meeting about a proposed
research direction: **is this dissertation-worthy, and if not yet, what would make it so?**

Read it in review-committee mode, not student mode. You're not being taught this system. You're
being asked to evaluate whether it — or something adjacent to it — is worth several years of your
life, and to practice the specific skill of separating *solid engineering execution* from *research
contribution*, because conflating the two is the single most common reason a promising MSc project
turns into a mediocre PhD proposal.

---

## 1. The system, in one paragraph, for calibration

A commitment-and-nullifier Groth16 ZK authentication layer (`ZKAuthRegistry`) bolted onto a
straightforward on-chain credential-issuance system (three UUPS registries), deployed on zkSync
Era. The circuit is small (1,698 R1CS constraints), the cryptography is textbook (nothing novel
at the primitive level — Groth16, Poseidon, a commitment/nullifier scheme lifted structurally from
Zerocash and Semaphore), and the engineering is honest: the codebase ships a threat model that
corrects its own earlier overclaim, and a security review that upgrades its own initial severity
assessment of a finding after cross-review. That intellectual honesty is genuinely rare and
genuinely valuable. It is also not, by itself, a research contribution — honesty about your
system's limitations is a hygiene factor, not a novelty claim.

---

## 2. What kind of contribution is this, actually?

The thesis is self-aware enough to raise this question itself, which is worth crediting before
critiquing further: it explicitly frames its own methodology as "design-science research... in the
sense of Hevner et al. insofar as it produces and evaluates an artefact against explicit
requirements," but immediately qualifies that "the iteration itself was literature-grounded
comparison rather than build-and-reject experimentation" — alternative architectures (notably a
Merkle-tree/Semaphore-style anonymity set) were *evaluated against the literature*, not
*independently implemented and discarded*. Read that qualification carefully, because it's doing a
lot of work: **a real design-science cycle requires building and rejecting alternatives, not just
citing why you didn't build them.** This thesis, by its own admission, did the latter. That's an
honest and correct self-assessment, and it's also the single clearest answer to "why isn't this a
PhD-strength contribution as it stands": the comparative evaluation that would justify the design
choice was never run.

Concretely: if you wanted to defend "a flat `mapping(bytes32 => bool)` is the right trade-off
versus a Merkle-tree anonymity set" as a *research* claim rather than an engineering judgment
call, you'd need to actually build both, and report comparative gas costs, comparative circuit
constraint counts, and — the part nobody in this space measures well — a comparative *anonymity
set analysis under realistic usage patterns* (a Merkle tree's anonymity set is only as good as the
number of *other* users who registered around the same time; an unpopulated tree provides no real
anonymity regardless of its cryptographic property). That comparative study doesn't exist here.
It's a genuinely open, tractable, and — this matters for you — *fundable* research question, and
it's the first of three concrete directions in section 5.

**The claimed novelty** — "Gap 3: none of the surveyed systems integrate ZK-based authentication
with on-chain credential issuance and management" — is a real gap in the sense that nobody had
built exactly this combination before. Be precise with yourself about what kind of gap that is,
though: it's an **integration gap**, not a **construction gap**. Nothing in the cryptography here
is new; the contribution is architectural composition of two known techniques into one deployed
system. That is legitimate, publishable *systems* work — a strong workshop paper, or a
tools/experience-report track at a security venue — but it is a different genre of contribution
than a new proof system, a new anonymity notion, or a new circuit-level technique, and you should
know precisely which genre you're producing before you write the introduction, because reviewers
absolutely will notice the mismatch if you frame integration work as a cryptographic contribution.

The genuinely strong systems-paper material here, incidentally, is the `forceEVMLA` finding: the
discovery that the Noir/UltraPlonk verifier's generated assembly hits a zksolc optimizer bug
("stack layout after 1000 iterations") under any optimized build, and that a *separate*,
independent stack-too-deep failure appeared in the *Groth16* verifier whenever both verifiers were
compiled together with `forceEVMLA` enabled — solved by removing the flag once UltraPlonk was no
longer deployed. That's a real, reproducible, previously-undocumented compiler-interaction finding.
It's exactly the kind of "here's a footgun nobody else has written down yet" contribution that a
short experience-report paper is *for*. Don't undersell it by burying it in an implementation
chapter — it's more novel than most of the cryptographic design decisions surrounding it.

---

## 3. Evaluation rigor: read this section as if you were reviewer 2

You already know how to spot weak empirical methodology. Apply it here, deliberately, because the
thesis's own honesty about this is instructive.

- **n=5 trials per device, reporting a bare mean, no variance, no confidence interval, on three
  of the four benchmarked environments.** The thesis says so itself: "should be interpreted as
  prototype-level performance evidence rather than statistically robust benchmarking." Correct
  self-assessment. It's not statistically powered to support any claim stronger than "this seems to
  work in the range of a few seconds" — which is fine as an engineering existence proof, and
  completely insufficient as a performance *claim* in a research paper. Note what it *did* get
  right on the supplementary measurement: n=25, median/mean/σ reported, reproducible via a
  committed script. That's the right instinct, applied inconsistently across the evaluation. If
  you were redoing this properly: power analysis up front, n sufficient to detect a meaningful
  effect size between device classes, thermal-state control (repeated proof generation on a
  laptop *will* thermal-throttle after enough trials — was that controlled for? unclear), pinned
  browser/JS-engine version across all measurement sessions, and a stated null hypothesis before
  collecting data, not after.
- **Gas costs measured once per operation on testnet, not across repeated runs with variance
  reported.** Deterministic EVM gas cost is a reasonable excuse for skipping variance here — cite
  that explicitly if you reuse this methodology, rather than leaving the reader to assume it was an
  oversight.
- **No adversarial red-team beyond self-review.** The security review is explicit that it is "not
  a substitute for a professional external audit," which is honest, but also means every finding in
  the severity table — including the corrected front-running finding — came from the same small
  set of people who built the system, reviewing their own work. That's a known limitation of
  internal reviews generally (confirmation bias toward the mental model you already have of your
  own system), not a criticism specific to this thesis, but it bounds how much weight you can put
  on "no other issues found" for anything not explicitly flagged. A genuine external red-team pass
  — even a scoped one, even a semester-long grad-course CTF-style exercise against this exact
  contract — would be a legitimate, cheap, high-signal follow-up study.
- **No user study behind any UX claim.** "Sub-8-second proof generation is acceptable for a login
  flow" is an assertion, not a measured claim. It might be true. A 15-person timed-task usability
  study with a control condition (standard wallet-signature login) would tell you whether it's
  true, and whether "acceptable" varies by whether the user understands *why* it's taking 8
  seconds — a genuinely interesting HCI-adjacent question this thesis doesn't touch at all.

None of this is unusual for a master's thesis — most master's-level evaluations look like this, and
this one is more honest about its own limits than most. The point of walking through it isn't to
grade the thesis; it's to practice noticing exactly where the evidentiary bar sits, because you'll
be setting that bar for your own dissertation work starting soon, and "did I actually collect
enough data to support this specific sentence in my abstract" is a question you should be asking
yourself constantly for the next several years.

---

## 4. Is the front-running finding a new vulnerability class, or a known one applied to a new domain?

This is the sharpest research-framing question in the whole thesis, and it's worth sitting with
rather than answering glibly.

**The mechanics, stripped to their essence:** a bearer credential (a session, authenticated via a
ZK proof and a nullifier) is created by a transaction whose contents are visible in a public
mempool before confirmation, and the resulting credential is handed out to *whoever holds the
resulting identifier*, with no binding back to who actually submitted the winning transaction's
*intent* versus its *bytes*. An attacker who front-runs the transaction inherits the credential.

**Is this new?** Front-running and MEV extraction are extensively studied — that's not in
question. What's worth actually investigating, rather than assuming either way, is whether *this
specific pattern* — nullifier-based ZK authentication where front-running yields role/session
impersonation rather than the more commonly studied outcomes (transaction reordering for profit,
double-spend races, sandwich attacks) — has prior art in the ZK-identity literature specifically
(Semaphore's own security considerations, Sismo, Worldcoin/World ID, zkLogin's own security
writeups, or the broader "front-running ZK proof submissions" literature that exists around
private DeFi transactions). This thesis doesn't position its finding against that literature at
all — it discovers and documents the mechanism from first principles, which is intellectually
honest, but it means the finding's *novelty relative to prior art* is genuinely unknown rather than
established. That's your first concrete task if you wanted to turn this into a publishable
security result: a proper related-work pass asking specifically "has 'front-running a ZK-auth
session-creation transaction yields impersonation, distinct from double-spend front-running' been
named and analyzed before, under any name?" If yes, this is a well-executed instance of a known
class, valuable as a case study, not as a discovery. If no — and it's plausible, since most
ZK-identity systems either use commit-reveal for exactly this reason or don't create bearer
sessions at all — you may have a genuinely citable finding, with a name worth giving it.

**The remediation as currently scoped is also worth pressure-testing.** "Bind session consumption
to `msg.sender == session.initiator`" is proposed as *the* fix. It's a correct fix for *this*
specific vector, but ask the PhD-level question: does it close the *general* problem, or just this
*instance*? A front-runner still consumes the legitimate user's nullifier and forces their
transaction to revert — that's griefing, now bounded to griefing rather than impersonation, but
not eliminated. A rigorous treatment would formalize the property being restored ("session
initiation is bound to transaction-intent, not transaction-order") as a game the adversary must
win, and prove the fix achieves it — rather than patching the one observed exploitation path and
declaring the class closed. That formalization doesn't exist yet, for this system or, as far as
this thesis's related-work review shows, for the pattern in general. That's your second concrete
research direction.

---

## 5. Three PhD-scale research directions, ranked

Ranked by novelty-to-effort ratio as you should actually weigh these, not by which sounds most
impressive in a proposal.

**1. Formalize "session-initiator binding" as a security game and prove it — highest
novelty-per-effort.** Define the adversary (mempool observer, can front-run any pending
transaction), define the property (session authentication is bound to the party whose *intent*
generated the underlying proof, not merely to transaction order), prove the naive system fails it
(you already have the exploit), prove the proposed fix succeeds — or discover it doesn't fully,
which would be a more interesting result than confirming it does. This generalizes past this one
contract: any ZK system that creates a stateful, reusable artifact (a session, a credential, a
capability) from an on-chain proof submission is potentially exposed to the same class, and a
general theorem beats a per-contract patch. This is a genuinely tractable, well-scoped, first-year
PhD project, and it's the closest thing to "new theory" available in this thesis's orbit.

**2. Extend the circuit to prove actual credential possession, non-interactively and
non-revealingly — highest ceiling, highest risk.** This thesis is explicit that its circuit
authenticates the *user*, not credential *possession* — proving "I know `sk`" says nothing about
"I hold a valid, non-revoked degree from a registered institution." Building a circuit that proves
the latter, without revealing *which* credential or *which* institution, is a real, hard, open
research problem: it needs either a ZK-friendly accumulator with efficient non-membership proofs
(for revocation, which is the genuinely hard part — proving something is *not* in a revocation set
without revealing which set-member you're checking against is a known-hard sub-problem, related to
work on anonymous revocation and RSA/Merkle accumulators), or a recursive/folding-proof construction
that keeps circuit size tractable as the credential set grows. This is dissertation-scale on its
own, sits adjacent to active research (accumulator-based revocation, Semaphore's own evolving
group-membership machinery, Sismo's "ZK badges"), and has a real deployment target already built
around it if you want an applied angle rather than a pure-theory one.

**3. An SoK on privacy-overclaiming in open-source ZK-authentication documentation — lowest risk,
genuinely useful, different genre entirely.** This thesis's own origin story — a codebase that
claimed "students authenticate without revealing their wallet address," corrected only after
someone checked — is not obviously a one-off. A systematic study auditing N open-source
ZK-identity/authentication projects' *documentation and marketing claims* against their *actual
on-chain behavior* (does `msg.sender` leak? is the claimed anonymity set real or nominal? does the
README's privacy claim survive reading the contract?) would be a genuine Systematization of
Knowledge contribution — lower technical risk than either of the above, doesn't require you to
build new cryptography, and produces something the field visibly needs: a reusable checklist and a
concrete, embarrassing-if-true dataset of how common this specific failure mode is. This is the
direction to pick if you want a first PhD-year publication with a clear, bounded scope while your
harder technical direction (1 or 2 above) matures in the background.

---

## 6. Questions an advisor will actually ask you about this

Rehearse answers to these before you propose any of the above as a research direction, because
they will come up, and "I hadn't thought about that" in a first advisor meeting costs you more
credibility than it should.

- "You said the flat mapping versus Merkle tree is a deliberate trade-off. Deliberate based on
  what measurement, or deliberate based on intuition?" — *(Answer, honestly, per section 2: based
  on citing the literature, not an independent measurement. That's your opening, not a weakness to
  hide.)*
- "Is your front-running finding new, or is it MEV research applied to a system nobody had applied
  it to yet?" — *(You don't know yet. Section 4 is your plan to find out, not your answer.)*
- "Your n=5 benchmark — if I asked you to rerun this with a proper power analysis, what sample size
  would you actually need, and why?" — *(Have a number ready. "More" is not an answer a committee
  accepts.)*
- "What's the actual novel technical artifact in your proposal — the proof, the construction, the
  formal definition, or the system? Because 'system' alone, at PhD scope, needs a much stronger
  empirical or theoretical payload than this thesis's evaluation currently has."

---

## 7. The actual decision in front of you

You're not just evaluating a thesis. You're calibrating whether you want to spend the next several
years doing work that looks like this — careful applied cryptographic engineering, honest
self-correction, real but modest novelty, systems-flavored rather than theory-flavored — versus
work that looks more like section 5's direction 1 or 2: harder, narrower, more likely to fail
outright, but with a real shot at a genuinely new theorem or construction at the end.

Both are legitimate PhDs. Neither is intrinsically better. But they're different bets on your time,
and the honest answer to "is this dissertation-worthy" is: **not as it stands, but it's a
well-chosen launching point for at least one direction above that is** — and figuring out which of
those directions you find yourself unable to stop thinking about, this month, before you commit, is
a more reliable signal for which PhD to start than any ranking of novelty-per-effort a document
like this one can hand you.
