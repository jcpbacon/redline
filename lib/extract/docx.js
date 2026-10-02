import { ParseError } from "./parse-error.js";

/**
 * Seam 2: the browser parser, for Word files (.docx).
 *
 *   extractDocxText(data)
 *     -> { kind: "text", text }     the Document's text
 *     -> { kind: "empty" }          the file has no text in its body (only
 *                                   pictures, or nothing at all)
 *     throws ParseError { code }    "not-docx" | "legacy-doc" | "corrupt" | "password"
 *
 * Runs in the Reader's browser, and under Node in tests: the same code, with
 * no DOM. `data` is the file's bytes, read on the Reader's machine; nothing
 * here makes a network request, and nothing about the file (its name, size,
 * type or metadata) is returned. The text is the only thing that leaves.
 *
 * A .docx is a zip of XML parts. The zip is opened with fflate (loaded on
 * first use, so it's fetched only once a Reader chooses a Word file), and the
 * main part, word/document.xml, is walked by the small XML reader below. That
 * walk is ours rather than a library's (mammoth was the alternative) so every
 * rule about what becomes text is written down here and nowhere else.
 *
 * ## How the text is built (ADR-0001: exact text, never reflowed)
 *
 * Source Sentences are matched against this text character for character.
 *
 * Kept exactly as the file encodes them: every character of every text run
 * (w:t), in document order. Curly quotes, ligatures, dashes, non-breaking
 * spaces and soft hyphens come through as they are. Nothing is normalised,
 * collapsed, de-hyphenated or joined. XML's own rules still apply, because
 * they decide what the characters are: entities (&amp; &#8217; …) are decoded
 * and line ends in the XML source are read as "\n" (XML 1.0 §2.11).
 *
 * A text run's leading and trailing spaces are kept when it, or an element
 * around it, says xml:space="preserve" (Word writes that on every run that
 * starts or ends with a space). Without it, spaces, tabs and line ends at
 * either end of the run are dropped, which is what Word itself shows.
 *
 * Added, and only these:
 * - "\n" between paragraphs (w:p). An empty paragraph is an empty line, so a
 *   blank line in the Document is a blank line here.
 * - "\n" for a break inside a paragraph (w:br of any type, w:cr).
 * - "\t" for a tab (w:tab inside a run, w:ptab).
 * - U+2011 for a non-breaking hyphen (w:noBreakHyphen), U+00AD for an
 *   optional hyphen (w:softHyphen), and the character a w:sym names, as Word
 *   shows each one.
 *
 * Tracked changes: the text as it would read with every change accepted.
 * Inserted text (w:ins, w:moveTo) is included; deleted text (w:del,
 * w:delText, w:moveFrom) is not. A deleted paragraph mark is ignored, so the
 * two paragraphs it joined stay on separate lines.
 *
 * Fields (page numbers, cross-references, dates): their result, the text Word
 * last displayed. The field code itself (w:instrText) is never included.
 *
 * Tables: each cell's paragraphs, row by row and left to right, one per line.
 *
 * Content controls, hyperlinks and smart tags: their text, in place.
 *
 * Left out, deliberately: headers, footers, footnotes, endnotes, comments
 * (they are separate parts of the file), text inside text boxes, shapes and
 * pictures (w:drawing, w:pict, w:object), and the older copy of anything Word
 * stored twice for older readers (mc:Fallback). The confirm screen tells the
 * Reader that headers, footers, footnotes and text boxes aren't included.
 */

const WORD_NAMESPACES = new Set([
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  "http://purl.oclc.org/ooxml/wordprocessingml/main",
]);
const MARKUP_COMPATIBILITY = "http://schemas.openxmlformats.org/markup-compatibility/2006";
const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
const OFFICE_DOCUMENT_RELATIONSHIPS = [
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
  "http://purl.oclc.org/ooxml/officeDocument/relationships/officeDocument",
];

/** Word elements whose whole subtree is left out (see the header comment). */
const SKIPPED = new Set(["del", "moveFrom", "delText", "delInstrText", "instrText", "drawing", "pict", "object"]);

/** A compound file (OLE2). Encrypted .docx files and old .doc files are both one of these. */
const COMPOUND_FILE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/**
 * @typedef {{ kind: "text", text: string } | { kind: "empty" }} DocxOutcome
 */

/**
 * @param {ArrayBuffer | Uint8Array} data the file's bytes
 * @returns {Promise<DocxOutcome>}
 */
