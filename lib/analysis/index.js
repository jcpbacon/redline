import { assertServerOnly } from "../env.js";
import { callModel } from "../openrouter/client.js";
import { callStructured, outputError } from "../openrouter/structured.js";
import { CLAUSE_TYPES, CLAUSE_TYPE_IDS, checkedClauseTypes } from "./clause-types.js";

assertServerOnly("lib/analysis/index.js");

export { ModelError } from "../openrouter/structured.js";

/**
 * Seam 1: the analysis module (spec issue #1).
 *
 *   analyzeDocument(documentText, redLines, { model }) -> { summary, flags, checked }
 *
 * - `summary` is the model's plain-English summary of the Document.
 * - `flags` is unranked. Every Flag's `sourceSentence` is a verbatim substring
 *   of `documentText`; one that is not never leaves this module (ADR-0001).
 * - `checked` is the clause types analysis looked for, returned whether or not
 *   anything was flagged. It is never empty.
 *
 * `model` has callModel's signature and defaults to the real OpenRouter
 * client. Tests pass a stub. A failed call, or a reply that is not the JSON
 * this module asked for, throws ModelError (retryable).
 *
 * @typedef {{ id: string, text: string }} RedLine
 * @typedef {{
 *   clauseType: string,
 *   severity: string,
 *   sourceSentence: string,
 *   whatItMeans: string,
 *   whyDangerous: string,
 *   counterOffer: string,
 *   matchedRedLineId: string | null,
 * }} Flag
 */

const FLAG_TEXT_FIELDS = ["clauseType", "severity", "sourceSentence", "whatItMeans", "whyDangerous", "counterOffer"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "flags"],
  properties: {
    summary: { type: "string" },
    flags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [...FLAG_TEXT_FIELDS, "matchedRedLineId"],
        properties: {
          clauseType: { type: "string", enum: [...CLAUSE_TYPE_IDS] },
          severity: { type: "string" },
          sourceSentence: { type: "string" },
          whatItMeans: { type: "string" },
          whyDangerous: { type: "string" },
          counterOffer: { type: "string" },
          matchedRedLineId: { type: ["string", "null"] },
        },
      },
    },
  },
};

const SYSTEM = [
  "You read a contract, lease, freelance agreement or terms of service for the person who has been asked to sign it (the Reader). The Reader has not signed yet and can ask for changes.",
  "",
  "Write a summary of the whole Document.",
  "- Say only what the Document says. Do not add facts, assumptions, typical practice or legal conclusions that the text does not support. If the Document does not say something, do not say it either.",
  "- Plain English, for someone with no legal training. Address the Reader as \"you\".",
  "- Short enough to read in under a minute: at most about 150 words.",
  "",
  "Then list the clauses that could hurt the Reader. Look for these clause types, and only these:",
  ...CLAUSE_TYPES.map((t) => `- ${t.id}: ${t.rule}`),
  "A clause is flagged only when at least one of these is true: it is hard to reverse once signed; the cost if it goes wrong could exceed the value of the deal; or it moves a right or obligation the Reader may not know they hold. A clause that is merely unusual (an odd governing law, a strange notice address) is not flagged.",
  "",
  "For each flag:",
  "- sourceSentence: copy the one sentence the flag comes from, character for character, exactly as it appears in the Document, including punctuation, quote marks and capitalisation. Do not shorten, paraphrase, join or correct it. A flag whose sentence is not found verbatim in the Document is discarded.",
  "- severity: \"critical\", \"high\" or \"medium\".",
  "- whatItMeans: what the clause does to the Reader, in plain English.",
  "- whyDangerous: why it is dangerous rather than merely unusual.",
  "- counterOffer: replacement wording the Reader could reasonably ask for.",
  "- matchedRedLineId: the id of the Reader's Red Line this clause conflicts with, or null.",
  "Do not flag something the Document leaves out. A missing clause has no sentence to quote.",
  "",
  "Red Lines are rules the Reader has set about what they will not accept. Use them to look harder for conflicts. Never use them to skip a clause type or to lower a severity. A Red Line the Document says nothing about produces no flag.",
  "",
  "If nothing in the Document should be flagged, return an empty flags list.",
].join("\n");

