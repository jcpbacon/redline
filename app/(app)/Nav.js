"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./app.module.css";

const ROUTES = [{ href: "/read", label: "Read a document" }];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Redline" className={styles.nav}>
      {ROUTES.map((route) => (
        <Link
          key={route.href}
          href={route.href}
          className={styles.navLink}
          aria-current={pathname === route.href ? "page" : undefined}
        >
          {route.label}
        </Link>
      ))}
    </nav>
  );
}
