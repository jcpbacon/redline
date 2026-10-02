/**
 * Writes the PDF fixtures for the browser parser's tests (tests/extract/).
 *
 *   node scripts/make-fixture-pdfs.mjs
 *
 * Deterministic: the same script writes the same bytes every time (no dates,
 * no random ids), so the committed files can be regenerated and diffed.
 *
 * tests/fixtures/pdf/
 *   compensation-ip.pdf           a text PDF, two pages, of sections 3 and 4.1
 *                                 of tests/fixtures/adhesion-contract.txt
 *   compensation-ip.expected.txt  exactly what extraction must return for it
 *   scanned.pdf                   two pages, each a raster image and no text
 *   corrupt.pdf                   starts like a PDF, the rest is damaged
 *   not-a-pdf.pdf                 a PNG image renamed .pdf
 *   password.pdf                  encrypted, opens only with a password
 *
 * The text PDF places every line itself (greedy word wrap at a fixed width),
 * so the expected text is known line by line: lines inside a paragraph are
 * joined by "\n", paragraphs by a blank line, and the page break by "\n"
 * (lib/extract/pdf.js says why). Clause 3.2 is laid out on one line, so its
 * Source Sentence from the sidecar appears unbroken; clause 4.1 wraps, so its
 * sentence carries in-clause line breaks.
 *
 * pdf-lib (a devDependency) builds the text and image PDFs. The encrypted one
 * is written by hand, because pdf-lib can't encrypt.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { PDFDocument, StandardFonts } from "pdf-lib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "tests", "fixtures", "pdf");
mkdirSync(out, { recursive: true });

const contract = readFileSync(join(root, "tests", "fixtures", "adhesion-contract.txt"), "utf8");

// ---- (a) the text PDF ---------------------------------------------------

/** The paragraphs of the contract from `first` up to (not including) `stop`. */
function paragraphs(first, stop) {
  const all = contract.split("\n\n");
  const from = all.findIndex((p) => p.startsWith(first));
  const to = all.findIndex((p, i) => i > from && p.startsWith(stop));
  if (from < 0 || to < 0) throw new Error(`Couldn't find "${first}" … "${stop}" in the contract fixture.`);
  return all.slice(from, to);
}

const pages = [paragraphs("3. COMPENSATION", "4. INTELLECTUAL"), paragraphs("4. INTELLECTUAL", "4.2 ")];

const PAGE = { width: 842, height: 595 }; // A4 landscape, in points
const MARGIN = 40;
const SIZE = 9;
const LEADING = 12; // baseline to baseline inside a paragraph
const PARAGRAPH_GAP = 9; // extra space between paragraphs

const text = await PDFDocument.create({ updateMetadata: false });
const font = await text.embedFont(StandardFonts.Helvetica);
const maxWidth = PAGE.width - 2 * MARGIN;

