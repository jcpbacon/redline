import Link from "next/link";
import styles from "../notice.module.css";

/*
 * Where the landing page's one call to action, "Try it on a document", leads.
 * Until accounts exist (ticket #18) this route answers the click instead of
 * 404ing, so the copy speaks to trying it on a document. The path is /sign-in
 * because that is what #18 puts here; a Reader sees the button label, not the
 * route, so the heading matches the button rather than the URL.
 */

export const metadata = {
  title: "Not built yet — Redline",
  description: "Redline cannot read your own document yet.",
};

export default function SignIn() {
  return (
    <main className={styles.table}>
      <div className={styles.sheet}>
        <h1 className={styles.heading}>You can&rsquo;t try it on a document yet</h1>
        <p className={styles.body}>
          Redline can&rsquo;t read your own document yet. That part isn&rsquo;t built.
        </p>
        <p className={styles.body}>
          The marked-up agreement on the front page was written by hand, to show what a
          finished analysis will look like.
        </p>
        <Link href="/" className={styles.action}>
          Back to the example
        </Link>
      </div>
    </main>
  );
}
