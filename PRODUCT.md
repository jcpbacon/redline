# Product

<!-- impeccable:product-schema 1 -->

Sources: `PRD.md`, `CLAUDE.md`, `CONTEXT.md`, `docs/adr/0001`, `docs/adr/0002`,
`research/summary.md`, GitHub issue #1 (the v1 spec). Facts marked
**[inferred]** were not confirmed by the product owner and should be corrected
if wrong; facts marked **[open]** are deliberately undecided.

## Platform

web

## Stack

Next.js on Vercel; Supabase for auth and Postgres; model calls through
OpenRouter from server-side code only. Settled in `CLAUDE.md`, not chosen here.
Still to decide before the relevant work starts: which OpenRouter model, whether
a Supabase project already exists, and every new dependency (`CLAUDE.md`, "Ask
before you decide").

## Users

**The Reader**: an independent creator or freelancer who has been handed a
Document they can still negotiate and has not signed yet — a brand or
sponsorship deal, a client services or consulting agreement, a licensing deal.
They have leverage and are looking at the paper *before* it binds them.

**Anchor persona**: the creator weighing a brand deal. The only segment with a
demonstrated price for this exact task ($800–$1,400 flat for brand-deal review;
$2,850 average for influencer agreements). Freelancers are the same Reader with
less money per Document and far more Documents; served, not the anchor.

**Deliberately not served**: renters, gym members, terms-of-service readers,
anyone across the table from a door-to-door rep — take-it-or-leave-it documents
where a Counter-offer is a gesture. Also not served: the post-harm moment
("explain what just happened to me"). Both cuts are ADR-0002.

## Product Purpose

Read a Document Pre-signature and tell the Reader, in plain English, what they
are about to agree to — with every warning tied to the exact Source Sentence it
came from, so the Reader can check it in their own copy rather than take
Redline's word for it.

Success for this version is that **the analysis can be trusted**, measured by
the tests in `PRD.md` §4: every rendered Flag is anchored to a verbatim
substring of the stored text (hard invariant); recall against an expert-labelled
corpus; low noise among extra Flags; a summary that invents nothing; a question
box that refuses rather than guesses; a clean Document that reads as clean.

## Positioning

Redline differentiates on the **trustworthiness of the analysis, not on
features** (ADR-0002). The mechanism: a Flag without a verbatim Source Sentence
is never rendered — dropped, logged, treated as a bug (ADR-0001). A Reader can
verify every claim without trusting Redline, the model, or knowing law.

Known facts that bound this claim:

- redlineapp.net ships a near-identical feature set under the same name at
  consumer pricing; Rocket Lawyer bundles AI contract analysis with a real
  lawyer at ~$12/mo (`research/summary.md` §5).
- The FTC's DoNotPay consent order polices "AI lawyer" claims. Redline may not
  market itself as equivalent to legal review.
- **[open]** Whether "Redline" is the working name or the public name. The
  collision is recorded in `PRD.md` §1 and `research/summary.md` §5.1; no
  decision exists.

## Operating Context

- The Reader arrives with a PDF, a DOCX, or text pasted from an email. The file
  is parsed in the browser; only extracted text leaves the machine and only
  extracted text is stored. The original file is never uploaded.
- Scanned Documents are detected and refused. There is no OCR, on purpose: a
  citation is worthless when the text it points at was misread (ADR-0001).
- The Reader keeps a persistent, editable list of Red Lines that drives which
  clauses become Flags and how severe they are.
- Every analysis view carries a visible "AI-generated, not legal advice"
  statement.
- Analyzed Documents accumulate in a private per-Reader library. Nothing is
  shared between Readers.
- Today's alternatives the Reader is choosing against: a lawyer (~$520 general,
  $800–1,400 brand deal, days of turnaround), peers who also have not read it,
  or signing unread.

## Capabilities and Constraints

In scope for this version (`CLAUDE.md`, `PRD.md` §3) — build these and stop:

1. Plain-English summary of the whole Document.
2. Ranked Flags, most severe first, each with its Source Sentence, what it
   means for the Reader, and why it is dangerous rather than merely unusual.
3. A drafted Counter-offer per Flag.
4. A question box that answers only from the Document and says when the
   Document does not address the question.
5. An editable list of the Reader's own Red Lines, which drives the analysis.
6. A saved library of past Documents (extracted text only).
7. A public landing page — the first designed surface, the entry point before
   sign-in. Added 2026-09-11 (`PRD.md` §3.7, issue #1 stories 49–55, tickets
   #2 and #3). Not yet listed in `CLAUDE.md`'s scope section.

Excluded on purpose: payments and billing, OCR, sharing a Document between
Readers, divergence detection (pitch vs. paper — deferred, not rejected),
deadline/consequence extraction, post-signature mode, non-English Documents,
flagging what the Document does *not* say.

Hard constraints future work must preserve:

- A Flag whose Source Sentence is not a verbatim substring of the stored text is
  dropped, never rendered. Enforced server-side in the analysis module.
- Extracted text is not normalised, reflowed, or de-hyphenated.
- State only what the Document says. Where the text does not support a claim,
  the product does not make it.
- Credentials live in `.env.local`; nothing secret is committed.

Terminology (`CONTEXT.md`): Reader, Document, Flag, Source Sentence,
Counter-offer, Red Line, Pre-signature. Avoid: user/customer/client,
file/upload, issue/finding/risk/alert, citation/quote/excerpt, redline (as a
verb), preference/setting.

**[open]** product facts, carried from `PRD.md` §9 and issue #1: severity scale;
recall and false-positive targets; the owner's own Red Lines seed list; how a
clean Document is presented; error asymmetry (over- vs under-flag); confidence
language; Document length ceiling; OpenRouter usage limits; who watches the
dropped-citation log.

## Brand Commitments

- Name: "Redline" **[open — see Positioning]**.
- Voice: plain English, states only what the text supports, marks what is
  undecided rather than papering over it. The repo's own documents model this
  register.
- No visual identity, logo, palette, or typography exists yet. Nothing is
  binding.
- Marketing constraint: no "know what you're signing the way a lawyer would"
  framing or any claim of legal-review equivalence (FTC / DoNotPay).

## Evidence on Hand

- `research/summary.md` and the four agent reports under `research/` — pain
  quotes (Trustpilot, Hacker News), clause-type rankings with sources, pricing
  anchors, the competitive set, and the case against the product.
- `PRD.md` — the brief, with each research-backed claim quoted and sourced.
- No real Reader testimonials, no customer logos, no usage data, no
  willingness-to-pay statement from an actual person, no labelled eval corpus
  yet. The Trustpilot quotes were extracted through a summarisation step and
  should be spot-checked before external use. **None of these may be fabricated
  on any surface.**
- No fixture Documents or screenshots exist yet.

## Product Principles

1. **Verifiable beats fluent.** Every claim points at a sentence the Reader can
   find. A claim that cannot be anchored is not made.
2. **Refuse rather than guess.** Scanned files, out-of-Document questions,
   silent clauses: the product says it cannot answer instead of producing a
   plausible one.
3. **Leverage is the audience.** Build for the Reader who can still change a
   term. Do not ship gestures to readers who cannot.
4. **Pre-signature, never post-harm.** Stay out of live-dispute advice.
5. **Prove trust before business.** This version exists to establish that the
   analysis can be trusted; monetisation, sharing, and growth features wait.
