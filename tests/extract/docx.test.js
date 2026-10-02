import { readFileSync } from "node:fs";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { extractDocxText } from "../../lib/extract/docx.js";
import { ParseError } from "../../lib/extract/parse-error.js";
import { readChosenFile } from "../../lib/extract/read-file.js";
import { loadSidecar } from "../helpers/stub-model.js";

/*
 * Seam 2, Word files. The fixtures are real .docx files written by
 * scripts/make-fixture-docx.mjs and parsed here by the same code the browser
 * runs. A few rules (tables, fields, text boxes …) are checked against small
 * documents built in the test from the same contract text.
 */

const dir = join(import.meta.dirname, "..", "fixtures", "docx");
const pdfDir = join(import.meta.dirname, "..", "fixtures", "pdf");
const file = (/** @type {string} */ name) => new Uint8Array(readFileSync(join(dir, name)));
const expected = readFileSync(join(dir, "compensation-ip.expected.txt"), "utf8");
const sidecar = loadSidecar();

/** @param {Uint8Array} bytes */
async function parseError(bytes) {
  try {
    await extractDocxText(bytes);
  } catch (error) {
    return error;
  }
  throw new Error("parsed without an error");
}

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/**
 * A .docx whose body is `bodyXml`, and nothing else.
 *
 * @param {string} bodyXml
 * @param {string} [extraNamespaces]
 */
