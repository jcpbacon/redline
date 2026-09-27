import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client for browser code.
 *
 * Holds only the publishable key, which is meant to be public and is protected
 * by row-level security rather than by being secret. The secret key never
 * appears here — see `./admin.js`.
 *
 * The two `process.env.NEXT_PUBLIC_*` references below are written out in full
 * on purpose. Next inlines these values into the client bundle at build time by
 * substituting the literal expression, so a dynamic lookup such as
 * `process.env[name]` is left untouched and arrives in the browser as
 * undefined. That is why this file does not use `required()` from `../env.js`.
 */

let client = null;

export function getBrowserSupabase() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must both be set at build time. See .env.example.",
    );
  }

  client = createClient(url, publishableKey);
  return client;
}