export async function extractDocxText(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  if (startsWith(bytes, COMPOUND_FILE)) throw compoundFileError(bytes);
  if (!isZip(bytes)) throw new ParseError("not-docx", "The file isn't a Word document.");

  const { unzipSync } = await import("fflate");

  /** @param {string} name */
  const read = (name) => {
    let files;
    try {
      files = unzipSync(bytes, { filter: (file) => file.name === name });
    } catch (error) {
      throw new ParseError("corrupt", "The Word file is damaged and can't be opened.", { cause: error });
    }
    return files[name] ?? null;
  };

  const mainPart = mainPartName(read("_rels/.rels"));
  const xml = read(mainPart);
  if (!xml) throw new ParseError("not-docx", "The file is a zip, but not a Word document.");

  const paragraphs = bodyParagraphs(decode(xml));
  const text = paragraphs.join("\n");
  if (text.trim() === "") return { kind: "empty" };
  return { kind: "text", text };
}

/**
 * Where the main document part is, from the package's relationships. A
 * package without them is read from word/document.xml, where Word puts it.
 *
 * @param {Uint8Array | null} rels
 */
function mainPartName(rels) {
  if (!rels) return "word/document.xml";
  let target = null;
  walk(decode(rels), {
    open(element) {
      if (element.local !== "Relationship") return;
      const type = element.attributes.get("Type");
      if (type && OFFICE_DOCUMENT_RELATIONSHIPS.includes(type) && target === null) {
        target = element.attributes.get("Target") ?? null;
      }
    },
  });
  if (!target) return "word/document.xml";
  // Targets are relative to the package root here; a leading "/" means the same.
  return target.replace(/^\/+/, "");
}

/**
 * The body's paragraphs, as text, by the rules in the header comment.
 *
 * @param {string} xml word/document.xml
 * @returns {string[]}
 */
export function bodyParagraphs(xml) {
  /** @type {string[]} */
  const paragraphs = [];
  /** @type {string | null} */
  let paragraph = null;
  let skipping = 0; // depth inside a left-out subtree
  let rootChecked = false;
  /** @type {{ preserve: boolean, raw: string } | null} */
  let run = null;

  const add = (/** @type {string} */ s) => {
    paragraph = (paragraph ?? "") + s;
  };

  walk(xml, {
    open(element) {
      if (!rootChecked) {
        rootChecked = true;
        if (!WORD_NAMESPACES.has(element.namespace) || element.local !== "document") {
          throw new ParseError("not-docx", "The file's main part isn't a Word document.");
        }
      }
      if (skipping) {
        skipping++;
        return;
      }
      if (leftOut(element)) {
        skipping = 1;
        return;
      }
      if (!WORD_NAMESPACES.has(element.namespace)) return;
      switch (element.local) {
        case "p":
          if (paragraph !== null) paragraphs.push(paragraph);
          paragraph = "";
          break;
        case "t":
          run = { preserve: element.preserve, raw: "" };
          break;
        case "br":
        case "cr":
          add("\n");
          break;
        case "tab":
        case "ptab":
          add("\t");
          break;
        case "noBreakHyphen":
          add("‑");
          break;
        case "softHyphen":
          add("­");
          break;
        case "sym": {
          const code = element.attributes.get(`${element.prefix}char`) ?? "";
          if (/^[0-9a-fA-F]{1,6}$/.test(code)) add(String.fromCodePoint(Number.parseInt(code, 16)));
          break;
        }
        default:
      }
    },
    text(s) {
      if (!skipping && run) run.raw += s;
    },
    close(element) {
      if (skipping) {
        skipping--;
        return;
      }
      if (!WORD_NAMESPACES.has(element.namespace)) return;
      if (element.local === "t" && run) {
        add(run.preserve ? run.raw : run.raw.replace(/^[ \t\n]+|[ \t\n]+$/g, ""));
        run = null;
      } else if (element.local === "p") {
        paragraphs.push(paragraph ?? "");
        paragraph = null;
      }
    },
  });
  if (!rootChecked) throw new ParseError("not-docx", "The file's main part is empty.");
  if (paragraph !== null) paragraphs.push(paragraph);
  return paragraphs;
}

/** @param {XmlElement} element */
function leftOut(element) {
  if (element.namespace === MARKUP_COMPATIBILITY) return element.local === "Fallback";
  if (!WORD_NAMESPACES.has(element.namespace)) return false;
  // Every property block (pPr, rPr, sectPr, tblPr, sdtPr …): formatting, never
  // text. pPr also holds tab stops (w:tabs/w:tab), which are not tabs in the text.
  return SKIPPED.has(element.local) || element.local.endsWith("Pr");
}

// ---- a small XML reader ------------------------------------------------------

