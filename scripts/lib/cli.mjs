/**
 * What scripts/smoke.mjs and scripts/eval.mjs share as command-line programs:
 * finding the repo, loading .env.local, reading flags, and turning a thrown
 * error into an exit code.
 */

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConfigError } from "../../lib/eval/pipeline.js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Load .env.local into process.env the way `next dev` would, without a
 * dependency (Node's own process.loadEnvFile). A variable already set in the
 * shell wins, even when it is set to nothing, so `OPENROUTER_API_KEY= npm run
 * smoke` really does run without a key. A missing .env.local is not an error;
 * the settings check that follows says what is missing.
 */
export function loadEnvLocal(path = join(ROOT, ".env.local")) {
  try {
    process.loadEnvFile(path);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

/**
 * Read `--flag value` pairs. Only the listed flags are accepted, each needs a
 * value, and paths are resolved against the working directory.
 *
 * @param {string[]} argv
 * @param {string[]} flags
 * @returns {Record<string, string>}
 */
export function parseArgs(argv, flags) {
  /** @type {Record<string, string>} */
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!flags.includes(flag)) {
      throw new ConfigError(`Unknown argument "${flag}". Accepted: ${flags.map((f) => `${f} <path>`).join(", ")}.`);
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) throw new ConfigError(`${flag} needs a path after it.`);
    args[flag] = resolve(value);
    i++;
  }
  return args;
}

/**
 * Run a script's main function and set the exit code. A ConfigError is a
 * setting or argument the person running it can fix, so it prints as one
 * line. Anything else is a crash and prints in full.
 *
 * @param {() => Promise<unknown>} main
 */
export async function runCli(main) {
  try {
    await main();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  }
}
