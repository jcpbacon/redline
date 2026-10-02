"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MAX_TITLE_LENGTH } from "../../../../lib/documents/title.js";
import read from "../../read/read.module.css";
import { renameDocument } from "./actions";
import styles from "./document.module.css";

/*
 * The Document's title, and renaming it in place (story 42). Rename swaps
 * the controls for a one-line field holding the current title; Save sends it
 * to the renameDocument Server Action, which writes the title only and
 * refreshes the page. Escape or Cancel puts things back and returns focus to
 * Rename. After a save, focus goes to the new heading and a status line says
 * it was renamed, for screen readers as much as anyone.
 *
 * `children` is drawn between the heading and the controls (the dates).
 */

const NETWORK_ERROR = "Couldn’t reach Redline. Check your connection and try again.";

/** @param {{ documentId: string, title: string, children?: import("react").ReactNode }} props */
export default function RenameDocument({ documentId, title, children }) {
  const [shown, setShown] = useState(title);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const fieldId = useId();
  const errorId = useId();
  const heading = useRef(/** @type {HTMLHeadingElement | null} */ (null));
  const opener = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const restoreFocus = useRef(/** @type {"heading" | "opener" | null} */ (null));

  // The page refreshes after a rename; take the stored title when it arrives.
  useEffect(() => setShown(title), [title]);

  useEffect(() => {
    if (editing || restoreFocus.current === null) return;
    (restoreFocus.current === "heading" ? heading.current : opener.current)?.focus();
    restoreFocus.current = null;
  }, [editing]);

  function start() {
    setDraft(shown);
    setError("");
    setStatus("");
    setEditing(true);
  }

  function cancel() {
    restoreFocus.current = "opener";
    setError("");
    setEditing(false);
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    let result;
    try {
      result = await renameDocument(documentId, draft);
    } catch {
      result = { error: NETWORK_ERROR };
    }
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setShown(result.title);
    setStatus("Renamed.");
    restoreFocus.current = "heading";
    setEditing(false);
  }

  return (
    <div className={styles.titleBlock}>
      <h1 className={read.heading} ref={heading} tabIndex={-1}>
        {shown}
      </h1>
      {children}

      {editing ? (
        <form className={styles.rename} onSubmit={save}>
          <label className={read.label} htmlFor={fieldId}>
            New name
          </label>
          <input
            id={fieldId}
            className={read.input}
            value={draft}
            maxLength={MAX_TITLE_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            autoFocus
            disabled={busy}
          />
          {error ? (
            <p className={styles.error} id={errorId} role="alert">
              {error}
            </p>
          ) : null}
          <div className={read.actions}>
            <button type="submit" className={read.action} disabled={busy || draft.trim() === ""}>
              {busy ? "Saving…" : "Save name"}
            </button>
            <button type="button" className={read.quiet} onClick={cancel} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.tools}>
          <button type="button" className={styles.tool} ref={opener} onClick={start} aria-label={`Rename “${shown}”`}>
            Rename
          </button>
        </div>
      )}

      <p className={read.visuallyHidden} role="status">
        {status}
      </p>
    </div>
  );
}
