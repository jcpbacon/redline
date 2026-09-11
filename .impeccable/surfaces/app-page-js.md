---
version: 1
slug: "app-page-js"
primary_target: "app/page.js"
related_targets: ["app/page.module.css"]
---

# Landing page — `/`

Scope: the public front door, one screen and one action. Visitor mode: Persuade.
Spec: PRD.md §3.7; issue #1 stories 49–54; ticket #2.

## Audience, job, action, proof

- Audience: a creator or freelancer who has been sent a brand, client, or
  licensing agreement they can still negotiate and have not signed (ADR-0002).
  Not renters, not terms-of-service readers, not anyone already in a dispute.
- Job: decide in one screen whether this is for them.
- Action: exactly one — try it on a document — leading to the sign-in route.
  The route does not exist yet (ticket #4); the link points at `/sign-in`.
- Proof: a contract turning into ranked flags, each showing the exact sentence
  it came from. Demonstrated with a sample agreement written for this page and
  labelled as such on the page itself.
- Constraints: no verdict on whether to sign; no legal advice; no scanned or
  photographed documents; no document types outside brand, client, and
  licensing agreements; no prices, customers, testimonials, logos, usage or
  accuracy numbers; no comparison to a lawyer's review. Severity levels are not
  decided (issue #1), so rank is shown as an ordinal, never a named level. All
  copy through the humanizer rule before commit (CLAUDE.md).

## Direction contract

THESIS: The tab is the flag. A printed agreement lies flat on the table with
colored index tabs protruding from its edge, each pointing at a highlighted
sentence, ranked top to bottom. It refuses the category arrangement — headline,
subhead, button, screenshot in a browser frame, three feature tiles.

OWN-WORLD: Office-paper white on a saturated laminate kitchen-table field
(deep teal). Ink near-black. Three highlighter/tab colors carry rank:
red-orange, orange, yellow, each also carried by a word. One black tab for the
action. The agreement is set in the contract's own face (Times New Roman);
everything Redline says is set in Archivo, condensed bold caps on tabs, regular
for statements. Materials: paper with a soft cast shadow, translucent
highlighter strokes, plastic tabs with a slight sheen. No cards, no gradients
as decoration, no icon tiles.

STORY: A visitor sees a contract they recognise, three sentences lit up, three
tabs naming what each does to them in plain words, ranked. They understand
that every warning points at a sentence they could check themselves, that
their file stays in their browser, and that this is not legal advice. They
click the black tab to try it on their own document.

FIRST VIEWPORT: Full-bleed teal table. Left/centre, the sample agreement page
at roughly 62% of viewport width, rotated about -1.2°, with a grey "SAMPLE —
written for this demonstration" stamp in its corner. Three sentences carry
highlighter strokes in rank colour. Three tabs protrude from the paper's right
edge at the height of their sentence, each printed "1ST / 2ND / 3RD" and a
plain-English heading; the top tab's heading is set largest. A ruled white
index card sits top-left on the table with the wordmark and the one-line hook.
The black action tab sits at the paper's lower right edge, outside the ranked
run. Below the fold, on a plain paper band: what Redline is for, the trust
rule, the privacy stance, accepted inputs, the AI/not-legal-advice statement,
and the action once more.

FORM: The Tabbed Contract, candidate 1 of my ordered list, presented as
IMPECCABLE'S PICK and chosen by the user over the assigned Disclosure Box.
Seed key 470264ae. Signature interaction, "the pull": on load the three
highlighter strokes draw across their sentences in rank order, then the tabs
slide in from the right; hovering or focusing a tab slides it out further,
dims the other strokes, and reveals on the tab what the clause does to you.
Reduced motion: everything rendered, nothing animates. Kept from the declined
hand: size is billing (rank by type scale), one sheet with two registers,
thresholds always in text.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.

## Unresolved

- Sign-in route name: `/sign-in` assumed; not named in issue #1.
- The public name (PRD §9): the page uses "Redline" as instructed.
- Deployment Protection still hides the deployment.
