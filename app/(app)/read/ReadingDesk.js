"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import { locateSourceSentence, sourceContext } from "../../../lib/analysis/context.js";
import { flagView } from "../../../lib/analysis/flag-view.js";
import { CleanVerdict, FlagTab, bandOf, ordinal } from "./FlagList";
import styles from "./flags.module.css";
import read from "./read.module.css";

/*
 * The ranked Flags and the Document they came from, on one page (stories 22
 * and 23). Used by /read for an unsaved reading and by /documents/[id].
 *
 * Pulling a tab ("Show it in the document") lifts it and scrolls the
 * Document to that Flag's Source Sentence, drawn in with the Highlighter
 * Mark in the Flag's band, with the text before and after it exactly as
 * stored or pasted. Focus moves to the highlighted sentence; a "Back to the
 * Nth flag" button right after it returns focus to the tab. Under reduced
 * motion the scroll is instant and the mark doesn't draw in.
 *
 * Every Flag's sentence is located in the text before anything is drawn
 * (lib/analysis/context.js). One that can't be found throws, so the page
 * fails loudly instead of highlighting the wrong words (ADR-0001).
 *
 * Dismissing is offered only when `onDismiss` is given, which is on a saved
 * Document whose Flags have ids. The change is saved first and shown once it
 * is; a dismissed Flag leaves the main list and is listed under a control
 * that shows it again and can put it back. A Document whose Flags are all
 * dismissed says so, never "Nothing flagged" (lib/analysis/flag-view.js).
 */

/**
 * @typedef {import("./FlagList").TabFlag} TabFlag
 * @typedef {(flagId: string, dismissed: boolean) => Promise<{ dismissedAt: string | null } | { error: string }>} DismissFn
 */

const FAILED = "Redline couldn’t save that change. Try again in a moment.";

/**
 * @param {{
 *   text: string,
 *   flags: TabFlag[],
 *   checked: Array<{ id: string, label: string }>,
 *   headingId: string,
 *   onDismiss?: DismissFn,
 *   children?: import("react").ReactNode,
 * }} props
 */
