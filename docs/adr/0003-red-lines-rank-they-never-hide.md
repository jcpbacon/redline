# 3. Red Lines rank, they never hide

Status: accepted · 2026-09-11

## Decision

A Reader's Red Lines change the order and marking of Flags. They never remove a
Flag, lower its severity, or cause a clause type to go unchecked. With no Red
Lines set, a Document yields exactly the Flags it would yield for any other
Reader; with Red Lines set, it yields the same Flags, with the matching ones
promoted and marked. A Red Line can add a Flag only through analysis and only
with a Source Sentence behind it (ADR-0001).

Ranking is a pure function with no model call, so this invariant is asserted
over fixed Flag sets rather than inferred from model behaviour.

## Alternatives

- Red Lines as a filter: show only what the Reader said they care about.
  Cleaner screen, and the obvious implementation. Rejected because a Reader who
  writes three Red Lines has told us what they know to worry about, not what
  the Document does to them; hiding the rest turns their blind spots into ours.
- Red Lines as a severity threshold: anything below the Reader's bar drops off.
  Same failure, and it makes the recall measurement (`PRD.md` §4) depend on
  which Reader ran the analysis.
- Red Lines only in the prompt, with no rule about what they may do. Rejected
  because the guarantee would live in prompt wording and silently degrade the
  first time the prompt or model changed.

## Why

Coverage cannot depend on the Reader's settings. The product's claim is that
it catches what could hurt you; a feature that lets you accidentally switch part
of that off is a feature that costs trust in exactly the case it was meant to
serve. Keeping Red Lines to promotion also keeps recall comparable across
Readers, which is what makes the eval corpus meaningful.

## Consequences

- The analysis prompt may use Red Lines to look harder for a conflict. It is
  not given them as a reason to skip a clause type or lower a severity.
- Ranking is its own seam (issue #1, Seam 1b): analysis assigns severity,
  ranking orders. Promotion moves a Flag ahead of its severity peers and never
  into a higher severity it did not earn.
- The set-equality test — same Flags in, same Flags out, with and without Red
  Lines — is part of the deterministic suite, not the eval suite.
- `CONTEXT.md`'s Red Line entry is worded to match. A Red Line that the
  Document is silent on produces nothing, which was already ADR-0001.
