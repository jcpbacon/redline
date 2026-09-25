/**
 * Fail if this Node is not the version the repo declares.
 *
 * The version is declared once, in package.json `engines.node`. Vercel reads
 * that same field and it overrides the dashboard setting, so the build there
 * and the build here agree without the number being written down twice.
 *
 * Only the `<major>.x` form is understood. Anything else throws rather than
 * being interpreted loosely, because a range this script quietly mis-parses
 * would defeat the point of having it.
 */

const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const pkgPath = join(__dirname, "..", "package.json");
const declared = JSON.parse(readFileSync(pkgPath, "utf8")).engines?.node;

if (!declared) {
  console.error(
    "No engines.node in package.json. The Node version has to be declared there — Vercel reads it too.",
  );
  process.exit(1);
}

const match = /^(\d+)\.x$/.exec(declared.trim());
if (!match) {
  console.error(
    `engines.node is "${declared}". This check only understands the "<major>.x" form, which is what Vercel documents. Either use that form or update scripts/check-node.js to handle the range properly.`,
  );
  process.exit(1);
}

const wanted = Number(match[1]);
const running = Number(process.versions.node.split(".")[0]);

if (running !== wanted) {
  console.error(
    `Node ${running} is running, but this project builds on Node ${wanted} (engines.node "${declared}").`,
  );
  console.error(
    `Vercel will build on ${wanted}.x, so a build that passes here on ${running} proves nothing. Install Node ${wanted} — nvm: "nvm install ${wanted} && nvm use ${wanted}".`,
  );
  process.exit(1);
}

console.log(`Node ${process.versions.node} matches engines.node "${declared}".`);
