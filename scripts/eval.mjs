/**
 * The recall eval (issue #32; spec issue #1, "Seam 1 — recall eval").
 *
 *   npm run eval                          live model (OPENROUTER_API_KEY and
 *                                         OPENROUTER_MODEL from .env.local)
 *   npm run eval -- --replay eval/recorded   replay one recorded response per
 *                                         Document, no key needed
 *   npm run eval -- --record <dir>        live, and save each raw response as
 *                                         <dir>/<name>.response.json
 *   npm run eval -- --corpus <dir>        another corpus (default eval/corpus)
 *
 * Runs every Document in the corpus (lib/eval/corpus.js) through the real
 * pipeline — analyzeDocument with citation verification, then rankFlags, with
 * the seed Red Lines — and prints recall and the extra-Flag share per
 * Document and overall (lib/eval/score.js). Targets are not decided, so it
 * never fails on a low score. It exits 1 on a crash: a missing setting, a
 * missing recording, a model error, or a broken corpus.
 */

import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { callModel } from "../lib/openrouter/client.js";
import { loadCorpus } from "../lib/eval/corpus.js";
import {
  ConfigError,
  assertLiveSettings,
  createReplayModel,
  loadRecording,
  runPipeline,
  saveRecording,
  seedRedLines,
} from "../lib/eval/pipeline.js";
import { MATCH_RULE, formatRatio, scoreDocument, scoreOverall } from "../lib/eval/score.js";
import { ROOT, loadEnvLocal, parseArgs, runCli } from "./lib/cli.mjs";

export const DEFAULT_CORPUS = join(ROOT, "eval", "corpus");

/** @param {string} dir @param {string} name */
export function recordingPath(dir, name) {
  return join(dir, `${name}.response.json`);
}

/** @param {string} sentence */
function brief(sentence) {
  return sentence.length > 90 ? `${sentence.slice(0, 87)}...` : sentence;
}

/**
 * @param {{
 *   argv?: string[],
 *   env?: Record<string, string | undefined>,
 *   out?: (line: string) => void,
 * }} [options]
 */
export async function runEval({ argv = [], env = process.env, out = console.log } = {}) {
  const args = parseArgs(argv, ["--replay", "--record", "--corpus"]);
  const corpusDir = args["--corpus"] ?? DEFAULT_CORPUS;
  const replayDir = args["--replay"];
  const recordDir = args["--record"];
  if (replayDir && recordDir) throw new ConfigError("Pass --replay or --record, not both.");
  if (!replayDir) assertLiveSettings(env);

  const corpus = loadCorpus(corpusDir);
  const redLines = seedRedLines();

  out("Redline recall eval");
  out(`Corpus: ${relative(process.cwd(), corpusDir) || "."} (${corpus.length} Documents)`);
  out(replayDir ? `Model: replayed from ${relative(process.cwd(), replayDir) || "."}` : `Model: ${env.OPENROUTER_MODEL} (live, through OpenRouter)`);
  out(`Red Lines: the ${redLines.length} seed Red Lines`);
  out(`Matching rule: ${MATCH_RULE}`);
  out("Recall = expert clauses matched by a Flag / expert clauses. Extra-Flag share = Flags matching no expert clause / Flags.");
  out("Only Flags that pass citation verification count. Targets are not decided: these are numbers, not a pass or fail.");
  out("");

  const documents = [];
  for (const doc of corpus) {
    const base = replayDir ? createReplayModel(loadRecording(recordingPath(replayDir, doc.name))) : callModel;
    // Record before analysis reads the reply, so a reply analysis rejects is still kept.
    const model = async (messages, options) => {
      const body = await base(messages, options);
      if (recordDir) saveRecording(recordingPath(recordDir, doc.name), body);
      return body;
    };
    const result = await runPipeline(doc.text, { model, redLines, documentId: `eval:${doc.name}` });

    const score = scoreDocument(
      doc.clauses.map((c) => c.sourceSentence),
      result.flags.map((f) => f.sourceSentence),
    );
    documents.push({ name: doc.name, ...score, proposed: result.proposed, dropped: result.drops.length });

    out(doc.name);
    out(`  recall            ${formatRatio(score.recall, score.matchedClauses, score.expertClauses)}`);
    out(`  extra-Flag share  ${formatRatio(score.extraFlagShare, score.extraFlags, score.flags)}`);
    out(`  Flags proposed ${result.proposed}, dropped by citation verification ${result.drops.length}, kept ${result.flags.length}`);
    doc.clauses.forEach((clause, i) => {
      if (!score.clauseMatched[i]) out(`  missed: ${clause.id ?? brief(clause.sourceSentence)}`);
    });
    result.flags.forEach((flag, i) => {
      if (!score.flagMatched[i]) out(`  extra: [${flag.clauseType}] ${brief(flag.sourceSentence)}`);
    });
    out("");
  }

  const overall = scoreOverall(documents);
  out("Overall");
  out(`  recall            ${formatRatio(overall.recall, overall.matchedClauses, overall.expertClauses)}`);
  out(`  extra-Flag share  ${formatRatio(overall.extraFlagShare, overall.extraFlags, overall.flags)}`);

  return { documents, overall };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  runCli(async () => {
    if (!argv.includes("--replay")) loadEnvLocal();
    await runEval({ argv });
  });
}