/** Greedy word wrap. The space a line breaks at is not drawn. */
function wrap(paragraph) {
  const lines = [];
  let line = "";
  for (const word of paragraph.split(" ")) {
    const next = line === "" ? word : `${line} ${word}`;
    if (line !== "" && font.widthOfTextAtSize(next, SIZE) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  lines.push(line);
  return lines;
}

const expectedPages = [];
for (const pageParagraphs of pages) {
  const page = text.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN - SIZE;
  const laidOut = [];
  for (const paragraph of pageParagraphs) {
    const lines = wrap(paragraph);
    for (const line of lines) {
      page.drawText(line, { x: MARGIN, y, size: SIZE, font });
      y -= LEADING;
    }
    y -= PARAGRAPH_GAP;
    laidOut.push(lines.join("\n"));
  }
  expectedPages.push(laidOut.join("\n\n"));
}
const expected = expectedPages.join("\n");

// The layout must give the tests what they rely on.
const lines = expected.split("\n");
if (!lines.some((l) => l.startsWith("3.2 Brand will pay the Fee") && l.endsWith("sole discretion."))) {
  throw new Error("Clause 3.2 no longer fits on one line; widen the page or shrink the type.");
}
if (!lines.some((l) => l.startsWith("4.1 Creator hereby assigns") && !l.endsWith("developed."))) {
  throw new Error("Clause 4.1 no longer wraps; the fixture needs an in-clause line break.");
}

writeFileSync(join(out, "compensation-ip.pdf"), await text.save({ useObjectStreams: false }));
writeFileSync(join(out, "compensation-ip.expected.txt"), expected, "utf8");

// ---- (b) the scanned PDF --------------------------------------------------

/** A grey page with dark bars where lines of type would be: a picture of text, not text. */
function scanPng(width, height) {
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0; // filter: none
    const inLine = y > 40 && y < height - 40 && y % 18 < 9;
    for (let x = 0; x < width; x++) {
      const inText = x > 30 && x < width - 30 && ((x * 7 + y * 3) % 23) > 4;
      raw[y * (width + 1) + 1 + x] = inLine && inText ? 40 : 236;
    }
  }
  return png(width, height, 0, raw); // colour type 0: greyscale
}

const scanned = await PDFDocument.create({ updateMetadata: false });
for (let i = 0; i < 2; i++) {
  const image = await scanned.embedPng(scanPng(300, 420));
  const page = scanned.addPage([595, 842]);
  page.drawImage(image, { x: 0, y: 0, width: 595, height: 842 });
}
writeFileSync(join(out, "scanned.pdf"), await scanned.save({ useObjectStreams: false }));

// ---- (c) a damaged PDF, and something that isn't a PDF at all -------------

// A PDF header, then bytes that are no PDF structure at all: no objects, no
// cross-reference table, no trailer.
const damage = Buffer.alloc(2048);
for (let i = 0; i < damage.length; i++) damage[i] = (i * 151 + 7) % 251;
writeFileSync(join(out, "corrupt.pdf"), Buffer.concat([Buffer.from("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n", "latin1"), damage]));

writeFileSync(join(out, "not-a-pdf.pdf"), scanPng(40, 40));

// ---- (d) a password-protected PDF -----------------------------------------

writeFileSync(join(out, "password.pdf"), encryptedPdf("let-me-in"));

console.log(`Wrote the PDF fixtures to ${out}`);

// ---- helpers ---------------------------------------------------------------

/**
 * @param {number} width
 * @param {number} height
 * @param {number} colourType
 * @param {Buffer} raw filtered scanlines
 */
function png(width, height, colourType, raw) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = colourType;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** @param {string} type @param {Buffer} data */
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** @param {Buffer} bytes */
function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * A one-page PDF under the standard security handler, revision 2 (40-bit
 * RC4), with a user password. A reader can't open it without the password,
 * which is all the test needs; the page content is never reached.
 *
 * @param {string} userPassword
 */
function encryptedPdf(userPassword) {
  const PAD = Buffer.from(
    "28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a",
    "hex",
  );
  const padded = (/** @type {string} */ pw) => Buffer.concat([Buffer.from(pw, "latin1"), PAD]).subarray(0, 32);
  const md5 = (/** @type {Buffer[]} */ ...parts) => createHash("md5").update(Buffer.concat(parts)).digest();
  const id = md5(Buffer.from("redline password fixture"));
  const permissions = -4; // everything allowed; the password is what stops it
  const p = Buffer.alloc(4);
  p.writeInt32LE(permissions);

  const ownerKey = md5(padded("owner-of-the-fixture")).subarray(0, 5);
  const O = rc4(ownerKey, padded(userPassword));
  const key = md5(padded(userPassword), O, p, id).subarray(0, 5);
  const U = rc4(key, PAD);

  // The content stream, encrypted with this object's key (object 4, gen 0).
  const objectKey = md5(key, Buffer.from([4, 0, 0, 0, 0])).subarray(0, 10);
  const content = rc4(objectKey, Buffer.from("BT /F1 12 Tf 72 720 Td (Locked) Tj ET", "latin1"));

  const hex = (/** @type {Buffer} */ b) => `<${b.toString("hex")}>`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content.toString("latin1")}\nendstream`,
    `<< /Filter /Standard /V 1 /R 2 /O ${hex(O)} /U ${hex(U)} /P ${permissions} >>`,
  ];

  let body = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 5 0 R /ID [${hex(id)} ${hex(id)}] >>\n`;
  body += `startxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

/** @param {Buffer} key @param {Buffer} data */
function rc4(key, data) {
  const s = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const result = Buffer.alloc(data.length);
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
    result[n] = data[n] ^ s[(s[i] + s[j]) & 255];
  }
  return result;
}