/**
 * @typedef {{
 *   local: string,
 *   prefix: string,
 *   namespace: string,
 *   attributes: Map<string, string>,
 *   preserve: boolean,
 *   namespaces: Map<string, string>,
 * }} XmlElement
 * `prefix` is the qualified-name prefix with its colon ("w:"), or "".
 */

/**
 * Walk well-formed XML, calling back for each element and run of character
 * data. Throws ParseError "corrupt" on anything malformed. Namespaces and
 * xml:space are resolved with their scope, as XML defines them. A DOCTYPE is
 * refused: Office files never have one.
 *
 * @param {string} xml
 * @param {{ open?: (e: XmlElement) => void, close?: (e: XmlElement) => void, text?: (s: string) => void }} handlers
 */
function walk(xml, handlers) {
  const source = xml.replace(/\r\n?/g, "\n");
  /** @type {XmlElement[]} */
  const stack = [];
  let seenRoot = false;
  let i = 0;

  const corrupt = (/** @type {string} */ why) => new ParseError("corrupt", `The Word file is damaged: ${why}.`);

  while (i < source.length) {
    const lt = source.indexOf("<", i);
    const end = lt === -1 ? source.length : lt;
    if (end > i) {
      const chars = source.slice(i, end);
      if (stack.length) handlers.text?.(decodeEntities(chars, corrupt));
      else if (chars.trim() !== "") throw corrupt("text outside the root element");
    }
    if (lt === -1) break;

    if (source.startsWith("<?", lt)) {
      i = after(source, "?>", lt, corrupt);
    } else if (source.startsWith("<!--", lt)) {
      i = after(source, "-->", lt, corrupt);
    } else if (source.startsWith("<![CDATA[", lt)) {
      const close = after(source, "]]>", lt, corrupt);
      if (!stack.length) throw corrupt("character data outside the root element");
      handlers.text?.(source.slice(lt + 9, close - 3));
      i = close;
    } else if (source.startsWith("<!", lt)) {
      throw corrupt("it declares a document type");
    } else if (source[lt + 1] === "/") {
      const close = after(source, ">", lt, corrupt);
      const name = source.slice(lt + 2, close - 1).trim();
      const element = stack.pop();
      if (!element || qualified(element) !== name) throw corrupt(`</${name}> doesn't match its opening tag`);
      handlers.close?.(element);
      i = close;
    } else {
      const close = tagEnd(source, lt, corrupt);
      const selfClosing = source[close - 2] === "/";
      const body = source.slice(lt + 1, close - (selfClosing ? 2 : 1));
      if (!stack.length && seenRoot) throw corrupt("more than one root element");
      seenRoot = true;
      const element = parseTag(body, stack[stack.length - 1], corrupt);
      handlers.open?.(element);
      if (selfClosing) handlers.close?.(element);
      else stack.push(element);
      i = close;
    }
  }
  if (stack.length) throw corrupt(`<${qualified(stack[stack.length - 1])}> is never closed`);
  if (!seenRoot) throw corrupt("there is no XML in it");
}

/** @param {XmlElement} e */
function qualified(e) {
  return e.prefix + e.local;
}

/**
 * @param {string} source
 * @param {string} token
 * @param {number} from
 * @param {(why: string) => ParseError} corrupt
 */
function after(source, token, from, corrupt) {
  const at = source.indexOf(token, from);
  if (at === -1) throw corrupt("the XML stops part way through");
  return at + token.length;
}

/**
 * The index just past a start tag's ">", skipping any ">" inside quoted attribute values.
 *
 * @param {string} source
 * @param {number} lt
 * @param {(why: string) => ParseError} corrupt
 */
function tagEnd(source, lt, corrupt) {
  /** @type {string | null} */
  let quote = null;
  for (let j = lt + 1; j < source.length; j++) {
    const c = source[j];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ">") {
      return j + 1;
    } else if (c === "<") {
      break;
    }
  }
  throw corrupt("a tag is never finished");
}

const ATTRIBUTE = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;

/**
 * @param {string} body the tag between "<" and ">" (or "/>")
 * @param {XmlElement | undefined} parent
 * @param {(why: string) => ParseError} corrupt
 * @returns {XmlElement}
 */
