import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { loadCorpus } from "../../lib/eval/corpus.js";
import { ConfigError } from "../../lib/eval/pipeline.js";
import { MATCH_RULE } from "../../lib/eval/score.js";
import { DEFAULT_CORPUS, runEval } from "../../scripts/eval.mjs";
import { analysisFromSidecar, completion, loadSidecar, readFixture } from "../helpers/stub-model.js";

/*
 * The recall eval over the shipped corpus, replaying the shipped recordings.
 * No key: env is empty, so a live call is impossible.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RECORDED = join(ROOT, "eval", "recorded");
const sidecar = loadSidecar();

const temps = [];
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "redline-eval-"));
  temps.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function replay(argv) {
  const lines = [];
  const result = await runEval({ argv, env: {}, out: (line) => lines.push(line) });
  return { ...result, output: lines.join("\n") };
}

describe("the shipped corpus", () => {
  it("pairs each Document with labels whose sentences are in it verbatim", () => {
    const corpus = loadCorpus(DEFAULT_CORPUS);
    expect(corpus.map((d) => d.name)).toEqual(["adhesion-contract", "clean-document", "freelance-design"]);
  });

  it("holds the test fixtures unchanged, labelled with the sidecar's planted clauses", () => {
    const byName = Object.fromEntries(loadCorpus(DEFAULT_CORPUS).map((d) => [d.name, d]));
    expect(byName["adhesion-contract"].text).toBe(readFixture("adhesion-contract.txt"));
    expect(byName["adhesion-contract"].clauses.map((c) => c.sourceSentence)).toEqual(sidecar.flags.map((f) => f.sourceSentence));
    expect(byName["clean-document"].text).toBe(readFixture("clean-document.txt"));
    expect(byName["clean-document"].clauses).toEqual([]);
  });
});

describe("runEval in replay mode", () => {
  it("reports recall and the extra-Flag share per Document and overall", async () => {
    const { documents, overall, output } = await replay(["--replay", RECORDED]);
    const byName = Object.fromEntries(documents.map((d) => [d.name, d]));

    expect(byName["adhesion-contract"]).toMatchObject({ expertClauses: 8, matchedClauses: 8, recall: 1, flags: 8, extraFlags: 0, extraFlagShare: 0, dropped: 0 });
    expect(byName["clean-document"]).toMatchObject({ expertClauses: 0, recall: null, flags: 0, extraFlagShare: null });
    // Four proposed: one verbatim, one partial quote, one paraphrase (dropped), one the expert did not list.
    expect(byName["freelance-design"]).toMatchObject({ proposed: 4, dropped: 1, flags: 3, expertClauses: 3, matchedClauses: 2, extraFlags: 1 });
    expect(byName["freelance-design"].recall).toBeCloseTo(2 / 3);
    expect(overall).toMatchObject({ expertClauses: 11, matchedClauses: 10, flags: 11, extraFlags: 1 });

    expect(output).toContain(`Matching rule: ${MATCH_RULE}`);
    for (const name of ["adhesion-contract", "clean-document", "freelance-design"]) {
      expect(output).toMatch(new RegExp(`^${name}\\n  recall `, "m"));
    }
    expect(output).toContain("recall            100.0% (8/8)");
    expect(output).toContain("recall            n/a (0/0)");
    expect(output).toContain("recall            90.9% (10/11)");
  });

  it("picks up a Document added as two files, with no code change", async () => {
    const corpus = tempDir();
    const recorded = tempDir();
    cpSync(DEFAULT_CORPUS, corpus, { recursive: true });
    cpSync(RECORDED, recorded, { recursive: true });
    const only = ["ip-assignment", "auto-renewal"];
    writeFileSync(join(corpus, "second-copy.txt"), readFixture("adhesion-contract.txt"));
    writeFileSync(
      join(corpus, "second-copy.labels.json"),
      JSON.stringify({ clauses: sidecar.flags.filter((f) => only.includes(f.id) || f.id === "category-ban").map(({ sourceSentence }) => ({ sourceSentence })) }),
    );
    writeFileSync(join(recorded, "second-copy.response.json"), JSON.stringify(completion(analysisFromSidecar(sidecar, { only }))));

    const { documents } = await replay(["--corpus", corpus, "--replay", recorded]);
    expect(documents.find((d) => d.name === "second-copy")).toMatchObject({ expertClauses: 3, matchedClauses: 2, flags: 2, extraFlags: 0 });
  });

  it("refuses a labels file whose sentence is not in its Document", () => {
    const corpus = tempDir();
    writeFileSync(join(corpus, "doc.txt"), "One sentence here.");
    writeFileSync(join(corpus, "doc.labels.json"), JSON.stringify({ clauses: [{ sourceSentence: "Another sentence." }] }));
    expect(() => loadCorpus(corpus)).toThrow(/not in doc\.txt verbatim/);
  });

  it("refuses a Document with no labels file", () => {
    const corpus = tempDir();
    writeFileSync(join(corpus, "doc.txt"), "One sentence here.");
    expect(() => loadCorpus(corpus)).toThrow(/no labels file: doc/);
  });

  it("fails when a Document has no recording to replay", async () => {
    const recorded = tempDir();
    writeFileSync(join(recorded, "adhesion-contract.response.json"), readFileSync(join(RECORDED, "adhesion-contract.response.json")));
    await expect(replay(["--replay", recorded])).rejects.toThrow(/No recorded model response/);
  });
});

describe("runEval live", () => {
  it("explains a missing key and model instead of calling anything", async () => {
    await expect(runEval({ argv: [], env: {}, out: () => {} })).rejects.toThrow(ConfigError);
    await expect(runEval({ argv: [], env: { OPENROUTER_API_KEY: "set" }, out: () => {} })).rejects.toThrow(/^OPENROUTER_MODEL is not set\./);
  });
});
