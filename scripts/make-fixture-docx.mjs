/**
 * Writes the Word fixtures for the browser parser's tests (tests/extract/).
 *
 *   node scripts/make-fixture-docx.mjs
 *
 * Deterministic: the same script writes the same bytes every time. Every zip
 * entry carries the same fixed timestamp and the parts are written in a fixed
 * order, so the committed files can be regenerated and diffed.
 *
 * tests/fixtures/docx/
 *   compensation-ip.docx          sections 3 and 4 of tests/fixtures/adhesion-contract.txt
 *                                 as Word writes them: one paragraph each, with
 *                                 - a tab after "3.1" (and tab stops in its
 *                                   paragraph properties, which are not text);
 *                                 - a line break inside 3.3 (w:br);
 *                                 - a tracked change in 3.2: "thirty (30)" deleted,
 *                                   "ninety (90)" inserted, so the clause reads as
 *                                   the contract does only with the change applied;
 *                                 - 4.1 split over several runs, some starting or
 *                                   ending with a space (xml:space="preserve"),
 *                                   with its curly apostrophe as UTF-8;
 *                                 - an empty paragraph before section 4;
 *                                 - a header part ("CONFIDENTIAL DRAFT"), which
 *                                   extraction leaves out.
 *   compensation-ip.expected.txt  exactly what extraction must return for it
 *   corrupt.docx                  the first half of compensation-ip.docx
 *   not-a-docx.docx               a zip holding only a text file
 *   password.docx                 a compound file with the streams Word writes
 *                                 for a password-protected .docx
 *   legacy.doc                    a compound file with a WordDocument stream,
 *                                 as an old Word 97–2003 file has
 *
 * fflate (a dependency; the parser uses it to open the zip) writes the zips.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { strToU8, zipSync } from "fflate";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "tests", "fixtures", "docx");
mkdirSync(out, { recursive: true });

const contract = readFileSync(join(root, "tests", "fixtures", "adhesion-contract.txt"), "utf8");
const clause = (/** @type {string} */ start) => {
  const found = contract.split("\n\n").find((p) => p.startsWith(start));
  if (!found) throw new Error(`Couldn't find "${start}" in the contract fixture.`);
  return found;
};

/** Local time fields, so the DOS timestamp in the zip is the same in every time zone. */
const MTIME = new Date(2026, 0, 1, 0, 0, 0);

// ---- (a) the text document ---------------------------------------------------

/**
 * A paragraph is a list of pieces. Each piece is
 *   string                 a run of text
 *   { tab: true }          a tab
 *   { br: true }           a line break
 *   { del: string }        tracked deletion (not in the text)
 *   { ins: string }        tracked insertion (in the text)
 * @typedef {string | { tab: true } | { br: true } | { del: string } | { ins: string }} Piece
 */

const c31 = clause("3.1 ");
const c33 = clause("3.3 ");
const c33Break = "under this Agreement. ";
const c41 = clause("4.1 ");

/** @type {Array<{ pieces: Piece[], tabStops?: boolean }>} */
const body = [
  { pieces: ["3. COMPENSATION"] },
  { pieces: ["3.1", { tab: true }, c31.slice("3.1 ".length)], tabStops: true },
  {
    pieces: [
      "3.2 Brand will pay the Fee within ",
      { del: "thirty (30)" },
      { ins: "ninety (90)" },
      " days after Brand's written acceptance of all Deliverables, and Brand may withhold acceptance in its sole discretion.",
    ],
  },
  {
    pieces: [
      c33.slice(0, c33.indexOf(c33Break) + c33Break.length - 1),
      { br: true },
      c33.slice(c33.indexOf(c33Break) + c33Break.length),
    ],
  },
  { pieces: [clause("3.4 ")] },
  { pieces: [] },
  { pieces: ["4. INTELLECTUAL PROPERTY"] },
  {
    pieces: [
      "4.1 Creator ",
      "hereby assigns",
      " to Brand all right, title and interest in and to the Content, and grants Brand a perpetual, irrevocable, worldwide, royalty-free license to use ",
      c41.slice(c41.indexOf("Creator’s")),
    ],
  },
  { pieces: [clause("4.2 ")] },
  { pieces: [clause("4.3 ")] },
];

// The clauses that went through a change must still read as the contract does.
const textOf = (/** @type {Piece[]} */ pieces) =>
  pieces
    .map((p) => (typeof p === "string" ? p : "tab" in p ? "\t" : "br" in p ? "\n" : "ins" in p ? p.ins : ""))
    .join("");
if (textOf(body[2].pieces) !== clause("3.2 ")) throw new Error("3.2 doesn't match the contract.");
if (textOf(body[7].pieces) !== c41) throw new Error("4.1 doesn't match the contract.");

