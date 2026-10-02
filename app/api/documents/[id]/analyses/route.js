import { createDocumentAnalysisHandler } from "../../../../../lib/documents/http.js";

/*
 * POST /api/documents/[id]/analyses — analyse a saved Document and store the
 * run as a new analysis. The handler is in lib/documents/http.js. Here it
 * gets the real OpenRouter client and the Reader's session from the request's
 * cookies; the key and model id stay on the server.
 */

// A full contract can take the model a while. Vercel uses this as the
// function's time limit.
export const maxDuration = 120;

export const POST = createDocumentAnalysisHandler();
