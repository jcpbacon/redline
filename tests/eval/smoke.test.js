import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigError, saveRecording } from "../../lib/eval/pipeline.js";
import { runSmoke } from "../../scripts/smoke.mjs";
import { FABRICATED_SENTENCE, analysisFromSidecar, completion, loadSidecar } from "../helpers/stub-model.js";

/*
 * The smoke run in replay mode: the real pipeline (analysis, citation
 * verification, ranking) answering from a recorded response. env is empty, so
 * nothing can reach the network.
 */

const sidecar = loadSidecar();
const fabricated = {
  clauseType: "payment-terms",
  severity: "critical",
  sourceSentence: FABRICATED_SENTENCE,
  whatItMeans: "You pay a penalty for every late post.",
  whyDangerous: "The penalty is larger than the fee.",
  counterOffer: null,
  matchedRedLineId: null,
};

const temps = [];
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function recording(body) {
  const dir = mkdtempSync(join(tmpdir(), "redline-smoke-"));
  temps.push(dir);
  const path = join(dir, "response.json");
  writeFileSync(path, JSON.stringify(body));
  return path;
}

async function smoke(argv, env = {}) {
  const lines = [];
  const tally = await runSmoke({ argv, env, out: (line) => lines.push(line) });
  return { tally, output: lines.join("\n") };
}

describe("runSmoke --replay", () => {
  it("drops a fabricated Source Sentence and tallies what is left", async () => {
    const body = completion(analysisFromSidecar(sidecar, { extraFlags: [fabricated], matches: { "ip-assignment": "seed-1" } }));
    const { tally, output } = await smoke(["--replay", recording(body)]);

    expect(tally).toMatchObject({ proposed: 9, dropped: 1, kept: 8, plantedFound: 8, plantedTotal: 8, missedPlanted: [] });
    expect(tally.flags.map((f) => f.sourceSentence)).not.toContain(FABRICATED_SENTENCE);
    expect(tally.flags[0]).toMatchObject({ severity: "critical", redLine: { id: "seed-1" } });
    for (const planted of sidecar.flags) expect(output).toContain(`Source Sentence: ${planted.sourceSentence}`);
    expect(output).toContain("Dropped by citation verification    1");
  });

  it("counts planted clauses the model missed", async () => {
    const only = ["ip-assignment", "payment-on-acceptance", "auto-renewal"];
    const { tally } = await smoke(["--replay", recording(completion(analysisFromSidecar(sidecar, { only })))]);
    expect(tally).toMatchObject({ proposed: 3, dropped: 0, kept: 3, plantedFound: 3, plantedTotal: 8 });
    expect(tally.missedPlanted).toHaveLength(5);
  });

  it("replays a response saved by --record, which keeps no model id", async () => {
    const dir = mkdtempSync(join(tmpdir(), "redline-smoke-"));
    temps.push(dir);
    const path = join(dir, "recorded.json");
    const served = completion(analysisFromSidecar(sidecar));
    // OpenRouter names the model it served; a stand-in string, not a model id.
    served.model = "stand-in";
    saveRecording(path, served);
    expect(JSON.parse(readFileSync(path, "utf8"))).not.toHaveProperty("model");

    const { tally } = await smoke(["--replay", path]);
    expect(tally).toMatchObject({ proposed: 8, dropped: 0, kept: 8, plantedFound: 8 });
  });
});

describe("runSmoke live", () => {
  it("explains a missing key and model in one line", async () => {
    const error = await runSmoke({ argv: [], env: {}, out: () => {} }).catch((e) => e);
    expect(error).toBeInstanceOf(ConfigError);
    expect(error.message).toBe(
      "OPENROUTER_API_KEY and OPENROUTER_MODEL are not set. Add them to .env.local, or pass --replay to run against a recorded model response.",
    );
  });

  it("names only the setting that is missing", async () => {
    await expect(runSmoke({ argv: [], env: { OPENROUTER_API_KEY: "set" }, out: () => {} })).rejects.toThrow(/^OPENROUTER_MODEL is not set\./);
  });
});
