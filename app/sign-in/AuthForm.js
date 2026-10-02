"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp } from "../auth/actions";
import notice from "../notice.module.css";
import styles from "./auth.module.css";

/*
 * One form, two modes: sign in, or create an account. Both post to a Server
 * Function, so the session cookie is written on the server and the form works
 * before JavaScript loads. After a sign-up that needs the email confirmed,
 * the form gives way to a "check your email" note.
 */

const COPY = {
  "sign-in": {
    heading: "Sign in",
    lede: "Use the email and password you signed up with.",
    submit: "Sign in",
    pending: "Signing in…",
    password: "current-password",
    switchPrompt: "New here?",
    switchLabel: "Create an account",
    switchHref: "/sign-in?mode=create",
  },
  create: {
    heading: "Create an account",
    lede: "Your account is private to you. Nobody else can see what you keep in it.",
    submit: "Create account",
    pending: "Creating your account…",
    password: "new-password",
    switchPrompt: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/sign-in",
  },
};

/** @param {{ mode: "sign-in" | "create", notice: string | null, key?: string }} props */
export default function AuthForm({ mode, notice: linkNotice }) {
  const copy = COPY[mode];
  const [state, formAction, pending] = useActionState(mode === "create" ? signUp : signIn, {});

  if (state?.checkEmail) {
    return (
      <>
        <h1 className={notice.heading}>Check your email</h1>
        <p className={notice.body} role="status">
          We sent a link to <strong className={styles.email}>{state.email}</strong>. Open it to finish
          creating your account. You&rsquo;ll be signed in when you do.
        </p>
        <p className={notice.body}>
          No email after a few minutes? Check your spam folder, or{" "}
          <Link href="/sign-in?mode=create" className={styles.switchLink} reloadDocument>
            try again
          </Link>
          .
        </p>
      </>
    );
  }

  const error = state?.error ?? linkNotice;

  return (
    <>
      <h1 className={notice.heading}>{copy.heading}</h1>
      <p className={notice.body}>{copy.lede}</p>

      <form action={formAction} className={styles.form} noValidate>
        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <input
            className={styles.input}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            defaultValue={state?.email ?? ""}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "auth-error" : undefined}
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Password</span>
          <input
            className={styles.input}
            type="password"
            name="password"
            autoComplete={copy.password}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "auth-error" : undefined}
            required
          />
        </label>

        {error ? (
          <p id="auth-error" className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className={notice.action} disabled={pending} aria-disabled={pending}>
          {pending ? copy.pending : copy.submit}
        </button>
      </form>

      <p className={styles.switch}>
        {copy.switchPrompt}{" "}
        <Link href={copy.switchHref} className={styles.switchLink}>
          {copy.switchLabel}
        </Link>
      </p>
    </>
  );
}
