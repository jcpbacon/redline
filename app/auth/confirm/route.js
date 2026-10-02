import { NextResponse } from "next/server";
import { safeNextPath } from "../../../lib/auth/routes.js";
import { createServerSupabase } from "../../../lib/supabase/server.js";

/*
 * GET /auth/confirm — where the link in Supabase's confirmation email lands.
 *
 * Two link shapes reach it, depending on the project's email template:
 *   ?token_hash=…&type=email   the template Supabase recommends for server-side
 *                              auth; verified with verifyOtp
 *   ?code=…                    the default template's redirect after Supabase
 *                              has verified the email (PKCE); exchanged for a
 *                              session using the verifier cookie set at sign-up
 * Either way a successful link signs the Reader in and sends them on; a failed
 * one goes back to /sign-in with a message saying the link didn't work.
 * `next` is honoured only when it is a path on this site.
 */

const OTP_TYPES = new Set(["email", "signup", "magiclink", "recovery", "invite", "email_change"]);

/** @param {Request} request */
export async function GET(request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const failed = new URL("/sign-in?error=confirm", url.origin);

  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.redirect(new URL("/sign-in", url.origin));

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");

  try {
    if (tokenHash && type && OTP_TYPES.has(type)) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: /** @type {import("@supabase/supabase-js").EmailOtpType} */ (type),
      });
      if (!error) return NextResponse.redirect(new URL(next, url.origin));
      console.error("Email confirmation failed:", error.code ?? error.message);
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, url.origin));
      console.error("Email confirmation failed:", error.code ?? error.message);
    }
  } catch (err) {
    console.error("Email confirmation couldn't reach Supabase:", err);
  }

  return NextResponse.redirect(failed);
}
