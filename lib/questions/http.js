import { assertServerOnly } from "../env.js";
import { readerStore } from "../documents/session.js";
import { askSavedDocument } from "./ask.js";
import { ModelError, answerQuestion } from "./index.js";
import { prepareQuestion } from "./text.js";

assertServerOnly("lib/questions/http.js");

/**
 * The POST handlers behind the question box, built by factories so tests can
 * give them a stub model (and, for a saved Document, a store over a test
 * database). The route files call them with no arguments, which leaves
 * answerQuestion on the real OpenRouter client.
 *
 * Both answer with the same shape:
 *
 *   200: { question: AskedQuestion }  (lib/questions/text.js) — grounded, with
 *        its Source Sentences, or unanswerable. Unanswerable is a successful
 *        answer, not an error.
 *   400: { error } — no question, a question that's too long, no Document
 *        text, or a body that isn't JSON.
 *   502: { error, retryable: true } — the model call failed or replied with
 *        something unusable. Nothing is stored; the same question can be
 *        asked again.
 *   500: { error, retryable: true } — anything else. Nothing is stored.
 *
 * Error bodies carry Reader-facing copy only; causes are logged here.
 */

export const COPY = Object.freeze({
  badRequest: "That request didn’t include a question.",
  noText: "There’s no document to ask about. Paste the document and read it first.",
  modelFailed: "Redline couldn’t answer that just now. Your question is still here, so you can ask again.",
  failed: "Something went wrong on our side. Your question is still here, so you can ask again.",
  off: "Accounts aren’t switched on here, so there are no saved documents to ask about.",
  signedOut: "You’ve been signed out. Sign in, then ask again.",
  notFound: "That document isn’t in your library.",
});

/**
 * POST /api/questions — a question about an unsaved reading. Nothing is
 * stored. The Document's text and the earlier questions come from the
 * browser, which holds the reading; grounding is checked against that text.
 *
 * Request: { question: string, text: string, history?: Array<{ question, text, unanswerable }> }
 *
 * @param {{
 *   model?: Parameters<typeof answerQuestion>[2]["model"],
 *   logDrop?: Parameters<typeof answerQuestion>[2]["logDrop"],
 * }} [deps]
 */
export function createAskHandler({ model, logDrop } = {}) {
  /** @param {Request} request */
  return async function POST(request) {
    const body = await readJson(request);
    if (!body) return Response.json({ error: COPY.badRequest }, { status: 400 });

    const prepared = prepareQuestion(body.question);
    if ("error" in prepared) return Response.json({ error: prepared.error }, { status: 400 });
    const text = body.text;
    if (typeof text !== "string" || text.trim() === "") {
      return Response.json({ error: COPY.noText }, { status: 400 });
    }

    try {
      const answer = await answerQuestion(prepared.question, text, {
        model,
        logDrop,
        history: body.history,
        signal: request.signal,
      });
      return Response.json({ question: asked(prepared.question, answer) });
    } catch (error) {
      return failure("POST /api/questions", error);
    }
  };
}

/**
 * POST /api/documents/[id]/questions — a question about a saved Document.
 * The text and the earlier questions are read from the database as the
 * signed-in Reader; the question and its answer are stored with the Document.
 *
 * Request: { question: string }
 * Also:    401 nobody signed in; 404 not this Reader's Document (the same
 *          answer as one that doesn't exist); 503 accounts not configured.
 *
 * @param {{
 *   model?: Parameters<typeof answerQuestion>[2]["model"],
 *   logDrop?: Parameters<typeof answerQuestion>[2]["logDrop"],
 *   connect?: typeof readerStore,
 * }} [deps]
 */
export function createDocumentQuestionHandler({ model, logDrop, connect = readerStore } = {}) {
  /**
   * @param {Request} request
   * @param {{ params: Promise<{ id: string }> }} context
   */
  return async function POST(request, { params }) {
    const { id } = await params;

    const body = await readJson(request);
    if (!body) return Response.json({ error: COPY.badRequest }, { status: 400 });
    const prepared = prepareQuestion(body.question);
    if ("error" in prepared) return Response.json({ error: prepared.error }, { status: 400 });

    let session;
    try {
      session = await connect();
    } catch (error) {
      console.error("POST /api/documents/[id]/questions couldn't open the Reader's session:", error);
      return Response.json({ error: COPY.failed, retryable: true }, { status: 500 });
    }
    if (session.state === "off") return Response.json({ error: COPY.off }, { status: 503 });
    if (session.state === "signed-out") return Response.json({ error: COPY.signedOut }, { status: 401 });

    try {
      const question = await askSavedDocument(session.store, id, prepared.question, {
        model,
        logDrop,
        signal: request.signal,
      });
      if (!question) return Response.json({ error: COPY.notFound }, { status: 404 });
      return Response.json({ question });
    } catch (error) {
      return failure("POST /api/documents/[id]/questions", error);
    }
  };
}

/**
 * @param {string} question
 * @param {import("./text.js").Answer} answer
 * @returns {import("./text.js").AskedQuestion}
 */
function asked(question, answer) {
  if ("unanswerable" in answer) {
    return { id: null, question, unanswerable: true, text: null, groundedIn: [], askedAt: null };
  }
  return { id: null, question, unanswerable: false, text: answer.text, groundedIn: answer.groundedIn, askedAt: null };
}

/** @param {Request} request */
async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} where
 * @param {unknown} error
 */
function failure(where, error) {
  console.error(`${where} failed:`, error);
  if (error instanceof ModelError) {
    return Response.json({ error: COPY.modelFailed, retryable: true }, { status: 502 });
  }
  return Response.json({ error: COPY.failed, retryable: true }, { status: 500 });
}
