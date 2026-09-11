<!--
SNAPSHOT — not the source of truth.

This is a point-in-time copy of GitHub issue #1, the Redline v1 spec:
https://github.com/jcpbacon/redline/issues/1

The issue is canonical. This file exists only so the spec can be read from
inside the repo without hitting GitHub. It will go stale the moment the
issue is edited again — /to-tickets splitting it into individual tickets,
or a future session adding to it, as already happened twice — and nothing
keeps this file in sync automatically. If the two ever disagree, the issue
wins.

Snapshotted: 2026-09-11 (after landing-page addition)

To refresh this file to match the live issue:

    gh issue view 1 --json body --jq '.body' > scratchpad/redline-v1-spec.md

Earlier snapshots aren't lost — this file is committed, so every previous
version stays in git history even after a refresh overwrites it here:

    git log -- scratchpad/redline-v1-spec.md          # list every snapshot
    git show <commit>:scratchpad/redline-v1-spec.md   # print one of them
-->

## Problem Statement

A Reader has been sent a Document — a brand deal, a client services agreement, a
licensing deal — and has to decide whether to sign it. They can negotiate it,
but only if they know which terms to push on. Reading it themselves, they can't
tell what's normal from what's a trap. A lawyer costs $500–1,400 and takes days;
asking peers gets guesses from people who also haven't read it. So they sign it
unread and find out what they agreed to when something goes wrong.

They need to know what the Document actually does to them, Pre-signature, in
language they understand, tied to the exact sentences so they can check it
themselves rather than take Redline's word for it.

## Solution

Redline is a web app. The Reader uploads a Document; the file is parsed in their
browser and only the extracted text leaves the machine. Redline returns:

- a plain-English summary of the whole Document;
- a ranked list of Flags — clauses that could hurt the Reader — each showing the
  exact Source Sentence it came from, a plain-English explanation of what it
  means for the Reader, and a drafted Counter-offer;
- a question box that answers only from the Document's text and says so when the
  text doesn't address the question.

The Reader keeps an editable list of their own Red Lines, which shapes what gets
flagged and how severely. Analyzed Documents are saved to a personal library as
extracted text only.

Every Flag can be checked: the Reader finds the Source Sentence in their own copy
and judges whether Redline read it correctly, without trusting Redline or knowing
law. A Flag whose Source Sentence cannot be shown verbatim is a defect and is
never displayed (ADR-0001).

## User Stories

Actor is the **Reader** (the authenticated user). Stories 49–55 have a second
actor, a **prospective Reader** — someone at the landing page who has not signed
in yet. (Added 2026-09-11; `CONTEXT.md` does not define this term yet.)

### Account and privacy

1. As a Reader, I want to create an account with an email address, so that my Documents and Red Lines are private to me and persist between visits.
2. As a Reader, I want to sign in and sign out, so that I control access to my account on a shared machine.
3. As a Reader, I want my session to persist across visits, so that I'm not re-authenticating every time.
4. As a Reader, I want to be the only person who can see my Documents and their analyses, so that confidential contract terms are never exposed to other users.

### Getting a Document in

5. As a Reader, I want to upload a Document as a PDF, so that I can analyze the contract I was actually sent.
6. As a Reader, I want to upload a Document as a DOCX, so that I can analyze contracts sent as Word files.
7. As a Reader, I want to paste plain text, so that I can analyze a contract that arrived in an email body.
8. As a Reader, I want the file parsed in my own browser with only the extracted text sent onward, so that I am not uploading a confidential document to a server.
9. As a Reader, I want to be clearly told when a Document looks like a scanned image with no extractable text, so that I understand why it can't be analyzed instead of receiving a wrong analysis.
10. As a Reader, I want to see the extracted text before analysis runs, so that I can confirm it parsed correctly.
11. As a Reader, I want a clear, specific error when parsing fails, so that I know whether to try a different file or format.
12. As a Reader, I want to be told when my Document exceeds the length Redline can analyze, so that I'm not left waiting on a request that will fail.

### The summary

