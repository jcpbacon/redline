# Redline

A web app that reads a contract, lease, freelance agreement, or terms of service
before someone signs it and tells them what they are agreeing to, with every
warning tied to the exact sentence it came from.

## Language

**Reader**:
The person the analysis is written for — the party Redline is trying to protect.
Distinct from the account holder; the Reader is a role, not a login.
_Avoid_: user, customer, client.

**Document**:
The contract, lease, agreement, or terms of service the Reader uploaded. Only its
extracted text is held; the original file is never stored.
_Avoid_: file, upload, contract (when speaking generally).

**Flag**:
One clause in the Document identified as able to hurt the Reader, carrying a
severity and the Source Sentence it was drawn from.
_Avoid_: issue, finding, risk, alert.

**Source Sentence**:
The exact, verbatim text from the Document that a Flag comes from. A Flag whose
Source Sentence cannot be shown is not rendered (see `docs/adr/0001`).
_Avoid_: citation, reference, excerpt, quote.

**Counter-offer**:
Drafted alternative wording for a flagged clause — what the Reader could ask for
instead.
_Avoid_: redline (as a verb), suggestion, revision, edit.

**Red Line**:
A rule the Reader sets in advance about what they will not accept in a Document.
The set of Red Lines drives the analysis — which clauses become Flags, and how
severe.
_Avoid_: preference, requirement, rule, setting.

**Pre-signature**:
The moment Redline is built for: the Reader is looking at the Document before it
binds them. The product does not address disputes about a Document already
signed.
_Avoid_: proactive, upfront.
