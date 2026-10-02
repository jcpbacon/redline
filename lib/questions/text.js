/**
 * Questions a Reader asks about a Document, and the answers, as plain data.
 * Pure; no I/O. Safe in browser and server code.
 *
 *   prepareQuestion(text)              -> { ok: true, question } | { ok: false, error }
 *   normaliseHistory(history)          -> HistoryEntry[]   (what the model is shown)
 *   questionsFromRows(rows, document)  -> AskedQuestion[]  (oldest first)
 *
 * An answer is either grounded (`text` plus the Source Sentences it rests on,
 * `groundedIn`) or unanswerable (the Document doesn't address the question,
 * story 31). Nothing in between: an answer whose grounding can't be shown is
 * unanswerable (ADR-0001, spec "Citation enforcement").
 *
 * @typedef {{ text: string, groundedIn: string[] } | { unanswerable: true }} Answer
 * @typedef {{ question: string, text: string | null, unanswerable: boolean }} HistoryEntry
 * @typedef {{
 *   id: string | null,
 *   question: string,
 *   unanswerable: boolean,
 *   text: string | null,
 *   groundedIn: string[],
 *   askedAt: string | null,
 * }} AskedQuestion
 */

export const MAX_QUESTION_LENGTH = 1000;

/** How many earlier questions go to the model with a follow-up. */
export const HISTORY_LIMIT = 10;

/** Longest earlier answer passed back to the model as context. */
const MAX_HISTORY_ANSWER_LENGTH = 4000;

export const QUESTION_ERRORS = Object.freeze({
  empty: "Type a question first.",
  tooLong: `That question is too long. Keep it under ${MAX_QUESTION_LENGTH} characters.`,
});

/**
 * Trim the question and check it. The Reader's own wording is kept otherwise:
 * nothing is matched against it verbatim.
 *
 * @param {unknown} text
 * @returns {{ ok: true, question: string } | { ok: false, error: string }}
 */
export function prepareQuestion(text) {
  const question = typeof text === "string" ? text.trim() : "";
  if (question === "") return { ok: false, error: QUESTION_ERRORS.empty };
  if (Array.from(question).length > MAX_QUESTION_LENGTH) return { ok: false, error: QUESTION_ERRORS.tooLong };
  return { ok: true, question };
}

/**
 * Earlier questions about the same Document, as context for a follow-up:
 * the last HISTORY_LIMIT, each reduced to the question and the answer's text.
 * Entries that aren't usable are skipped rather than failing the question,
 * because an unsaved reading's history comes from the browser.
 *
 * @param {unknown} history
 * @returns {HistoryEntry[]}
 */
export function normaliseHistory(history) {
  if (!Array.isArray(history)) return [];
  /** @type {HistoryEntry[]} */
  const entries = [];
  for (const item of history) {
    if (!item || typeof item !== "object") continue;
    const prepared = prepareQuestion(item.question);
    if ("error" in prepared) continue;
    const unanswerable = item.unanswerable === true;
    const text = !unanswerable && typeof item.text === "string" && item.text.trim() !== "" ? item.text : null;
    if (!unanswerable && text === null) continue;
    entries.push({
      question: prepared.question,
      text: text === null ? null : Array.from(text).slice(0, MAX_HISTORY_ANSWER_LENGTH).join(""),
      unanswerable,
    });
  }
  return entries.slice(-HISTORY_LIMIT);
}

/**
 * Stored `questions` rows back into what the screen draws, oldest first.
 *
 * Throws when a stored grounding sentence isn't in the Document's stored text,
 * or when a row claims an answer with nothing behind it: a Source Sentence
 * that can't be shown is a bug, and the page fails loudly rather than render
 * it (ADR-0001, CLAUDE.md). The stored text never changes after saving, so
 * this only fires on corrupt data.
 *
 * @param {Array<Record<string, any>>} rows
 * @param {string} documentText
 * @returns {AskedQuestion[]}
 */
export function questionsFromRows(rows, documentText) {
  if (!Array.isArray(rows)) throw new TypeError("questionsFromRows needs an array of rows.");
  if (typeof documentText !== "string") throw new TypeError("questionsFromRows needs the Document's text.");

  return [...rows]
    // The store already orders them; this keeps that order on ties (sort is stable).
    .sort((a, b) => time(a.created_at) - time(b.created_at))
    .map((row) => {
      const unanswerable = row.unanswerable === true;
      const groundedIn = Array.isArray(row.grounded_in) ? row.grounded_in : [];
      if (!unanswerable) {
        if (typeof row.answer_text !== "string" || row.answer_text.trim() === "" || groundedIn.length === 0) {
          throw new Error(`Stored question ${row.id} has an answer with nothing behind it. Refusing to show it (ADR-0001).`);
        }
        for (const sentence of groundedIn) {
          if (typeof sentence !== "string" || sentence.trim() === "" || !documentText.includes(sentence)) {
            throw new Error(
              `Stored question ${row.id} rests on a sentence that isn't in the Document's stored text. Refusing to show it (ADR-0001).`,
            );
          }
        }
      }
      return {
        id: typeof row.id === "string" ? row.id : null,
        question: String(row.question),
        unanswerable,
        text: unanswerable ? null : row.answer_text,
        groundedIn: unanswerable ? [] : [...groundedIn],
        askedAt: row.created_at == null ? null : row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      };
    });
}

/** @param {unknown} value */
function time(value) {
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value ?? ""));
  return Number.isNaN(ms) ? 0 : ms;
}
