import Link from "next/link";
import styles from "../notice.module.css";

/*
 * The landing page's one call to action points here. Accounts are ticket #18;
 * until that lands, this route exists so the action leads somewhere honest
 * instead of a 404. When sign-in is built it replaces this page at the same
 * path, so the link is never dead and never has to move.
 */

export const metadata = {
  title: "Sign in — Redline",
  description: "Accounts are not built yet.",
};

export default function SignIn() {
  return (
    <main className={styles.table}>
      <div className={styles.sheet}>
        <h1 className={styles.heading}>There&rsquo;s no sign-in yet</h1>
        <p className={styles.body}>
          Accounts don&rsquo;t exist yet. When they do, this is where you&rsquo;ll sign in.
        </p>
        <p className={styles.body}>
          Redline can&rsquo;t read your own document yet either. The marked-up agreement on
          the front page was written by hand, to show what a finished analysis will look
          like.
        </p>
        <Link href="/" className={styles.action}>
          Back to the example
        </Link>
      </div>
    </main>
  );
}
