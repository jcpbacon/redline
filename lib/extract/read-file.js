import { extractDocxText, isCompoundFile, isZip } from "./docx.js";
import { ParseError } from "./parse-error.js";
import { extractPdfText, hasPdfHeader } from "./pdf.js";

/**
 * What /read does with a file the Reader chose, up to the text.
 *
 *   readChosenFile(file, { pdfjs?, onProgress?, onFormat? })
 *     -> { format: "pdf", ...PdfOutcome }    (./pdf.js)
 *     -> { format: "docx", ...DocxOutcome }  (./docx.js)
 *     throws ParseError                      "unsupported", or the parser's own code
 *
 * The file's bytes are read in the browser (Blob.arrayBuffer, no network) and
 * handed to a parser chosen by what the bytes are (formatOf), never by the
 * file's name, extension or the type the browser reports: those are never
 * read here, so they can't reach a request or the library by way of this
 * function. The default title of a saved Document comes from its text
 * (lib/documents/title.js), never from the file name.
 *
 * `onFormat` is told which parser was chosen before it starts, so the screen
 * can say what it's reading.
 *
 * @param {Blob} file
 * @param {{ pdfjs?: any, onProgress?: (page: number, pages: number) => void, onFormat?: (format: "pdf" | "docx") => void }} [options]
 * @returns {Promise<({ format: "pdf" } & import("./pdf.js").PdfOutcome) | ({ format: "docx" } & import("./docx.js").DocxOutcome)>}
 */
export async function readChosenFile(file, { pdfjs, onProgress, onFormat } = {}) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = formatOf(bytes);
  onFormat?.(format);
  if (format === "pdf") return { format, ...(await extractPdfText(bytes, { pdfjs, onProgress })) };
  return { format, ...(await extractDocxText(bytes)) };
}

/**
 * Which parser reads these bytes, by their signature:
 * - a zip, or an Office compound file, goes to the Word parser, which tells a
 *   .docx from a locked one, an old .doc, or some other zip;
 * - "%PDF-" in the first 1024 bytes is a PDF.
 * Anything else is refused as "unsupported".
 *
 * @param {Uint8Array} bytes
 * @returns {"pdf" | "docx"}
 */
export function formatOf(bytes) {
  // Signatures at the very start first: a PDF's header may sit anywhere in its
  // first 1024 bytes, so a zip that happened to hold "%PDF-" there would
  // otherwise be taken for one.
  if (isZip(bytes) || isCompoundFile(bytes)) return "docx";
  if (hasPdfHeader(bytes)) return "pdf";
  throw new ParseError("unsupported", "The file is neither a PDF nor a Word document.");
}
