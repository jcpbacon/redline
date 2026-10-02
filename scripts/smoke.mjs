/**
 * The smoke run: one Document through the real pipeline, end to end.
 *
 *   npm run smoke                       live: the real OpenRouter client, with
 *                                       OPENROUTER_API_KEY and OPENROUTER_MODEL
 *                                       from .env.local
 *   npm run smoke -- --record <file>    live, and save the raw model response
 *   npm run smoke -- --replay <file>    no network: answer with a recorded
 *                                       response instead of calling the model
 *
 * Reads tests/fixtures/adhesion-contract.txt, runs analyzeDocument (with
 * citation verification) and rankFlags with the seed Red Lines, and prints
 * the summary, every ranked Flag with its Source Sentence verbatim and its
 * Counter-offer, and a tally: Flags the model returned, Flags dropped by
 * citation verification, Flags kept, and how many of the sidecar's planted
 * clauses were found (lib/eval/score.js's rule, the same as `npm run eval`).
 *
 * A recording saved with --record goes in the shape --replay and
 * `npm run eval -- --replay` read (eval/recorded/<name>.response.json), minus
 * the model id. The API key is never printed.
 */

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { callModel } from "../lib/openrouter/client.js";
import {
  ConfigError,
  assertLiveSettings,
  createReplayModel,
  loadRecording,
  runPipeline,
  saveRecording,
  seedRedLines,
} from "../lib/eval/pipeline.js";
import { MATCH_RULE, scoreDocument } from "../lib/eval/score.js";
import { ROOT, loadEnvLocal, parseArgs, runCli } from "./lib/cli.mjs";

export const DOCUMENT_PATH = join(ROOT, "tests", "fixtures", "adhesion-contract.txt");
export const SIDECAR_PATH = join(ROOT, "tests", "fixtures", "adhesion-contract.flags.json");

/**
 * @param {{
 *   argv?: string[],
 *   env?: Record<string, string | undefined>,
 *   out?: (line: string) => void,
 * }} [options]
 */
export async function runSmoke({ argv = [], env = process.env, out = console.log } = {}) {
  const args = parseArgs(argv, ["--replay", "--record"]);
  const replayPath = args["--replay"];
  const recordPath = args["--record"];
  if (replayPath && recordPath) throw new ConfigError("Pass --replay or --record, not both.");
  if (!replayPath) assertLiveSettings(env);

  const text = readFileSync(DOCUMENT_PATH, "utf8");
  const sidecar = JSON.parse(readFileSync(SIDECAR_PATH, "utf8"));
  const redLines = seedRedLines();

  const recorded = replayPath ? loadRecording(replayPath) : null;
  const base = recorded ? createReplayModel(recorded) : callModel;
  /** @type {any} */
  let lastBody = null;
  // Record before analysis reads the reply, so a reply analysis rejects is still kept.
  const model = async (messages, options) => {
    const body = await base(messages, options);
    lastBody = body;
    if (recordPath) saveRecording(recordPath, body);
    return body;
  };

  const modelLine = recorded
    ? `replayed from ${relative(process.cwd(), replayPath)}${typeof recorded.model === "string" ? ` (recorded from ${recorded.model})` : ""}`
    : `${env.OPENROUTER_MODEL} (live, through OpenRouter)`;

  out("Redline smoke run");
  out(`Document: ${relative(process.cwd(), DOCUMENT_PATH)}`);
  out(`Model: ${modelLine}`);
  out(`Red Lines: the ${redLines.length} seed Red Lines`);

  const result = await runPipeline(text, { model, redLines, documentId: "smoke:adhesion-contract" });
  if (!recorded && typeof lastBody?.model === "string" && lastBody.model !== env.OPENROUTER_MODEL) {
    out(`OpenRouter reported serving: ${lastBody.model}`);
  }
  if (recordPath) out(`Raw model response saved to ${relative(process.cwd(), recordPath)}`);

  out("");
  out("SUMMARY");
  out(result.summary);
  out("");
  out(`FLAGS (${result.flags.length}, ranked)`);
  result.flags.forEach((flag, i) => {
    const mark = flag.redLine ? ` · breaks Red Line ${flag.redLine.id}: "${flag.redLine.text}"` : "";
    out(`${i + 1}. ${flag.severity} · ${flag.clauseType}${mark}`);
    out(`   Source Sentence: ${flag.sourceSentence}`);
    out(`   Counter-offer: ${flag.counterOffer ?? "(none drafted)"}`);
  });
  if (result.drops.length) {
    out("");
    out(`DROPPED BY CITATION VERIFICATION (${result.drops.length})`);
    for (const drop of result.drops) out(`- ${drop.severity} · ${drop.clauseType}: ${drop.sourceSentence}`);
  }

  const planted = sidecar.flags;
  const score = scoreDocument(
    planted.map((p) => p.sourceSentence),
    result.flags.map((f) => f.sourceSentence),
  );
  const tally = {
    proposed: result.proposed,
    dropped: result.drops.length,
    kept: result.flags.length,
    plantedFound: score.matchedClauses,
    plantedTotal: score.expertClauses,
    missedPlanted: planted.filter((_, i) => !score.clauseMatched[i]).map((p) => p.id),
  };

  out("");
  out("TALLY");
  out(`  Flags returned by the model         ${tally.proposed}`);
  out(`  Dropped by citation verification    ${tally.dropped}`);
  out(`  Flags kept                          ${tally.kept}`);
  out(`  Planted clauses found               ${tally.plantedFound} of ${tally.plantedTotal}`);
  if (tally.missedPlanted.length) out(`  Planted clauses missed              ${tally.missedPlanted.join(", ")}`);
  out(`  Matching rule: ${MATCH_RULE}`);

  return { ...tally, summary: result.summary, flags: result.flags };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  runCli(async () => {
    if (!argv.includes("--replay")) loadEnvLocal();
    await runSmoke({ argv });
  });
}
