import Link from "next/link";
import { Suspense } from "react";
import Account from "./Account";
import Nav from "./Nav";
import ReaderNav from "./ReaderNav";
import styles from "./app.module.css";

/*
 * The app shell (.impeccable/surfaces/app-app-layout-js.md): a thin black rule
 * along the top edge of the desk, the wordmark at its left and the app's
 * routes beside it. The library and Red Lines appear for a signed-in Reader
 * (./ReaderNav.js).
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
        <Suspense fallback={<Nav />}>
          <ReaderNav />
        </Suspense>
        <Suspense fallback={null}>
          <Account />
        </Suspense>
      </header>
      {children}
    </div>
  );
}
