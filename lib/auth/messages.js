/**
 * What a Reader is told when signing in or creating an account goes wrong.
 *
 * A pure function from a Supabase Auth error (or a missing field) to a
 * sentence. It never passes Supabase's own message through: that text is
 * written for developers, can change between versions, and isn't ours to
 * show. Unknown errors get the generic line.
 *
 * Safe to import from browser code: no imports, no I/O.
 */

export const AUTH_COPY = Object.freeze({
  missingEmail: "Enter your email address.",
  missingPassword: "Enter a password.",
  invalidEmail: "That doesn’t look like an email address. Check it for typos.",
  wrongPassword: "That email and password don’t match. Check both and try again.",
  emailTaken: "There’s already an account with that email. Sign in instead.",
  weakPassword: "Pick a longer password that’s harder to guess.",
  passwordTooShort: (/** @type {number} */ min) => `Your password needs at least ${min} characters.`,
  passwordBreached: "That password has shown up in a data breach. Choose a different one.",
  passwordNeedsVariety: "Mix letters, numbers and symbols in your password.",
  notConfirmed: "Confirm your email first. Open the link we sent you, then sign in.",
  tooManyAttempts: "Too many tries in a short time. Wait a minute and try again.",
  signUpClosed: "New accounts can’t be created right now.",
  network: "Couldn’t reach the sign-in service. Check your connection and try again.",
  generic: "Something went wrong. Try again in a moment.",
  confirmFailed:
    "That confirmation link didn’t work. It may have expired or been used already. Try signing in, and if that fails, create the account again to get a new link.",
});

/**
 * @typedef {{ code?: string, name?: string, status?: number, message?: string, reasons?: string[] }} AuthErrorLike
 */

/**
 * @param {AuthErrorLike | null | undefined} error
 * @returns {string}
 */
export function authErrorMessage(error) {
  if (!error) return AUTH_COPY.generic;

  if (isNetworkError(error)) return AUTH_COPY.network;

  switch (error.code) {
    case "invalid_credentials":
      return AUTH_COPY.wrongPassword;
    case "email_exists":
    case "user_already_exists":
    case "identity_already_exists":
      return AUTH_COPY.emailTaken;
    case "weak_password":
      return weakPasswordMessage(error);
    case "email_not_confirmed":
      return AUTH_COPY.notConfirmed;
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return AUTH_COPY.tooManyAttempts;
    case "email_address_invalid":
    case "email_address_not_authorized":
      return AUTH_COPY.invalidEmail;
    case "signup_disabled":
    case "email_provider_disabled":
    case "provider_disabled":
      return AUTH_COPY.signUpClosed;
    case "validation_failed":
      return /email/i.test(error.message ?? "") ? AUTH_COPY.invalidEmail : AUTH_COPY.generic;
    default:
      if (error.status === 429) return AUTH_COPY.tooManyAttempts;
      return AUTH_COPY.generic;
  }
}

/**
 * Check the form before calling Supabase, so an empty field gets a specific
 * message instead of a round trip. Returns null when both fields are present.
 *
 * @param {{ email: string, password: string }} fields
 * @returns {string | null}
 */
export function missingFieldMessage({ email, password }) {
  if (email.trim() === "") return AUTH_COPY.missingEmail;
  if (password === "") return AUTH_COPY.missingPassword;
  return null;
}

/** @param {AuthErrorLike} error */
function weakPasswordMessage(error) {
  const reasons = Array.isArray(error.reasons) ? error.reasons : [];
  if (reasons.includes("pwned")) return AUTH_COPY.passwordBreached;
  if (reasons.includes("length")) {
    const min = /at least (\d+) characters/i.exec(error.message ?? "")?.[1];
    return min ? AUTH_COPY.passwordTooShort(Number(min)) : AUTH_COPY.weakPassword;
  }
  if (reasons.includes("characters")) return AUTH_COPY.passwordNeedsVariety;
  return AUTH_COPY.weakPassword;
}

/** @param {AuthErrorLike} error */
function isNetworkError(error) {
  if (error.name === "AuthRetryableFetchError") return true;
  if (error.name === "TypeError" && /fetch/i.test(error.message ?? "")) return true;
  return error.status === 0;
}
