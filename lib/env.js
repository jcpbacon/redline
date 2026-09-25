/**
 * Reading configuration, and failing loudly when it is absent.
 *
 * Nothing in this project carries a default for a value the product owner has
 * not chosen. A missing variable throws at the point of use, naming itself, so
 * a misconfigured deploy fails at the boundary instead of somewhere downstream
 * where the cause is no longer visible.
 */

/** Read a variable that must be set. Throws naming the variable if it is not. */
export function required(name) {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `${name} is not set. Add it to .env.local (see .env.example) or to the deployment environment.`,
    );
  }
  return value;
}

/** Read a variable that may be absent. Returns null rather than a substitute. */
export function optional(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Guard for a module that must never reach the browser.
 *
 * `server-only` from npm does this at build time, but adding a dependency is a
 * decision CLAUDE.md reserves for the product owner, so this is the same check
 * at runtime: importing one of these modules from a Client Component throws
 * rather than shipping a service-role key or an OpenRouter key to the browser.
 */
export function assertServerOnly(moduleName) {
  if (typeof window !== "undefined") {
    throw new Error(
      `${moduleName} is server-only and was imported into browser code. It holds a secret and must not be bundled for the client.`,
    );
  }
}
