/**
 * Seam 2: the browser parser, for PDFs.
 *
 *   extractPdfText(data, { pdfjs?, onProgress? })
 *     -> { kind: "text", text, pages }    the Document's text, and its page count
 *     -> { kind: "scanned", pages }       too little text for its pages (SCANNED_RULE)
 *     throws ParseError { code }          "not-pdf" | "corrupt" | "password"
 *
 * Runs in the Reader's browser. `data` is the file's bytes, read on the
 * Reader's machine; nothing here makes a network request, and nothing about
 * the file (its name, size or type) is returned. The text is the only thing
 * that leaves this function.
 *
 * `pdfjs` is Mozilla's PDF.js (pdfjs-dist). In the browser it is left out and
 * loaded on first use (loadPdfjs below), so it is only fetched once a Reader
 * chooses a PDF. Tests pass the same build in from Node. The legacy build is
 * used in both places, so the code under test is the code that ships, and it
 * covers browsers a little older than the current ones.
 *
 * ## How the text is rebuilt (ADR-0001: exact text, never reflowed)
 *
 * Source Sentences are matched against this text character for character, so
 * it has to be what the PDF says, laid out the way the Reader sees it.
 *
 * Kept exactly as PDF.js reports them:
 * - every character of every text item, in content order. PDF.js is asked
 *   not to normalise (`disableNormalization`), so ligatures (ﬁ), curly and
 *   straight quotes, dashes, non-breaking spaces and soft hyphens come
 *   through as the PDF encodes them;
 * - spaces inside a line, including any at a line's end. A PDF often has no
 *   space characters at all; where it doesn't, the spaces between words are
 *   the ones PDF.js puts in from the gaps between glyphs. Nothing here adds,
 *   removes or collapses one;
 * - hyphens at a line end. A word broken across two lines stays broken: there
 *   is no de-hyphenation and no joining of lines.
 *
 * Added, and only these:
 * - "\n" at the end of each line. A line ends where PDF.js marks an item
 *   `hasEOL`, or where the next item's baseline moves up or down by more
 *   than half the font size (SAME_LINE_TOLERANCE) without one.
 * - a blank line ("\n\n") between two lines on a page whose baselines are
 *   further apart than PARAGRAPH_GAP times the Document's normal line
 *   spacing. Normal line spacing is the smallest baseline-to-baseline gap
 *   between consecutive lines anywhere in the Document, measured in units of
 *   font size so small print and body text compare fairly. Gaps under half
 *   the font size are ignored when finding it: those are not separate lines
 *   of type. A Document whose paragraphs are separated only by indentation
 *   gets no blank lines; one with a heading set tighter than its body text
 *   may get extra ones.
 * - "\n" between pages. A page break ends a line, and the layout can't say
 *   whether it also ends a paragraph, so no paragraph break is claimed.
 *
 * Dropped: lines with no characters at all (PDF.js reports an empty item
 * where a line ends with nothing on it). Nothing else.
 *
 * Not attempted: reading order. Lines come in the order the PDF draws them,
 * which for a two-column page or a sidebar may not be reading order.
 * Right-to-left and vertical text are not reordered.
 */

/**
 * "Looks scanned": too few pages carry real text.
 *
 * A page counts as having text when it has at least `minCharactersPerPage`
 * characters that aren't whitespace. A PDF is treated as scanned when fewer
 * than `minShareOfPagesWithText` of its pages do.
 *
 * Why these numbers: a page of contract text has hundreds to thousands of
 * characters. A scanned page has none, or only a short stamp a scanner or
 * e-signing service added (a page number, an envelope id), which stays well
 * under 50. Counting pages rather than averaging characters means a scan with
 * one typed cover page is still refused, instead of being analysed from that
 * page alone. Half rather than all, so a blank back page or a sparse signature
 * page doesn't refuse a real text PDF.
 */
export const SCANNED_RULE = Object.freeze({
  minCharactersPerPage: 50,
  minShareOfPagesWithText: 0.5,
});

