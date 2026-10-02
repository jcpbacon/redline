import { extractPdfText } from "./pdf.js";

/**
 * What /read does with a PDF the Reader chose, up to the text.
 *
 *   readChosenPdf(file, { pdfjs?, onProgress? }) -> PdfOutcome (./pdf.js)
 *
 * The file's bytes are read in the browser (Blob.arrayBuffer, no network) and
 * handed to the parser. What comes back is the outcome and nothing else: the
 * file's name, size and type are never read here, so they can't reach a
 * request or the library by way of this function. The default title of a
 * saved Document comes from its text (lib/documents/title.js), never from the
 * file name.
 *
 * @param {Blob} file
 * @param {Parameters<typeof extractPdfText>[1]} [options]
 */
export async function readChosenPdf(file, options) {
  const bytes = await file.arrayBuffer();
  return extractPdfText(bytes, options);
}
