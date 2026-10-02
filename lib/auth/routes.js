/**
 * The app home, the rule for which requests skip the landing page, and the
 * guard on any "send me back to" path.
 *
 * Pure; safe in browser and server code.
 */

/**
 * The app's home: where a Reader goes after signing in or confirming their
 * email, and where a signed-in Reader who opens `/` is sent instead of the
 * landing page (story 55).
 *
 * It is the paste screen rather than the library because a Reader usually
 * arrives with a new Document in hand, and the library is one click away in
 * the nav. One home for both cases keeps sign-in and `/` from giving two
 * answers to the same question. Recorded on issue #1 and in BUILD-REPORT.md.
 */
export const APP_HOME = "/read";

/**
 * Where proxy.js sends a request before anything renders, or null to let it
 * through. Only `/` is redirected, and only for a signed-in Reader: the
 * landing page is for someone who hasn't signed in yet.
 *
 * @param {{ pathname: string, signedIn: boolean }} request
 * @returns {string | null}
 */
export function routeForRequest({ pathname, signedIn }) {
  if (pathname === "/" && signedIn) return APP_HOME;
  return null;
}

/**
 * Accept a redirect target only when it is a path on this site. Anything else
 * (another origin, a protocol-relative `//host`, a backslash trick, nothing at
 * all) falls back to APP_HOME, so a crafted confirmation link can't
 * bounce a Reader to someone else's site.
 *
 * @param {unknown} next
 * @returns {string}
 */
export function safeNextPath(next) {
  if (typeof next !== "string") return APP_HOME;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return APP_HOME;
  if (/[\u0000-\u001f]/.test(next)) return APP_HOME;
  return next;
}