/** A blank line goes where baselines are further apart than this times normal line spacing. */
export const PARAGRAPH_GAP = 1.4;

/** A baseline move of more than this times the font size, without hasEOL, starts a new line. */
export const SAME_LINE_TOLERANCE = 0.5;

/** How far into the file the "%PDF-" header may sit. PDF readers allow 1024 bytes. */
const HEADER_WINDOW = 1024;

export class ParseError extends Error {
  /**
   * @param {"not-pdf" | "corrupt" | "password"} code
   * @param {string} message
   * @param {{ cause?: unknown }} [options]
   */
  constructor(code, message, options) {
    super(message, options);
    this.name = "ParseError";
    this.code = code;
  }
}

/**
 * @typedef {{ kind: "text", text: string, pages: number } | { kind: "scanned", pages: number }} PdfOutcome
 * @typedef {{ str?: string, hasEOL?: boolean, transform?: number[], height?: number }} TextItem
 * @typedef {{ text: string, y: number, size: number }} Line
 */

/**
 * @param {ArrayBuffer | Uint8Array} data the file's bytes
 * @param {{ pdfjs?: any, onProgress?: (page: number, pages: number) => void }} [options]
 * @returns {Promise<PdfOutcome>}
 */
export async function extractPdfText(data, { pdfjs, onProgress } = {}) {
  // A copy: PDF.js hands its input to a worker, which detaches the buffer.
  const bytes = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(data.slice(0));
  if (!hasPdfHeader(bytes)) throw new ParseError("not-pdf", "The file doesn't start with a PDF header.");

  const lib = pdfjs ?? (await loadPdfjs());
  const task = lib.getDocument({
    data: bytes,
    // Fail on a damaged file instead of returning what could be salvaged.
    stopAtErrors: true,
    // Only text is read. No fonts are loaded, nothing is drawn, nothing is fetched.
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    disableAutoFetch: true,
    verbosity: 0,
  });

  try {
    let document;
    try {
      document = await task.promise;
    } catch (error) {
      throw classify(error);
    }
    const pages = document.numPages;
    if (!pages) throw new ParseError("corrupt", "The PDF has no pages.");

    /** @type {Line[][]} */
    const pageLines = [];
    for (let number = 1; number <= pages; number++) {
      try {
        const page = await document.getPage(number);
        const content = await page.getTextContent({ disableNormalization: true, includeMarkedContent: false });
        pageLines.push(linesOf(content.items));
        page.cleanup();
      } catch (error) {
        throw classify(error);
      }
      onProgress?.(number, pages);
    }

    if (looksScanned(pageLines)) return { kind: "scanned", pages };
    return { kind: "text", text: joinPages(pageLines), pages };
  } finally {
    await task.destroy();
  }
}

/**
 * Turn one page's text items into lines, in the order PDF.js gives them.
 *
 * @param {TextItem[]} items
 * @returns {Line[]}
 */
export function linesOf(items) {
  /** @type {Line[]} */
  const lines = [];
  /** @type {Line | null} */
  let line = null;
  let ended = false;

  for (const item of items) {
    if (typeof item.str !== "string") continue; // marked content, not text
    const y = item.transform?.[5] ?? 0;
    const size = fontSize(item);

    if (line && !ended && item.str !== "" && line.text !== "" && Math.abs(y - line.y) > SAME_LINE_TOLERANCE * Math.max(size, line.size)) {
      ended = true;
    }
    if (!line || ended) {
      if (line) lines.push(line);
      line = { text: "", y, size };
      ended = false;
    }
    if (line.text === "" && item.str !== "") {
      // A line is placed by its first item with characters in it.
      line.y = y;
      line.size = size;
    }
    line.text += item.str;
    if (item.hasEOL) ended = true;
  }
  if (line) lines.push(line);
  return lines.filter((l) => l.text !== "");
}

/**
 * @param {Line[][]} pageLines
 * @returns {string}
 */
