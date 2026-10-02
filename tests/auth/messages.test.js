import { describe, expect, it } from "vitest";
import { AUTH_COPY, authErrorMessage, missingFieldMessage } from "../../lib/auth/messages.js";

/*
 * Supabase Auth errors in, the sentence a Reader sees out. The error shapes
 * are the ones @supabase/auth-js produces: AuthApiError carries `code` and
 * `status`; a weak password also carries `reasons`; a failed fetch is an
 * AuthRetryableFetchError with status 0.
 */

const apiError = (code, status = 400, extra = {}) => ({ name: "AuthApiError", code, status, message: "raw supabase text", ...extra });

describe("authErrorMessage", () => {
  it.each([
    ["wrong email or password", apiError("invalid_credentials"), AUTH_COPY.wrongPassword],
    ["email already registered", apiError("user_already_exists", 422), AUTH_COPY.emailTaken],
    ["email already registered (newer code)", apiError("email_exists", 422), AUTH_COPY.emailTaken],
    ["email not confirmed yet", apiError("email_not_confirmed"), AUTH_COPY.notConfirmed],
    ["rate limited", apiError("over_request_rate_limit", 429), AUTH_COPY.tooManyAttempts],
    ["email rate limited", apiError("over_email_send_rate_limit", 429), AUTH_COPY.tooManyAttempts],
    ["malformed email", apiError("email_address_invalid"), AUTH_COPY.invalidEmail],
    ["sign-ups turned off", apiError("signup_disabled", 422), AUTH_COPY.signUpClosed],
    ["email validation failure", apiError("validation_failed", 400, { message: "Unable to validate email address: invalid format" }), AUTH_COPY.invalidEmail],
    ["other validation failure", apiError("validation_failed", 400, { message: "Something else" }), AUTH_COPY.generic],
    ["unknown 429 without a code", { name: "AuthApiError", status: 429, message: "x" }, AUTH_COPY.tooManyAttempts],
    ["an unknown code", apiError("some_new_code", 500), AUTH_COPY.generic],
    ["nothing at all", null, AUTH_COPY.generic],
  ])("%s", (_case, error, expected) => {
    expect(authErrorMessage(error)).toBe(expected);
  });

  it("treats a fetch that never reached Supabase as a network problem", () => {
    expect(authErrorMessage({ name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" })).toBe(AUTH_COPY.network);
    expect(authErrorMessage({ name: "TypeError", message: "fetch failed" })).toBe(AUTH_COPY.network);
  });

  it("names the minimum length when a password is too short", () => {
    const error = apiError("weak_password", 422, {
      message: "Password should be at least 8 characters.",
      reasons: ["length"],
    });
    expect(authErrorMessage(error)).toBe(AUTH_COPY.passwordTooShort(8));
    expect(authErrorMessage(error)).toContain("8 characters");
  });

  it("says when a password has been in a breach, ahead of any other reason", () => {
    expect(authErrorMessage(apiError("weak_password", 422, { reasons: ["length", "pwned"] }))).toBe(AUTH_COPY.passwordBreached);
  });

  it("asks for more kinds of character when that is the reason", () => {
    expect(authErrorMessage(apiError("weak_password", 422, { reasons: ["characters"] }))).toBe(AUTH_COPY.passwordNeedsVariety);
  });

  it("falls back to a general weak-password line when no reason is given", () => {
    expect(authErrorMessage(apiError("weak_password", 422))).toBe(AUTH_COPY.weakPassword);
  });

  it("never shows Supabase's own error text", () => {
    const codes = ["invalid_credentials", "email_exists", "weak_password", "unexpected_failure", "validation_failed"];
    for (const code of codes) expect(authErrorMessage(apiError(code))).not.toContain("raw supabase text");
  });
});

describe("missingFieldMessage", () => {
  it("asks for the email first, then the password", () => {
    expect(missingFieldMessage({ email: "  ", password: "" })).toBe(AUTH_COPY.missingEmail);
    expect(missingFieldMessage({ email: "a@b.co", password: "" })).toBe(AUTH_COPY.missingPassword);
  });

  it("is satisfied when both are there", () => {
    expect(missingFieldMessage({ email: "a@b.co", password: " " })).toBeNull();
  });
});
