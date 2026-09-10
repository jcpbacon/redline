# 2. Who Redline is for

Status: accepted · 2026-09-10

## Decision

Redline is built for a Reader who can negotiate the Document and has not signed
it yet — a freelancer or creator reviewing a client, brand, or licensing
agreement. The anchor persona is the creator weighing a brand deal. The product
is not built for readers facing take-it-or-leave-it documents (renters, gym
members, terms-of-service readers), and not for the moment after something has
already gone wrong.

## Considered options

- **Serve the loudest, best-evidenced pain** — renters and consumers hit by
  auto-renewals, junk fees, withheld deposits (`research/summary.md` §1). Larger
  population, sharper stories. Rejected: these readers have no leverage, so the
  drafted Counter-offer — a core feature — is a gesture with nothing behind it.
- **Anchor on freelancers rather than creators.** 50–76M people; the document
  volume that would let the analysis prove itself on real usage. Rejected as the
  *anchor* (freelancers are still served): no source in the research shows a
  freelancer stating they would pay for this, whereas creators have a
  demonstrated price of $800–$2,850 per document and an audience that doubles as
  distribution.
- **Build for the post-harm moment** — "explain what just happened to me,"
  which is where the research shows people actually searching
  (`research/summary.md` §5.3). Rejected: that is advice about a live dispute,
  the exact territory the FTC's DoNotPay consent order polices
  (`research/summary.md` §5.7).

## Why

The Counter-offer feature only means something when the Reader can ask for a
change, which forces the "has leverage" cut. Within that, creators are the one
segment with proven willingness to pay. Pre-signature keeps the product clear of
regulated legal-advice claims.

## Consequences

- The product walks away from the pain the research documents most vividly, and
  from the moment users are most motivated to look. This is a deliberate bet
  that a smaller, reachable, lawful market beats a larger one the product cannot
  serve well.
- The cost of anchoring on creators specifically — thin real-usage document
  volume to prove the analysis on — was raised during the grilling and not
  answered by the product owner. Recorded as open in `PRD.md` §9.
- redlineapp.net serves an overlapping audience with an overlapping feature set
  at consumer pricing. The first version differentiates on trustworthiness of
  the analysis, not on features.
