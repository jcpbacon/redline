import { describe, expect, it } from "vitest";
import { checkedClauseTypes } from "../../lib/analysis/clause-types.js";
import { rankFlags } from "../../lib/analysis/rank.js";
import { SEVERITY_IDS } from "../../lib/analysis/severity.js";
import { analysisFromRecord, checkedFromIds, checkedToIds, flagsToRows, rowsToFlags } from "../../lib/documents/rows.js";
import { loadSidecar, readFixture } from "../helpers/stub-model.js";

/*
 * Ranked Flags ⇄ flags rows. Flags are built from the fixture sidecar in the
 * shape analyzeDocument returns, then ranked by the real rankFlags.
 */

const contract = readFixture("adhesion-contract.txt");
const sidecar = loadSidecar();

const RED_LINES = [{ id: "11111111-1111-4111-8111-111111111111", text: "I keep the rights to my work" }];

function analysedFlags() {
  // Reversed so ranking has work to do; one Counter-offer missing; one Red Line matched.
  return [...sidecar.flags].reverse().map((entry, i) => ({
    clauseType: entry.clauseType,
    severity: entry.severity,
    sourceSentence: entry.sourceSentence,
    whatItMeans: entry.whatItMeans,
    whyDangerous: entry.whyDangerous,
    counterOffer: i === 0 ? null : entry.counterOffer,
    matchedRedLineId: entry.clauseType === "ip-assignment-or-licence-scope" ? RED_LINES[0].id : null,
    position: contract.indexOf(entry.sourceSentence),
  }));
}

describe("flagsToRows → rowsToFlags", () => {
  it("round-trips the ranked Flags exactly, with Red Lines", () => {
    const ranked = rankFlags(analysedFlags(), RED_LINES).flags;
    expect(ranked.some((f) => f.counterOffer === null)).toBe(true);
    expect(ranked.some((f) => f.redLine !== null)).toBe(true);
    const back = rowsToFlags(flagsToRows(ranked), { documentText: contract, redLines: RED_LINES });
    expect(back).toEqual(ranked);
  });

  it("round-trips with no Red Lines", () => {
    const flags = analysedFlags().map((f) => ({ ...f, matchedRedLineId: null }));
    const ranked = rankFlags(flags, []).flags;
    expect(rowsToFlags(flagsToRows(ranked), { documentText: contract })).toEqual(ranked);
  });

  it("stores the rank as order_index and restores order whatever order rows come back in", () => {
    const ranked = rankFlags(analysedFlags(), RED_LINES).flags;
    const rows = flagsToRows(ranked);
    expect(rows.map((r) => r.order_index)).toEqual(ranked.map((_, i) => i));
    const shuffled = [...rows].reverse();
    expect(rowsToFlags(shuffled, { documentText: contract, redLines: RED_LINES })).toEqual(ranked);
  });

  it("stores a missing or blank Counter-offer as null", () => {
    const [flag] = rankFlags(analysedFlags(), []).flags;
    expect(flagsToRows([{ ...flag, counterOffer: "   " }])[0].counter_offer).toBeNull();
    expect(flagsToRows([{ ...flag, counterOffer: null }])[0].counter_offer).toBeNull();
  });

  it("refuses a severity the scale doesn't have, both ways", () => {
    const [flag] = rankFlags(analysedFlags(), []).flags;
    expect(() => flagsToRows([{ ...flag, severity: "low" }])).toThrow(RangeError);
    const [row] = flagsToRows([flag]);
    expect(() => rowsToFlags([{ ...row, severity: "low" }])).toThrow(RangeError);
    expect(SEVERITY_IDS).toContain(row.severity);
  });

  it("refuses to show a stored Flag whose Source Sentence isn't in the stored text", () => {
    const [row] = flagsToRows(rankFlags(analysedFlags(), []).flags);
    expect(() => rowsToFlags([{ ...row, source_sentence: "Not in the contract." }], { documentText: contract })).toThrow(
      /ADR-0001/,
    );
    expect(() => rowsToFlags([{ ...row, source_sentence: "  " }], { documentText: contract })).toThrow();
  });
});

describe("checked", () => {
  it("stores ids and reads back the labels analysis reported", () => {
    const checked = checkedClauseTypes();
    expect(checkedFromIds(checkedToIds(checked))).toEqual(checked);
  });
});

describe("analysisFromRecord", () => {
  it("turns latest_analysis's record into what the screen draws", () => {
    const ranked = rankFlags(analysedFlags(), RED_LINES).flags;
    const record = {
      id: "a",
      summary: "S",
      created_at: "2026-10-02T10:00:00+00:00",
      red_lines_snapshot: RED_LINES,
      checked: checkedToIds(checkedClauseTypes()),
      flags: flagsToRows(ranked),
    };
    expect(analysisFromRecord(record, contract)).toEqual({
      id: "a",
      summary: "S",
      createdAt: "2026-10-02T10:00:00+00:00",
      checked: checkedClauseTypes(),
      flags: ranked,
      clean: false,
      redLines: RED_LINES,
    });
  });

  it("is null when there is no analysis, and clean when there are no Flags", () => {
    expect(analysisFromRecord(null, contract)).toBeNull();
    const clean = analysisFromRecord({ id: "a", summary: "S", created_at: "t", checked: [], flags: [] }, contract);
    expect(clean?.clean).toBe(true);
    expect(clean?.flags).toEqual([]);
  });
});
