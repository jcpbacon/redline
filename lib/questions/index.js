import { assertServerOnly } from "../env.js";
import { contentId } from "../analysis/index.js";
import { callModel } from "../openrouter/client.js";
import { callStructured, outputError } from "../openrouter/structured.js";
import { normaliseHistory, prepareQuestion } from "./text.js";

assertServerOnly("lib/questions/index.js");

export { ModelError } from "../openrouter/structured.js";

/**
 * Seam 1, second half: the question box (spec issue #1, stories 29–33).
 *
 *   answerQuestion(question, documentText, { model, documentId, logDrop, history, signal })
 *     -> { text, groundedIn }      grounded in the Document
 *     -> { unanswerable: true }    the Document doesn't address it
 *
 * The answer comes only from the Document. Every sentence in `groundedIn` is
 * a non-empty, verbatim substring of `documentText`, the same check a Flag's
 * Source Sentence gets (ADR-0001, spec "Citation enforcement"). The model's
 * reply is not trusted on this: when it says it can answer but any grounding
 * sentence it returns is not in the Document verbatim, or it returns none,
 * the result is `{ unanswerable: true }` and the drop is logged, exactly as a
 * dropped Flag is. An answer is never shown with a citation that can't be
 * shown, and never shown without one.
 *
 * `history` is the earlier questions about the same Document (oldest first),
 * so a follow-up can say "and what about that clause?" (story 33). It is
 * context only: grounding is still checked against the Document alone, so an
 * earlier answer can't stand in for the text.
 *
 * `model` has callModel's signature and defaults to the real OpenRouter
 * client; tests pass a stub. A failed call, or a reply that is not the JSON
 * asked for, throws ModelError (retryable). An empty question throws
 * TypeError before the model is called.
 *
 * `documentId` names the Document in the drop log, as for analyzeDocument: a
 * saved Document's id, or else a hash of its text (contentId).
 *
 * @typedef {import("./text.js").Answer} Answer
 * @typedef {{
 *   tag: typeof GROUNDING_DROPPED,
 *   documentId: string,
 *   answer: string,
 *   groundedIn: string[],
 *   notInDocument: string[],
 * }} GroundingDrop
 */

/**
 * The tag on every dropped-answer record. A sibling of analysis's
 * "redline.citation_dropped", so one search (`redline.*_dropped`) finds both.
 */
export const GROUNDING_DROPPED = "redline.grounding_dropped";

/**
 * Where a dropped answer is recorded: one JSON line on the server's stderr,
 * like logCitationDrop (lib/analysis/index.js), and as provisional (#29).
 * The record carries what the model returned (its answer and the sentences it
 * claimed), never the Document and never the Reader's question.
 *
 * @param {GroundingDrop} record
 */
export function logGroundingDrop(record) {
  console.error(JSON.stringify(record));
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answerable", "answer", "groundedIn"],
  properties: {
    answerable: { type: "boolean" },
    answer: { type: "string" },
    groundedIn: { type: "array", items: { type: "string" } },
  },
};

const SYSTEM = [
  "You answer a question about a contract, lease, freelance agreement or terms of service for the person who has been asked to sign it (the Reader). The Reader has not signed yet.",
  "",
  "Answer only from the Document's text.",
  "- Use no outside knowledge: no general legal information, typical practice, what the law usually says, or what other contracts do. If the answer depends on anything the Document does not say, the Document does not answer it.",
  "- Say only what the Document says. Do not guess, infer intentions, or fill gaps.",
  "- If the Document does not address the question, set answerable to false, answer to an empty string and groundedIn to an empty list. Do not answer it anyway, and do not answer a different question instead.",
  "",
  "When the Document does answer it:",
  "- answerable: true.",
  "- answer: a short answer in plain English, for someone with no legal training. Address the Reader as \"you\".",
  "- groundedIn: every sentence of the Document the answer rests on, each copied character for character exactly as it appears in the Document, including punctuation, quote marks and capitalisation. Copy whole sentences. Do not shorten, paraphrase, join or correct them. An answer whose sentences are not found verbatim in the Document is thrown away, and so is an answer with no sentences.",
  "",
  "Earlier questions and answers about this Document may be listed before it. Use them only to understand what a follow-up question refers to. They are not a source: everything in your answer must come from the Document itself.",
].join("\n");

/**
 * @param {string} question
 * @param {string} documentText
 * @param {import("./text.js").HistoryEntry[]} history
 */
function userMessage(question, documentText, history) {
  const earlier = history.length
    ? history
        .map(
          (h, i) =>
            `${i + 1}. Question: ${h.question}\n   Answer: ${h.unanswerable ? "(The Document does not address this.)" : h.text}`,
        )
        .join("\n")
    : "(none)";
  return [
    `Earlier questions about this Document, oldest first:\n${earlier}`,
    `The Document, between the markers:\n<<<DOCUMENT\n${documentText}\nDOCUMENT>>>`,
    `The Reader's question:\n${question}`,
  ].join("\n\n");
}

/** @param {Record<string, unknown>} reply */
function readReply(reply) {
  const { answerable, answer, groundedIn } = reply;
  if (typeof answerable !== "boolean") throw outputError("The model's reply didn't say whether it could answer.");
  if (typeof answer !== "string") throw outputError("The model's reply had no answer text.");
  if (!Array.isArray(groundedIn) || groundedIn.some((s) => typeof s !== "string")) {
    throw outputError("The model's reply had no list of grounding sentences.");
  }
  if (answerable && answer.trim() === "") throw outputError("The model said it could answer but gave no answer.");
  return { answerable, answer, groundedIn: /** @type {string[]} */ (groundedIn) };
}

/**
 * @param {string} question
 * @param {string} documentText
 * @param {{
 *   model?: (messages: Array<{ role: string, content: string }>, options?: object) => Promise<any>,
 *   documentId?: string,
 *   logDrop?: (record: GroundingDrop) => void,
 *   history?: unknown,
 *   signal?: AbortSignal,
 * }} [options]
 * @returns {Promise<Answer>}
 */
export async function answerQuestion(
  question,
  documentText,
  { model = callModel, documentId, logDrop = logGroundingDrop, history, signal } = {},
) {
  const prepared = prepareQuestion(question);
  if ("error" in prepared) throw new TypeError(`answerQuestion needs a question: ${prepared.error}`);
  if (typeof documentText !== "string" || documentText.trim() === "") {
    throw new TypeError("answerQuestion needs the Document's text.");
  }

  const reply = await callStructured(model, {
    system: SYSTEM,
    user: userMessage(prepared.question, documentText, normaliseHistory(history)),
    name: "document_answer",
    schema: SCHEMA,
    signal,
  });
  const { answerable, answer, groundedIn } = readReply(reply);

  if (!answerable) return { unanswerable: true };

  const notInDocument = groundedIn.filter((s) => s.trim() === "" || !documentText.includes(s));
  if (groundedIn.length === 0 || notInDocument.length > 0) {
    logDrop({
      tag: GROUNDING_DROPPED,
      documentId: documentId ?? contentId(documentText),
      answer,
      groundedIn,
      notInDocument,
    });
    return { unanswerable: true };
  }

  return { text: answer, groundedIn: [...new Set(groundedIn)] };
}
