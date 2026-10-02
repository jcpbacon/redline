import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeDocument } from "../../lib/analysis/index.js";
import { rankFlags } from "../../lib/analysis/rank.js";
import {
  FABRICATED_SENTENCE,
  createStubModel,
  analysisFromSidecar,
  loadSidecar,
  readFixture,
  stubReadingDocument,
} from "../helpers/stub-model.js";

/*
 * Ticket #22 through Seam 1 with the stubbed model: Red Lines go into the
 * analysis, and a Flag that breaks one carries its id; nothing else about
 * the Flags changes (ADR-0003); a Red Line with no sentence behind it
 * produces nothing (ADR-0001).
 */

const contract = readFixture("adhesion-contract.txt");
const clean = readFixture("clean-document.txt");
const sidecar = loadSidecar();

const EXCLUSIVITY = { id: "rl-exclusivity", text: "If I can't work with other brands, the list is short and ends when this job ends." };
const PAY = { id: "rl-pay", text: "I get paid by a fixed date." };
const RED_LINES = [EXCLUSIVITY, PAY];

const exclusivityEntry = sidecar.flags.find((f) => f.id === "category-ban");

beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("analyzeDocument reached the network");
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The Flags as a set: Source Sentence and severity, in a fixed order. */
const asSet = (flags) => flags.map((f) => `${f.severity} | ${f.sourceSentence}`).sort();

describe("a Flag that breaks a supplied Red Line", () => {
  it("carries that Red Line's id when the Document breaks it", async () => {
    const model = stubReadingDocument(sidecar, { matches: { "category-ban": EXCLUSIVITY.id } });
    const { flags } = await analyzeDocument(contract, RED_LINES, { model });

    const claiming = flags.filter((f) => f.matchedRedLineId === EXCLUSIVITY.id);
    expect(claiming.map((f) => f.sourceSentence)).toEqual([exclusivityEntry.sourceSentence]);
    expect(flags.filter((f) => f !== claiming[0]).every((f) => f.matchedRedLineId === null)).toBe(true);
  });

  it("is absent for a Document that doesn't break it: no Flag claims it", async () => {
    const model = stubReadingDocument(sidecar, { matches: { "category-ban": EXCLUSIVITY.id } });
    const { flags } = await analyzeDocument(clean, RED_LINES, { model });
    expect(flags.some((f) => f.matchedRedLineId === EXCLUSIVITY.id)).toBe(false);
  });

  it("has its claim cleared when the id isn't one the Reader supplied", async () => {
    const model = stubReadingDocument(sidecar, { matches: { "category-ban": "rl-somebody-else" } });
    const { flags } = await analyzeDocument(contract, RED_LINES, { model });
    const exclusivity = flags.find((f) => f.sourceSentence === exclusivityEntry.sourceSentence);
    expect(exclusivity?.matchedRedLineId).toBeNull();
    // The Flag itself stays: a bad claim costs the mark, not the Flag.
    expect(flags).toHaveLength(sidecar.flags.length);
  });

  it("can't claim a Red Line with no Reader Red Lines at all", async () => {
    const model = stubReadingDocument(sidecar, { matches: { "category-ban": EXCLUSIVITY.id } });
    const { flags } = await analyzeDocument(contract, [], { model });
    expect(flags.every((f) => f.matchedRedLineId === null)).toBe(true);
  });
});

describe("a Red Line with no supporting sentence in the Document", () => {
  it("produces no Flag: a Flag claiming it with a sentence the Document doesn't contain is dropped", async () => {
    const invented = {
      clauseType: "payment-terms",
      severity: "high",
      sourceSentence: FABRICATED_SENTENCE,
      whatItMeans: "You aren't paid by a fixed date.",
      whyDangerous: "You could wait forever.",
      counterOffer: null,
      matchedRedLineId: PAY.id,
    };
    const drops = [];
    const model = createStubModel(analysisFromSidecar(sidecar, { only: [], extraFlags: [invented] }));
    const { flags } = await analyzeDocument(clean, RED_LINES, { model, logDrop: (r) => drops.push(r) });

    expect(flags).toEqual([]);
    expect(drops.map((d) => d.sourceSentence)).toEqual([FABRICATED_SENTENCE]);
  });

  it("leaves the real Flags alone when the invented one is dropped", async () => {
    const invented = { ...analysisFromSidecar(sidecar).flags[0], sourceSentence: FABRICATED_SENTENCE, matchedRedLineId: PAY.id };
    const model = createStubModel(analysisFromSidecar(sidecar, { extraFlags: [invented] }));
    const { flags } = await analyzeDocument(contract, RED_LINES, { model, logDrop: () => {} });
    expect(flags.some((f) => f.matchedRedLineId === PAY.id)).toBe(false);
    expect(asSet(flags)).toEqual(asSet(sidecar.flags));
  });
});

describe("Red Lines rank, they never hide (ADR-0003), through the stub", () => {
  // The same stubbed output both times. With no Red Lines the claims are
  // cleared; with them they stand. Nothing else may differ.
  const payload = analysisFromSidecar(sidecar, {
    matches: { "category-ban": EXCLUSIVITY.id, "morality-clawback": PAY.id },
  });

  it("returns the same Flag set with no Red Lines and with Red Lines", async () => {
    const without = await analyzeDocument(contract, [], { model: createStubModel(payload) });
    const withRed = await analyzeDocument(contract, RED_LINES, { model: createStubModel(payload) });

    expect(asSet(withRed.flags)).toEqual(asSet(without.flags));
    expect(withRed.flags).toHaveLength(sidecar.flags.length);
    // Everything but the claim is identical, Flag for Flag.
    const strip = (flags) => flags.map(({ matchedRedLineId, ...rest }) => rest);
    expect(strip(withRed.flags)).toEqual(strip(without.flags));
  });

  it("after ranking, differs only in order and marks, and never lifts a Flag past a higher severity", async () => {
    const without = rankFlags((await analyzeDocument(contract, [], { model: createStubModel(payload) })).flags, []);
    const withRed = rankFlags(
      (await analyzeDocument(contract, RED_LINES, { model: createStubModel(payload) })).flags,
      RED_LINES,
    );

    expect(asSet(withRed.flags)).toEqual(asSet(without.flags));
    expect(without.flags.every((f) => f.redLine === null)).toBe(true);
    expect(withRed.flags.map((f) => f.severity)).toEqual(without.flags.map((f) => f.severity));

    const marked = withRed.flags.filter((f) => f.redLine !== null);
    expect(marked.map((f) => f.redLine?.text).sort()).toEqual([EXCLUSIVITY.text, PAY.text].sort());

    // The exclusivity Flag is first among the high ones, and still after the critical one.
    const highs = withRed.flags.filter((f) => f.severity === "high");
    expect(highs[0].sourceSentence).toBe(exclusivityEntry.sourceSentence);
    expect(withRed.flags[0].severity).toBe("critical");
    expect(withRed.flags.map((f) => f.sourceSentence)).not.toEqual(without.flags.map((f) => f.sourceSentence));
  });
});
