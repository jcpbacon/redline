# Redline — Research Summary

Synthesis of four parallel research agents (2026-08-28). Sources: `who-has-this-pain.md`,
`what-goes-wrong.md`, `what-already-exists.md`, `who-would-pay.md`.

**Read section 5 before the rest.** The evidence is supportive of the *pain* and substantially
unfavorable to the *product as differentiated*.

---

## 1. The three sharpest pain points

### A. The document contradicts what a human being told you out loud

> "When I asked what went wrong SunRun told me I should have read the contract closer."

— Erik Kuhi, homeowner. A payment-escalator clause pushed his combined monthly cost to ~$708
after being sold solar as a *replacement* for his electric bill.
https://www.trustpilot.com/review/sunrun.com

The same shape appears in the Vivint finding: a door-to-door rep promised a two-week trial; the
written cancellation clause didn't give one. This is the strongest argument for Redline's
specific design — the value isn't simplification, it's *divergence detection* between the pitch
and the paper. Nothing in the competitive set does this explicitly.

### B. Money keeps leaving after you think you're done

> "Cancelled my membership, and then 6 months later got hit with a collections account claiming
> I owed them 600 dollars."

— Aaron Burns, Planet Fitness member. https://www.trustpilot.com/review/planetfitness.com

> "I found out that almost 500USD from my deposit was gone!"

— Yen Ying Ng, freelancer, on a dormant-account fee buried in Freelancer.com's terms.
https://www.trustpilot.com/review/freelancer.com

Corroborated at scale by Agent 2: FTC-tracked auto-renewal/negative-option complaints roughly
doubled from ~42/day (2021) to ~70+/day (2024), with an active enforcement wave.
https://www.jonesday.com/en/insights/2026/05/ftc-revives-clicktocancel-rule-new-risks-for-subscription-businesses

### C. You are bound by a term you only discover when you try to leave

> "This reads to me like Amazon want all my apps, and won't let me remove them from their store
> unless I remove them from everywhere! ... have Amazon laid claim to all the Android apps I've
> made or ever will make?"

— Indie app developer, on Amazon Appstore Developer Agreement section 3.a, discovered only when
he tried to pull one app down. https://news.ycombinator.com/item?id=2564512

Stated losses across all findings with a dollar figure cluster **$300–$3,025** — real anger, but
not "hire a lawyer" money. That gap is precisely the wedge, and also the pricing ceiling.

---

## 2. Clause types that matter most, ranked

| # | Clause | Evidence | Confidence |
|---|---|---|---|
| 1 | **Auto-renewal / negative-option** | FTC complaints ~42/day (2021) to ~70+/day (2024); ~$50M / ~500k consumers refunded in one settlement | Evidence-backed |
| 2 | **Mandatory arbitration + class-action waiver** | CFPB: ~80M cardholders covered, **75% didn't know**, invoked to block class claims 65% of the time | Evidence-backed (2015 study) |
| 3 | **Non-competes** | Small Business Majority: >33% of SMB owners blocked from hiring; ~50% say one hurt their own ability to start/grow | Evidence-backed |
| 4 | **Payment terms / no late-fee teeth** | Freelancers Union data: 71% hit a stalled payment; avg ~$6,000/yr lost (~13% of income); ~$1.6B aggregate | Evidence-backed |
| 5 | **Liability caps + indemnity carve-outs** | 97% of vendor forms cap liability; indemnity carved *out* of the cap in 40%+ of negotiated deals, so exposure is effectively uncapped | Evidence-backed |
| 6 | **Security deposit / repair liability** | NY AG: ~5,000 tenant complaints since 2023, ~$2.1M recovered | Evidence-backed, NY only |
| 7 | **Unilateral amendment** ("we may change these terms") | Near-universal in ToS; courts repeatedly refuse to enforce silent changes | Judgment call — no volume data |
| 8 | **Rental junk fees / hidden mandatory fees** | FTC action returned ~$50M to ~500k renters | Evidence-backed |

**Dropped for lack of data, not lack of importance:** IP assignment / work-for-hire overreach,
personal guarantees, non-solicits, NDA overreach, exclusivity, and fee escalators as a distinct
category. IP assignment is a plausible top-five candidate for freelancers that simply wasn't
quantified within the search budget.

**Design implication (Agent 1):** people don't say "clause." They describe *events* — got a
collections letter, got denied a claim, got billed after cancelling. Rows 2 and 5 above are
exactly the clauses users are documented as not understanding. Organize output around "what can
happen to you," with the source sentence attached as evidence.

---

## 3. Where the existing tools are weak

Two tiers, and a crowded middle you can't reach.

- **Enterprise CLM / legal AI** (Ironclad, Evisort, Lexion, LawGeex, Spellbook, Robin AI, Genie
  AI, Harvey) — well-capitalized, demo-gated, no published pricing; Harvey estimated at ~$288K/yr
  entry. Complaints are about cost, learning curve, and AI-accuracy vigilance, not absent demand.
  Not competitors to a consumer product, and not an opportunity.
- **Rocket Lawyer** — the one consumer incumbent, $124.99–$349/yr, and **already ships "Rocket
  Copilot" AI contract analysis flagging "key terms and red flags" on unlimited uploads**. Its
  complaints are almost entirely billing and cancellation practices, not analysis quality.
  https://www.rocketlawyer.com/pricing
- **Consumer lease/contract scanners** (Contract Analyzer AI, LeaseLogic, Lease Decoder, Lease
  Shield AI) — thin, indie, 5–7 ratings each, priced $4.99/mo to $69.99/yr. No dominant player
  has emerged.