13. As a Reader, I want a plain-English summary of the whole Document, so that I understand what I am signing at a high level.
14. As a Reader, I want the summary to state only what the Document says, so that I am not misled by claims the text does not support.
15. As a Reader, I want the summary to be readable in a minute, so that I get oriented before digging into Flags.

### Flags

16. As a Reader, I want a list of the clauses that could hurt me, so that I know what to negotiate.
17. As a Reader, I want Flags ranked by severity, most severe first, so that I spend my negotiating capital on what matters most.
18. As a Reader, I want every Flag to show the exact Source Sentence from my Document, so that I can verify Redline read it correctly.
19. As a Reader, I want to never be shown a Flag without its Source Sentence, so that I can trust that every Flag is grounded in the text.
20. As a Reader, I want each Flag to explain in plain English what the clause means for me, so that I understand the risk without a law degree.
21. As a Reader, I want each Flag to say why the clause is dangerous rather than merely unusual, so that I can tell a real problem from a quirk.
22. As a Reader, I want to see a Source Sentence in the context of the surrounding text, so that I can read the whole clause it belongs to.
23. As a Reader, I want to dismiss a Flag I have considered and accepted, so that my view reflects the decisions I have already made.
24. As a Reader, I want a Flag that conflicts with one of my Red Lines to be marked as such, so that I can see which of my own rules the Document breaks.

### Counter-offers

25. As a Reader, I want a drafted Counter-offer for each Flag, so that I have concrete language to send back.
26. As a Reader, I want to copy a Counter-offer to my clipboard, so that I can paste it into an email.
27. As a Reader, I want to edit a Counter-offer before I use it, so that it fits my situation and voice.
28. As a Reader, I want each Counter-offer framed as a request I could reasonably make, so that sending it does not blow up the negotiation.

### Asking questions

29. As a Reader, I want to ask a free-text question about my Document, so that I can check a specific concern.
30. As a Reader, I want the answer drawn only from my Document's text, so that I am not getting generic legal information that may not apply to my contract.
31. As a Reader, I want to be told when my Document does not address the question, so that I know to ask the other party rather than assume an answer.
32. As a Reader, I want the answer to point at the Source Sentence(s) it rests on, so that I can verify it the same way I verify a Flag.
33. As a Reader, I want to ask follow-up questions about the same Document, so that I can work through a concern.

### Red Lines

34. As a Reader, I want to write my own Red Lines in plain language, so that the analysis reflects what I personally will not accept.
35. As a Reader, I want to edit and delete Red Lines, so that my list stays current as my situation changes.
36. As a Reader, I want my Red Lines to persist across Documents, so that I do not re-enter them for every contract.
37. As a Reader, I want to re-run analysis on a Document after changing my Red Lines, so that the Flags reflect my current rules.
38. As a Reader, I want a starting set of common Red Lines that I can keep or remove, so that I am not staring at an empty box.

### The library

39. As a Reader, I want every analyzed Document saved to a personal library, so that I can return to it later.
40. As a Reader, I want each saved Document to show a title and the date it was analyzed, so that I can find the right one.
41. As a Reader, I want to reopen a past Document and see its summary, Flags, and Counter-offers, so that I can revisit the analysis.
42. As a Reader, I want to rename a Document, so that my library is legible.
43. As a Reader, I want to delete a Document from my library, so that I control what is kept.
44. As a Reader, I want only the extracted text stored and never the original file, so that a confidential document is not sitting on Redline's servers.

### Trust

45. As a Reader, I want a visible statement that the analysis is AI-generated and is not legal advice, so that I calibrate how far to trust it.
46. As a Reader, I want Redline to tell me plainly when a Document is genuinely low-risk, so that I believe it the times it does flag something.
47. As a Reader, I want a failed analysis to be retryable without re-uploading the Document, so that a transient error does not cost me the extracted text.
48. As a Reader, I want analysis progress shown while it runs, so that I know the request is alive.

### The front door (added 2026-09-11, PRD §3.7)

