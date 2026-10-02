import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { getSupabaseConfig } from "./config.js";

/**
 * Keeps a Reader's session alive across visits (story 3), and says whether
 * the request carries one.
 *
 * Runs from the root proxy.js before every page and route renders. Supabase
 * access tokens are short-lived; reading the session here refreshes an
 * expired one with its refresh token and writes the new cookies onto both the
 * request (so this render sees them) and the response (so the browser keeps
 * them). Server Components can't write cookies, which is why this happens
 * here and not in the page.
 *
 * `signedIn` comes from the same `getClaims()` call, which verifies the JWT
 * rather than trusting the cookie. proxy.js uses it for one optimistic
 * redirect (a signed-in Reader opening `/`); it is not access control. Every
 * page and Server Function checks the Reader itself, and the database checks
 * again through row-level security.
 *
 * With Supabase unconfigured it passes the request through untouched and
 * reports nobody signed in.
 *
 * @param {import("next/server").NextRequest} request
 * @returns {Promise<{ response: NextResponse, signedIn: boolean }>}
 */
export async function refreshSession(request) {
  const config = getSupabaseConfig();
  if (!config) return { response: NextResponse.next({ request }), signedIn: false };

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

  let signedIn = false;
  try {
    const { data, error } = await supabase.auth.getClaims();
    signedIn = !error && typeof data?.claims?.sub === "string";
  } catch (err) {
    // Supabase unreachable: render signed-out rather than fail the page.
    console.error("Couldn't refresh the Reader's session:", err);
  }

  return { response, signedIn };
}

/**
 * A redirect to `path` that still carries whatever the session refresh wrote:
 * the new session cookies, so the browser doesn't lose a refreshed token on
 * the way to the app. It is marked uncacheable because it depends on who is
 * asking.
 *
 * @param {import("next/server").NextRequest} request
 * @param {NextResponse} refreshed the response refreshSession returned
 * @param {string} path a path on this site
 */
export function redirectKeepingSession(request, refreshed, path) {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  for (const cookie of refreshed.cookies.getAll()) redirect.cookies.set(cookie);
  redirect.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  return redirect;
}
