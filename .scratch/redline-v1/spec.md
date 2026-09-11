<!--
REFERENCE COPY — not this repo's spec. Do not ticket from this file.

This is a verbatim copy of `.scratch/redline-v1/spec.md` from
https://github.com/ankitvirmani/redline, taken 2026-09-11. It describes a
different product decision: consumers reading adhesion contracts (its ADR-0002),
no counter-offers, ranking by leverage lost, external-context fact base. This
repo's ADR-0002 chose freelancers and creators with negotiable documents, and
counter-offers are a core feature. The ADRs it cites (0003–0008) are that repo's,
not ours.

Three ideas were adopted from it on 2026-09-11 and nothing else should be
without a decision: a model-free ranking seam, a checked-list on a clean
result, and "Red Lines rank, they never hide" (now ADR-0003 here).

Where this repo's spec actually lives:

  - GitHub issue #1 is canonical:
    https://github.com/jcpbacon/redline/issues/1
  - scratchpad/redline-v1-spec.md is a committed snapshot of that issue.
  - Tickets #2–#16 are issue #1 broken into vertical slices.
  - PRD.md is the brief; CONTEXT.md the glossary; docs/adr/ the decisions.

The "Status" line below is that repo's, kept for fidelity. Here it is
reference only.
-->

# Spec: Redline v1

Status: ready-for-agent (in the source repo; reference only here)

Source: `PRD.md`. Settled decisions: ADRs 0001–0008. Vocabulary: `CONTEXT.md`.
Constraints: `CLAUDE.md`. Where this spec and an ADR disagree, the ADR wins.

## Problem Statement

A reader is about to accept an adhesion contract — a terms of service, a
subscription, a gym membership, an offer letter. They can accept it or walk away;
they cannot change a word. They are not a lawyer and will not hire one, because a
$300 review is out of proportion to a $40/month gym contract.

Reading the document is not sufficient. The CFPB found over three quarters of
consumers did not know whether their credit card agreement contained an
arbitration clause, and fewer than 7% of those who had one understood it meant
they could not sue. The Blind poster quoted in `PRD.md` §2 read his offer letter,
found the clause, and still needed help understanding what it did to him.

Today the reader clicks accept, or pastes the document into a general chatbot that
offers no severity ordering, no guaranteed source sentence, and no way to
distinguish a confident error from a correct answer.

## Solution

Redline accepts a document as pasted text or a text-layer PDF, parsed in the
browser, and returns: a plain-English summary, the clauses that could hurt the
reader ranked by how much leverage they remove, each showing the exact source
sentence it came from, and a question box that answers only from the document.

Every claim the reader sees is checkable. A flag quotes the sentence that produced
it. A consequence drawn from outside the document is shown separately, marked as
external, carrying its own citation. A flag whose source sentence cannot be shown
never reaches the screen.

## User Stories

**Getting a document in**

1. As a reader, I want to paste the text of a terms of service, so that I can get an analysis without hunting for a file to download.
2. As a reader, I want to upload a PDF offer letter, so that I do not have to select and copy it by hand.
3. As a reader, I want a photographed or scanned document refused with the reason given, so that I never act on an analysis of text that was misread.
4. As a reader, I want a PDF with no text layer rejected explicitly rather than analysed as empty, so that I understand why nothing happened.
5. As a reader, I want to be told how much of the document the system believes it received, so that I can tell a thorough analysis from one run on a fragment.
6. As a reader, I want my original file never stored, so that uploading a contract does not create a copy of it somewhere.

**Understanding what I am signing**

7. As a reader, I want a plain-English summary of what accepting this document commits me to, so that I can orient before reading detail.
8. As a reader, I want the clauses that could hurt me identified, so that I do not have to know in advance which parts matter.
9. As a reader, I want each flag to show the exact sentence it came from, so that I can check the claim against the document myself.
10. As a reader, I want a flag whose source sentence cannot be shown to never appear at all, so that nothing I am shown is unverifiable.
11. As a reader, I want to be told what a clause does to me in plain terms, so that the flag means something rather than naming a category.
12. As a reader, I want facts from outside the document shown separately with their own source, so that I can tell what my contract says apart from what is known about clauses like it.
13. As a reader, I want any deadline or opt-out the document itself grants me surfaced, so that I can act inside a window I would otherwise miss.
14. As a reader, I want flags ordered by how much they take from me rather than by how unusual they are, so that a standard-but-harmful clause is not buried under a rare-but-trivial one.
15. As a reader, I want to see how confident the analysis is in each flag, so that I can weigh a borderline finding differently from a certain one.
16. As a reader, I want to be told the analysis does not account for where I live, so that I do not assume a flagged clause is enforceable against me.

