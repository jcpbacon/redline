# Redline

A web app that reads a contract, lease, freelance agreement, or terms of service
and tells the reader what they are actually signing.

## Read these before you act

- `research/summary.md` — the user research, including the evidence against this
  product. Read it before deciding what the product should do.
- `PRD.md` — the brief, once it exists. Read it before building.

## Settled, not open for reinterpretation

- Next.js, Supabase for auth and database, deployed on Vercel.
- The uploaded file is parsed in the browser. Only the extracted text is stored;
  the original file is never uploaded or persisted.
- The product calls its model through OpenRouter.
- Every risk flag cites the exact sentence it came from. A flag whose source
  sentence cannot be shown is a bug — fail loudly rather than render it.

## Scope

Build these and stop:

- plain-English summary
- clauses that could hurt the reader, ranked by severity, each showing its exact
  source sentence
- a drafted counter-offer for each flagged clause
- a question box that answers only from the document
- an editable list of the user's own red lines, which drives the analysis
- a saved library of past documents

Excluded on purpose: payments, billing, OCR for scanned documents, and sharing a
document between users. This version exists to prove the analysis can be
trusted, and none of those make it more trustworthy. OCR would actively
undermine it, because a citation is worthless when the text it points at was
misread.

When something looks like the obvious next step and is not on that list, ask
first.

## Ask before you decide

These are deliberately undecided. Do not resolve them by picking one silently.

- Which OpenRouter model to call.
- Whether a Supabase project already exists, and therefore whether it is safe to
  create tables or run migrations against it.
- Adding any dependency.

## Standing rules

- Keep credentials in `.env.local`, which is gitignored. Never commit a secret,
  because a key is public the moment it is pushed and has to be rotated.
- State only what the document says. Where the text does not support a claim,
  the product does not make it.
- All copy a user reads in this product — the landing page, UI labels, error
  messages, empty states — has to be run through the humanizer skill before it
  is committed. Copy that reads as though a model wrote it is a defect, not a
  matter of taste.
