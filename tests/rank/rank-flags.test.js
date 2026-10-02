import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rankFlags } from "../../lib/analysis/rank.js";

/*
 * Seam 1b over fixed Flag sets (ADR-0003). No model, no stub: these Flags are
 * written out here, in the shape analyzeDocument returns.
 */

function flag(id, severity, position, matchedRedLineId = null) {
  return {
    clauseType: "payment-terms",
    severity,
    sourceSentence: `Sentence ${id}.`,
    whatItMeans: `What ${id} means.`,
    whyDangerous: `Why ${id} is dangerous.`,
    counterOffer: `Counter-offer for ${id}.`,
    matchedRedLineId,
    position,
  };
}

const ids = (flags) => flags.map((f) => f.sourceSentence.replace(/^Sentence (.*)\.$/, "$1"));

/** A Flag as it went in, without the marking ranking adds. */
const unmarked = ({ redLine, ...rest }) => rest;
const bySentence = (a, b) => a.sourceSentence.localeCompare(b.sourceSentence);

// Deliberately out of order: input order is neither severity nor Document order.
const MIXED = [
  flag("m-late", "medium", 900),
  flag("h-late", "high", 700),
  flag("c", "critical", 500),
  flag("m-early", "medium", 100, "rl-renewal"),
  flag("h-early", "high", 300),
  flag("h-mid", "high", 400, "rl-pay"),
];

const RED_LINES = [
  { id: "rl-pay", text: "I get paid within 30 days." },
  { id: "rl-renewal", text: "Nothing renews without me saying so." },
];

describe("rankFlags ordering", () => {
  it("puts the most severe Flags first", () => {
    const { flags } = rankFlags(MIXED, []);
    expect(flags.map((f) => f.severity)).toEqual(["critical", "high", "high", "high", "medium", "medium"]);
  });

  it("keeps Document order among Flags of the same severity", () => {
    const { flags } = rankFlags(MIXED, []);
    expect(ids(flags)).toEqual(["c", "h-early", "h-mid", "h-late", "m-early", "m-late"]);
  });

  it("keeps input order when two Flags share a severity and a position", () => {
    const { flags } = rankFlags([flag("second", "high", 50), flag("first", "high", 50)], []);
    expect(ids(flags)).toEqual(["second", "first"]);
  });

  it("does not change the array it was given", () => {
    const input = [...MIXED];
    rankFlags(input, RED_LINES);
    expect(input).toEqual(MIXED);
  });

  it("refuses a severity that is not on the scale", () => {
    expect(() => rankFlags([flag("x", "catastrophic", 1)], [])).toThrow(RangeError);
  });
});

describe("Red Lines promote and mark, within a severity", () => {
  it("moves a Flag that breaks a Red Line ahead of its severity peers and marks it", () => {
    const { flags } = rankFlags(MIXED, RED_LINES);
    expect(ids(flags)).toEqual(["c", "h-mid", "h-early", "h-late", "m-early", "m-late"]);
    const promoted = flags.find((f) => f.sourceSentence === "Sentence h-mid.");
    expect(promoted.redLine).toEqual({ id: "rl-pay", text: "I get paid within 30 days." });
    expect(flags.filter((f) => f.redLine !== null).map((f) => f.redLine.id).sort()).toEqual(["rl-pay", "rl-renewal"]);
  });

  it("never moves a promoted Flag above a more severe one", () => {
    const set = [flag("c", "critical", 900), flag("h-red", "high", 10, "rl-pay"), flag("m-red", "medium", 5, "rl-renewal")];
    const { flags } = rankFlags(set, RED_LINES);
    expect(ids(flags)).toEqual(["c", "h-red", "m-red"]);
    expect(flags.map((f) => f.severity)).toEqual(["critical", "high", "medium"]);
  });

  it("neither promotes nor marks a match to a Red Line that was not passed in", () => {
    const { flags } = rankFlags(MIXED, [RED_LINES[1]]);
    expect(ids(flags)).toEqual(["c", "h-early", "h-mid", "h-late", "m-early", "m-late"]);
    expect(flags.find((f) => f.sourceSentence === "Sentence h-mid.").redLine).toBeNull();
  });

  it("returns exactly the Flags it was given, with and without Red Lines", () => {
    const without = rankFlags(MIXED, []).flags;
    const withRed = rankFlags(MIXED, RED_LINES).flags;
    expect(without).toHaveLength(MIXED.length);
    expect(withRed).toHaveLength(MIXED.length);
    expect(without.map(unmarked).sort(bySentence)).toEqual([...MIXED].sort(bySentence));
    expect(withRed.map(unmarked).sort(bySentence)).toEqual([...MIXED].sort(bySentence));
    // Same severities in: Red Lines never lowered or raised one.
    expect(withRed.map(unmarked).sort(bySentence).map((f) => f.severity)).toEqual(
      without.map(unmarked).sort(bySentence).map((f) => f.severity),
    );
  });

  it("marks nothing when there are no Red Lines", () => {
    expect(rankFlags(MIXED, []).flags.every((f) => f.redLine === null)).toBe(true);
  });
});

describe("clean", () => {
  it("is true for no Flags", () => {
    expect(rankFlags([], [])).toEqual({ flags: [], clean: true });
    expect(rankFlags([], RED_LINES)).toEqual({ flags: [], clean: true });
  });

  it("is false for any Flags", () => {
    expect(rankFlags([flag("only", "medium", 0)], []).clean).toBe(false);
    expect(rankFlags(MIXED, RED_LINES).clean).toBe(false);
  });
});

describe("rank.js has no model client and no I/O", () => {
  it("imports nothing but the severity scale", () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../lib/analysis/rank.js"), "utf8");
    const imports = [...source.matchAll(/(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g)].map(
      (m) => m[1] ?? m[2] ?? m[3],
    );
    expect(imports).toEqual(["./severity.js"]);
    const severity = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../lib/analysis/severity.js"), "utf8");
    expect(severity).not.toMatch(/\bfrom\s+["']|import\(|require\(/);
  });
});
