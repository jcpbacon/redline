/**
 * The JSON body /read sends to /api/analyze: the Document's text and nothing
 * else. Throws if handed anything but a string, so a File or a Blob can't be
 * sent by mistake (ticket #20: only extracted text leaves the browser).
 *
 * Kept apart from lib/extract/ so importing it doesn't pull in the PDF parser.
 *
 * @param {string} text
 * @returns {string}
 */
export function analyzeRequestBody(text) {
  if (typeof text !== "string") {
    throw new TypeError("analyzeRequestBody takes the Document's text, not a file.");
  }
  return JSON.stringify({ text });
}
