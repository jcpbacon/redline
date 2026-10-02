import { createDocumentQuestionHandler } from "../../../../../lib/questions/http.js";

/*
 * POST /api/documents/[id]/questions — ask a saved Document a question and
 * store it with its answer. The handler is in lib/questions/http.js. Here it
 * gets the real OpenRouter client and the Reader's session from the request's
 * cookies; the key and model id stay on the server.
 */

export const maxDuration = 120;

export const POST = createDocumentQuestionHandler();
