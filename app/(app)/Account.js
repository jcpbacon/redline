import Link from "next/link";
import { signOut } from "../auth/actions";
import { getSupabaseConfig } from "../../lib/supabase/config.js";
import { getReader } from "../../lib/supabase/server.js";
import styles from "./app.module.css";

/*
 * The right-hand end of the app's top rule: "Sign in" for a signed-out
 * Reader, the Reader's email and "Sign out" for a signed-in one, and nothing
 * at all when this deployment has no accounts (the sign-in page would only
 * say so).
 *
 * Rendered inside <Suspense> by the layout, so reading the session doesn't
 * hold back the rest of the page.
 */

export default async function Account() {
  if (!getSupabaseConfig()) return null;

  const reader = await getReader();

  if (!reader) {
    return (
      <div className={styles.account}>
        <Link href="/sign-in" className={styles.navLink}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={signOut} className={styles.account}>
      {reader.email ? <span className={styles.who}>{reader.email}</span> : null}
      <button type="submit" className={`${styles.navLink} ${styles.navButton}`}>
        Sign out
      </button>
    </form>
  );
}
