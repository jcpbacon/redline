import { severityOrder } from "./severity.js";

/**
 * Seam 1b: ranking (spec issue #1, ADR-0003).
 *
 *   rankFlags(flags, redLines) -> { flags, clean }
 *
 * A pure function: no model client, no I/O, no clock. Analysis assigns each
 * Flag its severity; this only orders and marks.
 *
 * - Most severe first (lib/analysis/severity.js holds the scale).
 * - Within one severity, a Flag that breaks one of the Reader's Red Lines
 *   comes first and carries `redLine: { id, text }`. It is never moved above
 *   a Flag of higher severity. Every other Flag carries `redLine: null`.
 * - Remaining ties keep Document order (`position`, the Source Sentence's
 *   index in the Document), then input order.
 * - Red Lines change order and marking only. The Flags out are exactly the
 *   Flags in, whatever Red Lines are passed (ADR-0003).
 * - `clean` is true exactly when there are no Flags. The caller shows
 *   `analyzeDocument`'s `checked` list in that case (story 46a).
 *
 * The input array and its Flags are not modified.
 *
 * @typedef {{ id: string, text: string }} RedLine
 * @typedef {{ severity: string, position: number, matchedRedLineId?: string | null, [key: string]: unknown }} UnrankedFlag
 * @param {UnrankedFlag[]} flags
 * @param {RedLine[]} [redLines]
 * @returns {{ flags: Array<UnrankedFlag & { redLine: RedLine | null }>, clean: boolean }}
 */
export function rankFlags(flags, redLines = []) {
  if (!Array.isArray(flags)) throw new TypeError("rankFlags needs an array of Flags.");
  if (!Array.isArray(redLines)) throw new TypeError("redLines must be an array.");

  const byId = new Map(redLines.map((r) => [r.id, { id: r.id, text: r.text }]));

  const entries = flags.map((flag, inputIndex) => {
    if (typeof flag?.position !== "number" || !Number.isFinite(flag.position)) {
      throw new TypeError(`Flag ${inputIndex} has no position in the Document.`);
    }
    const redLine = typeof flag.matchedRedLineId === "string" ? byId.get(flag.matchedRedLineId) ?? null : null;
    return { flag, redLine, severity: severityOrder(flag.severity), inputIndex };
  });

  entries.sort(
    (a, b) =>
      a.severity - b.severity ||
      Number(b.redLine !== null) - Number(a.redLine !== null) ||
      a.flag.position - b.flag.position ||
      a.inputIndex - b.inputIndex,
  );

  return {
    flags: entries.map(({ flag, redLine }) => ({ ...flag, redLine })),
    clean: entries.length === 0,
  };
}
