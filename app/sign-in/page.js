import Link from "next/link";
import { redirect } from "next/navigation";
import { AUTH_COPY } from "../../lib/auth/messages.js";
import { APP_HOME } from "../../lib/auth/routes.js";
import { getSupabaseConfig } from "../../lib/supabase/config.js";
import { getReader } from "../../lib/supabase/server.js";
import AuthForm from "./AuthForm";
import styles from "../notice.module.css";

/*
 * /sign-in: where the landing page's one call to action leads.
 *
 *   accounts off      → say so, and send the Reader to /read, which works
 *                       without an account
 *   already signed in → straight on into the app
 *   otherwise         → sign in, or create an account (?mode=create)
 *
 * `?error=confirm` is set by /auth/confirm when an email link fails.
 */

export const metadata = {
  title: "Sign in · Redline",
  description: "Sign in to Redline, or create an account.",
};

export default async function SignIn({ searchParams }) {
  if (!getSupabaseConfig()) return <AccountsOff />;

  if (await getReader()) redirect(APP_HOME);

  const params = await searchParams;
  const mode = params?.mode === "create" ? "create" : "sign-in";
  const notice = params?.error === "confirm" ? AUTH_COPY.confirmFailed : null;

  return (
    <main className={styles.table}>
      <div className={styles.sheet}>
        <AuthForm key={mode} mode={mode} notice={notice} />
      </div>
    </main>
  );
}

function AccountsOff() {
  return (
    <main className={styles.table}>
      <div className={styles.sheet}>
        <h1 className={styles.heading}>Accounts aren’t switched on here</h1>
        <p className={styles.body}>
          Sign-in isn&rsquo;t set up on this version of Redline, so you can&rsquo;t create an account
          here. You can still paste a document and read what it says, but nothing gets saved.
        </p>
        <Link href="/read" className={styles.action}>
          Paste a document
        </Link>
      </div>
    </main>
  );
}
