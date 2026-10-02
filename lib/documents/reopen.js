import { questionsFromRows } from "../questions/text.js";
import { readerRedLines } from "../red-lines/index.js";
import { analysisFromRecord } from "./rows.js";

/**
 * Reopening a saved Document from the library (story 41): what
 * /documents/[id] loads and then draws.
 *
 *   loadSavedDocument(store, id) -> null | SavedDocumentRows   (database reads only)
 *   showSavedDocument(rows)      -> what DocumentView draws    (pure; throws on corrupt data)
 *
 * The most recent analysis comes back exactly as it was stored: summary,
 * ranked Flags with their Counter-offers, and the Red Lines it used. Nothing
 * here takes a model, or reaches one: reopening is reads from the database
 * (plus seeding a new Reader's Red Lines, which is a write of fixed text).
 * Running a new analysis is a separate request (lib/documents/http.js).
 *
 * null means no such Document for this Reader. Another Reader's id reads the
 * same as one that never existed or was deleted: row-level security returns
 * no row for it.
 *
 * The two halves are apart so the page can tell a database that didn't answer
 * (load throws a StoreError: "try again") from stored data that breaks
 * ADR-0001 (show throws: a stored Flag or answer quotes a sentence that isn't
 * in the stored text, and the page fails loudly rather than render it).
 */

/**
 * @typedef {{
 *   document: import("./store.js").StoredDocument,
 *   record: Record<string, any> | null,
 *   redLines: Array<{ id: string, text: string }>,
 *   questionRows: import("./store.js").QuestionRow[],
 * }} SavedDocumentRows
 */

/**
 * @param {Pick<import("./store.js").DocumentStore, "getDocument" | "latestAnalysis" | "listQuestions" | "seedRedLines" | "listRedLines">} store
 * @param {string} id
 * @returns {Promise<SavedDocumentRows | null>}
 */
export async function loadSavedDocument(store, id) {
  const document = await store.getDocument(id);
  if (!document) return null;
  const record = await store.latestAnalysis(document.id);
  const redLines = await readerRedLines(store);
  const questionRows = await store.listQuestions(document.id);
  return { document, record, redLines, questionRows };
}

/**
 * @param {SavedDocumentRows} rows
 */
export function showSavedDocument({ document, record, redLines, questionRows }) {
  return {
    document,
    analysis: analysisFromRecord(record, document.text),
    redLines,
    questions: questionsFromRows(questionRows, document.text),
  };
}
