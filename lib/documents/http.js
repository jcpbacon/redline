import { assertServerOnly } from "../env.js";
import { ModelError } from "../analysis/index.js";
import { analyseSavedDocument } from "./analyse.js";
import { readerStore } from "./session.js";

assertServerOnly("lib/documents/http.js");

/**
 * The POST handler behind /api/documents/[id]/analyses: analyse a saved
 * Document by id and store the run. Built by a factory, like
 * lib/analysis/http.js, so tests can give it a stub model and a store over a
 * test database.
 *
 * Request: no body. The text is read from the database, never from the
 *          request, so a retry can't send different text.
 * 200:  { analysisId, summary, flags, clean, checked } — flags ranked.
 * 401:  { error }  — nobody signed in.
 * 404:  { error }  — no such Document for this Reader. Another Reader's id
 *                    gets the same answer as an id that never existed.
 * 503:  { error }  — accounts aren't configured on this deployment.
 * 502:  { error, retryable: true } — the model call failed; nothing stored.
 * 500:  { error, retryable: true } — anything else; nothing stored.
 *
 * Error bodies carry Reader-facing copy only; causes are logged here.
 *
 * @param {{
 *   model?: Parameters<typeof analyseSavedDocument>[2]["model"],
 *   logDrop?: Parameters<typeof analyseSavedDocument>[2]["logDrop"],
 *   modelId?: () => string,
 *   connect?: typeof readerStore,
 * }} [deps]
 */
export function createDocumentAnalysisHandler({ model, logDrop, modelId, connect = readerStore } = {}) {
  /**
   * @param {Request} request
   * @param {{ params: Promise<{ id: string }> }} context
   */
  return async function POST(request, { params }) {
    const { id } = await params;

    let session;
    try {
      session = await connect();
    } catch (error) {
      console.error("POST /api/documents/[id]/analyses couldn't open the Reader's session:", error);
      return Response.json({ error: COPY.failed, retryable: true }, { status: 500 });
    }
    if (session.state === "off") return Response.json({ error: COPY.off }, { status: 503 });
    if (session.state === "signed-out") return Response.json({ error: COPY.signedOut }, { status: 401 });

    try {
      const result = await analyseSavedDocument(session.store, id, { model, logDrop, modelId, signal: request.signal });
      if (!result) return Response.json({ error: COPY.notFound }, { status: 404 });
      return Response.json(result);
    } catch (error) {
      console.error("POST /api/documents/[id]/analyses failed:", error);
      if (error instanceof ModelError) {
        return Response.json({ error: COPY.modelFailed, retryable: true }, { status: 502 });
      }
      return Response.json({ error: COPY.failed, retryable: true }, { status: 500 });
    }
  };
}

export const COPY = Object.freeze({
  off: "Accounts aren’t switched on here, so there are no saved documents to read.",
  signedOut: "Sign in to read a saved document.",
  notFound: "That document isn’t in your library.",
  modelFailed: "The analysis didn’t finish. Your document is saved, so you can try again.",
  failed: "Something went wrong on our side. Your document is saved, so you can try again.",
});