/** @param {RedLine[]} redLines */
function userMessage(documentText, redLines) {
  const lines = redLines.length
    ? redLines.map((r) => `- [${r.id}] ${r.text}`).join("\n")
    : "(none)";
  return `The Reader's Red Lines:\n${lines}\n\nThe Document, between the markers:\n<<<DOCUMENT\n${documentText}\nDOCUMENT>>>`;
}

/** @param {unknown} redLines @returns {RedLine[]} */
function normaliseRedLines(redLines) {
  if (redLines == null) return [];
  if (!Array.isArray(redLines)) throw new TypeError("redLines must be an array.");
  return redLines.map((r, i) => {
    if (!r || typeof r.id !== "string" || typeof r.text !== "string") {
      throw new TypeError(`redLines[${i}] must have a string id and text.`);
    }
    return { id: r.id, text: r.text };
  });
}

/**
 * Check the parsed reply's shape and return the summary and candidate Flags.
 * @param {Record<string, unknown>} reply
 */
function readReply(reply) {
  const { summary, flags } = reply;
  if (typeof summary !== "string" || summary.trim() === "") {
    throw outputError("The model's reply had no summary.");
  }
  if (!Array.isArray(flags)) {
    throw outputError("The model's reply had no flags list.");
  }
  flags.forEach((flag, i) => {
    if (!flag || typeof flag !== "object") throw outputError(`Flag ${i} in the model's reply was not an object.`);
    for (const field of FLAG_TEXT_FIELDS) {
      if (typeof flag[field] !== "string") throw outputError(`Flag ${i} in the model's reply had no ${field}.`);
    }
  });
  return { summary, flags };
}

/**
 * Keep only the Flags whose Source Sentence is in the Document verbatim
 * (ADR-0001). An empty sentence would match anything, so it fails too.
 *
 * @param {string} documentText
 * @param {Array<Record<string, any>>} candidates
 * @param {Set<string>} redLineIds
 * @returns {Flag[]}
 */
function verifiedFlags(documentText, candidates, redLineIds) {
  const kept = [];
  let dropped = 0;
  for (const c of candidates) {
    if (c.sourceSentence.trim() === "" || !documentText.includes(c.sourceSentence)) {
      dropped++;
      continue;
    }
    kept.push({
      clauseType: c.clauseType,
      severity: c.severity,
      sourceSentence: c.sourceSentence,
      whatItMeans: c.whatItMeans,
      whyDangerous: c.whyDangerous,
      counterOffer: c.counterOffer,
      // A Red Line the Reader did not set cannot be matched.
      matchedRedLineId:
        typeof c.matchedRedLineId === "string" && redLineIds.has(c.matchedRedLineId) ? c.matchedRedLineId : null,
    });
  }
  if (dropped > 0) {
    // Ticket #29 gives these drops a proper destination. The Document's text
    // is confidential, so neither it nor the rejected sentence is logged.
    console.warn(`analyzeDocument: dropped ${dropped} flag(s) whose Source Sentence is not in the Document.`);
  }
  return kept;
}

/**
 * @param {string} documentText
 * @param {RedLine[]} [redLines]
 * @param {{ model?: (messages: Array<{ role: string, content: string }>, options?: object) => Promise<any>, signal?: AbortSignal }} [options]
 * @returns {Promise<{ summary: string, flags: Flag[], checked: Array<{ id: string, label: string }> }>}
 */
export async function analyzeDocument(documentText, redLines = [], { model = callModel, signal } = {}) {
  if (typeof documentText !== "string" || documentText.trim() === "") {
    throw new TypeError("analyzeDocument needs the Document's text.");
  }
  const reds = normaliseRedLines(redLines);

  const reply = await callStructured(model, {
    system: SYSTEM,
    user: userMessage(documentText, reds),
    name: "document_analysis",
    schema: SCHEMA,
    signal,
  });
  const { summary, flags } = readReply(reply);

  return {
    summary,
    flags: verifiedFlags(documentText, flags, new Set(reds.map((r) => r.id))),
    checked: checkedClauseTypes(),
  };
}
