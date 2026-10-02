import { assertServerOnly } from "../env.js";
import { ModelError, analyzeDocument } from "./index.js";
import { rankFlags } from "./rank.js";
import { readerStore } from "../documents/session.js";
import { readerRedLines } from "../red-lines/index.js";

assertServerOnly("lib/analysis/http.js");

/**
 * The POST handler behind /api/analyze, built by a factory so tests can give
 * it a stub model. app/api/analyze/route.js calls this with no arguments,
 * which leaves analyzeDocument on the real OpenRouter client. A route file may
 * only export HTTP methods and segment config, so the factory lives here.
 *
 * Request:  { text: string }   — the Document's text, exactly as the Reader confirmed it.
 * 200:      { summary, flags, clean, checked, redLines } — `flags` already
 *           ranked by rankFlags (most severe first); `clean` is true when none
 *           survived; `redLines` is the Red Lines the run used.
 * 400:      { error }          — no text, or a body that is not JSON.
 * 502:      { error, retryable: true } — the model call failed or replied with
 *           something unusable. The same text can be sent again.
 * 500:      { error, retryable: true } — anything else.
 *
 * Error bodies carry Reader-facing copy only. The cause is logged here, on the
 * server, so a missing key or a provider's message never reaches the browser.
 *
 * No account is needed and nothing is stored: saving a Document is ticket #21.
 *
 * No account is needed. A signed-in Reader's Red Lines (seeded first for a
 * new Reader) go to the analysis and to ranking, so a Flag that breaks one is
 * marked and promoted; anyone else's run has none. They come from the
 * session, never from the request body. If they can't be read, the run goes
 * ahead without them and the cause is logged: Red Lines only mark and
 * promote, so the Flags are the same either way (ADR-0003).
 *
 * `connect` gives the Reader's session (lib/documents/session.js); tests pass
 * one over a test database.
 *
 * @param {{
 *   model?: Parameters<typeof analyzeDocument>[2]["model"],
 *   logDrop?: Parameters<typeof analyzeDocument>[2]["logDrop"],
 *   connect?: typeof readerStore,
 * }} [deps]
 */
export function createAnalyzeHandler({ model, logDrop, connect = readerStore } = {}) {
  return async function POST(request) {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "That request didn’t include any text to read." }, { status: 400 });
    }

    const text = body && typeof body === "object" ? body.text : undefined;
    if (typeof text !== "string" || text.trim() === "") {
      return Response.json({ error: "There’s no text to read. Paste the document first." }, { status: 400 });
    }

    const redLines = await redLinesFor(connect);

    try {
      const { summary, flags, checked } = await analyzeDocument(text, redLines, { model, logDrop, signal: request.signal });
      const ranked = rankFlags(flags, redLines);
      return Response.json({ summary, flags: ranked.flags, clean: ranked.clean, checked, redLines });
    } catch (error) {
      console.error("POST /api/analyze failed:", error);
      if (error instanceof ModelError) {
        return Response.json(
          { error: "The analysis didn’t finish. Your text is still here, so you can try again.", retryable: true },
          { status: 502 },
        );
      }
      return Response.json(
        { error: "Something went wrong on our side. Your text is still here, so you can try again.", retryable: true },
        { status: 500 },
      );
    }
  };
}

/**
 * The signed-in Reader's Red Lines, or [] for anyone else, or when they can't
 * be read (logged).
 *
 * @param {typeof readerStore} connect
 * @returns {Promise<Array<{ id: string, text: string }>>}
 */
async function redLinesFor(connect) {
  try {
    const session = await connect();
    if (session.state !== "ok") return [];
    return await readerRedLines(session.store);
  } catch (error) {
    console.error("POST /api/analyze couldn't read the Reader's Red Lines; reading without them:", error);
    return [];
  }
}
