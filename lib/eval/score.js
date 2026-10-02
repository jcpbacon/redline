/**
 * Scoring for the recall eval (spec issue #1, "Seam 1 — recall eval"; #32).
 *
 * Pure: no I/O, no model, no clock. The eval job (scripts/eval.mjs) and the
 * smoke run (scripts/smoke.mjs) both score with this module, so "found" means
 * the same thing in both.
 *
 * An expert clause is one Source Sentence an expert says matters in a
 * Document. A Flag matches an expert clause when their Source Sentences
 * overlap under MATCH_RULE. Then, for one Document:
 *
 *   recall          = expert clauses matched by at least one Flag / expert clauses
 *   extra-Flag share = Flags matching no expert clause / Flags
 *
 * A Flag that matches two expert clauses counts toward both; an expert clause
 * matched by two Flags counts once. A ratio whose denominator is zero is null
 * ("n/a"), never 0, 100% or NaN: a Document with no expert clauses has no
 * recall to speak of, and a run with no Flags has no extra-Flag share.
 */

/** The share of the shorter sentence's distinct words the other must contain. */
export const TOKEN_OVERLAP_THRESHOLD = 0.6;

/** The matching rule in words, printed in the eval's header. */
export const MATCH_RULE =
  "A Flag matches an expert clause when, after both Source Sentences are normalised " +
  "(Unicode NFKC, lower case, curly quotes made straight, dashes made '-', runs of whitespace made one space), " +
  "either one contains the other, " +
  `or at least ${Math.round(TOKEN_OVERLAP_THRESHOLD * 100)}% of the distinct words of the sentence with fewer distinct words ` +
  "also appear in the other (a word is a run of letters or digits).";

/** @param {string} text */
export function normalise(text) {
  return String(text)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Distinct words of a sentence, normalised. @param {string} text */
export function words(text) {
  return new Set(normalise(text).match(/[\p{L}\p{N}]+/gu) ?? []);
}

/**
 * Whether two Source Sentences overlap under MATCH_RULE. An empty sentence
 * matches nothing.
 *
 * @param {string} a
 * @param {string} b
 */
export function sentencesMatch(a, b) {
  const na = normalise(a);
  const nb = normalise(b);
  if (na === "" || nb === "") return false;
  if (na.includes(nb) || nb.includes(na)) return true;

  const wa = words(a);
  const wb = words(b);
  const [shorter, longer] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  if (shorter.size === 0) return false;
  let shared = 0;
  for (const w of shorter) if (longer.has(w)) shared++;
  return shared / shorter.size >= TOKEN_OVERLAP_THRESHOLD;
}

/** @param {number} numerator @param {number} denominator */
function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

/**
 * Score one Document.
 *
 * @param {string[]} expertSentences the expert clauses' Source Sentences
 * @param {string[]} flagSentences the Flags' Source Sentences
 * @returns {{
 *   expertClauses: number,
 *   flags: number,
 *   matchedClauses: number,
 *   extraFlags: number,
 *   recall: number | null,
 *   extraFlagShare: number | null,
 *   clauseMatched: boolean[],
 *   flagMatched: boolean[],
 * }}
 */
export function scoreDocument(expertSentences, flagSentences) {
  if (!Array.isArray(expertSentences) || !Array.isArray(flagSentences)) {
    throw new TypeError("scoreDocument needs two arrays of sentences.");
  }
  const clauseMatched = expertSentences.map((e) => flagSentences.some((f) => sentencesMatch(e, f)));
  const flagMatched = flagSentences.map((f) => expertSentences.some((e) => sentencesMatch(e, f)));
  const matchedClauses = clauseMatched.filter(Boolean).length;
  const extraFlags = flagMatched.filter((m) => !m).length;
  return {
    expertClauses: expertSentences.length,
    flags: flagSentences.length,
    matchedClauses,
    extraFlags,
    recall: ratio(matchedClauses, expertSentences.length),
    extraFlagShare: ratio(extraFlags, flagSentences.length),
    clauseMatched,
    flagMatched,
  };
}

/**
 * Pool per-Document scores into one overall score: total matched clauses over
 * total expert clauses, total extra Flags over total Flags (micro-averaged, so
 * a Document with more clauses weighs more).
 *
 * @param {Array<{ expertClauses: number, flags: number, matchedClauses: number, extraFlags: number }>} scores
 */
export function scoreOverall(scores) {
  const sum = (key) => scores.reduce((n, s) => n + s[key], 0);
  const expertClauses = sum("expertClauses");
  const flags = sum("flags");
  const matchedClauses = sum("matchedClauses");
  const extraFlags = sum("extraFlags");
  return {
    expertClauses,
    flags,
    matchedClauses,
    extraFlags,
    recall: ratio(matchedClauses, expertClauses),
    extraFlagShare: ratio(extraFlags, flags),
  };
}

/**
 * A ratio for printing: "62.5% (5/8)", or "n/a (0/0)" when there is none.
 *
 * @param {number | null} value
 * @param {number} numerator
 * @param {number} denominator
 */
export function formatRatio(value, numerator, denominator) {
  const share = value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
  return `${share} (${numerator}/${denominator})`;
}
