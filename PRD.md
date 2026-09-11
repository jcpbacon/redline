# Redline — Product Brief

A web app that reads a contract before someone signs it and tells them, in plain
English, what they are about to agree to — with every warning tied to the exact
sentence it came from.

This brief is written from decisions made on 2026-09-10. Where a claim rests on
research, it is quoted and sourced. Where nothing supports a claim, that is said
plainly. Several sections were not fully interrogated before drafting; those are
marked **[not yet decided]** and listed again at the end.

---

## 1. Who this is for

**The reader is an independent creator or freelancer who has been handed a
contract they can still negotiate, and has not signed it yet.** A brand or
sponsorship agreement, a client services or consulting agreement, a licensing
deal. They have leverage — they can ask for a term to change — and they are
looking at the document *before* it binds them.

**Anchor persona: the creator weighing a brand deal.** This is the only segment
in the research with a demonstrated price for exactly this task:

> Brand-deal review runs **$800–$1,400 flat**; ContractsCounsel's average for
> influencer agreements is **$2,850** — the highest of roughly 250 contract
> types they track.
> — `research/summary.md` §4

Freelancers on client and consulting agreements are the same reader with less
money per document and far more documents. The product serves them; the brief is
written to the creator because that is where willingness to pay is proven rather
than assumed.

### What they do today instead

- **Pay a lawyer.** ~$520 flat for general contract review, $800–1,400 for a
  brand deal specifically (`research/summary.md` §4). Real advice, and someone
  who carries liability. Slow, and relative to a $3–5k deal it feels expensive.
- **Ask peers** — a Discord, a creator Slack, a group chat. Free and fast. The
  person answering usually hasn't read the contract either.
- **Sign it unread.** The common case. `research/summary.md` §1: *"When I asked
  what went wrong SunRun told me I should have read the contract closer."*
- **Use an existing scanner.** redlineapp.net already does most of what this
  brief describes — upload a contract, get flagged clauses tied to source text,
  Q&A, negotiation-email drafting — at $9.99 one-time / $29.99/yr
  (`research/summary.md` §5.1). This is the honest competitor and it ships today.

### Who is deliberately not served

Renters, gym members, people clicking a terms-of-service box, homeowners across
the table from a door-to-door rep. This is the larger population and, by the
evidence, the louder pain — the $600 gym collections letter, the withheld
deposit, the $708 solar bill (`research/summary.md` §1). The counter-offer
feature (§3.3) is meaningless to someone with no power to negotiate, so serving
them would mean shipping a gesture. That product should exist. It is not this
one.

---

## 2. The problem

Three shapes, all from `research/summary.md` §1:

**The paper contradicts the pitch.**

> "When I asked what went wrong SunRun told me I should have read the contract
> closer."
> — Erik Kuhi, homeowner, whose combined monthly cost reached ~$708 after solar
> was sold as a replacement for his electric bill.
> https://www.trustpilot.com/review/sunrun.com

For a creator: the brand's rep says "standard six-month usage," the contract
grants a perpetual worldwide license.

**Terms you only meet on the way out.**

> "This reads to me like Amazon want all my apps, and won't let me remove them
> from their store unless I remove them from everywhere! ... have Amazon laid
> claim to all the Android apps I've made or ever will make?"
> — an indie developer on the Amazon Appstore Developer Agreement §3.a,
> discovered only when he tried to pull one app down.
> https://news.ycombinator.com/item?id=2564512

**Money that keeps moving after you think it has stopped.**

> "I found out that almost 500USD from my deposit was gone!"
> — Yen Ying Ng, freelancer, on a dormant-account fee in Freelancer.com's terms.
> https://www.trustpilot.com/review/freelancer.com

The thread through all three: the reader could have known, the sentence was
there, and nothing made them read it or told them what it meant. Stated losses
across the research cluster at **$300–$3,025** — enough to be angry about, not
enough to hire a lawyer for. That gap is the product, and it is also the ceiling
on what the product can charge.

---

## 3. What the first version does

Exactly what is on this list, and nothing outside it. When something looks
like the obvious next feature and is not here, it gets asked about first.

1. **A plain-English summary** of the whole document.
2. **A ranked list of clauses that could hurt the reader**, most severe first,
   each showing the exact sentence from the document it was drawn from.
3. **A drafted counter-offer** for each flagged clause — alternative language the
   reader could ask for.
4. **A question box** that answers only from the text of the uploaded document,
   and says so when the document does not answer.
5. **An editable list of the reader's own red lines**, which drives the
   analysis — the flags and their severity reflect what this reader has said
   they will not accept.
6. **A saved library** of the reader's past documents. Extracted text only; the
   original file is never stored.

**Added 2026-09-11:**

