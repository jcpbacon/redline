/**
 * The longest Document Redline will read, in one place (story 12).
 *
 * The number itself is an open decision (issue #1, "Document length
 * ceiling"), so it is configuration, read from NEXT_PUBLIC_DOCUMENT_MAX_CHARACTERS:
 *
 * - unset or blank: there is no ceiling. No length is refused, here or on the
 *   server, and nothing in the code stands in for the missing number.
 * - a whole number: a Document with more characters than that is refused. The
 *   browser refuses it before any request is made; the routes that take text
 *   (/api/analyze, /api/questions, and saving a Document) refuse it too, so a
 *   request that skips the browser gets the same answer.
 * - anything else throws, naming the variable, rather than guessing.
 *
 * The NEXT_PUBLIC_ prefix is what lets the browser and the server read the
 * same value: Next inlines it into both at build time, so changing it needs a
 * rebuild. It is read with the literal `process.env.NEXT_PUBLIC_…` expression
 * on every call, because Next only inlines that exact form, and tests set it
 * per case.
 *
 * Characters are Unicode code points, so an emoji or an accented letter made
 * of one code point counts once.
 *
 * Pure; safe in browser and server code.
 */

export const CEILING_VARIABLE = "NEXT_PUBLIC_DOCUMENT_MAX_CHARACTERS";

/** @returns {number | null} the ceiling, or null when none is configured */
export function documentCeiling() {
  const raw = process.env.NEXT_PUBLIC_DOCUMENT_MAX_CHARACTERS;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const value = raw.trim();
  if (!/^[0-9]+$/.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) {
    throw new Error(`${CEILING_VARIABLE} must be a whole number of characters, or left unset for no limit. It is "${raw}".`);
  }
  return Number(value);
}

/**
 * @param {string} text
 * @returns {number} code points in `text`
 */
export function documentLength(text) {
  let count = 0;
  // eslint-disable-next-line no-unused-vars
  for (const _ of text) count++;
  return count;
}

/**
 * Check a Document's length against the ceiling: null when it may be read,
 * or the refusal, with Reader-facing copy in `error`.
 *
 * @param {string} text
 * @returns {{ length: number, limit: number, error: string } | null}
 */
export function overCeiling(text) {
  const limit = documentCeiling();
  if (limit === null) return null;
  // Cheap first: UTF-16 length is never less than the code point count.
  if (text.length <= limit) return null;
  const length = documentLength(text);
  if (length <= limit) return null;
  return { length, limit, error: tooLong(length, limit) };
}

/**
 * @param {number} length
 * @param {number} limit
 */
function tooLong(length, limit) {
  const n = (/** @type {number} */ value) => value.toLocaleString("en-US");
  return `This document is ${n(length)} characters long. Redline can read up to ${n(limit)}, so it can’t read this one.`;
}
