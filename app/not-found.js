import Link from "next/link";
import styles from "./notice.module.css";

/*
 * Next renders this for any path that matches no route. Without it the Reader
 * gets the framework's default 404, which reads like a broken deploy.
 */

export const metadata = {
  title: "Not found — Redline",
};

export default function NotFound() {
  return (
    <main className={styles.table}>
      <div className={styles.sheet}>
        <h1 className={styles.heading}>That page isn&rsquo;t here</h1>
        <p className={styles.body}>
          Nothing exists at this address. Redline is one page so far, so the front page is
          probably where you were headed.
        </p>
        <Link href="/" className={styles.action}>
          Back to the front page
        </Link>
      </div>
    </main>
  );
}
