/**
 * The Red Lines a new Reader starts with.
 *
 * PLACEHOLDER — research's list (PRD §5), not the owner's; owner must ratify
 * (issue #1).
 *
 * One Red Line per PRD §5 clause type, in §5's order, written as a rule the
 * Reader would set for themselves. They are inserted once per Reader, the
 * first time that Reader's Red Lines are read (seed_red_lines in
 * supabase/migrations/20261002000700_red_line_seeds.sql), and from then on are
 * the Reader's own: editing or deleting one changes it for that Reader only,
 * and deleting all of them does not bring them back.
 *
 * Changing this list changes what new Readers start with. Readers already
 * seeded keep what they have.
 */
export const SEED_RED_LINES = Object.freeze([
  "I keep ownership of what I make. Any licence I give them ends on a set date and covers set uses.",
  "I get paid by a fixed date, whether or not they sign off on the work.",
  "If I can't work with some brands, they're named, and the ban ends when this job does.",
  "I don't pay their losses or legal costs. If I have to, there's a cap.",
  "They can't end the deal or change the terms on their own while they still owe me for work I've done.",
  "They can't cancel or take back my fee over my conduct when they're the only judge of it.",
  "Nothing renews unless I say yes.",
]);
