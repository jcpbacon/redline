/**
 * The clause types analysis looks for, in PRD §5's order.
 *
 * This one list does three jobs, so they cannot drift apart:
 * - the prompt names these types and nothing else as things to flag;
 * - the response schema allows only these ids as a Flag's `clauseType`;
 * - `analyzeDocument` returns it as `checked`, so a Document with no Flags
 *   still shows what was looked for (spec story 46a).
 *
 * The list is PRD §5's provisional ranking, which the owner has not ratified.
 * Change it here and every use follows. `rule` is what the prompt tells the
 * model makes that clause type dangerous rather than merely unusual.
 */
export const CLAUSE_TYPES = Object.freeze([
  {
    id: "ip-assignment-or-licence-scope",
    label: "Who owns the work, and what rights you give away",
    rule: "The Reader assigns ownership of their work, or grants a licence that is perpetual, irrevocable, worldwide, covers any media, or extends to their name, likeness or voice.",
  },
  {
    id: "payment-terms",
    label: "When and whether you get paid",
    rule: "Nothing fixes when payment is owed (for example, payment waits on an approval the other side can withhold), payment is very late, or nothing follows from not paying.",
  },
  {
    id: "exclusivity",
    label: "Exclusivity and bans on working with others",
    rule: "The Reader may not work with others in a category that is broad or vaguely defined, decided by the other side, or the ban outlasts the engagement.",
  },
  {
    id: "indemnification",
    label: "Paying the other side's losses and legal costs",
    rule: "The Reader covers the other side's losses or legal costs, especially with no cap, or for claims the Reader did not cause.",
  },
  {
    id: "termination-or-unilateral-amendment",
    label: "Ending or changing the deal without you",
    rule: "The other side can end the agreement for any reason, or change its terms by notice, especially where the Reader works up front and is paid later.",
  },
  {
    id: "morality",
    label: "Conduct and reputation clauses",
    rule: "The other side can terminate or claw back fees over the Reader's conduct, judged at its sole discretion or reaching conduct outside the work.",
  },
  {
    id: "auto-renewal",
    label: "Automatic renewal",
    rule: "The agreement renews itself unless the Reader cancels by a deadline.",
  },
]);

export const CLAUSE_TYPE_IDS = Object.freeze(CLAUSE_TYPES.map((t) => t.id));

/** What `analyzeDocument` reports as checked: a fresh copy, never empty. */
export function checkedClauseTypes() {
  return CLAUSE_TYPES.map(({ id, label }) => ({ id, label }));
}
