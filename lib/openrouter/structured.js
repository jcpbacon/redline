/**
 * Every model request Redline makes, built in one place.
 *
 * Analysis (lib/analysis) and question answering both ask the model for a JSON
 * object of a known shape. The owner's standing answer to "which model, and
 * how" fixes three things on every such request, so they live here rather than
 * being repeated by each caller:
 *
 * - the provider is pinned, with no fallback to another one;
 * - reasoning effort is low;
 * - the reply is structured output against a strict JSON schema.
 *
 * The model id is not set here. `callModel` in ./client.js adds it from
 * OPENROUTER_MODEL, so nothing in this file can name one.
 *
 * `model` is always passed in: it has callModel's signature,
 * `(messages, options) => Promise<chat completion>`, so tests hand in a stub.
 */

export const PROVIDER = Object.freeze({
  order: Object.freeze(["fireworks"]),
  allow_fallbacks: false,
  require_parameters: true,
});

export const REASONING = Object.freeze({ effort: "low" });

/**
 * A model call that did not produce a usable answer: the request failed, or
 * the reply was not JSON, or was JSON of the wrong shape. Every case is worth
 * retrying with the same input, which is what `retryable` tells the caller.
 *
 * `kind` is "request" when the call itself failed and "output" when it
 * returned something unusable.
 */
export class ModelError extends Error {
  /**
   * @param {string} message
   * @param {{ kind: "request" | "output", cause?: unknown }} details
   */
  constructor(message, { kind, cause }) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ModelError";
    this.kind = kind;
    this.retryable = true;
  }
}

/**
 * The messages and options for one structured request.
 *
 * @param {{ system: string, user: string, name: string, schema: object }} request
 */
export function buildStructuredRequest({ system, user, name, schema }) {
  return {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    options: {
      provider: { ...PROVIDER, order: [...PROVIDER.order] },
      reasoning: { ...REASONING },
      response_format: {
        type: "json_schema",
        json_schema: { name, strict: true, schema },
      },
    },
  };
}

/**
 * Send a structured request and return the parsed JSON object.
 *
 * Throws ModelError when the call fails, when the reply carries no content,
 * or when that content is not a JSON object. Checking the object's fields is
 * the caller's job, because only the caller knows its schema; it should throw
 * `outputError(...)` when they are wrong.
 *
 * @param {(messages: Array<{ role: string, content: string }>, options?: object) => Promise<any>} model
 * @param {{ system: string, user: string, name: string, schema: object, signal?: AbortSignal }} request
 * @returns {Promise<Record<string, unknown>>}
 */
export async function callStructured(model, { signal, ...request }) {
  const { messages, options } = buildStructuredRequest(request);

  let body;
  try {
    body = await model(messages, signal ? { ...options, signal } : options);
  } catch (cause) {
    throw new ModelError("The model call failed.", { kind: "request", cause });
  }

  // OpenRouter can answer 200 with an error object in place of choices.
  if (body && typeof body === "object" && body.error) {
    throw new ModelError("The model call returned an error.", { kind: "request", cause: body.error });
  }

  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw outputError("The model returned no content.");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (cause) {
    throw new ModelError("The model's reply was not valid JSON.", { kind: "output", cause });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw outputError("The model's reply was not a JSON object.");
  }
  return parsed;
}

/** A ModelError for a reply that does not match the schema the caller asked for. */
export function outputError(message) {
  return new ModelError(message, { kind: "output" });
}
