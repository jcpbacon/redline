import Link from "next/link";
import styles from "./read/read.module.css";

/*
 * A sheet on the desk that says why a screen can't show what was asked for:
 * accounts are off, nobody is signed in, or the database didn't answer.
 * Used by the library and a Document's page, which need an account.
 */

/** @param {{ heading: string, children?: import("react").ReactNode, href: string, action: string }} props */
export default function Notice({ heading, children, href, action }) {
  return (
    <main className={styles.desk}>
      <article className={styles.paper}>
        <div className={styles.stack}>
          <h1 className={styles.heading}>{heading}</h1>
          <p className={styles.lede}>{children}</p>
          <div className={styles.actions}>
            <Link href={href} className={styles.action}>
              {action}
            </Link>
          </div>
        </div>
      </article>
    </main>
  );
}

/**
 * The two notices every account screen shares. `what` says what has nowhere
 * to live without accounts; it defaults to the library's wording.
 *
 * @param {{ what?: string }} props
 */
export function AccountsOff({ what = "there’s no library to keep documents in" }) {
  return (
    <Notice heading="Accounts aren’t switched on here" href="/read" action="Paste a document">
      This version of Redline has no sign-in, so {what}. You can still paste a document and read
      what it says.
    </Notice>
  );
}

/** @param {{ what: string }} props */
export function SignInFirst({ what }) {
  return (
    <Notice heading="Sign in to see this" href="/sign-in" action="Sign in">
      {what}
    </Notice>
  );
}
