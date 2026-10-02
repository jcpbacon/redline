import Link from "next/link";
import { Suspense } from "react";
import Account from "./Account";
import Nav from "./Nav";
import styles from "./app.module.css";

/*
 * The app shell (.impeccable/surfaces/app-app-layout-js.md): a thin black rule
 * along the top edge of the desk, the wordmark at its left and the app's
 * routes beside it. It links only to routes that exist. The library and Red
 * Lines join this rule when tickets #21 and #22 build them.
 *
 * Nothing here needs an account or Supabase: a Reader who is not signed in can
 * still read a pasted Document. The account control at the right end of the
 * rule (./Account.js) renders nothing when accounts are off.
 */

export default function AppLayout({ children }) {
  return (
    <div className={styles.shell}>
      <header className={styles.rule}>
        <Link href="/" className={styles.wordmark}>
          Redline
        </Link>
        <Nav />
        <Suspense fallback={null}>
          <Account />
        </Suspense>
      </header>
      {children}
    </div>
  );
}
