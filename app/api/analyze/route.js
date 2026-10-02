import { createAnalyzeHandler } from "../../../lib/analysis/http.js";

/*
 * POST /api/analyze — runs Seam 1 on pasted text. The handler, and why it is
 * built by a factory, are in lib/analysis/http.js. Here it gets no injected
 * model, so it calls OpenRouter with the key and model id from the server's
 * environment; neither is ever sent to the browser.
 */

// A full contract can take the model a while. Vercel uses this as the
// function's time limit.
export const maxDuration = 120;

export const POST = createAnalyzeHandler();
