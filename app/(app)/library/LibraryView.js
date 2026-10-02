import Link from "next/link";
import { libraryDate } from "../../../lib/documents/dates.js";
import read from "../read/read.module.css";
import styles from "./library.module.css";

/*
 * The library's list, given the entries. Kept apart from page.js, which
 * decides who is reading and loads the entries, so it renders the same
 * whatever supplied them.
 */

/** @param {{ entries: import("../../../lib/documents/store.js").LibraryEntry[] }} props */
export default function LibraryView({ entries }) {
  return (
    <main className={read.desk}>
      <article className={read.paper}>
        <div className={read.stack}>
          <h1 className={read.heading}>Your library</h1>
          {entries.length === 0 ? (
            <>
              <p className={read.lede}>
                Nothing saved yet. Paste a document and choose Save and read it, and it will show up
                here.
              </p>
              <div className={read.actions}>
                <Link href="/read" className={read.action}>
                  Paste a document
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className={read.lede}>Most recent first.</p>
              <ol className={styles.list}>
                {entries.map((entry) => {
                  const date = libraryDate(entry);
                  return (
                    <li key={entry.id} className={styles.entry}>
                      <Link href={`/documents/${entry.id}`} className={styles.title}>
                        {entry.title}
                      </Link>
                      <time className={styles.date} dateTime={date.iso}>
                        {date.label}
                      </time>
                    </li>
                  );
                })}
              </ol>
              <div className={read.actions}>
                <Link href="/read" className={read.quiet}>
                  Paste another document
                </Link>
              </div>
            </>
          )}
        </div>
      </article>
    </main>
  );
}
