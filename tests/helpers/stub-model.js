/**
 * A stand-in for `callModel` from lib/openrouter/client.js.
 *
 * Tests never reach the network and never need OPENROUTER_API_KEY or
 * OPENROUTER_MODEL. Every stub here has callModel's signature,
 * `(messages, options) => Promise<completion>`, and resolves to a body shaped
 * like an OpenRouter chat completion whose message content is the JSON string
 * the test asked for. Pass a stub wherever the code under test accepts a model
 * client.
 *
 * The stub deliberately carries no `model` field: no model id is written
 * anywhere in this repo, tests included (CLAUDE.md, "Ask before you decide").
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

/** Read a fixture file as UTF-8 text, exactly as stored. */
export function readFixture(name) {
  return readFileSync(join(FIXTURES, name), "utf8");
}

/** The planted-clause sidecar for adhesion-contract.txt. */
export function loadSidecar(name = "adhesion-contract.flags.json") {
  return JSON.parse(readFixture(name));
}

/**
 * A sentence that appears in neither fixture. Used to stand for a model that
 * invents a Source Sentence; fixtures.test.js checks it really is absent.
 */
export const FABRICATED_SENTENCE =
  "Creator shall pay Brand a late-delivery penalty of ten thousand dollars ($10,000) for each Deliverable published after its scheduled date.";

/**
 * Wrap message content in an OpenRouter-shaped chat completion.
 * A string is used as the content verbatim (so a test can send malformed
 * JSON); anything else is JSON-encoded.
 */
export function completion(content) {
  return {
    id: "stub-completion",
    object: "chat.completion",
    created: 0,
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: typeof content === "string" ? content : JSON.stringify(content),
        },
      },
    ],
  };
}

/**
 * Build a model client from a responder.
 *
 * - a function is called with (messages, options) and its return value
 *   (sync or async) becomes the content, so one stub can answer several
 *   different calls;
 * - an Error is thrown from every call, as a failed request would be;
 * - anything else is the content of every call.
 *
 * Like the real client, it rejects an empty message list.
 */
export function createStubModel(responder) {
  return async function stubCallModel(messages, options = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("callModel needs at least one message.");
    }
    if (responder instanceof Error) throw responder;
    const content =
      typeof responder === "function" ? await responder(messages, options) : responder;
    return completion(content);
  };
}

/** One sidecar entry as the model would return it (no fixture-only keys). */
export function flagPayload(entry) {
  const { clauseType, sourceSentence, severity, whatItMeans, whyDangerous, counterOffer } = entry;
  return { clauseType, sourceSentence, severity, whatItMeans, whyDangerous, counterOffer };
}

export const DEFAULT_SUMMARY =
  "A brand partnership agreement between Northwick Wellness Co. and a content creator for four sponsored posts, paid a single fee after the brand accepts the work.";

/**
 * The analysis payload for the sidecar: a summary plus one flag per planted
 * clause. `extraFlags` are appended as given; `only` keeps just the listed
 * sidecar ids. `matches` maps a sidecar id to the Red Line id the model
 * claims that clause breaks (its matchedRedLineId); every other flag claims
 * none.
 *
 * @typedef {{ summary?: string, extraFlags?: object[], only?: string[], matches?: Record<string, string> }} SidecarOptions
 * @param {{ flags: Array<Record<string, string>> }} sidecar
 * @param {SidecarOptions} [options]
 */
export function analysisFromSidecar(sidecar, { summary = DEFAULT_SUMMARY, extraFlags = [], only, matches = {} } = {}) {
  const entries = only ? sidecar.flags.filter((f) => only.includes(f.id)) : sidecar.flags;
  const flags = entries.map((entry) => ({ ...flagPayload(entry), matchedRedLineId: matches[entry.id] ?? null }));
  return { summary, flags: [...flags, ...extraFlags] };
}

/**
 * A model that flags a planted clause only when its sentence is in what it
 * was sent, so the same stub answers differently for the adhesion contract
 * (every planted clause) and the clean fixture (none). `matches` as for
 * analysisFromSidecar. It looks only for the sidecar's sentences in the
 * messages; it doesn't read or depend on the prompt's wording.
 *
 * @param {{ flags: Array<Record<string, string>> }} sidecar
 * @param {SidecarOptions} [options]
 */
export function stubReadingDocument(sidecar, options = {}) {
  return createStubModel((messages) => {
    const sent = messages.map((m) => String(m.content)).join(" ");
    const present = sidecar.flags.filter((f) => sent.includes(f.sourceSentence)).map((f) => f.id);
    return analysisFromSidecar(sidecar, { ...options, only: present });
  });
}

/**
 * A model that returns every planted clause in the sidecar.
 * @param {{ flags: Array<Record<string, string>> }} sidecar
 * @param {SidecarOptions} [options]
 */
export function stubFromSidecar(sidecar, options) {
  return createStubModel(analysisFromSidecar(sidecar, options));
}

/** A model that finds nothing to flag. */
export function stubClean({ summary = "A mutual creator services agreement with capped liability, fixed payment dates and a time-limited licence." } = {}) {
  return createStubModel({ summary, flags: [] });
}

/**
 * A model that returns the sidecar's flags plus one whose Source Sentence is
 * not in the Document.
 * @param {{ flags: Array<Record<string, string>> }} sidecar
 * @param {SidecarOptions & { sentence?: string, severity?: string }} [options]
 */
export function stubWithFabricatedSentence(sidecar, { sentence = FABRICATED_SENTENCE, severity = "critical", ...options } = {}) {
  const fabricated = {
    clauseType: "payment-terms",
    sourceSentence: sentence,
    severity,
    whatItMeans: "You pay a large penalty for every late post.",
    whyDangerous: "The penalty is larger than the fee.",
    counterOffer: "Remove the penalty.",
  };
  return stubFromSidecar(sidecar, { ...options, extraFlags: [...(options.extraFlags || []), fabricated] });
}

/** A model whose every call fails. */
export function stubFailing(error = new Error("OpenRouter returned 503: stubbed failure")) {
  return createStubModel(error instanceof Error ? error : new Error(String(error)));
}

/** A model that returns exactly this content (e.g. a question-box answer). */
export function stubContent(content) {
  return createStubModel(content);
}
