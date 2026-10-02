import { createHash } from "node:crypto";
import { assertServerOnly } from "../env.js";
import { callModel } from "../openrouter/client.js";
import { callStructured, outputError } from "../openrouter/structured.js";
import { CLAUSE_TYPES, CLAUSE_TYPE_IDS, checkedClauseTypes } from "./clause-types.js";
import { SEVERITY_IDS } from "./severity.js";

assertServerOnly("lib/analysis/index.js");

export { ModelError } from "../openrouter/structured.js";

/**
 * Seam 1: the analysis module (spec issue #1).
 *
 *   analyzeDocument(documentText, redLines, { model, documentId, logDrop })
 *     -> { summary, flags, checked }
 *
 * - `summary` is the model's plain-English summary of the Document.
 * - `flags` is unranked; rankFlags in ./rank.js orders them. Every Flag's
 *   `sourceSentence` is a verbatim substring of `documentText`; one that is
 *   not never leaves this module (ADR-0001), and each drop is logged.
 *   `severity` is one of ./severity.js's levels. `position` is the index of
 *   the Source Sentence in `documentText`, which ranking uses to break ties.
 *   `counterOffer` is optional: a string, or null when the model drafted none
 *   (or only whitespace). A Flag without one is still a Flag and is returned;
 *   only a missing Source Sentence removes a Flag.
 * - `checked` is the clause types analysis looked for, returned whether or not
 *   anything was flagged. It is never empty.
 *
 * `model` has callModel's signature and defaults to the real OpenRouter
 * client. Tests pass a stub. A failed call, or a reply that is not the JSON
 * this module asked for, throws ModelError (retryable).
 *
 * `documentId` names the Document in the drop log: the saved Document's id,
 * or, when omitted (a pasted Document nobody saved), a hash of its text. See
 * `contentId`. `logDrop` receives one record per dropped Flag and defaults to
 * `logCitationDrop`; tests pass their own to capture the records.
 *
 * @typedef {{ id: string, text: string }} RedLine
 * @typedef {{
 *   clauseType: string,
 *   severity: string,
 *   sourceSentence: string,
 *   whatItMeans: string,
 *   whyDangerous: string,
 *   counterOffer: string | null,
 *   matchedRedLineId: string | null,
 *   position: number,
 * }} Flag
 * @typedef {{
 *   tag: typeof CITATION_DROPPED,
 *   documentId: string,
 *   clauseType: string,
 *   severity: string,
 *   sourceSentence: string,
 * }} CitationDrop
 */

/** Fields every Flag must carry as a string. counterOffer is optional and checked on its own. */
const FLAG_TEXT_FIELDS = ["clauseType", "severity", "sourceSentence", "whatItMeans", "whyDangerous"];

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
        // Strict mode wants every property in `required`; optional ones are nullable.
        required: [...FLAG_TEXT_FIELDS, "counterOffer", "matchedRedLineId"],
        properties: {
          clauseType: { type: "string", enum: [...CLAUSE_TYPE_IDS] },
          severity: { type: "string", enum: [...SEVERITY_IDS] },
          sourceSentence: { type: "string" },
          whatItMeans: { type: "string" },
          whyDangerous: { type: "string" },
          counterOffer: { type: ["string", "null"] },
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
  `- severity: one of ${SEVERITY_IDS.map((id) => `"${id}"`).join(", ")} (from most to least severe).`,
  "- whatItMeans: what the clause does to the Reader, in plain English.",
  "- whyDangerous: why it is dangerous rather than merely unusual.",
  "- counterOffer: alternative wording for this clause that the Reader could reasonably ask for. Frame it as a request the Reader is making, not a demand or an ultimatum (for example \"Could we change this to: ...\" followed by the proposed wording). Cover only the terms of the flagged clause; do not raise other clauses or add new obligations unrelated to it. Do not state anything about the deal as fact that the Document does not say. If there is no reasonable alternative to ask for, use null.",
  "- matchedRedLineId: the id of the Reader's Red Line this clause conflicts with, or null.",
  "Do not flag something the Document leaves out. A missing clause has no sentence to quote.",
  "",
  "Red Lines are rules the Reader has set about what they will not accept. They are listed before the Document, each with its id in square brackets.",
  "- Use them for one thing only: to look harder for clauses that conflict with them, and to set matchedRedLineId on a flag whose clause breaks one.",
  "- Check every clause type above whether or not any Red Line mentions it. A clause type no Red Line covers is checked exactly as carefully, and its flags keep the severity they would have with no Red Lines at all.",
  "- Never skip, drop or merge a flag because of a Red Line, and never raise or lower a severity because of one. Severity comes only from what the clause does to the Reader.",
  "- A Red Line about something the Document does not mention produces nothing: no flag, and no matchedRedLineId anywhere. A flag still needs its sentence copied verbatim from the Document.",
  "- matchedRedLineId must be one of the ids listed, copied exactly, or null.",
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
    if (flag.counterOffer != null && typeof flag.counterOffer !== "string") {
      throw outputError(`Flag ${i} in the model's reply had a Counter-offer that was not text.`);
    }
    if (!SEVERITY_IDS.includes(flag.severity)) {
      throw outputError(`Flag ${i} in the model's reply had a severity outside the scale.`);
    }
  });
  return { summary, flags };
}