7. **A public landing page** — the front door at `/` for someone who has not
   signed in. It exists so the anchor reader (§1) can tell in one screen whether
   this is for them, and so the trust claim is made before a single document is
   uploaded. It must say, in this order of importance:
   - what Redline does, for whom, and at which moment (pre-signature, §6.2);
   - the trust mechanism: every warning shows the exact sentence it came from,
     and a warning that can't is never shown (`docs/adr/0001`);
   - the privacy stance: the file is parsed in the browser and never uploaded;
   - that the analysis is AI-generated and is not legal advice;
   - one call to action into sign-up / sign-in.

   It must not: show pricing (§7, payments are out); show testimonials, customer
   logos, usage numbers, or accuracy figures (none exist — §8); or claim
   equivalence to a lawyer's review (§5.7 of the research, the DoNotPay order).
   Copy states only what the product actually does, the same standing rule that
   governs the analysis itself.

---

## 4. What good looks like

The first version exists to establish that the analysis can be trusted. That is
testable, and these are the tests. Thresholds marked **[not yet decided]** are
for the product owner to set.

1. **Every flag is anchored.** For a fixture set of documents, 100% of flags
   that render show a quote that is a verbatim substring of the stored text. A
   flag whose source sentence cannot be shown is dropped, not displayed
   (`docs/adr/0001`). This is a hard invariant, not a target.
2. **It catches what a professional would catch.** Assemble a corpus of ~20
   freelance and brand contracts, each with an expert's list of the 3–5 clauses
   that actually matter in it. Measure **recall**: what fraction of those
   clauses appear in Redline's flagged list. Target: **[not yet decided]** —
   but this is the number that matters most, because a missed harmful clause is
   the failure the product is supposed to prevent.
3. **It is not crying wolf.** On the same corpus, of the clauses Redline flags
   that are *not* on the expert list, a reviewer judges what share are defensible
   versus noise. Target: **[not yet decided]**.
4. **The summary invents nothing.** Sample summaries; check every sentence
   against the document. Zero claims the text does not support (standing rule in
   `CLAUDE.md`).
5. **The question box refuses rather than guesses.** Give it questions the
   document does not answer. It should say the document does not address this,
   not produce a plausible answer.
6. **A genuinely clean document reads as clean.** See §8 — **[not yet decided]**
   how a low-risk result is presented so the product stays believable when it
   has little to report.

---

## 5. Red lines: which clauses get flagged, how severely, and why

**[not yet decided — provisional.]** This section is meant to carry what the
product owner knows that the research does not: which clauses are dangerous from
experience, and what separates dangerous from merely unusual. That interrogation
did not happen before this draft. What follows is the research's ranked clause
list (`research/summary.md` §2) adapted to creator and freelance documents. It
needs to be replaced or ratified by the owner's own judgment.