49. As a prospective Reader, I want the landing page to tell me in one screen what Redline does, who it is for, and at which moment (before I sign), so that I can tell whether it is for me without signing up.
50. As a prospective Reader, I want the page to say that every warning shows the exact sentence it came from and that a warning which can't is never shown, so that I understand how I would check its work.
51. As a prospective Reader, I want the page to say that my file is parsed in my browser and never uploaded, so that I know a confidential contract is not leaving my machine before I trust it with one.
52. As a prospective Reader, I want the page to say the analysis is AI-generated and is not legal advice, so that I calibrate my expectations before I start.
53. As a prospective Reader, I want one clear call to action that takes me to sign-up / sign-in, so that I know what to do next.
54. As a prospective Reader, I want the page to work on my phone, so that I can read it from the message the contract arrived in.
55. As a signed-in Reader, I want to land in the app rather than on the marketing page, so that I am not re-sold a product I already use.

## Implementation Decisions

### Stack and boundaries

- Next.js application deployed on Vercel. Supabase for authentication and a
  Postgres database. Model calls go through OpenRouter, from server-side code
  only, so the API key is never exposed to the browser. (CLAUDE.md)
- Next.js is pinned to `^16.3.4`, not the 14.x line the scaffold originally
  shipped with — 14.x's newest release had a critical RCE advisory with no fix
  published for either the 14.x or 15.x lines. Upgrading now, while the app is
  still two trivial files, was cheaper than upgrading later against real
  application code.
- The Document file is parsed entirely in the browser. Only extracted text is
  transmitted and persisted; the original file is never uploaded. PDF and DOCX
  are parsed with client-side libraries; pasted plain text is taken as-is.
  (CLAUDE.md)
- Which OpenRouter model to call is **not yet decided** and must not be
  hardcoded — it is configuration. Choosing it requires an explicit decision
  (CLAUDE.md).

### Extraction fidelity

- Extracted text preserves source characters: no whitespace normalization, no
  reflow, no de-hyphenation across line breaks. Source Sentences are matched
  against this stored text, so it must equal what the Reader sees in their own
  copy. (ADR-0001)
- If parsing a PDF yields little or no text relative to its page count, the
  Document is treated as a scanned image: the Reader is told it cannot be
  analyzed. There is no OCR fallback. (ADR-0001, CLAUDE.md)

### Seam 1 — the analysis module (server-side)

One module, confirmed with the product owner as the primary test seam. Public
interface:

- `analyzeDocument(documentText, redLines) -> { summary, flags }`
  - `flags` is ordered, most severe first, ties broken by position in the
    Document.
  - each flag: `{ severity, sourceSentence, whatItMeans, counterOffer,
    matchedRedLineId? }`.
- `answerQuestion(question, documentText) -> { text, groundedIn } | { unanswerable: true }`
  - `groundedIn` is a list of Source Sentences.

The OpenRouter client is injected into the module so tests can supply a stub or
a recorded response.

### Citation enforcement (ADR-0001)

- After the model returns candidate Flags, each `sourceSentence` is checked as an
  exact substring of `documentText`. A Flag that fails the check is dropped, and
  the drop is logged with enough context to investigate (which Document, what the
  model returned).
- This check lives inside the analysis module, not in the UI. A Flag can never
  reach the client without a validated Source Sentence.
- The same substring check is applied to every Source Sentence in a Q&A answer's
  `groundedIn`.

### Red Lines as analysis input

- Red Lines are passed into `analyzeDocument` as plain text. The model is asked
  to identify where the Document conflicts with each Red Line; a resulting Flag
  carries that Red Line's id in `matchedRedLineId`.
- Red Lines never produce a Flag that lacks a Source Sentence. A Red Line about
  something the Document is simply silent on produces no Flag (ADR-0001).

### Severity

- A small fixed ordinal scale. The exact set and the boundary between levels is
  **not yet decided**; the module should treat severity as an enum it can sort
  by.

### Persistence (Supabase / Postgres, row-level security scoping every table to
its owning Reader)

- `documents` — id, reader_id, title, extracted_text, created_at. No file blob.
- `analyses` — id, document_id, summary, model_id, red_lines_snapshot,
  created_at. Re-running analysis inserts a new row; the most recent is shown.
