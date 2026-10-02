import { describe, expect, it } from "vitest";
import { flagView, isDismissed } from "../../lib/analysis/flag-view.js";
import { rankFlags } from "../../lib/analysis/rank.js";
import { loadSidecar, readFixture } from "../helpers/stub-model.js";

/*
 * Story 23 and the all-dismissed criterion: which Flags the main list shows,
 * which are set aside, and whether the Document reads as clean.
 */

const contract = readFixture("adhesion-contract.txt");
const sidecar = loadSidecar();

/**
 * The planted Flags, ranked, each with a row id and no dismissal yet.
 * @returns {Array<{ id: string, dismissedAt: string | null, [key: string]: any }>}
 */
function rankedFlags() {
  const flags = sidecar.flags.map((f, i) => ({
    clauseType: f.clauseType,
    severity: f.severity,
    sourceSentence: f.sourceSentence,
    whatItMeans: f.whatItMeans,
    whyDangerous: f.whyDangerous,
    counterOffer: f.counterOffer ?? null,
    matchedRedLineId: null,
    position: contract.indexOf(f.sourceSentence),
    id: `flag-${i}`,
  }));
  return rankFlags(flags, []).flags.map((f) => ({ ...f, id: String(f.id), dismissedAt: null }));
}

const AT = "2026-10-02T10:00:00.000Z";

describe("flagView", () => {
  it("is clean only when the analysis raised no Flags", () => {
    expect(flagView([])).toEqual({ state: "clean", total: 0, visible: [], dismissed: [] });
  });

  it("shows every Flag, in ranked order, when none is dismissed", () => {
    const flags = rankedFlags();
    const view = flagView(flags);
    expect(view.state).toBe("has-visible");
    expect(view.total).toBe(flags.length);
    expect(view.visible.map((e) => e.flag)).toEqual(flags);
    expect(view.visible.map((e) => e.rank)).toEqual(flags.map((_, i) => i + 1));
    expect(view.dismissed).toEqual([]);
  });

  it("moves dismissed Flags out of the main list, keeping them retrievable with their original rank", () => {
    const flags = rankedFlags();
    flags[0] = { ...flags[0], dismissedAt: AT };
    flags[2] = { ...flags[2], dismissedAt: AT };
    const view = flagView(flags);

    expect(view.state).toBe("has-visible");
    expect(view.total).toBe(flags.length);
    expect(view.dismissed.map((e) => [e.rank, e.flag.id])).toEqual([
      [1, flags[0].id],
      [3, flags[2].id],
    ]);
    expect(view.visible.map((e) => e.rank)).toEqual(flags.map((_, i) => i + 1).filter((r) => r !== 1 && r !== 3));
    expect(view.visible.some((e) => isDismissed(e.flag))).toBe(false);
    // Nothing is lost: every Flag is in exactly one list.
    const ids = [...view.visible, ...view.dismissed].map((e) => e.flag.id).sort();
    expect(ids).toEqual(flags.map((f) => f.id).sort());
  });

  it("is all-dismissed, not clean, when the Reader dismissed every Flag", () => {
    const flags = rankedFlags().map((f) => ({ ...f, dismissedAt: AT }));
    const view = flagView(flags);
    expect(view.state).toBe("all-dismissed");
    expect(view.state).not.toBe("clean");
    expect(view.total).toBe(flags.length);
    expect(view.visible).toEqual([]);
    expect(view.dismissed.map((e) => e.flag)).toEqual(flags);
  });

  it("puts a Flag back in the list when its dismissal is cleared", () => {
    const flags = rankedFlags().map((f) => ({ ...f, dismissedAt: AT }));
    flags[1] = { ...flags[1], dismissedAt: null };
    const view = flagView(flags);
    expect(view.state).toBe("has-visible");
    expect(view.visible.map((e) => e.rank)).toEqual([2]);
  });

  it("treats Flags that were never stored (no dismissedAt) as not dismissed", () => {
    const flags = rankedFlags().map(({ id, dismissedAt, ...flag }) => /** @type {{ dismissedAt?: string | null }} */ (flag));
    expect(flagView(flags).visible).toHaveLength(flags.length);
  });
});
