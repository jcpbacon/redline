/**
 * Why a chosen file couldn't be read, for every parser in lib/extract/.
 *
 * Codes:
 *   "not-pdf"      the PDF parser was handed something without a PDF header
 *   "not-docx"     the DOCX parser was handed something that isn't a Word document
 *   "legacy-doc"   an old Word 97–2003 .doc file (a compound file, not a zip)
 *   "unsupported"  the chooser found neither a PDF nor a Word file
 *   "corrupt"      the file is the right kind but damaged
 *   "password"     the file is locked with a password (encrypted)
 */
export class ParseError extends Error {
  /**
   * @param {"not-pdf" | "not-docx" | "legacy-doc" | "unsupported" | "corrupt" | "password"} code
   * @param {string} message
   * @param {{ cause?: unknown }} [options]
   */
  constructor(code, message, options) {
    super(message, options);
    this.name = "ParseError";
    this.code = code;
  }
}
