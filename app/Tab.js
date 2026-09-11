"use client";

import { useId, useState } from "react";
import styles from "./page.module.css";

export default function Tab({ rank, ordinal, heading, meaning, sentenceId }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  return (
    <div className={styles.tab} data-rank={rank} data-open={open || undefined}>
      <button
        type="button"
        className={styles.tabFace}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.tabRank}>{ordinal}</span>
        <span className={styles.tabHeading}>{heading}</span>
      </button>
      <div id={bodyId} className={styles.tabBody}>
        <div className={styles.tabBodyInner}>
          <p className={styles.tabMeaning}>{meaning}</p>
          <p className={styles.tabMeta}>
            Ranked {ordinal.toLowerCase()} of 3 by how badly it can hurt you.{" "}
            <a href={`#${sentenceId}`} className={styles.tabLink}>
              The sentence it came from is highlighted on the page.
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
