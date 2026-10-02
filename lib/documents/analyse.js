import { assertServerOnly } from "../env.js";
import { analyzeDocument } from "../analysis/index.js";
import { rankFlags } from "../analysis/rank.js";
import { getModelId } from "../openrouter/client.js";
import { readerRedLines } from "../red-lines/index.js";
import { checkedToIds, flagsToRows } from "./rows.js";

assertServerOnly("lib/documents/analyse.js");

/**
 * Analyse a saved Document by its id, and store the result.
 *
 *   analyseSavedDocument(store, documentId, { model, logDrop, modelId, signal })
 *     -> null                                   (no such Document for this Reader)
 *     -> { analysisId, summary, flags, clean, checked, redLines }
 *
 * The text comes from the database, loaded under the Reader's session, so a
 * retry after a failed run reads exactly what was saved and the Reader never
 * pastes it again (story 47). Every successful run inserts a new analyses
 * row with its Flags in one transaction (save_analysis); the newest one is
 * what the Document's page shows. A failed run stores nothing.
 *
 * The Reader's Red Lines as they are right now (seeded first for a new
 * Reader, lib/red-lines/index.js) go to the analysis and to ranking, and are
 * stored with the run as red_lines_snapshot, so the page can later say which
 * Red Lines this reading used and name a Red Line a Flag broke even after the
 * Reader edits or deletes it. They only mark and promote; the Flags are the
 * same with or without them (ADR-0003). `redLines` in the result is that
 * snapshot.
 *
 * `modelId` returns the configured model id for the analyses row; it defaults
 * to reading OPENROUTER_MODEL, and is read before the model is called so a
 * missing setting fails before any work is done.
 *
 * @param {import("./store.js").DocumentStore} store
 * @param {string} documentId
 * @param {{
 *   model?: Parameters<typeof analyzeDocument>[2]["model"],
 *   logDrop?: Parameters<typeof analyzeDocument>[2]["logDrop"],
 *   modelId?: () => string,
 *   signal?: AbortSignal,
 * }} [options]
 */
export async function analyseSavedDocument(store, documentId, { model, logDrop, modelId = getModelId, signal } = {}) {
  const document = await store.getDocument(documentId);
  if (!document) return null;

  const configuredModel = modelId();
  const redLines = await readerRedLines(store);
  const { summary, flags, checked } = await analyzeDocument(document.text, redLines, {
    model,
    logDrop,
    signal,
    documentId: document.id,
  });
  const ranked = rankFlags(flags, redLines);

  const { id } = await store.saveAnalysis({
    documentId: document.id,
    summary,
    modelId: configuredModel,
    redLinesSnapshot: redLines,
    checked: checkedToIds(checked),
    flags: flagsToRows(ranked.flags),
  });

  return { analysisId: id, summary, flags: ranked.flags, clean: ranked.clean, checked, redLines };
}
