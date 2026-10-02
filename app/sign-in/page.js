import Link from "next/link";
import styles from "../notice.module.css";

/*
 * Where the landing page's one call to action, "Try it on a document", leads.
 * Accounts arrive with ticket #18, which puts sign-in here. Until then this
 * route says so and sends the Reader to /read, where pasted text can be
 * analysed without an account.
 */

export const metadata = {
  title: "Sign-in isn’t built yet · Redline",
  description: "You can try Redline on pasted text without an account.",
};

export default function SignIn() {
  return (
    <main className={styles.table}>
      <div className={styles.sheet}>
        <h1 className={styles.heading}>Sign-in isn&rsquo;t built yet</h1>
        <p className={styles.body}>
          You can still try Redline on a document. Paste its text and you&rsquo;ll get a
          plain-English summary. Without an account, nothing is saved.
        </p>
        <Link href="/read" className={styles.action}>
          Paste a document
        </Link>
      </div>
    </main>
  );
}
