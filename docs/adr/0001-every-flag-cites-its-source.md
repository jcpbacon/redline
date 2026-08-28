# 1. Every flag cites its source sentence

Status: accepted · 2026-08-28

## Decision

Every risk flag carries the exact sentence from the uploaded document it came
from, shown to the reader. A flag whose source sentence cannot be shown is a
bug, not a formatting preference: it is dropped rather than rendered.

## Alternatives

- Let the model describe risks in its own words, citing nothing. Fastest to
  build, reads more fluently, and nothing in it can be checked.
- Cite a section or page number. Cheaper, but sends the reader back into the
  document they could not read in the first place.
- Quote where the model offers one, paraphrase where it does not. The reader
  cannot tell which claims are grounded, so the uncited ones borrow credibility
  from the cited ones.

## Why

A reader can take any flag, find that sentence in their own contract, and judge
whether we read it correctly — without trusting us, the model, or knowing law.
It is also our only defence against a fluent, confident, wrong answer: an
invented risk has no sentence behind it, so the rule catches it first.

## Consequences

- Rules out OCR for scanned documents; a citation is worthless when the text it
  points at was misread.
- Rules out flagging what the document does not say: a missing late-fee or
  termination clause has no sentence to quote.
- The browser parser must preserve exact source text, not normalised or
  reflowed text, or quotes will not match what the reader sees.
- Model output is validated, not trusted: each quote is checked as a verbatim
  substring of the stored text before it renders.
- Tests assert the invariant rather than the wording — for fixture documents,
  every flag's quote must appear verbatim in the source.
