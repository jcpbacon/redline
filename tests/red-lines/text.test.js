import { describe, expect, it } from "vitest";
import { SEED_RED_LINES } from "../../lib/red-lines/seed.js";
import { MAX_RED_LINE_LENGTH, RED_LINE_ERRORS, prepareRedLine, sameRedLines } from "../../lib/red-lines/text.js";

describe("prepareRedLine", () => {
  it("trims and collapses whitespace", () => {
    expect(prepareRedLine("  I keep\n my   footage.  ")).toEqual({ ok: true, text: "I keep my footage." });
  });

  it("refuses an empty or blank Red Line", () => {
    for (const text of ["", "   \n\t", undefined, null, 42]) {
      expect(prepareRedLine(text)).toEqual({ ok: false, error: RED_LINE_ERRORS.empty });
    }
  });

  it("refuses one over the limit, and accepts one at it", () => {
    expect(prepareRedLine("a".repeat(MAX_RED_LINE_LENGTH)).ok).toBe(true);
    expect(prepareRedLine("a".repeat(MAX_RED_LINE_LENGTH + 1))).toEqual({ ok: false, error: RED_LINE_ERRORS.tooLong });
  });
});

describe("sameRedLines", () => {
  const a = { id: "1", text: "One" };
  const b = { id: "2", text: "Two" };

  it("is true for the same ids and wording, in any order", () => {
    expect(sameRedLines([a, b], [b, a])).toBe(true);
    expect(sameRedLines([], [])).toBe(true);
  });

  it("is false when one was added, removed or reworded", () => {
    expect(sameRedLines([a], [a, b])).toBe(false);
    expect(sameRedLines([a, b], [a])).toBe(false);
    expect(sameRedLines([a], [{ id: "1", text: "One, reworded" }])).toBe(false);
    expect(sameRedLines([a], [{ id: "3", text: "One" }])).toBe(false);
  });
});

describe("the seed set", () => {
  it("is a list a Reader could have written: each one passes the same check, and none repeats", () => {
    expect(SEED_RED_LINES.length).toBeGreaterThan(0);
    for (const text of SEED_RED_LINES) expect(prepareRedLine(text)).toEqual({ ok: true, text });
    expect(new Set(SEED_RED_LINES).size).toBe(SEED_RED_LINES.length);
  });
});
