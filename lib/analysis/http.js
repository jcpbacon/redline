import { assertServerOnly } from "../env.js";
import { ModelError, analyzeDocument } from "./index.js";

assertServerOnly("lib/analysis/http.js");

/**
 * The POST handler behind /api/analyze, built by a factory so tests can give
 * it a stub model. app/api/analyze/route.js calls this with no arguments,
 * which leaves analyzeDocument on the real OpenRouter client. A route file may
 * only export HTTP methods and segment config, so the factory lives here.
 *
 * Request:  { text: string }   — the Document's text, exactly as the Reader confirmed it.
 * 200:      { summary, flags, checked }
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
 * @param {{ model?: Parameters<typeof analyzeDocument>[2]["model"] }} [deps]
 */
export function createAnalyzeHandler({ model } = {}) {
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

    try {
      const analysis = await analyzeDocument(text, [], { model, signal: request.signal });
      return Response.json(analysis);
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