/** The fixed tag on every drop record, so the log can be searched for it. */
export const CITATION_DROPPED = "redline.citation_dropped";

/**
 * A stable id for a Document that has no database id: the SHA-256 of its
 * text, prefixed so it can never be mistaken for a row id. The same text
 * always gets the same id, so drops from repeated runs line up.
 *
 * @param {string} documentText
 */
export function contentId(documentText) {
  return `unsaved:sha256:${createHash("sha256").update(documentText, "utf8").digest("hex")}`;
}

/**
 * Where a dropped Flag is recorded. PROVISIONAL: who reads these, and where
 * they should finally go, is undecided (ticket #29). For now each drop is one
 * JSON line on the server's stderr via console.error, tagged
 * "redline.citation_dropped". Locally it prints in the `next dev` terminal; on
 * Vercel it lands in the function's runtime logs, searchable by the tag.
 *
 * The record carries the sentence the model returned, which the spec requires
 * ("what the model returned"). By construction it is not a verbatim sentence
 * of the Document, but it may paraphrase one closely, so treat these logs as
 * holding Document-derived text. The Document itself is never logged.
 *
 * @param {CitationDrop} record
 */
export function logCitationDrop(record) {
  console.error(JSON.stringify(record));
}

/**
 * Keep only the Flags whose Source Sentence is in the Document verbatim
 * (ADR-0001). An empty sentence would match anything, so it fails too.
 * Every Flag that fails is reported to `logDrop`.
 *
 * @param {string} documentText
 * @param {Array<Record<string, any>>} candidates
 * @param {Set<string>} redLineIds
 * @param {{ documentId: string, logDrop: (record: CitationDrop) => void }} drops
 * @returns {Flag[]}
 */
function verifiedFlags(documentText, candidates, redLineIds, { documentId, logDrop }) {
  const kept = [];
  for (const c of candidates) {
    const position = c.sourceSentence.trim() === "" ? -1 : documentText.indexOf(c.sourceSentence);
    if (position === -1) {
      logDrop({
        tag: CITATION_DROPPED,
        documentId,
        clauseType: c.clauseType,
        severity: c.severity,
        sourceSentence: c.sourceSentence,
      });
      continue;
    }
    kept.push({
      clauseType: c.clauseType,
      severity: c.severity,
      sourceSentence: c.sourceSentence,
      whatItMeans: c.whatItMeans,
      whyDangerous: c.whyDangerous,
      counterOffer: typeof c.counterOffer === "string" && c.counterOffer.trim() !== "" ? c.counterOffer : null,
      // A Red Line the Reader did not set cannot be matched.
      matchedRedLineId:
        typeof c.matchedRedLineId === "string" && redLineIds.has(c.matchedRedLineId) ? c.matchedRedLineId : null,
      position,
    });
  }
  return kept;
}

/**
 * @param {string} documentText
 * @param {RedLine[]} [redLines]
 * @param {{
 *   model?: (messages: Array<{ role: string, content: string }>, options?: object) => Promise<any>,
 *   signal?: AbortSignal,
 *   documentId?: string,
 *   logDrop?: (record: CitationDrop) => void,
 * }} [options]
 * @returns {Promise<{ summary: string, flags: Flag[], checked: Array<{ id: string, label: string }> }>}
 */
export async function analyzeDocument(
  documentText,
  redLines = [],
  { model = callModel, signal, documentId, logDrop = logCitationDrop } = {},
) {
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
    flags: verifiedFlags(documentText, flags, new Set(reds.map((r) => r.id)), {
      documentId: documentId ?? contentId(documentText),
      logDrop,
    }),
    checked: checkedClauseTypes(),
  };
}
