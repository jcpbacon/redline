import { refreshSession } from "./lib/supabase/proxy.js";

/*
 * Next 16's proxy (formerly middleware). Its only job is to refresh the
 * Reader's Supabase session cookies; see lib/supabase/proxy.js. With Supabase
 * unconfigured it passes every request through unchanged.
 */

/** @param {import("next/server").NextRequest} request */
export function proxy(request) {
  return refreshSession(request);
}

export const config = {
  matcher: [
    // Everything except build output, image optimisation and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
