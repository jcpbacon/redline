/**
 * Where sign-in sends a Reader, and the guard on any "send me back to" path.
 *
 * Pure; safe in browser and server code.
 */

/**
 * Where a Reader goes after signing in or confirming their email. The library
 * doesn't exist yet (ticket #21), so for now it's the paste screen.
 */
export const AFTER_SIGN_IN = "/read";

/**
 * Accept a redirect target only when it is a path on this site. Anything else
 * (another origin, a protocol-relative `//host`, a backslash trick, nothing at
 * all) falls back to AFTER_SIGN_IN, so a crafted confirmation link can't
 * bounce a Reader to someone else's site.
 *
 * @param {unknown} next
 * @returns {string}
 */
export function safeNextPath(next) {
  if (typeof next !== "string") return AFTER_SIGN_IN;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return AFTER_SIGN_IN;
  if (/[\u0000-\u001f]/.test(next)) return AFTER_SIGN_IN;
  return next;
}