export default function ReadingDesk({ text, flags, checked, headingId, onDismiss, children }) {
  const documentId = useId();
  const dismissedId = useId();

  // Fail loudly, before drawing anything, if any Source Sentence isn't in the text.
  for (const flag of flags) locateSourceSentence(text, flag);

  const [dismissedAt, setDismissedAt] = useState(
    () => /** @type {Record<string, string | null>} */ (Object.fromEntries(flags.filter((f) => f.id).map((f) => [f.id, f.dismissedAt ?? null]))),
  );
  const [active, setActive] = useState(/** @type {{ rank: number, at: number } | null} */ (null));
  const [showDismissed, setShowDismissed] = useState(false);
  const [pending, setPending] = useState(/** @type {string | null} */ (null));
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [focusTab, setFocusTab] = useState(/** @type {number | null} */ (null));

  const markRef = useRef(/** @type {HTMLElement | null} */ (null));
  const sectionHeadingRef = useRef(/** @type {HTMLHeadingElement | null} */ (null));
  const showButtons = useRef(/** @type {Map<number, HTMLButtonElement>} */ (new Map()));

  const shown = flags.map((flag) => (flag.id ? { ...flag, dismissedAt: dismissedAt[flag.id] ?? null } : flag));
  const view = flagView(shown);

  const activeFlag = active ? shown[active.rank - 1] : null;
  const highlight = activeFlag ? sourceContext(text, activeFlag) : null;

  // After a tab is pulled: bring the sentence into view and put focus on it.
  useEffect(() => {
    const mark = markRef.current;
    if (!active || !mark) return;
    mark.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    mark.focus({ preventScroll: true });
  }, [active]);

  // After a Flag moves between lists, put focus where the Reader can carry on.
  useEffect(() => {
    if (focusTab === null) return;
    const button = showButtons.current.get(focusTab);
    if (button) button.focus();
    else sectionHeadingRef.current?.focus();
    setFocusTab(null);
  }, [focusTab]);

  /** @param {number} rank */
  function show(rank) {
    setActive({ rank, at: Date.now() });
  }

  function back() {
    if (!active) return;
    const button = showButtons.current.get(active.rank);
    if (button) {
      button.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
      button.focus({ preventScroll: true });
    }
  }

  /**
   * @param {TabFlag} flag
   * @param {number} rank
   * @param {boolean} dismiss
   */
  async function toggle(flag, rank, dismiss) {
    if (!onDismiss || !flag.id || pending) return;
    const id = flag.id;
    setPending(id);
    setError("");
    setStatus("");
    /** @type {{ dismissedAt: string | null } | { error: string }} */
    let result;
    try {
      result = await onDismiss(id, dismiss);
    } catch {
      result = { error: FAILED };
    }
    setPending(null);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setDismissedAt((current) => ({ ...current, [id]: result.dismissedAt }));
    if (dismiss) {
      setStatus(`You dismissed the ${ordinal(rank)} flag. It’s under the dismissed ones now.`);
      if (active?.rank === rank) setActive(null);
      // The tab is gone from the main list: land on the list's heading.
      setFocusTab(-1);
    } else {
      setStatus(`The ${ordinal(rank)} flag is back in the list.`);
      setFocusTab(rank);
    }
  }

  /** @param {{ flag: TabFlag, rank: number }} entry */
  function tab({ flag, rank }) {
    const dismissed = Boolean(flag.dismissedAt);
    return (
      <Fragment key={flag.id ?? `${rank}-${flag.sourceSentence}`}>
        <FlagTab
          flag={flag}
          rank={rank}
          total={view.total}
          active={active?.rank === rank}
          onShow={() => show(rank)}
          showRef={(node) => {
            if (node) showButtons.current.set(rank, node);
            else showButtons.current.delete(rank);
          }}
          documentId={documentId}
          dismiss={
            onDismiss && flag.id
              ? { dismissed, pending: pending === flag.id, onToggle: () => toggle(flag, rank, !dismissed) }
              : undefined
          }
        />
      </Fragment>
    );
  }

  const dismissedCount = view.dismissed.length;

  return (
    <>
      {view.state === "clean" ? (
        <CleanVerdict checked={checked} headingId={headingId} />
      ) : (
        <section className={styles.section} aria-labelledby={headingId}>
          <h2 className={styles.sectionHeading} id={headingId} ref={sectionHeadingRef} tabIndex={-1}>
            {view.state === "all-dismissed"
              ? view.total === 1
                ? "You dismissed the one flagged clause"
                : `You dismissed all ${view.total} flagged clauses`
              : view.visible.length === 1
                ? "1 clause could hurt you"
                : `${view.visible.length} clauses could hurt you`}
          </h2>
          <p className={styles.lede}>
            {view.state === "all-dismissed" ? (
              <>
                {view.total === 1 ? "It’s" : "They’re"} still in the document. Show{" "}
                {view.total === 1 ? "it" : "them"} to read {view.total === 1 ? "it" : "them"} again, or put{" "}
                {view.total === 1 ? "it" : "one"} back.
              </>
            ) : (
              <>
                Worst first. Each one quotes the sentence it came from, word for word. Show it in the
                document to read the clause around it.
              </>
            )}
          </p>

          <p className={styles.deskStatus} role="status">
            {status}
          </p>
          {error ? (
            <p className={styles.deskError} role="alert">
              {error}
            </p>
          ) : null}

          {view.visible.length > 0 ? <ol className={styles.list}>{view.visible.map(tab)}</ol> : null}

          {dismissedCount > 0 ? (
            <div className={styles.dismissedBar}>
              {view.state === "has-visible" ? (
                <p className={styles.meta}>
                  You dismissed {dismissedCount === 1 ? "1 more" : `${dismissedCount} more`}.
                </p>
              ) : null}
              <button
                type="button"
                className={read.quiet}
                aria-expanded={showDismissed}
                aria-controls={dismissedId}
                onClick={() => setShowDismissed((v) => !v)}
              >
                {showDismissed
                  ? "Hide the dismissed ones"
                  : dismissedCount === 1
                    ? "Show the dismissed one"
                    : `Show the ${dismissedCount} dismissed`}
              </button>
            </div>
          ) : null}

          {dismissedCount > 0 && showDismissed ? (
            <section className={styles.section} aria-labelledby={`${dismissedId}-heading`} id={dismissedId}>
              <h3 className={styles.dismissedHeading} id={`${dismissedId}-heading`}>
                Dismissed
              </h3>
              <ol className={styles.list}>{view.dismissed.map(tab)}</ol>
            </section>
          ) : null}
        </section>
      )}

      {children}

      <h2 className={read.label}>The document</h2>
      <div className={read.document} id={documentId}>
        {highlight && active ? (
          <>
            {highlight.before}
            <mark
              key={active.at}
              ref={markRef}
              tabIndex={-1}
              className={`${styles.mark} ${styles.docMark}`}
              data-band={bandOf(/** @type {TabFlag} */ (activeFlag))}
            >
              {highlight.sentence}
            </mark>
            <button type="button" className={styles.back} onClick={back}>
              Back to the {ordinal(active.rank)} flag
            </button>
            {highlight.after}
          </>
        ) : (
          text
        )}
      </div>
    </>
  );
}

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}