- **ToS;DR** — free, volunteer-graded, covers *services* rather than *your* document; coverage
  gaps on smaller companies.
- **DoNotPay** — FTC consent order (Feb 2025), $193K in relief, permanent ban on deceptive "AI
  lawyer" claims. A hard regulatory boundary on how this category may be marketed.
  https://www.ftc.gov/news-events/news/press-releases/2025/02/ftc-finalizes-order-donotpay-prohibits-deceptive-ai-lawyer-claims-imposes-monetary-relief-requires

**Genuine weaknesses worth attacking:** nobody detects divergence between what a salesperson
promised and what the document says; nobody organizes output around consequences and deadlines
("this charges you again on March 3 unless you cancel by Feb 1"); the consumer tier has no
trusted brand; and the incumbent with distribution is disliked for its billing, not its product.

---

## 4. Who would plausibly pay, and roughly what

| Segment | Size | Existing price anchor | Read |
|---|---|---|---|
| **Creators / influencers** | not sourced | Brand-deal review **$800–$1,400 flat**; ContractsCounsel avg **$2,850** for influencer agreements — highest of ~250 contract types | Sharpest willingness to pay found; already paying four figures per document |
| **Freelancers** | 53M–76.4M (source-dependent) | Bonsai **$24–79/mo** for contract-adjacent tooling | Habituated to SaaS; largest population; no direct WTP quote for risk review |
| **Small business** | 36.2M (SBA 2025) | LegalShield SMB **$59.95–169.95/mo** incl. unlimited document review | Closest proven analog for recurring payment |
| **Renters** | 46.1M households | Free legal aid and clinics dominate | Biggest population, weakest WTP signal |
| **Consumers (ToS)** and **founders** | — | — | No sourced evidence either way. Gaps, not verdicts. |

Baseline anchors: lawyer contract review averages **$520 flat** ($250–750/hr as the alternative);
ToS review averages **$290**. LegalShield markets itself explicitly against "$300–500/hr lawyers."

**Rough read:** creators are the highest-value beachhead, freelancers the largest, renters the
loudest but least monetizable. No agent found a verbatim "I'd pay $X" statement — all willingness
to pay here is *inferred from what adjacent products charge*, not from stated intent.

---

## 5. What contradicts the hypothesis

**This is the section that should change your plans.**

1. **A shipping product called Redline already does nearly all of this.** redlineapp.net —
   photograph or upload a contract, get a 0–100 risk score, clauses flagged
   high-risk/caution/safe with plain-English explanations tied to source text, Q&A over the
   document, and automated negotiation-email drafting (functionally your counter-offer feature).
   It targets renters, freelancers, job applicants, and small businesses at **$9.99 one-time /
   $29.99/yr / $89.99/yr.** That is a name collision *and* near-total feature overlap, already
   priced. https://redlineapp.net/

2. **Rocket Lawyer bundles the core feature into a $12.41/mo plan that also includes a real
   lawyer.** Your differentiating feature is someone else's bundled checkbox, sold alongside
   something you can't offer.

3. **Timing works against the product.** Every Agent 1 finding is a story about discovering the
   term *at the event* — the collections letter, the denied claim, the deposit dispute. The
   product requires the user to seek review *before* signing, at the exact moment they feel
   least worried. Nothing in this research demonstrates that people go looking for contract
   review pre-signature; the demand evidence is all post-harm.

4. **The best-evidenced harms are not clause-comprehension problems.** Freelancer nonpayment
   (~$6,000/yr average loss), junk fees, and illegally withheld deposits are *counterparty
   behavior* problems. Reading the contract better would not have prevented most of them. The
   clause types with the hardest numbers behind them are the ones a reading tool helps with least.

5. **Redlining assumes negotiating leverage most of these users don't have.** Auto-renewal in a
   gym contract, arbitration in a ToS, Amazon's developer agreement — none are negotiable. The
   counter-offer feature is only meaningful for freelance and SMB vendor contracts, a subset of
   the target market.

6. **The segment with the sharpest pain has the weakest willingness to pay** (renters), and the
   segment with proven willingness to pay (creators, $800–$2,850 per document) is small and
   already served by specialist human lawyers.

7. **The regulatory ceiling is established, not hypothetical.** The DoNotPay consent order means
   the marketing claims that would make this product compelling ("know what you're signing the
   way a lawyer would") are the exact claims the FTC has already policed.

8. **The evidence base is thin where it matters most.** Reddit — the single richest vein for
   first-person contract-harm stories, and explicitly in scope — was unreachable by both search
   and fetch for Agent 1. The pain findings lean on Trustpilot, and Agent 1 flags that those
   quotes were extracted through an intermediate summarization step and should be spot-checked
   against the live pages before any external use. Two agents also ran 13 searches against a
   12-search cap and disclosed it.

### Verdict

The pain is real and well documented. The **hypothesis as differentiated is not supported** — a
functionally equivalent product already exists at consumer pricing under the same name, and a
distribution-rich incumbent bundles the core feature for $12/mo.

What the evidence *does* support, as something narrower and defensible: **divergence detection**
(what you were promised versus what the paper says — nobody does this, and it is the most vivid
pain pattern found), and **consequence-and-deadline surfacing** ("this bills you again on X
unless you act by Y" — by far the highest-volume documented harm). Those are features, not yet
a company.

Before a PRD, two things are worth doing: pull the Reddit evidence Agent 1 couldn't reach, and
find or disprove a single real person saying out loud what they would have paid to know in
advance. Neither exists in this research.
