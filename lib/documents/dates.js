/**
 * Dates as the library and a Document's page print them: "2 Oct 2026".
 *
 * Formatted on the server in UTC, so the same row prints the same date for
 * every Reader and the server render matches the browser's. A Reader far from
 * UTC can see a date one day off near midnight; the <time> element carries
 * the exact instant.
 *
 * Pure; safe in browser and server code.
 */

// Written out rather than taken from Intl, whose short month names differ
// between ICU versions ("Sep" or "Sept"), which would make the server and
// browser disagree.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** @param {string | null | undefined} iso @returns {string} */
export function formatDay(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * The line under a library entry's title.
 *
 * @param {{ savedAt: string, analysedAt: string | null }} entry
 * @returns {{ label: string, iso: string }}
 */
export function libraryDate({ savedAt, analysedAt }) {
  return analysedAt
    ? { label: `Read ${formatDay(analysedAt)}`, iso: analysedAt }
    : { label: `Saved ${formatDay(savedAt)}, not read yet`, iso: savedAt };
}
