/**
 * Whether accounts are switched on for this deployment, and with what.
 *
 * Returns `{ url, publishableKey }` when both public Supabase variables are
 * set, and null when either is missing. Null is a normal state, not an error:
 * the landing page and /read work without an account, so nothing that merely
 * renders may throw because Supabase is unconfigured. Screens that need an
 * account check for null and say so instead.
 *
 * Both `process.env.NEXT_PUBLIC_*` references are written out in full on
 * purpose. Next inlines these into the client bundle by substituting the
 * literal expression, so a dynamic lookup such as `process.env[name]` would
 * arrive in the browser as undefined. Safe to import from browser code.
 *
 * @returns {{ url: string, publishableKey: string } | null}
 */
export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!isSet(url) || !isSet(publishableKey)) return null;
  return { url: url.trim(), publishableKey: publishableKey.trim() };
}

/** @param {unknown} value @returns {value is string} */
function isSet(value) {
  return typeof value === "string" && value.trim() !== "";
}