const expected = body.map((p) => textOf(p.pieces)).join("\n");

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const escape = (/** @type {string} */ s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rPr = '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr>';
const t = (/** @type {string} */ s) =>
  /^\s|\s$/.test(s) ? `<w:t xml:space="preserve">${escape(s)}</w:t>` : `<w:t>${escape(s)}</w:t>`;

let revision = 0;
const change = (/** @type {string} */ tag) =>
  `<w:${tag} w:id="${++revision}" w:author="Northwick Legal" w:date="2026-09-01T09:00:00Z">`;

/** @param {Piece} piece */
function run(piece) {
  if (typeof piece === "string") return `<w:r>${rPr}${t(piece)}</w:r>`;
  if ("tab" in piece) return `<w:r>${rPr}<w:tab/></w:r>`;
  if ("br" in piece) return `<w:r>${rPr}<w:br/></w:r>`;
  if ("del" in piece) return `${change("del")}<w:r>${rPr}<w:delText>${escape(piece.del)}</w:delText></w:r></w:del>`;
  return `${change("ins")}<w:r>${rPr}${t(piece.ins)}</w:r></w:ins>`;
}

const paragraphsXml = body
  .map(({ pieces, tabStops }) => {
    const pPr = tabStops
      ? '<w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs><w:spacing w:after="160"/></w:pPr>'
      : '<w:pPr><w:spacing w:after="160"/></w:pPr>';
    return `<w:p>${pPr}${pieces.map(run).join("")}</w:p>`;
  })
  .join("\n");

const xmlHead = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

const documentXml =
  xmlHead +
  `<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>\n${paragraphsXml}\n` +
  '<w:sectPr><w:headerReference w:type="default" r:id="rId1"/><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>' +
  "</w:body></w:document>";

const headerXml =
  xmlHead + `<w:hdr xmlns:w="${W}"><w:p><w:r><w:t>CONFIDENTIAL DRAFT</w:t></w:r></w:p></w:hdr>`;

const contentTypes =
  xmlHead +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
  "</Types>";

const packageRels =
  xmlHead +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  `<Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/>` +
  "</Relationships>";

const documentRels =
  xmlHead +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  `<Relationship Id="rId1" Type="${R}/header" Target="header1.xml"/>` +
  "</Relationships>";

/** @param {Record<string, string>} parts */
const zip = (parts) =>
  zipSync(
    Object.fromEntries(Object.entries(parts).map(([name, text]) => [name, [strToU8(text), { mtime: MTIME, level: 9 }]])),
  );

const docx = zip({
  "[Content_Types].xml": contentTypes,
  "_rels/.rels": packageRels,
  "word/document.xml": documentXml,
  "word/_rels/document.xml.rels": documentRels,
  "word/header1.xml": headerXml,
});

writeFileSync(join(out, "compensation-ip.docx"), docx);
writeFileSync(join(out, "compensation-ip.expected.txt"), expected);

// ---- (b) the refusals ----------------------------------------------------------

writeFileSync(join(out, "corrupt.docx"), docx.subarray(0, Math.floor(docx.length / 2)));
writeFileSync(join(out, "not-a-docx.docx"), zip({ "notes.txt": "Shopping list: milk, eggs, bread.\n" }));
writeFileSync(join(out, "password.docx"), compoundFile(["EncryptionInfo", "EncryptedPackage"]));
writeFileSync(join(out, "legacy.doc"), compoundFile(["WordDocument", "1Table"]));

console.log(`Wrote the Word fixtures to ${out}`);

// ---- helpers ---------------------------------------------------------------

/**
 * A minimal compound file (OLE2, version 3, 512-byte sectors): a header, one
 * FAT sector and one directory sector holding the root entry and an empty
 * stream for each name. Enough for anything that reads the signature and the
 * directory, which is all the parser does.
 *
 * @param {string[]} streams
 */
function compoundFile(streams) {
  const SECTOR = 512;
  const FREE = 0xffffffff;
  const END_OF_CHAIN = 0xfffffffe;
  const FAT_SECTOR = 0xfffffffd;
  const header = Buffer.alloc(SECTOR, 0);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(header, 0);
  header.writeUInt16LE(0x3e, 24); // minor version
  header.writeUInt16LE(3, 26); // major version
  header.writeUInt16LE(0xfffe, 28); // byte order
  header.writeUInt16LE(9, 30); // sector shift: 512
  header.writeUInt16LE(6, 32); // mini sector shift: 64
  header.writeUInt32LE(1, 44); // FAT sectors
  header.writeUInt32LE(1, 48); // first directory sector
  header.writeUInt32LE(4096, 56); // mini stream cutoff
  header.writeUInt32LE(END_OF_CHAIN, 60); // first mini FAT sector
  header.writeUInt32LE(0, 64); // mini FAT sectors
  header.writeUInt32LE(END_OF_CHAIN, 68); // first DIFAT sector
  header.writeUInt32LE(0, 72); // DIFAT sectors
  header.writeUInt32LE(0, 76); // DIFAT[0]: the FAT is sector 0
  for (let i = 1; i < 109; i++) header.writeUInt32LE(FREE, 76 + i * 4);

  const fat = Buffer.alloc(SECTOR, 0xff);
  fat.writeUInt32LE(FAT_SECTOR, 0);
  fat.writeUInt32LE(END_OF_CHAIN, 4);

  const directory = Buffer.alloc(SECTOR, 0);
  const entry = (/** @type {number} */ index, /** @type {string} */ name, /** @type {number} */ type, /** @type {number} */ child, /** @type {number} */ right) => {
    const at = index * 128;
    Buffer.from(`${name}\0`, "utf16le").copy(directory, at);
    directory.writeUInt16LE((name.length + 1) * 2, at + 64);
    directory[at + 66] = type; // 5 root, 2 stream
    directory[at + 67] = 1; // black
    directory.writeUInt32LE(FREE, at + 68); // left sibling
    directory.writeUInt32LE(right, at + 72); // right sibling
    directory.writeUInt32LE(child, at + 76); // child
    directory.writeUInt32LE(END_OF_CHAIN, at + 116); // starting sector
    directory.writeUInt32LE(0, at + 120); // size
  };
  entry(0, "Root Entry", 5, 1, FREE);
  streams.forEach((name, i) => entry(i + 1, name, 2, FREE, i + 2 <= streams.length ? i + 2 : FREE));
  for (let i = streams.length + 1; i < 4; i++) {
    const at = i * 128;
    directory.writeUInt32LE(FREE, at + 68);
    directory.writeUInt32LE(FREE, at + 72);
    directory.writeUInt32LE(FREE, at + 76);
  }
  return Buffer.concat([header, fat, directory]);
}