function parseTag(body, parent, corrupt) {
  const nameMatch = /^[^\s/>]+/.exec(body);
  if (!nameMatch) throw corrupt("a tag has no name");
  const name = nameMatch[0];

  /** @type {Map<string, string>} */
  const attributes = new Map();
  let at = name.length;
  while (at < body.length) {
    const space = /\s*/y;
    space.lastIndex = at;
    space.exec(body);
    at = space.lastIndex;
    if (at >= body.length) break;
    ATTRIBUTE.lastIndex = at;
    const m = ATTRIBUTE.exec(body);
    if (!m) throw corrupt(`a <${name}> tag has a malformed attribute`);
    attributes.set(m[1], decodeEntities(m[2] ?? m[3] ?? "", corrupt));
    at = ATTRIBUTE.lastIndex;
  }

  let namespaces = parent?.namespaces ?? new Map([["xml", XML_NAMESPACE]]);
  for (const [key, value] of attributes) {
    if (key === "xmlns" || key.startsWith("xmlns:")) {
      if (namespaces === parent?.namespaces) namespaces = new Map(namespaces);
      namespaces.set(key === "xmlns" ? "" : key.slice(6), value);
    }
  }

  const colon = name.indexOf(":");
  const prefix = colon === -1 ? "" : name.slice(0, colon);
  const local = colon === -1 ? name : name.slice(colon + 1);
  const namespace = namespaces.get(prefix);
  if (namespace === undefined && prefix !== "") throw corrupt(`the prefix "${prefix}" is never declared`);

  const space = attributes.get("xml:space");
  const preserve = space === "preserve" ? true : space === "default" ? false : (parent?.preserve ?? false);

  return { local, prefix: prefix ? `${prefix}:` : "", namespace: namespace ?? "", attributes, preserve, namespaces };
}

const NAMED = /** @type {Record<string, string>} */ ({ lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" });

/**
 * @param {string} s
 * @param {(why: string) => ParseError} corrupt
 */
function decodeEntities(s, corrupt) {
  if (!s.includes("&")) return s;
  return s.replace(/&([^;&\s]*);?/g, (whole, ref) => {
    if (!whole.endsWith(";")) throw corrupt("a stray & in the text");
    if (ref in NAMED) return NAMED[ref];
    const m = /^#(?:x([0-9a-fA-F]+)|([0-9]+))$/.exec(ref);
    const code = m ? Number.parseInt(m[1] ?? m[2], m[1] ? 16 : 10) : NaN;
    if (!Number.isInteger(code) || code < 1 || code > 0x10ffff) throw corrupt(`an unknown entity &${ref};`);
    return String.fromCodePoint(code);
  });
}

/**
 * A part's bytes as text: UTF-8, or UTF-16 when it starts with that byte
 * order mark. Bytes that aren't valid in that encoding mean a damaged file.
 *
 * @param {Uint8Array} bytes
 */
function decode(bytes) {
  let encoding = "utf-8";
  if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = "utf-16le";
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = "utf-16be";
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch (error) {
    throw new ParseError("corrupt", "The Word file's text isn't readable.", { cause: error });
  }
}

// ---- signatures --------------------------------------------------------------

/** @param {Uint8Array} bytes @param {number[]} prefix */
function startsWith(bytes, prefix) {
  return bytes.length >= prefix.length && prefix.every((b, i) => bytes[i] === b);
}

/**
 * A zip: a local file header (PK\3\4) or, for an empty zip, the end of the
 * central directory (PK\5\6).
 *
 * @param {Uint8Array} bytes
 */
export function isZip(bytes) {
  return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]);
}

/** @param {Uint8Array} bytes */
export function isCompoundFile(bytes) {
  return startsWith(bytes, COMPOUND_FILE);
}

/**
 * Word saves a password-protected .docx as a compound file holding an
 * "EncryptionInfo" stream and the encrypted zip ("EncryptedPackage"); an old
 * Word 97–2003 .doc is a compound file with a "WordDocument" stream. Stream
 * names are stored in UTF-16LE in the file's directory, so they're looked for
 * as such. The contents are never decrypted or read.
 *
 * @param {Uint8Array} bytes
 */
function compoundFileError(bytes) {
  if (containsUtf16(bytes, "EncryptionInfo") || containsUtf16(bytes, "EncryptedPackage")) {
    return new ParseError("password", "The Word file is locked with a password.");
  }
  if (containsUtf16(bytes, "WordDocument")) {
    return new ParseError("legacy-doc", "The file is an old Word .doc, not a .docx.");
  }
  return new ParseError("not-docx", "The file isn't a Word document.");
}

/** @param {Uint8Array} bytes @param {string} name */
function containsUtf16(bytes, name) {
  const needle = new Uint8Array(name.length * 2);
  for (let i = 0; i < name.length; i++) needle[i * 2] = name.charCodeAt(i);
  outer: for (let i = 0; i + needle.length <= bytes.length; i++) {
    if (bytes[i] !== needle[0]) continue;
    for (let j = 1; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}
