# Agent 1: Who Has This Pain

## Method (searches run, pages read, counts)

- Web searches run: 12 (hard cap reached). Targeted Reddit (r/freelance, r/legaladvice, r/smallbusiness), Hacker News, Avvo, JustAnswer, ConsumerAffairs, and BBB for people describing being hurt by a contract clause they did not read or notice.
- **Access constraint discovered early:** reddit.com is not reachable by either the web-search tool (rejected as "not accessible to our user agent" when domain-restricted) or the page-fetch tool ("unable to fetch"). Every r/legaladvice, r/freelance, r/smallbusiness, r/Tenant, r/Landlord search attempt returned no retrievable Reddit content. JustAnswer.com and ConsumerAffairs.com pages returned HTTP 403 on fetch; one BBB complaint URL returned 404. These channels are logged below as gaps rather than filled with unsourced material.
- Given the Reddit/BBB/JustAnswer block, research pivoted to other public first-person sources named in scope-adjacent terms: Hacker News (via the HN Algolia API, which is fetchable), and Trustpilot consumer reviews (fetchable, verified/attributed reviewer names, dated).
- Pages read: 13 fetch attempts that returned content (Hacker News item + Algolia API calls, and 8 Trustpilot company review pages); 8 further fetch attempts returned no content (403/404/blocked) and are not counted as findings.
- Stopped once 8 distinct, sourced findings were collected, per instructions.

## Findings

### 1. Freelance/indie app developer
Persona: independent Android app developer distributing through Amazon's Appstore.

> "This reads to me like Amazon want all my apps, and won't let me remove them from their store unless I remove them from everywhere! Am I reading this wrong? Or have Amazon laid claim to all the Android apps I've made or ever will make as long as I maintain an account on their AppStore?"

Contract term involved: Amazon Appstore Developer Agreement, section 3.a ("Delivery Commitment for Apps") — requires a developer to keep an app available on Amazon's store for as long as it's offered on any "Similar Service," discovered only after he tried to pull a weak app down.
Stated cost: no dollar figure; cost was being unable to remove an app he was embarrassed by, and losing the option to walk away from the platform relationship without also pulling every version everywhere.
Source: https://news.ycombinator.com/item?id=2564512

### 2. Gym member / consumer
Persona: consumer, Planet Fitness member who cancelled his membership.

> "Cancelled my membership, and then 6 months later got hit with a collections account claiming I owed them 600 dollars."
— reviewer "Aaron Burns"

Contract term involved: membership cancellation/billing-continuation terms in the gym contract.
Stated cost: $600 sent to a collections agency.
Source: https://www.trustpilot.com/review/planetfitness.com

### 3. Home-security consumer
Persona: consumer who signed up for Vivint home security from a door-to-door sales rep.

> "Cancellation period was a lie. I wanted to see how I would fair with vivant after a rep comes to my door. They said I would have two weeks to use the trail and if I didn't like it in that time I could end it."
— reviewer "D.E."

Contract term involved: trial/cancellation-period clause that did not match what the sales rep represented verbally.
Stated cost: not quantified in dollars; the stated harm is being held to a contract term she says was misrepresented at signing.
Source: https://www.trustpilot.com/review/vivint.com

### 4. Homeowner / solar customer
Persona: homeowner who financed a residential solar installation through Sunrun.

> "When I asked what went wrong SunRun told me I should have read the contract closer."
— reviewer "Erik Kuhi"

Contract term involved: a payment-escalator clause in the solar loan/lease that raised the payment after an initial period, on top of the electric bill it was supposed to replace.
Stated cost: combined monthly cost rose to roughly $708 (about $300 electric bill + $408 solar payment) after 18 months, after being sold on the promise that solar would replace/lower his electric bill.
Source: https://www.trustpilot.com/review/sunrun.com

### 5. Renter / tenant
Persona: tenant in a Greystar-managed apartment, in a security-deposit dispute after move-out.

> "Legally, they are obligated to honor my lease which stated the security deposit I was required to pay was $3025."
— reviewer "Diana Lopez"

Contract term involved: security deposit clause of the lease.
Stated cost: $3,025 (the deposit amount in dispute).
Source: https://www.trustpilot.com/review/greystar.com

### 6. UK telecom consumer
Persona: UK consumer switching broadband/TV providers away from Virgin Media.

> "You failed to confirm in writing that you would credit my account for £250.00 being the early cancellation charges from the incumbent provider in fact the cancellation charges were £300 from Daisy."
— reviewer "Victor Jones"

