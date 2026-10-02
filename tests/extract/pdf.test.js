import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { ParseError, extractPdfText, joinPages, linesOf } from "../../lib/extract/pdf.js";
import { readChosenFile } from "../../lib/extract/read-file.js";
import { analyzeRequestBody } from "../../lib/documents/request-body.js";
import { loadSidecar } from "../helpers/stub-model.js";

/*
 * Seam 2, PDFs. The fixtures are real PDF files written by
 * scripts/make-fixture-pdfs.mjs and parsed here by the same PDF.js build the
 * browser loads (the legacy build), running under Node.
 */

const dir = join(import.meta.dirname, "..", "fixtures", "pdf");
const pdf = (/** @type {string} */ name) => new Uint8Array(readFileSync(join(dir, name)));
const expected = readFileSync(join(dir, "compensation-ip.expected.txt"), "utf8");
const sidecar = loadSidecar();

/** @param {string} name */
async function parseError(name) {
  try {
    await extractPdfText(pdf(name), { pdfjs });
  } catch (error) {
    return error;
  }
  throw new Error(`${name} parsed without an error`);
}

describe("extractPdfText on a text PDF", () => {
  it("returns exactly the stored expected text, whitespace and in-clause line breaks included", async () => {
    const result = await extractPdfText(pdf("compensation-ip.pdf"), { pdfjs });
    expect(result.kind).toBe("text");
    expect(result.pages).toBe(2);
    if (result.kind !== "text") return;
    expect(result.text).toBe(expected);
    // The fixture has what the assertion above is meant to cover.
    expect(expected).toContain("\n\n");
    expect(expected).toMatch(/4\.1 Creator hereby assigns[^\n]*\n[^\n]*developed\./);
    expect(expected).toContain("’"); // a curly apostrophe, not turned into '
  });

  it("keeps a sidecar Source Sentence verbatim, and one that wraps keeps its line break", async () => {
    const result = await extractPdfText(pdf("compensation-ip.pdf"), { pdfjs });
    if (result.kind !== "text") throw new Error("expected text");

    // Clause 3.2 is laid out on one line: the sidecar sentence is in the output as is.
    const payment = sidecar.flags.find((f) => f.id === "payment-on-acceptance").sourceSentence;
    expect(result.text.includes(payment)).toBe(true);

    // Clause 4.1 wraps. The sentence taken from the expected text, line break
    // and all, is a verbatim substring of the output.
    const start = expected.indexOf("Creator hereby assigns");
    const end = expected.indexOf("later developed.") + "later developed.".length;
    const wrapped = expected.slice(start, end);
    expect(wrapped).toContain("\n");
    expect(result.text.includes(wrapped)).toBe(true);
    // The same words with the break taken out are the sidecar's sentence;
    // the parser didn't reflow them into it.
    const ip = sidecar.flags.find((f) => f.id === "ip-assignment").sourceSentence;
    expect(wrapped.replace("\n", " ")).toBe(ip);
    expect(result.text.includes(ip)).toBe(false);
  });

  it("reports each page as it goes", async () => {
    /** @type {number[][]} */
    const seen = [];
    await extractPdfText(pdf("compensation-ip.pdf"), { pdfjs, onProgress: (page, pages) => seen.push([page, pages]) });
    expect(seen).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });
});

describe("extractPdfText on files it can't use", () => {
  it("calls a PDF of page images scanned, with no text", async () => {
    const result = await extractPdfText(pdf("scanned.pdf"), { pdfjs });
    expect(result).toEqual({ kind: "scanned", pages: 2 });
  });

  it("gives a damaged PDF, a non-PDF and a locked PDF each their own code", async () => {
    const corrupt = await parseError("corrupt.pdf");
    const notPdf = await parseError("not-a-pdf.pdf");
    const locked = await parseError("password.pdf");
    for (const error of [corrupt, notPdf, locked]) expect(error).toBeInstanceOf(ParseError);
    expect(corrupt.code).toBe("corrupt");
    expect(notPdf.code).toBe("not-pdf");
    expect(locked.code).toBe("password");
  });

  it("calls an empty file not a PDF", async () => {
    await expect(extractPdfText(new Uint8Array(0), { pdfjs })).rejects.toMatchObject({ code: "not-pdf" });
  });
});

describe("rebuilding lines from text items", () => {
  /**
   * @param {string} str
   * @param {number} y
   * @param {boolean} [hasEOL]
   */
  const item = (str, y, hasEOL = false, size = 10) => ({ str, hasEOL, transform: [size, 0, 0, size, 72, y], height: size });

  it("joins items on one baseline and breaks where hasEOL says or the baseline moves", () => {
    const lines = linesOf([item("The ", 700), item("Fee", 700, true), item("is due", 688), item(" now.", 676)]);
    expect(lines.map((l) => l.text)).toEqual(["The Fee", "is due", " now."]);
  });

  it("keeps a hyphen at a line end and doesn't join the word back up", () => {
    const text = joinPages([linesOf([item("non-refund-", 700, true), item("able deposit", 688, true)])]);
    expect(text).toBe("non-refund-\nable deposit");
  });

  it("puts a blank line only where the gap is wider than normal line spacing", () => {
    const page = linesOf([item("one", 700, true), item("two", 688, true), item("three", 664, true)]);
    expect(joinPages([page])).toBe("one\ntwo\n\nthree");
  });

  it("joins pages with a single line break", () => {
    expect(joinPages([linesOf([item("end of page", 100, true)]), linesOf([item("next page", 700, true)])])).toBe(
      "end of page\nnext page",
    );
  });
});

describe("what leaves the browser", () => {
  it("returns only the outcome from a chosen file, nothing about the file", async () => {
    const name = "Northwind-confidential-offer.pdf";
    const file = new File([readFileSync(join(dir, "compensation-ip.pdf"))], name, { type: "application/pdf" });
    const result = await readChosenFile(file, { pdfjs });
    expect(Object.keys(result).sort()).toEqual(["format", "kind", "pages", "text"]);
    expect(JSON.stringify(result)).not.toContain("Northwind-confidential");
    expect(JSON.stringify(result)).not.toContain("application/pdf");
  });

  it("builds the analysis request from the text alone and refuses a file", () => {
    expect(JSON.parse(analyzeRequestBody(expected))).toEqual({ text: expected });
    const file = new File(["%PDF-1.7"], "x.pdf");
    expect(() => analyzeRequestBody(/** @type {any} */ (file))).toThrow(TypeError);
  });
});
