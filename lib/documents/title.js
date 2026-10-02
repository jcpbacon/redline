/**
 * A saved Document's title, and checking what a Reader asked to save.
 *
 * Pure; safe in browser and server code. The title is the only thing here
 * that is ever trimmed. The Document's text is passed through untouched,
 * because Source Sentences are matched against exactly that string
 * (ADR-0001).
 */

/** Longest default title, in characters, before it is cut at a word. */
export const DEFAULT_TITLE_LENGTH = 80;

/** Longest title a Reader can give. Longer ones are cut, not refused. */
export const MAX_TITLE_LENGTH = 200;

export const UNTITLED = "Untitled document";

/**
 * A title from the Document's first line that has any text on it: trimmed,
 * runs of whitespace collapsed to one space, and cut at a word boundary with
 * an ellipsis if it is long.
 *
 * @param {string} text
 * @returns {string}
 */
export function defaultTitle(text) {
  if (typeof text !== "string") return UNTITLED;
  const line = text.split(/\r\n|\r|\n/).find((l) => l.trim() !== "");
  if (!line) return UNTITLED;
  const flat = line.trim().replace(/\s+/g, " ");
  return cut(flat, DEFAULT_TITLE_LENGTH);
}

/**
 * The title to store: the Reader's, trimmed and collapsed, or the default
 * when they left it blank.
 *
 * @param {unknown} given
 * @param {string} text
 */
export function titleFor(given, text) {
  const flat = typeof given === "string" ? given.trim().replace(/\s+/g, " ") : "";
  return flat === "" ? defaultTitle(text) : cut(flat, MAX_TITLE_LENGTH);
}

/**
 * Check a save request. Returns the row to insert, or an error to show.
 * `text` is returned as the very same string it was given.
 *
 * @param {{ title?: unknown, text?: unknown }} input
 * @returns {{ ok: true, title: string, text: string } | { ok: false, error: string }}
 */
export function prepareDocument(input) {
  const text = input?.text;
  if (typeof text !== "string" || text.trim() === "") {
    return { ok: false, error: "There’s no text to save. Paste the document first." };
  }
  if (text.includes("\u0000")) {
    // Postgres can't store a NUL character in text. Refuse rather than strip
    // it, which would change the Document.
    return { ok: false, error: "This text has a hidden character Redline can’t save. Copy it again from the original." };
  }
  return { ok: true, title: titleFor(input.title, text), text };
}

/**
 * Check a new title a Reader typed to rename a Document. Same rules as a title
 * given at save time (trimmed, runs of whitespace collapsed, cut at
 * MAX_TITLE_LENGTH), except that blank is refused: there is no text here to
 * take a default from, and a rename to nothing is a mistake.
 *
 * @param {unknown} given
 * @returns {{ ok: true, title: string } | { ok: false, error: string }}
 */
export function prepareTitle(given) {
  const flat = typeof given === "string" ? given.trim().replace(/\s+/g, " ") : "";
  if (flat === "") return { ok: false, error: "Give the document a name." };
  if (flat.includes("\u0000")) {
    return { ok: false, error: "That name has a hidden character Redline can’t save. Type it again." };
  }
  return { ok: true, title: cut(flat, MAX_TITLE_LENGTH) };
}

/** @param {string} value @param {number} max */
function cut(value, max) {
  const chars = Array.from(value);
  if (chars.length <= max) return value;
  const head = chars.slice(0, max - 1).join("");
  const space = head.lastIndexOf(" ");
  const base = space > max / 2 ? head.slice(0, space) : head;
  return `${base.replace(/[\s,;:.-]+$/, "")}…`;
}
