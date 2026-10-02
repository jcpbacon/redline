import { routeForRequest } from "./lib/auth/routes.js";
import { redirectKeepingSession, refreshSession } from "./lib/supabase/proxy.js";

/*
 * Next 16's proxy (formerly middleware). It refreshes the Reader's Supabase
 * session cookies (see lib/supabase/proxy.js) and, with the answer that
 * refresh already got, sends a signed-in Reader who opens `/` to the app home
 * before the landing page renders (story 55; lib/auth/routes.js). With
 * Supabase unconfigured it passes every request through unchanged.
 */

/** @param {import("next/server").NextRequest} request */
export async function proxy(request) {
  const { response, signedIn } = await refreshSession(request);
  const target = routeForRequest({ pathname: request.nextUrl.pathname, signedIn });
  return target ? redirectKeepingSession(request, response, target) : response;
}

export const config = {
  matcher: [
    // Everything except build output, image optimisation and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
