import { assertServerOnly, optional, required } from "../env.js";

assertServerOnly("lib/openrouter/client.js");

/**
 * The model Redline calls, through OpenRouter.
 *
 * Which model that is has not been chosen (CLAUDE.md, "Ask before you decide"),
 * so it is read from OPENROUTER_MODEL and there is no fallback here or anywhere
 * else — including tests and fixtures. A build with no model configured fails
 * when it first tries to call one, rather than quietly analysing a Document
 * with whatever model happened to be cheapest to default to.
 */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** The configured model id. Throws if none is configured. */
export function getModelId() {
  return required("OPENROUTER_MODEL");
}

/**
 * Send messages to the configured model and return the parsed response body.
 *
 * `messages` is OpenRouter's chat format. Anything else in `options` is passed
 * through to the API untouched, so callers can set temperature, response_format
 * and so on without this wrapper needing to know about them.
 *
 * @param {Array<{ role: string, content: string }>} messages
 * @param {{ signal?: AbortSignal, [key: string]: unknown }} [options]
 */
export async function callModel(messages, { signal, ...options } = {}) {
  assertServerOnly("lib/openrouter/client.js");

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("callModel needs at least one message.");
  }

  const headers = {
    Authorization: `Bearer ${required("OPENROUTER_API_KEY")}`,
    "Content-Type": "application/json",
  };

  // OpenRouter uses these for attribution on its dashboard; both are optional.
  const site = optional("OPENROUTER_SITE_URL");
  if (site) headers["HTTP-Referer"] = site;
  const title = optional("OPENROUTER_APP_NAME");
  if (title) headers["X-Title"] = title;

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({ model: getModelId(), messages, ...options }),
  });

  if (!response.ok) {
    // The body often carries the reason; include it, but never the key.
    const detail = await response.text().catch(() => "");
    throw new Error(
      `OpenRouter returned ${response.status}${detail ? `: ${detail.slice(0, 500)}` : ""}`,
    );
  }

  return response.json();
}
