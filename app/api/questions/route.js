import { createAskHandler } from "../../../lib/questions/http.js";

/*
 * POST /api/questions — the question box on an unsaved reading. Nothing is
 * stored. The handler is in lib/questions/http.js; here it gets the real
 * OpenRouter client, and the key and model id stay on the server.
 */

export const maxDuration = 120;

export const POST = createAskHandler();