- `flags` — id, analysis_id, severity, source_sentence, what_it_means,
  counter_offer, matched_red_line_id, order_index, dismissed_at.
- `red_lines` — id, reader_id, text, created_at, archived_at.
- `questions` — id, document_id, reader_id, question, answer_text, unanswerable,
  created_at.

### Client-only behaviour

- Counter-offer edits are for the Reader's own use (copy / tweak); they are not
  persisted in v1.
- The "AI-generated, not legal advice" notice appears on every analysis view.

### Landing page (added 2026-09-11)

- Served at `/`. Static content: no model calls, no database reads, no
  per-visitor state. It is the one route that must work with Supabase and
  OpenRouter unconfigured.
- Copy is bound by the same standing rule as the analysis: it states only what
  the product actually does. No pricing (payments are out of scope), no
  testimonials, logos, usage counts, or accuracy figures (none exist — PRD §8),
  no claim of equivalence to a lawyer's review (research §5.7).
- The "AI-generated, not legal advice" statement appears on the page itself,
  not only after sign-in.
- The call to action targets the sign-in route. Until stories 1–3 ship, that
  route does not exist; the page must not pretend otherwise (see Further Notes).
- A signed-in Reader requesting `/` is redirected into the app (story 55).
  Which route that is depends on the library / upload work and is **not yet
  decided**.
- Design direction (visual world, typography, palette) is not decided in this
  spec; it is established through the design process and recorded in
  `DESIGN.md` when the page is built.

### Runtime version pinning — not yet done

- Nothing currently pins the Node version the app targets (no `engines` field,
  no `.nvmrc` / `.node-version`). Local dev, CI, and Vercel's build image can
  silently drift apart without one. Should be added before this stops being a
  two-file scaffold.

### OpenRouter usage limits — not yet decided

- Neither `analyzeDocument` nor `answerQuestion` has a rate limit or a
  per-Reader usage cap specified anywhere. Once these are live, an unbounded
  Reader (or a bug that retries in a loop) is a real cost and abuse surface.
  Needs a decision before either function takes real traffic.

## Testing Decisions

- A good test asserts external behaviour through a seam's public interface and
  nothing else — never the prompt text, the number of model calls, or private
  helpers. Fixtures in, returned value checked.

### Seam 1 — analysis module (deterministic, with stubbed / recorded model output)

- **Citation invariant:** across a set of fixture Documents and canned model
  outputs — including an output that contains a quote which is *not* in the
  Document — every Flag returned has a `sourceSentence` that is a verbatim
  substring of the input, the non-matching Flag is absent, and its drop is
  logged.
- **Red Lines:** given a Document that violates a supplied Red Line, the
  corresponding Flag carries that Red Line's id; given a Document that does not,
  no Flag claims it.
- **Q&A:** an in-Document question returns `{ text, groundedIn }` with each
  grounding sentence present verbatim in the text; an out-of-Document question
  returns `{ unanswerable: true }`.
- **Ordering:** Flags are returned most-severe-first, Document order breaking
  ties.

### Seam 1 — recall eval (separate job, live or replayed model, not a unit test)

- A labelled corpus of roughly 20 freelance and brand Documents, each with an
  expert's list of the clauses that matter in it. The job reports recall (the
  fraction of expert clauses that appear as Flags) and the fraction of Flags not
  on the expert list. Target thresholds are **not yet decided**; until they are,
  the job reports numbers and does not gate CI.

### Seam 2 — the browser parser (browser-like environment, fixture files)

- A known fixture PDF extracts to text that equals a stored expected string
  exactly, including whitespace and in-clause line breaks.
- A known fixture DOCX does the same.
- A scanned-image PDF produces the "looks scanned" outcome, not partial garbage.
- A sentence taken from the expected text is a verbatim substring of the parser
  output — the property Seam 1 depends on.

### Dependency vulnerability scanning

- `npm audit` (or equivalent) runs as part of the build, not just by hand. The
  scaffold's `next@14.2.35` — the newest release on that line — carried a
  critical RCE advisory with no published fix for 14.x or 15.x, and it was
  only caught because someone ran `npm audit` manually. That shouldn't be the
  only line of defence.

