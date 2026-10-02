import { describe, expect, it } from "vitest";
import {
  MATCH_RULE,
  formatRatio,
  scoreDocument,
  scoreOverall,
  sentencesMatch,
} from "../../lib/eval/score.js";
import { loadSidecar } from "../helpers/stub-model.js";

const sidecar = loadSidecar();
const planted = sidecar.flags.map((f) => f.sourceSentence);
const [ipSentence, paymentSentence] = planted;

// Ten distinct words; the two below share six and five of them.
const TEN = "alpha bravo charlie delta echo foxtrot golf hotel india juliet";
const SHARES_SIX = "alpha bravo charlie delta echo foxtrot kilo lima mike november oscar papa";
const SHARES_FIVE = "alpha bravo charlie delta echo kilo lima mike november oscar papa quebec";

describe("sentencesMatch", () => {
  it("matches a sentence to itself", () => {
    expect(sentencesMatch(paymentSentence, paymentSentence)).toBe(true);
  });

  it("matches when one sentence contains the other, either way round", () => {
    const part = "Brand may withhold acceptance in its sole discretion";
    expect(sentencesMatch(paymentSentence, part)).toBe(true);
    expect(sentencesMatch(part, paymentSentence)).toBe(true);
  });

  it("ignores case, curly quotes and spacing differences", () => {
    const straight = ipSentence.replace(/’/g, "'").toUpperCase().replace(/ /g, "  ");
    expect(sentencesMatch(ipSentence, straight)).toBe(true);
  });

  it("matches on word overlap at the threshold and not below it", () => {
    expect(sentencesMatch(TEN, SHARES_SIX)).toBe(true);
    expect(sentencesMatch(TEN, SHARES_FIVE)).toBe(false);
  });

  it("never matches an empty sentence", () => {
    expect(sentencesMatch("", paymentSentence)).toBe(false);
    expect(sentencesMatch("   ", "   ")).toBe(false);
  });

  it("tells the fixture's planted clauses apart, and matches none to a merely unusual clause", () => {
    planted.forEach((a, i) =>
      planted.forEach((b, j) => expect(sentencesMatch(a, b), `${sidecar.flags[i].id} vs ${sidecar.flags[j].id}`).toBe(i === j)),
    );
    for (const unusual of sidecar.notFlags) {
      expect(planted.some((p) => sentencesMatch(p, unusual))).toBe(false);
    }
  });

  it("states its threshold in the printed rule", () => {
    expect(MATCH_RULE).toMatch(/60%/);
  });
});

describe("scoreDocument", () => {
  it("scores exact matches, a miss and an extra Flag", () => {
    const score = scoreDocument(planted.slice(0, 3), [planted[0], planted[1], sidecar.notFlags[0]]);
    expect(score).toMatchObject({ expertClauses: 3, flags: 3, matchedClauses: 2, extraFlags: 1 });
    expect(score.recall).toBeCloseTo(2 / 3);
    expect(score.extraFlagShare).toBeCloseTo(1 / 3);
    expect(score.clauseMatched).toEqual([true, true, false]);
    expect(score.flagMatched).toEqual([true, true, false]);
  });

  it("counts a clause once however many Flags match it", () => {
    const score = scoreDocument([paymentSentence], [paymentSentence, "Brand may withhold acceptance in its sole discretion"]);
    expect(score).toMatchObject({ matchedClauses: 1, extraFlags: 0, recall: 1, extraFlagShare: 0 });
  });

  it("credits both clauses a single Flag spans, once each", () => {
    const both = `${ipSentence} ${paymentSentence}`;
    const score = scoreDocument([ipSentence, paymentSentence, planted[2]], [both]);
    expect(score).toMatchObject({ expertClauses: 3, flags: 1, matchedClauses: 2, extraFlags: 0, extraFlagShare: 0 });
    expect(score.recall).toBeCloseTo(2 / 3);
  });

  it("reports recall as n/a, not 100% or NaN, when the expert lists nothing", () => {
    const none = scoreDocument([], []);
    expect(none.recall).toBeNull();
    expect(none.extraFlagShare).toBeNull();
    expect(formatRatio(none.recall, none.matchedClauses, none.expertClauses)).toBe("n/a (0/0)");

    const flagged = scoreDocument([], [paymentSentence]);
    expect(flagged.recall).toBeNull();
    expect(flagged).toMatchObject({ extraFlags: 1, extraFlagShare: 1 });
  });

  it("scores no Flags as zero recall and an n/a extra-Flag share", () => {
    const score = scoreDocument(planted, []);
    expect(score).toMatchObject({ matchedClauses: 0, recall: 0, extraFlags: 0, extraFlagShare: null });
  });
});

describe("scoreOverall", () => {
  it("pools the counts across Documents", () => {
    const overall = scoreOverall([
      scoreDocument(planted, planted),
      scoreDocument([], []),
      scoreDocument(planted.slice(0, 2), [planted[0], sidecar.notFlags[0]]),
    ]);
    expect(overall).toMatchObject({ expertClauses: 10, matchedClauses: 9, flags: 10, extraFlags: 1 });
    expect(overall.recall).toBeCloseTo(0.9);
    expect(formatRatio(overall.extraFlagShare, overall.extraFlags, overall.flags)).toBe("10.0% (1/10)");
  });

  it("is n/a over an empty run", () => {
    expect(scoreOverall([])).toMatchObject({ recall: null, extraFlagShare: null });
  });
});