**My red lines**

17. As a reader, I want to record conditions I will not accept, so that the analysis reflects what I care about.
18. As a reader, I want clauses matching my red lines promoted to the top and marked as such, so that I see my own concerns first.
19. As a reader, I want my red lines to change the order and never hide anything, so that setting one cannot cost me coverage.
20. As a reader who sets no red lines, I want exactly the same clauses found, so that the feature is optional rather than load-bearing.

**When the document is fine**

21. As a reader, I want a genuinely benign document reported as clean, so that Redline is worth running on documents that turn out to be fine.
22. As a reader, I want to see the list of what was checked when nothing is found, so that a clean result is distinguishable from a failed analysis.
23. As a reader, I want no invented low-severity finding on a clean document, so that I keep believing the tool when it does flag something.

**Asking questions**

24. As a reader, I want to ask questions about the document in my own words, so that I can pursue what worries me rather than what was flagged.
25. As a reader, I want each answer to cite the sentence it came from, so that answers are as checkable as flags.
26. As a reader, I want a question the document cannot answer refused rather than guessed at, so that I never receive a fabricated answer about my own contract.

**Coming back**

27. As a reader, I want to sign in, so that my documents and red lines persist.
28. As a reader, I want past documents saved to a library, so that I can revisit what I agreed to.

**Building it**

29. As a developer, I want ranking testable without a model call, so that ordering behaviour is deterministic and cheap to assert.
30. As a developer, I want citation verification to run in code rather than live in a prompt, so that it cannot degrade when the model or prompt changes.
31. As a developer, I want a fast deterministic suite separate from a model-backed eval suite, so that every commit is checked without paying for inference.

## Implementation Decisions

**Four seams.** Chosen so that every acceptance test in `PRD.md` §4 lands on
exactly one of them, and so that the two most consequential behaviours —
citation verification and severity ordering — are testable without a browser, a
database, or a live model.

1. **Text extraction.** Input (pasted text or a PDF) in; extracted text, its
   source kind, and a completeness assessment out. Rejects scans and text-layer-less
   PDFs with a machine-readable reason rather than returning empty text.
2. **Analysis.** Extracted text in; a plain-English summary, the set of clause
   types checked, and verified flags out. Each flag carries its source sentence,
   severity, confidence, consequence, and any document-granted exit. Unranked.
3. **Ranking.** Flags and red lines in; ordered flags, red-line marks, and the
   clean-document determination out. **Contains no model call.**
4. **Question answering.** Extracted text and a question in; a grounded answer
   with its source sentence, or a refusal, out.

**Extraction must be lossy-free.** Whitespace, smart quotes, ligatures and line
breaks are preserved exactly. Verification downstream compares model-returned
spans against this text; any normalisation breaks every citation silently, which
is why extraction is its own seam rather than folded into analysis.

**Completeness is assessed at extraction, from structural signals** — text ending
mid-sentence, absence of a closing or signature block, implausible length.
Type-relative plausibility is deferred; it needs a document type that only
analysis determines, and the structural signals catch the case that matters
(a reader pasting part of a page).

**Completeness informs, it does not gate.** A low completeness reading is reported
alongside the result and does not suppress the clean verdict (ADR 0006). This is a
known, recorded gap, not an oversight.

**Verification lives behind the analysis seam.** The model returns spans; code
checks each span against the extracted text; a flag whose span does not match
verbatim is dropped before the function returns and logged as a defect. An
unverifiable flag never leaves analysis, so no render path can display one
(ADR 0001).

**Severity is assigned during analysis, not ranking.** Severity is a property of
the clause as written — the type sets a baseline band and the instance's actual
terms move it within or across bands (`PRD.md` §5). Ranking therefore consumes
severity rather than computing it, which is what makes ranking model-free.

**Ranking orders by leverage lost** — how much of the reader's ability to sue, to
leave, or to refuse a change the clause removes (ADR 0003). Red lines promote
matching flags and mark them; they never remove or suppress a flag (ADR 0008).

**Consequences are two-tier.** The document-grounded claim leads, bound to its
source sentence. External context is a distinct field carrying its own citation,
rendered as visibly separate (ADR 0007). These are different types, not one string
with a convention.