### Not unit-tested

- Supabase auth, library CRUD, upload wiring, OpenRouter transport — covered by a
  thin layer of route-level integration / e2e tests.

### Prior art

- None in this repo; it is greenfield. This spec establishes the fixture-driven
  pattern.

## Out of Scope

- Payments, billing, subscriptions. (CLAUDE.md)
- OCR for scanned Documents — detect and refuse, never guess. (CLAUDE.md,
  ADR-0001)
- Sharing a Document between Readers. (CLAUDE.md)
- Divergence detection (comparing the Document to what the Reader was verbally
  promised) — identified as the strongest wedge in the research but deferred; v1
  has no way to capture the pitch. (PRD §7)
- Deadline / consequence extraction as a feature — dates, reminders, a calendar.
  A harmful dated clause still surfaces as a Flag; nothing is extracted or
  scheduled. (PRD §7)
- Post-signature / dispute mode. (PRD §6.2)
- Flagging what the Document does *not* say — a missing clause has no Source
  Sentence and so cannot be a Flag (ADR-0001). Whether the summary may note a
  significant silence is **not yet decided**.
- Non-English Documents.
- On the landing page: a pricing section, a waitlist or email capture, a blog
  or docs section, and any social proof. The page is one screen and one call
  to action.

## Further Notes

Open decisions carried from `PRD.md` §9. Each should be settled before the work
it blocks begins; none blocks scaffolding the app or building Seam 2.

- **Severity scale** — the exact levels and what separates them. Blocks
  finalising Flag ranking.
- **Recall / false-positive targets** — blocks the recall eval gating anything.
- **Red Lines seed list** — `PRD.md` §5 is the research's clause ranking, not the
  owner's lived judgement; needs the owner's pass before shipping as defaults.
- **Clean-Document presentation** — how a low-risk result is shown so the tool
  stays believable when it has little to report (`PRD.md` §4.6, §8).
- **Error asymmetry** — whether Redline should lean toward over- or
  under-flagging when uncertain. Shapes the model instructions and the severity
  boundaries.
- **Confidence language** — how certain the summary and Flags should sound when
  the model is not certain. Hedged text is safe and useless; confident text is
  useful and sometimes wrong.
- **Anchor-segment cost** (`PRD.md` §6.3) — product-strategy open item, not a
  build blocker.
- **Document length ceiling** — user story #12 promises the Reader a message
  when their Document is too long to analyze, but no actual number exists
  anywhere. Needs a decision the same way the severity scale does.
- **Deployment Protection posture** — the deployed app is currently reachable
  only by whoever owns the Vercel account; nothing else, including automated
  checks, can view it. Fine while there's nothing to see, but worth an
  explicit decision about when production goes public.
- **Ownership of dropped-citation logs** — a Flag that fails the citation
  check is "dropped and logged with enough context to investigate," but
  nothing says where that log goes or who is expected to look at it. Right
  now the invariant has no owner watching for violations.
- **The public name** (landing page) — the page is the first place the name is
  shown to a stranger, and `research/summary.md` §5.1 records a shipping
  product called Redline with the same feature set. Working name or real name
  must be decided before the page is public.
- **Where the call to action goes** — sign-up / sign-in (stories 1–3) has no
  ticket and no route yet. The landing page can ship with the CTA pointing at
  the intended route, but it is not demoable end-to-end until auth exists.
- **Where a signed-in Reader lands** (story 55) — depends on which app route
  is the home: the library, or the upload screen.
- **Deployment Protection** — already listed above; it now also blocks the
  landing page from being seen by anyone but the Vercel account owner.
- **"Prospective Reader"** — used in stories 49–55 and not in `CONTEXT.md`.
  Either add it to the glossary or fold it into "Reader" with a note that the
  Reader is a role, not a login (which `CONTEXT.md` already says).

The two test seams were confirmed with the product owner. Everything outside them
is standard framework plumbing, tested incidentally.