export function joinPages(pageLines) {
  const normal = normalSpacing(pageLines);
  return pageLines
    .map((lines) =>
      lines
        .map((line, i) => {
          if (i === 0) return line.text;
          const gap = lineGap(lines[i - 1], line);
          const breakBefore = normal !== null && gap !== null && gap > normal * PARAGRAPH_GAP ? "\n\n" : "\n";
          return breakBefore + line.text;
        })
        .join(""),
    )
    .filter((page) => page !== "")
    .join("\n");
}

/**
 * Baseline-to-baseline distance from `a` down to `b`, in units of font size.
 * Null when `b` sits level with or above `a` (a new column, a sidebar).
 *
 * @param {Line} a
 * @param {Line} b
 */
function lineGap(a, b) {
  const drop = a.y - b.y;
  const size = Math.max(a.size, b.size, 1);
  return drop > 0 ? drop / size : null;
}

/** @param {Line[][]} pageLines */
function normalSpacing(pageLines) {
  let smallest = null;
  for (const lines of pageLines) {
    for (let i = 1; i < lines.length; i++) {
      const gap = lineGap(lines[i - 1], lines[i]);
      if (gap === null || gap < 0.5) continue;
      if (smallest === null || gap < smallest) smallest = gap;
    }
  }
  return smallest;
}

/** @param {Line[][]} pageLines */
function looksScanned(pageLines) {
  const withText = pageLines.filter((lines) => {
    let count = 0;
    for (const line of lines) count += line.text.replace(/\s/g, "").length;
    return count >= SCANNED_RULE.minCharactersPerPage;
  }).length;
  return withText < pageLines.length * SCANNED_RULE.minShareOfPagesWithText;
}

/** @param {TextItem} item */
function fontSize(item) {
  const t = item.transform;
  // The text matrix's vertical scale; `height` when the matrix is rotated.
  const fromMatrix = t ? Math.hypot(t[2] ?? 0, t[3] ?? 0) : 0;
  return fromMatrix || item.height || 1;
}

/** @param {Uint8Array} bytes */
function hasPdfHeader(bytes) {
  const window = bytes.subarray(0, HEADER_WINDOW + 5);
  for (let i = 0; i + 5 <= window.length; i++) {
    if (window[i] === 0x25 && window[i + 1] === 0x50 && window[i + 2] === 0x44 && window[i + 3] === 0x46 && window[i + 4] === 0x2d) {
      return true; // "%PDF-"
    }
  }
  return false;
}

/**
 * PDF.js's errors, as ParseErrors. Anything that isn't about the file itself
 * (the library failed to load, the tab ran out of memory) is rethrown as is.
 *
 * @param {any} error
 */
function classify(error) {
  if (error instanceof ParseError) return error;
  const name = error?.name;
  if (name === "PasswordException") {
    return new ParseError("password", "The PDF is protected by a password.", { cause: error });
  }
  if (name === "InvalidPDFException" || name === "FormatError" || name === "UnknownErrorException" || name === "MissingPDFException") {
    return new ParseError("corrupt", "The PDF is damaged and can't be read.", { cause: error });
  }
  return error;
}

/** @type {Promise<any> | null} */
let loading = null;

/**
 * Load PDF.js in the browser, once, with its worker. The worker is created
 * the way PDF.js documents for bundlers (pdfjs-dist/webpack.mjs): a module
 * Worker from `new URL(…, import.meta.url)`, which Next's bundler turns into
 * its own file. Text extraction runs in that worker, off the page's thread.
 */
export function loadPdfjs() {
  if (typeof window === "undefined") {
    throw new Error("loadPdfjs runs in the browser. On a server or in tests, pass `pdfjs` to extractPdfText.");
  }
  loading ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((lib) => {
    if (!lib.GlobalWorkerOptions.workerPort) {
      lib.GlobalWorkerOptions.workerPort = new Worker(
        new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url),
        { type: "module" },
      );
    }
    return lib;
  });
  loading.catch(() => {
    loading = null;
  });
  return loading;
}
