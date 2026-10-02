import { assertServerOnly } from "../env.js";
import { answerQuestion } from "./index.js";
import { questionsFromRows } from "./text.js";

assertServerOnly("lib/questions/ask.js");

/**
 * Ask a question of a saved Document, and store the question with its answer.
 *
 *   askSavedDocument(store, documentId, question, { model, logDrop, signal })
 *     -> null              (no such Document for this Reader)
 *     -> AskedQuestion     (the stored row, as the screen draws it)
 *
 * The Document's text and the earlier questions about it are read from the
 * database under the Reader's session, never from the request, so a follow-up
 * is answered in the context of what was really asked before (story 33) and
 * grounding is checked against exactly the stored text. A failed model call
 * throws (ModelError) before anything is written: nothing is stored.
 *
 * `question` must already be prepared (lib/questions/text.js prepareQuestion).
 *
 * @param {import("../documents/store.js").DocumentStore} store
 * @param {string} documentId
 * @param {string} question
 * @param {{
 *   model?: Parameters<typeof answerQuestion>[2]["model"],
 *   logDrop?: Parameters<typeof answerQuestion>[2]["logDrop"],
 *   signal?: AbortSignal,
 * }} [options]
 * @returns {Promise<import("./text.js").AskedQuestion | null>}
 */
export async function askSavedDocument(store, documentId, question, { model, logDrop, signal } = {}) {
  const document = await store.getDocument(documentId);
  if (!document) return null;

  const earlier = await store.listQuestions(document.id);
  const history = earlier.map((row) => ({
    question: row.question,
    text: row.answer_text,
    unanswerable: row.unanswerable,
  }));

  const answer = await answerQuestion(question, document.text, {
    model,
    logDrop,
    signal,
    history,
    documentId: document.id,
  });

  const row = await store.saveQuestion({ documentId: document.id, question, answer });
  return questionsFromRows([row], document.text)[0];
}