Contract term involved: early-cancellation-charge terms, including a promised credit for the previous provider's own early-termination fee that was not honored in writing.
Stated cost: £300 in early cancellation charges (against a promised £250 credit that did not materialize as agreed).
Source: https://www.trustpilot.com/review/virginmedia.com

### 7. Vehicle owner / consumer
Persona: consumer with a CarShield extended vehicle warranty who filed a claim.

> "my claim was denied on my 2015 Colorado pickup supposedly because of pre-existing condition"
— reviewer identified only as "Customer"

Contract term involved: pre-existing-condition exclusion clause in the vehicle service contract, invoked at claim time rather than flagged at signing.
Stated cost: not quantified in the review, but the clause meant the repair was not covered at all.
Source: https://www.trustpilot.com/review/carshield.com

### 8. Freelancer
Persona: freelancer using the Freelancer.com marketplace, with funds held in an account she stopped actively using.

> "I found out that almost 500USD from my deposit was gone!"
— reviewer "Yen Ying Ng"

Contract term involved: a dormant-account fee term (a recurring ~$14/month deduction for inactive accounts) buried in the platform's terms, not something she was tracking.
Stated cost: roughly $500 silently deducted from her account balance.
Source: https://www.trustpilot.com/review/freelancer.com

## Patterns observed

- **The gap is almost never "the clause was hidden in tiny print" — it's "the clause contradicted what a human being said out loud."** Vivint's rep promised a two-week trial; the written cancellation terms said otherwise (#3). Sunrun's sales pitch promised the solar payment would replace the electric bill; the contract's escalator clause meant it added to it (#4). This is a strong signal for a product that surfaces the *exact source sentence* next to a plain-English summary — the value isn't just simplification, it's catching where the document diverges from what the person was told.
- **Money keeps leaving through billing/renewal mechanics that survive cancellation**, not through some single catastrophic clause: continued billing after cancellation (#2), a dormant-account fee nobody was watching (#8), an early-termination charge dispute over a promised credit (#6). A tool that flags "this contract keeps charging you unless you take action X by date Y" would have caught most of these before signing.
- **Exclusions discovered only at the moment of claim** are their own category (#7 — "pre-existing condition"), distinct from renewal/cancellation traps. These are clauses that are individually short and easy to skim past, but decide the entire value of the contract when something goes wrong.
- **The dollar amounts cluster in the low hundreds to low thousands** ($300–$3,025 across findings with a stated figure) — not "bet the company" money, but enough to cause real anger and, in at least one case (#2), a collections mark.
- People do not use the word "clause" much in their own complaints — they describe the *event* (got a collections letter, got denied a claim, got a bill after cancelling) and only reconstruct the contract term when pressed or when quoting the document back at the company. This suggests the product's summary should be organized around "what can happen to you" rather than a legalistic clause-by-clause taxonomy, with the source clause attached as evidence.

## What I could not find

- **No Reddit-sourced findings.** r/legaladvice, r/freelance, r/smallbusiness, r/personalfinance, r/Tenant, r/Landlord, r/UKPersonalFinance, and r/AskALawyer were all explicitly in scope, but reddit.com was not reachable by either the search tool (rejected outright when domain-restricted) or the fetch tool ("unable to fetch") in this environment. This is a tooling limitation, not an absence of stories — Reddit almost certainly has the richest first-person material for this hypothesis (especially freelance non-compete and lease disputes) and should be checked directly by a human or a differently-configured agent.
- **No Twitter/X threads.** Not reachable with the available tools in this session; not attempted beyond initial search queries that returned no usable links.
- **No BBB complaint narratives.** The one BBB complaint URL attempted (Exploria Resorts / timeshare) returned 404, and BBB profile URLs could not be reliably guessed without a working search path into BBB's site structure.
- **No JustAnswer.com or ConsumerAffairs.com content**, despite promising leads (a JustAnswer question about a gym contract signed "unbeknownst" to the poster, and ConsumerAffairs reviews of Exploria/Summer Bay Resort timeshare pressure tactics). Both domains returned HTTP 403 on every fetch attempt.
- **No small-business-specific finding with a personal-guarantee or commercial-lease clause.** Searches on personal guarantees and joint-and-several liability surfaced only law-firm explainer content, not first-person accounts, within the search budget.
- **No freelance non-compete finding with a stated cost.** Multiple searches were run on this exact topic (it seems highly relevant to Redline) but did not surface a sourceable first-person account within the search cap.
- **Exact Trustpilot review permalinks were not individually captured** — findings are sourced to the company's Trustpilot review-listing page rather than a permalink to the single review, because the fetch tool returned page content without individual review URLs. A human spot-check of exact wording against the live page is recommended before using these quotes externally, since content was extracted via an intermediate summarization step rather than raw HTML inspection.
