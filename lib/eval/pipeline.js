import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { analyzeDocument } from "../analysis/index.js";
import { rankFlags } from "../analysis/rank.js";
import { SEED_RED_LINES } from "../red-lines/seed.js";

/**
 * The analysis pipeline as the product runs it, for scripts that run it
 * outside Next: analyzeDocument (with citation verification) then rankFlags.
 * Shared by `npm run smoke` and `npm run eval`.
 *
 * The model is passed in. Live runs pass callModel from
 * lib/openrouter/client.js; replays pass createReplayModel(recordedBody).
 * Either way the reply goes through the same parsing and Source Sentence
 * check as in the product. Nothing here substitutes for analysis.
 */

/**
 * The Red Lines a new Reader starts with (lib/red-lines/seed.js), with ids
 * "seed-1" to "seed-7" in list order. The scripts analyse with these, since
 * they are what a Reader who has changed nothing runs with. Recorded
 * responses refer to them by these ids.
 */
export function seedRedLines() {
  return SEED_RED_LINES.map((text, i) => ({ id: `seed-${i + 1}`, text }));
}

/** A required setting is missing. Scripts print `message` as one line and exit 1. */
export class ConfigError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

/** The settings a live run needs. Their values are never printed. */
export const LIVE_SETTINGS = Object.freeze(["OPENROUTER_API_KEY", "OPENROUTER_MODEL"]);

/**
 * Throw ConfigError naming every live setting that is missing or blank.
 *
 * @param {Record<string, string | undefined>} env
 */
export function assertLiveSettings(env) {
  const missing = LIVE_SETTINGS.filter((name) => typeof env[name] !== "string" || env[name].trim() === "");
  if (missing.length) {
    throw new ConfigError(
      `${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} not set. Add ${missing.length === 1 ? "it" : "them"} to .env.local, or pass --replay to run against a recorded model response.`,
    );
  }
}

/**
 * A model client that answers every call with a recorded response body, as
 * callModel would have returned it. It ignores what it is sent, so a
 * recording made for one Document only makes sense replayed for that one.
 *
 * @param {unknown} body
 */
export function createReplayModel(body) {
  return async function replayCallModel(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("callModel needs at least one message.");
    }
    return structuredClone(body);
  };
}

/**
 * A recorded response, as written to disk. The `model` field OpenRouter adds
 * is removed: no model id is written into this repo (CLAUDE.md), and a
 * recording may be committed as an eval fixture.
 *
 * @param {Record<string, unknown>} body
 */
export function recordable(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const { model: _model, ...rest } = body;
  return rest;
}

/** @param {string} path @param {unknown} body */
export function saveRecording(path, body) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(recordable(/** @type {any} */ (body)), null, 2)}\n`, "utf8");
}

/** @param {string} path */
export function loadRecording(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (cause) {
    throw new Error(`No recorded model response at ${path}.`, { cause });
  }
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new Error(`The recorded model response at ${path} is not JSON.`, { cause });
  }
}

/** How many Flags a raw model response proposed, before any were checked. */
function proposedFlagCount(body) {
  const content = body?.choices?.[0]?.message?.content;
  const flags = JSON.parse(content).flags;
  return flags.length;
}

/**
 * Run one Document through analysis and ranking.
 *
 * Returns the ranked Flags, the summary, the citation drops (captured from
 * analyzeDocument's drop logger, so nothing reaches stderr), the number of
 * Flags the model proposed, and the raw response body (for recording).
 *
 * Throws whatever analyzeDocument throws: a failed call or an unusable reply
 * is a crash for these scripts, not a score.
 *
 * @param {string} documentText
 * @param {{
 *   model: (messages: Array<{ role: string, content: string }>, options?: object) => Promise<any>,
 *   redLines?: Array<{ id: string, text: string }>,
 *   documentId?: string,
 * }} options
 */
export async function runPipeline(documentText, { model, redLines = [], documentId }) {
  /** @type {unknown[]} */
  const responses = [];
  const recordingModel = async (messages, options) => {
    const body = await model(messages, options);
    responses.push(body);
    return body;
  };

  /** @type {Array<import("../analysis/index.js").CitationDrop>} */
  const drops = [];
  const analysis = await analyzeDocument(documentText, redLines, {
    model: recordingModel,
    documentId,
    logDrop: (record) => drops.push(record),
  });
  const ranked = /** @type {{ flags: Array<import("../analysis/index.js").Flag & { redLine: { id: string, text: string } | null }>, clean: boolean }} */ (
    rankFlags(analysis.flags, redLines)
  );
  const response = responses[responses.length - 1];

  return {
    summary: analysis.summary,
    checked: analysis.checked,
    flags: ranked.flags,
    clean: ranked.clean,
    drops,
    proposed: proposedFlagCount(response),
    response,
  };
}
