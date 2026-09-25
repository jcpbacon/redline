/**
 * Fail the build when a dependency carries a known critical advisory.
 *
 * This runs as part of `npm run build`, which is what Vercel runs, so a
 * critical advisory stops a deploy rather than waiting to be noticed by hand —
 * which is how the original scaffold's Next 14.x was caught.
 *
 * `npm audit --audit-level=critical` alone would do most of this, but its exit
 * code cannot distinguish "found a critical advisory" from "could not reach the
 * registry". Both should stop the build; only one of them means the code is
 * unsafe, and a build log that confuses the two wastes the next person's time.
 */

const { spawnSync } = require("node:child_process");
const { join } = require("node:path");

const projectDir = join(__dirname, "..");
// Passed as one shell string rather than a command plus an args array: npm on
// Windows is a .cmd, which Node will only run through a shell, and handing a
// shell an args array is deprecated (DEP0190). There is no user input here.
const result = spawnSync("npm audit --json", {
  cwd: projectDir,
  encoding: "utf8",
  shell: true,
  maxBuffer: 32 * 1024 * 1024,
});

if (result.error) {
  console.error(`Could not run npm audit: ${result.error.message}`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error("npm audit did not return JSON. Its output was:");
  console.error(result.stdout || result.stderr || "(nothing)");
  process.exit(1);
}

// npm reports its own failures inside the JSON rather than on stderr.
if (report.error) {
  console.error(
    `npm audit could not complete: ${report.error.summary || report.error.code || "unknown error"}`,
  );
  console.error(
    "This is not a clean result. The build stops here rather than deploying code whose advisories were never checked.",
  );
  process.exit(1);
}

const counts = report.metadata?.vulnerabilities;
if (!counts) {
  console.error("npm audit returned no vulnerability counts. Treating that as unchecked, not as clean.");
  process.exit(1);
}

const critical = counts.critical ?? 0;

if (critical > 0) {
  const names = Object.entries(report.vulnerabilities || {})
    .filter(([, v]) => v.severity === "critical")
    .map(([name]) => name);

  console.error(
    `${critical} critical advisor${critical === 1 ? "y" : "ies"} in the dependency tree${names.length ? `: ${names.join(", ")}` : ""}.`,
  );
  console.error("Run `npm audit` for the detail, then upgrade or replace the dependency.");
  process.exit(1);
}

const summary = ["high", "moderate", "low"]
  .map((level) => `${counts[level] ?? 0} ${level}`)
  .join(", ");

console.log(`No critical advisories. Also present: ${summary}.`);
