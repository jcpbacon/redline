---
version: 1
slug: "app-app-layout-js"
primary_target: "app/(app)/layout.js"
related_targets: []
---

# App shell — behind sign-in

Scope: the frame that holds every signed-in screen: getting a Document in
(paste or upload), the result (summary, ranked Flags with Source Sentences and
Counter-offers, the clean verdict with its checked-list), the question box, the
Reader's Red Lines, and the library. Visitor mode: Operate. Brief only; no app
screen is built today. Spec: issue #1 stories 1–48; tickets #4–#15.

## Task, information, states, constraints

- Task: get a Document in, read what it does to you, ask it a question, keep
  your Red Lines current, return to past Documents.
- Information hierarchy on a result: summary first; then Flags most severe
  first, each with heading, what it means, why it is dangerous rather than
  unusual, the Source Sentence in the contract's face, its Counter-offer, and a
  mark when it breaks a Red Line; then the question box.
- States that matter: extracting (in the browser), confirming extracted text,
  analysing (progress), failed (retry without re-upload), clean (checked-list
  shown, never a blank), scanned/refused, over-length, unanswerable question,
  dismissed Flag, empty library, empty Red Lines (seed set offered).
- Frequency: a Reader arrives with one Document every few weeks; the library
  and Red Lines are revisited, the result is read closely once.
- Constraints: "AI-generated, not legal advice" on every analysis view. Only
  extracted text is ever shown or stored; nothing about the file. Severity
  levels undecided; the UI sorts and labels by whatever the enum names. Rank
  and danger always carried by a word. All copy through the humanizer rule.

## Direction contract

THESIS: The same table, the same tabs, doing work. The result is the Reader's
own agreement laid flat with tabs on its edge; the app is the desk around it.
It refuses the dashboard arrangement — sidebar nav, card grid, stat tiles.

OWN-WORLD: Inherits the landing world: paper white on the teal laminate field,
ink near-black, rank colours red-orange/orange/yellow reserved for Flags and
their highlights, black for actions. Archivo for everything Redline says,
Times New Roman for every Source Sentence and for the extracted Document.
Operate register: the teal field recedes to a border and gutters; paper owns
the working area; tabs become the Flag list's own component. Inputs are ruled
lines on paper, buttons are black tabs, the question box is a ruled index
card. No cards-on-cards, no icon tiles, no gradients.

STORY: A Reader pastes or drops a contract; it appears as a page on the desk,
text confirmed before anything leaves the browser. Analysis runs; tabs appear
on the page's edge, ranked. They pull a tab to read what it does to them, see
the sentence lit on the page, copy the Counter-offer. They ask the page a
question on an index card; it answers with a sentence or says the Document
does not address it. A clean Document shows a single white tab: "Nothing
flagged. Checked: …". Their Red Lines are a ruled list on a second card; the
library is a drawer of past pages with titles and dates.

FIRST VIEWPORT (result screen): the Document page centred on the desk at
reading width, its Flags as tabs on the right edge in rank order, the summary
on an index card clipped to the page's top-left corner, the "AI-generated, not
legal advice" line printed in the page footer, the question card docked
bottom-right. Library and Red Lines reached from a thin black rule along the
desk's top edge, not a sidebar.

FORM: The Tabbed Contract, carried from the landing decision (seed key
470264ae) into Operate mode. Signature interaction: pulling a tab lifts it and
scrolls the page so the Source Sentence and its highlight are in view; the
Counter-offer copies from the tab. Reduced motion: no slide, instant reveal.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.

## Unresolved

- Where a signed-in Reader lands: library or upload (issue #1, ticket #3).
- Severity enum names (issue #1) — tabs need a word per level.
- How four signals (rank, Red-Line mark, dismissed, checked-list) read on one
  edge without noise; decide when ticket #9 is built.
