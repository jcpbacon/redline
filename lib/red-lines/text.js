/**
 * Checking a Red Line a Reader wrote. Pure; safe in browser and server code.
 *
 * A Red Line is plain text. It is trimmed and its runs of whitespace are
 * collapsed (it is the Reader's own wording, not a Document, so nothing is
 * matched against it verbatim). It can't be empty, and it is capped so one
 * Red Line can't crowd the analysis prompt.
 */

export const MAX_RED_LINE_LENGTH = 300;

export const RED_LINE_ERRORS = Object.freeze({
  empty: "Write the red line first.",
  tooLong: `Keep it under ${MAX_RED_LINE_LENGTH} characters. One rule per line works best.`,
});

/**
 * @param {unknown} text
 * @returns {{ ok: true, text: string } | { ok: false, error: string }}
 */
export function prepareRedLine(text) {
  const flat = typeof text === "string" ? text.trim().replace(/\s+/g, " ") : "";
  if (flat === "") return { ok: false, error: RED_LINE_ERRORS.empty };
  if (Array.from(flat).length > MAX_RED_LINE_LENGTH) return { ok: false, error: RED_LINE_ERRORS.tooLong };
  return { ok: true, text: flat };
}

/**
 * Whether the Red Lines an analysis used are the Reader's Red Lines now:
 * the same ids with the same wording. Order doesn't matter, since ranking
 * doesn't depend on it.
 *
 * @param {Array<{ id: string, text: string }>} used  the analysis's red_lines_snapshot
 * @param {Array<{ id: string, text: string }>} current
 */
export function sameRedLines(used, current) {
  if (used.length !== current.length) return false;
  const now = new Map(current.map((r) => [r.id, r.text]));
  return used.every((r) => now.has(r.id) && now.get(r.id) === r.text);
}
