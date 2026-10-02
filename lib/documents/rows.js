import { CLAUSE_TYPES } from "../analysis/clause-types.js";
import { severityOrder } from "../analysis/severity.js";

/**
 * Ranked Flags ⇄ `flags` rows, and a stored analysis back into what the
 * screen draws.
 *
 * Pure; no I/O. Safe in browser and server code.
 *
 *   flagsToRows(rankedFlags)                    -> rows for save_analysis
 *   rowsToFlags(rows, { documentText, redLines }) -> the ranked Flags again
 *
 * Round trip: rowsToFlags(flagsToRows(rankFlags(f, r).flags), { redLines: r })
 * equals rankFlags(f, r).flags. `order_index` is the rank the Reader was
 * shown; rows come back in that order whatever order they are read in.
 *
 * `redLines` is the analysis's red_lines_snapshot, so a Flag that broke a Red
 * Line keeps showing the Red Line as it was worded when the analysis ran.
 *
 * Reading back refuses a Flag whose Source Sentence is not in the Document's
 * stored text, by throwing (ADR-0001, CLAUDE.md: fail loudly rather than
 * render it). The stored text never changes after saving, so this only fires
 * on corrupt data.
 */

/**
 * @typedef {{ id: string, text: string }} RedLine
 * @typedef {{
 *   clauseType: string,
 *   severity: string,
 *   sourceSentence: string,
 *   whatItMeans: string,
 *   whyDangerous: string,
 *   counterOffer: string | null,
 *   matchedRedLineId: string | null,
 *   position: number,
 *   redLine: RedLine | null,
 * }} RankedFlag
 * @typedef {{
 *   severity: string,
 *   clause_type: string,
 *   source_sentence: string,
 *   what_it_means: string,
 *   why_dangerous: string,
 *   counter_offer: string | null,
 *   matched_red_line_id: string | null,
 *   position: number,
 *   order_index: number,
 * }} FlagRow
 */

/**
 * @param {Array<Record<string, any>>} flags already ranked by rankFlags, in the RankedFlag shape
 * @returns {FlagRow[]}
 */
export function flagsToRows(flags) {
  if (!Array.isArray(flags)) throw new TypeError("flagsToRows needs an array of Flags.");
  return flags.map((flag, orderIndex) => {
    severityOrder(flag.severity); // throws on a level the scale doesn't have
    if (typeof flag.sourceSentence !== "string" || flag.sourceSentence.trim() === "") {
      throw new TypeError(`Flag ${orderIndex} has no Source Sentence.`);
    }
    return {
      severity: flag.severity,
      clause_type: flag.clauseType,
      source_sentence: flag.sourceSentence,
      what_it_means: flag.whatItMeans,
      why_dangerous: flag.whyDangerous,
      counter_offer: typeof flag.counterOffer === "string" && flag.counterOffer.trim() !== "" ? flag.counterOffer : null,
      matched_red_line_id: flag.matchedRedLineId ?? null,
      position: flag.position,
      order_index: orderIndex,
    };
  });
}

/**
 * @param {Array<Partial<FlagRow> & Record<string, unknown>>} rows
 * @param {{ documentText?: string, redLines?: RedLine[] }} [context]
 * @returns {RankedFlag[]}
 */
export function rowsToFlags(rows, { documentText, redLines = [] } = {}) {
  if (!Array.isArray(rows)) throw new TypeError("rowsToFlags needs an array of rows.");
  const byId = new Map((Array.isArray(redLines) ? redLines : []).map((r) => [r.id, { id: r.id, text: r.text }]));

  return [...rows]
    .sort((a, b) => Number(a.order_index) - Number(b.order_index))
    .map((row) => {
      severityOrder(String(row.severity));
      const sourceSentence = row.source_sentence;
      if (typeof sourceSentence !== "string" || sourceSentence.trim() === "") {
        throw new Error(`Stored Flag at rank ${row.order_index} has no Source Sentence.`);
      }
      if (typeof documentText === "string" && !documentText.includes(sourceSentence)) {
        throw new Error(
          `Stored Flag at rank ${row.order_index} quotes a sentence that isn't in the Document's stored text. Refusing to show it (ADR-0001).`,
        );
      }
      const matchedRedLineId = typeof row.matched_red_line_id === "string" ? row.matched_red_line_id : null;
      return {
        clauseType: String(row.clause_type),
        severity: String(row.severity),
        sourceSentence,
        whatItMeans: String(row.what_it_means),
        whyDangerous: String(row.why_dangerous),
        counterOffer: typeof row.counter_offer === "string" && row.counter_offer.trim() !== "" ? row.counter_offer : null,
        matchedRedLineId,
        position: Number(row.position),
        redLine: matchedRedLineId ? byId.get(matchedRedLineId) ?? null : null,
      };
    });
}

/**
 * The jsonb that latest_analysis() returns, as the screen wants it.
 *
 * @param {Record<string, any> | null} record
 * @param {string} documentText
 * @returns {null | {
 *   id: string,
 *   summary: string,
 *   createdAt: string,
 *   checked: Array<{ id: string, label: string }>,
 *   flags: RankedFlag[],
 *   clean: boolean,
 * }}
 */
export function analysisFromRecord(record, documentText) {
  if (!record) return null;
  const redLines = Array.isArray(record.red_lines_snapshot) ? record.red_lines_snapshot : [];
  const flags = rowsToFlags(Array.isArray(record.flags) ? record.flags : [], { documentText, redLines });
  return {
    id: String(record.id),
    summary: String(record.summary),
    createdAt: String(record.created_at),
    checked: checkedFromIds(record.checked),
    flags,
    clean: flags.length === 0,
  };
}

const CLAUSE_LABELS = new Map(CLAUSE_TYPES.map((t) => [t.id, t.label]));

/**
 * What analysis checked, as stored: clause type ids only, so a later change to
 * a label's wording shows on old analyses too.
 *
 * @param {Array<{ id: string }>} checked
 * @returns {string[]}
 */
export function checkedToIds(checked) {
  if (!Array.isArray(checked)) throw new TypeError("checked must be an array.");
  return checked.map((c) => String(c.id));
}

/**
 * @param {unknown} ids
 * @returns {Array<{ id: string, label: string }>}
 */
export function checkedFromIds(ids) {
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => ({ id: String(id), label: CLAUSE_LABELS.get(String(id)) ?? String(id) }));
}