**External context comes from a curated, sourced fact base**, not from model
recall. Its accuracy is ours rather than the document's, so it needs a reviewable
store rather than being generated per request.

**Exit information is document-sourced only.** Deadlines and opt-outs the document
states, each with a source sentence. No statutory rights (ADR 0005, ADR 0007).

**The model client is injected** at the analysis and question-answering seams, so
tests can supply a stub. The model identifier is read from one environment
variable and never hardcoded (`CLAUDE.md`).

**Storage holds extracted text only** — never the uploaded file (`CLAUDE.md`).
Library and red lines require auth; both are Supabase concerns.

**Open, and not settled by this spec:** how a reader is meant to combine severity,
confidence, completeness and red-line marks, which now number four signals on one
screen (ADRs 0003, 0006, 0007).

## Testing Decisions

**A good test here asserts what a reader would observe** — that a rendered flag's
quote appears in their document, that arbitration outranks an oddity, that a clean
document reads as clean. It does not assert prompt contents, model call counts, or
internal function shapes, all of which will change.

**Two tiers.**

*Tier one — deterministic, every commit.* Model client stubbed with known
payloads. Covers: extraction fidelity and rejection behaviour; completeness
detection on truncated input; span verification, including that a flag with a
fabricated span is dropped rather than rendered; ranking order; red-line promotion;
clean-document determination and its checked-list; question refusal on ungrounded
input. No inference cost, no flakiness.

*Tier two — eval suite, run deliberately.* Real model over a labelled corpus.
Covers the measurements in `PRD.md` §4 that only a real model can produce: recall
on planted clauses (proposed ≥95% on the four regulator-evidenced types, ≥80% on
the other three) and precision at top severity (proposed ≥90%). Thresholds are
proposed and need calibrating against the corpus before they carry meaning. This
suite is what `PRD.md` §4 was written to be measured by.

**Per seam.**

- *Extraction*: character-level fidelity against known inputs; scanned PDF and no-text-layer PDF produce a typed rejection; a document truncated at 40% yields a visibly different completeness reading from the same document intact.
- *Analysis*: every returned flag's source sentence appears verbatim in the input — asserted programmatically over every fixture, not sampled; a stubbed model returning an unmatchable span produces zero flags; severity bands respond to clause terms, not only clause type; external context fields carry resolvable citations.
- *Ranking*: pure function tests over fixed flag sets. Arbitration outranks a merely unusual clause. Red-line matches are promoted and marked. A red line never removes a flag. An empty flag set yields a clean document with a checked-list.
- *Question answering*: questions answerable from the document return an answer with a source sentence; questions not answerable return a refusal. Proposed 100% refusal — an answer to an ungrounded question is a defect of the same class as a missing citation, not a quality shortfall.

**No prior art.** This is the first code in the repo, so these tests set the
convention rather than following one. `.claude/skills/flush/evals/evals.json`
shows the eval-case shape used elsewhere in this project.

## Out of Scope

From ADR 0002 and `CLAUDE.md`, deliberately excluded rather than deferred:

- **Counter-offer drafting.** The feature assumed a negotiation that does not exist for an adhesion contract.
- **A sign/don't-sign verdict.** Not in the document, and the shape of claim the FTC fined DoNotPay $193,000 for.
- **OCR and photographed documents.** A citation into misread text is worse than no citation.
- **Any claim about enforceability, and any statutory right.** Not in the document; asserting it moves liability onto us.
- **Payments, billing, sharing a document between readers.** None makes the analysis more trustworthy.
- **DOCX.** Not settled as needed; adding it is a dependency decision.
- **Negotiable documents, and readers who have already signed.** Both are segment decisions (ADR 0002), not backlog items.

## Further Notes

**Which OpenRouter model, and whether a Supabase project exists, remain
unanswered.** Both are marked stop-and-ask in `CLAUDE.md`. Implementation stops and
asks rather than scaffolding a throwaway project or mocking auth to stay unblocked.

**The riskiest thing in this spec is not technical.** `PRD.md` §8 records that no
evidence was found of any consumer paying to have a terms of service explained,
and that the free incumbents — ChatGPT, ToS;DR, Rocket Lawyer's bundled review —
already occupy this ground. Building this well does not resolve that.

**Three of the seven clause types rest on weaker evidence** than the other four
(`PRD.md` §5). Recall targets are set accordingly, and flag quality should not be
expected to be uniform across types.
