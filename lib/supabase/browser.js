import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config.js";

/**
 * Supabase client for browser code, sharing the Reader's session with the
 * server through cookies (@supabase/ssr).
 *
 * Holds only the publishable key, which is meant to be public and is protected
 * by row-level security rather than by being secret. The secret key never
 * appears here — see `./admin.js`.
 *
 * Returns null when Supabase isn't configured for this deployment, so a
 * component can render an "accounts aren't on" state instead of crashing.
 *
 * @returns {import("@supabase/supabase-js").SupabaseClient | null}
 */
export function getBrowserSupabase() {
  const config = getSupabaseConfig();
  if (!config) return null;
  // createBrowserClient returns one shared instance per page in the browser.
  return createBrowserClient(config.url, config.publishableKey);
}
