import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { getSupabaseConfig } from "./config.js";

/**
 * Keeps a Reader's session alive across visits (story 3).
 *
 * Runs from the root proxy.js before every page and route renders. Supabase
 * access tokens are short-lived; reading the session here refreshes an
 * expired one with its refresh token and writes the new cookies onto both the
 * request (so this render sees them) and the response (so the browser keeps
 * them). Server Components can't write cookies, which is why this happens
 * here and not in the page.
 *
 * It refreshes and nothing more. It does not redirect or decide access: every
 * page and Server Function checks the Reader itself, and the database checks
 * again through row-level security.
 *
 * With Supabase unconfigured it passes the request through untouched.
 *
 * @param {import("next/server").NextRequest} request
 */
export async function refreshSession(request) {
  const config = getSupabaseConfig();
  if (!config) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Cache-Control and friends, so a CDN never caches a response carrying a session.
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  try {
    await supabase.auth.getClaims();
  } catch (err) {
    // Supabase unreachable: render signed-out rather than fail the page.
    console.error("Couldn't refresh the Reader's session:", err);
  }

  return response;
}
