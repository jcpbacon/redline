"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COPY, authErrorMessage, missingFieldMessage } from "../../lib/auth/messages.js";
import { APP_HOME } from "../../lib/auth/routes.js";
import { createServerSupabase } from "../../lib/supabase/server.js";

/*
 * Server Functions behind the sign-in page and the sign-out button.
 *
 * They run on the server, so the Supabase client writes the session straight
 * into the response's cookies; nothing about the session is handled in the
 * browser. Each one re-checks that accounts are configured rather than
 * trusting that the page which rendered the form did.
 *
 * State returned to the form:
 *   { error, email }     → show the error, keep what was typed in the email field
 *   { checkEmail, email } → sign-up worked; Supabase wants the email confirmed
 * On success they redirect, so they return nothing.
 */

/**
 * @typedef {{ error?: string, email?: string, checkEmail?: boolean }} AuthFormState
 */

/** @param {FormData} formData */
function readFields(formData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

/**
 * @param {AuthFormState} _previous
 * @param {FormData} formData
 * @returns {Promise<AuthFormState>}
 */
export async function signIn(_previous, formData) {
  const { email, password } = readFields(formData);
  const missing = missingFieldMessage({ email, password });
  if (missing) return { error: missing, email };

  const supabase = await createServerSupabase();
  if (!supabase) return { error: AUTH_COPY.signUpClosed, email };

  let failure = null;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    failure = error;
  } catch (err) {
    failure = err;
  }
  if (failure) return { error: authErrorMessage(failure), email };

  redirect(APP_HOME);
}

/**
 * Email confirmation is a Supabase project setting, so both outcomes are
 * handled: with it off, signUp returns a session and the Reader is signed in;
 * with it on, there is no session yet and the Reader is told to check their
 * email. The link in that email lands on /auth/confirm.
 *
 * @param {AuthFormState} _previous
 * @param {FormData} formData
 * @returns {Promise<AuthFormState>}
 */
export async function signUp(_previous, formData) {
  const { email, password } = readFields(formData);
  const missing = missingFieldMessage({ email, password });
  if (missing) return { error: missing, email };

  const supabase = await createServerSupabase();
  if (!supabase) return { error: AUTH_COPY.signUpClosed, email };

  let result;
  try {
    result = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm` },
    });
  } catch (err) {
    return { error: authErrorMessage(err), email };
  }

  const { data, error } = result;
  if (error) return { error: authErrorMessage(error), email };

  // With confirmation on, Supabase answers an already-registered email with a
  // user that has no identities instead of an error.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { error: AUTH_COPY.emailTaken, email };
  }

  if (data.session) redirect(APP_HOME);
  return { checkEmail: true, email };
}

export async function signOut() {
  const supabase = await createServerSupabase();
  if (supabase) {
    let failed = false;
    try {
      // Local scope: sign out this browser, not the Reader's other devices.
      const { error } = await supabase.auth.signOut({ scope: "local" });
      failed = Boolean(error);
    } catch (err) {
      console.error("Sign-out couldn't reach Supabase:", err);
      failed = true;
    }
    // If Supabase couldn't be told, still forget the session here: on a shared
    // machine, "Sign out" has to mean this browser is signed out (story 2).
    if (failed) {
      const store = await cookies();
      for (const { name } of store.getAll()) if (name.startsWith("sb-")) store.delete(name);
    }
  }
  redirect("/");
}

/** The origin this request came in on, for the confirmation link. */
async function siteOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
