"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./app.module.css";

// `short` is shown instead of `label` on a phone, where the rule has to fit
// the wordmark, both routes and the account control on one line.
const READ = { href: "/read", label: "Read a document", short: "Read" };
const LIBRARY = { href: "/library", label: "Library", short: null };

/**
 * The app's routes along the top rule. The library is listed only for a
 * signed-in Reader; ./ReaderNav.js decides which.
 *
 * @param {{ signedIn?: boolean }} props
 */
export default function Nav({ signedIn = false }) {
  const pathname = usePathname();
  const routes = signedIn ? [READ, LIBRARY] : [READ];
  return (
    <nav aria-label="Redline" className={styles.nav}>
      {routes.map((route) => (
        <Link
          key={route.href}
          href={route.href}
          className={styles.navLink}
          aria-current={pathname === route.href ? "page" : undefined}
        >
          {route.short ? (
            <>
              <span className={styles.full}>{route.label}</span>
              <span className={styles.short} aria-hidden="true">
                {route.short}
              </span>
            </>
          ) : (
            route.label
          )}
        </Link>
      ))}
    </nav>
  );
}
