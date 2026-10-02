import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { assertServerOnly } from "../env.js";
import { getSupabaseConfig } from "./config.js";

assertServerOnly("lib/supabase/server.js");

/**
 * Supabase clients for server code that runs inside a request: Server
 * Components, Server Functions and Route Handlers. The Reader's session comes
 * from the request's cookies, and every query runs as that Reader, so
 * row-level security applies. This is not the secret-key client in
 * `./admin.js`.
 *
 * Everything here returns null when Supabase isn't configured, and touches no
 * request data in that case, so a page that doesn't need an account renders
 * (and can still be prerendered) without it.
 */

/**
 * A client bound to this request's cookies, or null when accounts are off.
 * Create one per request; never share it.
 *
 * Server Components can't write cookies, so `setAll` swallows the error there.
 * That is safe because proxy.js refreshes the session on every request before
 * rendering starts. Server Functions and Route Handlers can write, and do.
 *
 * @returns {Promise<import("@supabase/supabase-js").SupabaseClient | null>}
 */
export async function createServerSupabase() {
  const config = getSupabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: proxy.js has already refreshed the session.
        }
      },
    },
  });
}

/**
 * The signed-in Reader, or null when nobody is signed in, accounts are off,
 * or Supabase can't be reached. Never throws: a page asking who is reading
 * should render signed-out rather than fail.
 *
 * Uses `getClaims()`, which verifies the session's JWT (locally when the
 * project signs with asymmetric keys, otherwise against Supabase Auth) rather
 * than trusting the cookie's contents.
 *
 * @returns {Promise<{ id: string, email: string | null } | null>}
 */
export async function getReader() {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims || typeof claims.sub !== "string") return null;
    return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
  } catch (err) {
    console.error("Couldn't read the Reader's session:", err);
    return null;
  }
}