function docx(bodyXml, extraNamespaces = "") {
  return zipSync({
    "_rels/.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        "</Relationships>",
    ),
    "word/document.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${W}"${extraNamespaces}><w:body>${bodyXml}</w:body></w:document>`,
    ),
  });
}

/** @param {string} bodyXml @param {string} [extraNamespaces] */
async function textOf(bodyXml, extraNamespaces) {
  const result = await extractDocxText(docx(bodyXml, extraNamespaces));
  if (result.kind !== "text") throw new Error(`expected text, got ${result.kind}`);
  return result.text;
}

describe("extractDocxText on a Word file", () => {
  it("returns exactly the stored expected text, tabs and line breaks included", async () => {
    const result = await extractDocxText(file("compensation-ip.docx"));
    expect(result).toEqual({ kind: "text", text: expected });
    // The fixture has what the assertion above is meant to cover.
    expect(expected).toContain("3.1\tIn full consideration"); // a tab
    expect(expected).toContain("under this Agreement.\nCreator will provide"); // a break inside 3.3
    expect(expected).toContain("$200), payable together with the Fee.\n\n4. INTELLECTUAL"); // an empty paragraph
    expect(expected).toContain("Creator’s name"); // a curly apostrophe, not turned into '
    expect(expected).not.toContain("CONFIDENTIAL DRAFT"); // the header is left out
  });

  it("keeps sidecar Source Sentences verbatim, including one split across runs", async () => {
    const result = await extractDocxText(file("compensation-ip.docx"));
    if (result.kind !== "text") throw new Error("expected text");
    for (const id of ["payment-on-acceptance", "ip-assignment"]) {
      const sentence = sidecar.flags.find((f) => f.id === id).sourceSentence;
      expect(result.text.includes(sentence)).toBe(true);
    }
    // A sentence taken from the expected text, line break and all.
    const start = expected.indexOf("Creator is responsible");
    const end = expected.indexOf("before any payment is made.") + "before any payment is made.".length;
    expect(result.text.includes(expected.slice(start, end))).toBe(true);
  });

  it("reads tracked changes as accepted: deleted text out, inserted text in", async () => {
    const result = await extractDocxText(file("compensation-ip.docx"));
    if (result.kind !== "text") throw new Error("expected text");
    expect(result.text).not.toContain("thirty (30)");
    expect(result.text).toContain("within ninety (90) days");
  });

  it("refuses a damaged, a non-Word, a locked and an old .doc file, each with its own code", async () => {
    const corrupt = await parseError(file("corrupt.docx"));
    const notDocx = await parseError(file("not-a-docx.docx"));
    const locked = await parseError(file("password.docx"));
    const legacy = await parseError(file("legacy.doc"));
    for (const error of [corrupt, notDocx, locked, legacy]) expect(error).toBeInstanceOf(ParseError);
    expect(corrupt.code).toBe("corrupt");
    expect(notDocx.code).toBe("not-docx");
    expect(locked.code).toBe("password");
    expect(legacy.code).toBe("legacy-doc");
  });

  it("calls a PDF, an empty file and a spreadsheet-shaped zip not a Word document", async () => {
    expect((await parseError(new Uint8Array(readFileSync(join(pdfDir, "compensation-ip.pdf"))))).code).toBe("not-docx");
    expect((await parseError(new Uint8Array(0))).code).toBe("not-docx");
    const workbook = zipSync({
      "_rels/.rels": strToU8(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      ),
      "xl/workbook.xml": strToU8('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>'),
    });
    expect((await parseError(workbook)).code).toBe("not-docx");
  });

  it("calls a Word file with broken XML damaged", async () => {
    const broken = zipSync({ "word/document.xml": strToU8(`<w:document xmlns:w="${W}"><w:body><w:p><w:r><w:t>Fee</w:r></w:p>`) });
    expect((await parseError(broken)).code).toBe("corrupt");
  });

  it("returns the empty outcome for a document with no text, such as one that is only a picture", async () => {
    const picture = '<w:p><w:r><w:drawing><wp:inline xmlns:wp="urn:x"/></w:drawing></w:r></w:p><w:p/>';
    expect(await extractDocxText(docx(picture))).toEqual({ kind: "empty" });
  });
});

describe("what becomes text", () => {
  const sentence = sidecar.flags.find((f) => f.id === "auto-renewal").sourceSentence;

  it("trims a run's edges only without xml:space=preserve, and keeps entities and NBSP as encoded", async () => {
    const text = await textOf(
      '<w:p><w:r><w:t>  6.2</w:t></w:r><w:r><w:t xml:space="preserve"> This&#160;Agreement </w:t></w:r><w:r><w:t>&amp; more  </w:t></w:r></w:p>',
    );
    expect(text).toBe("6.2 This Agreement & more");
  });

  it("reads tables cell by cell, one paragraph per line", async () => {
    const cell = (/** @type {string} */ s) => `<w:tc><w:tcPr><w:tcW w:w="2000"/></w:tcPr><w:p><w:r><w:t>${s}</w:t></w:r></w:p></w:tc>`;
    const text = await textOf(`<w:tbl><w:tblPr/><w:tr>${cell("Fee")}${cell("$200")}</w:tr><w:tr>${cell("Term")}${cell("6 months")}</w:tr></w:tbl>`);
    expect(text).toBe("Fee\n$200\nTerm\n6 months");
  });

  it("shows a field's result and never its code", async () => {
    const text = await textOf(
      '<w:p><w:r><w:t xml:space="preserve">See section </w:t></w:r>' +
        '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> REF _Ref1 \\h </w:instrText></w:r>' +
        '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>6.2</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>' +
        '<w:fldSimple w:instr=" PAGE "><w:r><w:t xml:space="preserve"> on page 3</w:t></w:r></w:fldSimple></w:p>',
    );
    expect(text).toBe("See section 6.2 on page 3");
  });

  it("leaves out text boxes and the older copy Word keeps for old readers", async () => {
    const mc = ' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
    const text = await textOf(
      `<w:p><w:r><w:t>${sentence}</w:t></w:r>` +
        '<mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><w:txbxContent><w:p><w:r><w:t>BOX</w:t></w:r></w:p></w:txbxContent></w:drawing></mc:Choice>' +
        '<mc:Fallback><w:pict><w:txbxContent><w:p><w:r><w:t>BOX</w:t></w:r></w:p></w:txbxContent></w:pict></mc:Fallback></mc:AlternateContent></w:p>',
      mc,
    );
    expect(text).toBe(sentence);
  });

  it("leaves out a deleted tab or line break along with deleted text", async () => {
    const text = await textOf(
      '<w:p><w:r><w:t>Fee</w:t></w:r><w:del w:id="1"><w:r><w:tab/><w:br/><w:delText>thirty</w:delText></w:r></w:del><w:r><w:t xml:space="preserve"> due</w:t></w:r></w:p>',
    );
    expect(text).toBe("Fee due");
  });

  it("treats moved-away text as deleted, special hyphens and symbols as Word shows them", async () => {
    const text = await textOf(
      '<w:p><w:moveFrom w:id="1"><w:r><w:t>OLD</w:t></w:r></w:moveFrom><w:moveTo w:id="2"><w:r><w:t>non</w:t></w:r></w:moveTo>' +
        '<w:r><w:noBreakHyphen/><w:t>renewal</w:t><w:softHyphen/><w:sym w:font="Symbol" w:char="00A7"/><w:ptab w:alignment="right"/><w:cr/></w:r></w:p>',
    );
    expect(text).toBe("non‑renewal­§\t\n");
  });

  it("matches namespaces by URI, not by the w: prefix", async () => {
    const result = await extractDocxText(
      zipSync({
        "word/document.xml": strToU8(`<x:document xmlns:x="${W}"><x:body><x:p><x:r><x:t>${sentence}</x:t></x:r></x:p></x:body></x:document>`),
      }),
    );
    expect(result).toEqual({ kind: "text", text: sentence });
  });
});

describe("choosing a file", () => {
  it("sends a PDF to the PDF parser and a Word file to the Word parser, by what the bytes are", async () => {
    const pdfExpected = readFileSync(join(pdfDir, "compensation-ip.expected.txt"), "utf8");
    // Names and types that lie: the chooser goes by the bytes alone.
    const pdfFile = new File([readFileSync(join(pdfDir, "compensation-ip.pdf"))], "contract.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const wordFile = new File([readFileSync(join(dir, "compensation-ip.docx"))], "contract.pdf", { type: "application/pdf" });

    /** @type {string[]} */
    const formats = [];
    const fromPdf = await readChosenFile(pdfFile, { pdfjs, onFormat: (f) => formats.push(f) });
    const fromWord = await readChosenFile(wordFile, { pdfjs, onFormat: (f) => formats.push(f) });

    expect(formats).toEqual(["pdf", "docx"]);
    expect(fromPdf).toEqual({ format: "pdf", kind: "text", text: pdfExpected, pages: 2 });
    expect(fromWord).toEqual({ format: "docx", kind: "text", text: expected });
  });

  it("returns nothing about the file but its text", async () => {
    const name = "Northwind-confidential-offer.docx";
    const chosen = new File([readFileSync(join(dir, "compensation-ip.docx"))], name, { type: "application/msword" });
    const result = await readChosenFile(chosen, { pdfjs });
    expect(Object.keys(result).sort()).toEqual(["format", "kind", "text"]);
    expect(JSON.stringify(result)).not.toContain("Northwind-confidential");
    expect(JSON.stringify(result)).not.toContain("msword");
  });

  it("refuses a file that is neither, and passes the Word parser's refusals through", async () => {
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "x.pdf");
    await expect(readChosenFile(png, { pdfjs })).rejects.toMatchObject({ name: "ParseError", code: "unsupported" });
    await expect(readChosenFile(new File([file("password.docx")], "x.docx"), { pdfjs })).rejects.toMatchObject({ code: "password" });
  });
});