| Clause | Severity | Why it is a red line, not just unusual |
|---|---|---|
| **IP assignment / license scope** | Critical | What rights the reader gives up, for how long, and where. "Perpetual, worldwide, irrevocable" versus "six months, paid media only." Broad grants are common — that is not the point. It is irreversible, and the reader usually discovers what they gave away only when they try to reuse their own work. The research names this a plausible top-five clause for freelancers that went unquantified (§2). |
| **Payment terms with no teeth** | High | Net-60/90; "payment on client approval" with no deadline on approval; no late fee; no kill fee. Freelancers Union: 71% hit a stalled payment, ~$6,000/yr average loss (§2 #4). Dangerous when nothing defines *when* payment is owed and nothing follows from not paying. |
| **Exclusivity / category ban / non-compete** | High | "May not work with competing brands" — "competing" undefined, duration undefined, no carve-out for existing clients. ~50% of small-business owners say a non-compete hurt their own ability to grow (§2 #3). Dangerous when the restricted category is broad or vague and the restriction outlives the engagement. |
| **Indemnification** | High | The reader agrees to cover the other side's losses — often uncapped, often carved out of any liability cap (§2 #5: carved out in 40%+ of negotiated deals). The one clause that can cost more than the entire contract is worth. |
| **Termination for convenience / unilateral amendment** | Medium | "Either party may terminate on 7 days' notice"; "we may change these terms." Dangerous specifically when paired with work done up front and payment due later. |
| **Morality / reputation clause** | Medium | Creator-specific. Termination and fee clawback if the brand decides the creator's conduct reflects badly on it. Dangerous when the standard is the brand's sole discretion and reaches conduct outside the campaign. |
| **Auto-renewal** | Medium | The research's #1 clause by complaint volume overall (§2 #1). Less central to negotiated creator work, but appears in retainers and tooling agreements. |

**The rule for what counts as a red line:** a clause is flagged when at least one
of these is true — (a) it is hard to reverse once signed, (b) the cost if it
goes wrong exceeds the value of the deal, or (c) it moves a right or obligation
the reader does not know they hold. A clause that is merely unusual — an odd
governing-law choice, a strange notice address — is not a red line and is not
flagged as one.

---

## 6. The calls made, and what each one cost

**1. The reader has leverage — we are not serving the loudest pain.**
Chose: freelancers and creators who can negotiate a term before signing.
Chose against: renters, gym members, terms-of-service readers.
Worse off: the people the research documents most vividly — the $708 solar bill,
the $600 gym collections letter, the withheld deposit (`research/summary.md`
§1). A counter-offer cannot help them and this product will not pretend
otherwise.

**2. Pre-signature — we are not serving the moment of actual demand.**
Chose: the moment before signing.
Chose against: "explain what just happened to me," which is where the research
shows people actually searching (`research/summary.md` §5.3).
Worse off: the user at the point they are motivated to look. By then it is a
question about a live dispute, which is advice, which is the exact territory the
FTC's DoNotPay consent order polices (`research/summary.md` §5.7).

**3. Creators are the anchor — not freelancers.**
Chose: the creator persona (demonstrated willingness to pay; an audience that
functions as distribution).
Chose against: freelancers as anchor (50–76M people; the document volume that
would let the product prove its analysis on real usage rather than a seeded test
set).
Worse off: **[the product owner has not stated this]**. Asked twice during the
grilling, not answered. The drafter's articulation, offered for the owner to
confirm or replace: worse off is the product's own ability to prove itself —
thin creator document volume means "the analysis can be trusted" gets
demonstrated on a curated corpus, and the freelancer with a $4k contract and no
lawyer waits for a second version that may not come.

---

## 7. What we are not building, and why

- **Payments and billing.** Out per `CLAUDE.md`. The first version proves the
  analysis, not the business model.
- **OCR for scanned documents.** Out, and not neutral: a citation is worthless
  when the text it points at was misread. Every flag must quote a verbatim
  sentence (`docs/adr/0001`), and OCR breaks that at the source.
- **Sharing a document between users.** Out per `CLAUDE.md`.
- **Divergence detection — comparing the document to what the reader was
  promised.** The research's single strongest candidate for a defensible product
  (`research/summary.md` §5, verdict). Deferred, not rejected: the first version
  has no way to capture the pitch, and building that capture is a product in
  itself. Recorded here so it is not quietly forgotten.
- **Deadline and consequence extraction as a feature** — "this bills you again
  on March 3 unless you cancel by February 1." The research's second wedge and
  the highest-volume documented harm (`research/summary.md` §5). Deferred for the
  same reason. A harmful dated clause still shows up in the ranked list (§3.2);
  the product just does not extract the date or build a calendar around it.
- **Post-harm mode.** See call §6.2.

---

## 8. What the research could not tell us

- **Whether anyone seeks contract review before signing at all.** Every piece of
  demand evidence in the research is post-harm (`research/summary.md` §5.3). The
  central behavioral bet of this product — that people will look *before* they
  sign — is unverified.
- **A real willingness-to-pay figure.** Every number in `research/summary.md` §4
  is inferred from what adjacent products charge, not from a person saying "I
  would pay X." The research names getting this as a thing to do *before* a PRD.
  It was not done.
- **The size of the creator segment.** "Not sourced" (`research/summary.md` §4).
  The anchor persona is a segment of unknown size.
- **First-person harm stories from Reddit.** Unreachable by the research agents
  (`research/summary.md` §5.8). The pain findings lean on Trustpilot quotes
  pulled through a summarization step that the research itself says should be
  checked against the live pages before any external use. The quotes in this
  brief inherit that caveat.

---

## 9. Still open — decide before building

- **§4** — recall and false-positive targets for the evaluation corpus.
- **§5** — the entire red-lines section is the research's list, not the owner's.
  Needs the owner's own clause judgment.
- **§6.3** — what anchoring on creators costs, in the owner's own words.
- **§8** — how a clean document is presented. Resolved 2026-09-11 in the spec
  (issue #1, story 46a): a clean result shows the list of clause types that
  were checked, so it reads as a result rather than an empty screen.
- **Not yet grilled at all:** which error is worse to make (false alarm vs.
  miss) and how that asymmetry shapes the ranking; how confident the output
  should sound when the model is not certain.
- **§3.7, landing page — the public name.** The research names a shipping
  product called Redline with the same feature set (`research/summary.md`
  §5.1). The landing page is the first place the name is shown to a stranger;
  whether "Redline" is the working name or the real one has to be decided
  before it goes public.
- **§3.7 — what the call to action leads to.** Sign-up does not exist yet
  (issue #1 stories 1–3). Until it does, the page has nowhere to send anyone.
- **§3.7 — when the page is reachable.** Vercel Deployment Protection currently
  hides the whole deployment; a landing page nobody can reach is a mock-up.
