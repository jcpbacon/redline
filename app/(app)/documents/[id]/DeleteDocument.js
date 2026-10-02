"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import read from "../../read/read.module.css";
import { deleteDocument } from "./actions";
import styles from "./document.module.css";

/*
 * Deleting a saved Document (story 43), at the foot of the page, away from
 * everything else the Reader does here. It takes two deliberate steps:
 * "Delete this document" opens a confirm panel that names the Document and
 * says what goes with it, and only "Delete it" in that panel deletes. Focus
 * lands on "Keep it", so Enter or Space on arrival is the safe choice;
 * Escape or "Keep it" closes the panel and returns focus to the opener.
 *
 * The panel's form posts the id to the deleteDocument Server Action. On
 * success that redirects to /library, which says the document is gone; on
 * failure the error shows in the panel and nothing was deleted.
 */

/** @param {{ documentId: string, title: string }} props */
export default function DeleteDocument({ documentId, title }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteDocument, /** @type {{ error?: string }} */ ({}));
  const headingId = useId();
  const detailId = useId();
  const keep = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const opener = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) keep.current?.focus();
    else if (wasOpen.current) opener.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (!open) {
    return (
      <div className={styles.deleteZone}>
        <button type="button" className={styles.tool} ref={opener} onClick={() => setOpen(true)}>
          Delete this document
        </button>
      </div>
    );
  }

  return (
    <div
      className={styles.confirm}
      role="group"
      aria-labelledby={headingId}
      aria-describedby={detailId}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !pending) setOpen(false);
      }}
    >
      <h2 className={styles.confirmHeading} id={headingId}>
        Delete &ldquo;{title}&rdquo;?
      </h2>
      <p className={styles.confirmText} id={detailId}>
        This deletes the text, every reading of it, and the questions you asked about it. You
        can&rsquo;t undo it.
      </p>
      {state?.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      <form action={formAction} className={read.actions}>
        <input type="hidden" name="documentId" value={documentId} />
        <button type="button" className={read.action} ref={keep} onClick={() => setOpen(false)} disabled={pending}>
          Keep it
        </button>
        <button type="submit" className={styles.destroy} disabled={pending}>
          {pending ? "Deleting…" : "Delete it"}
        </button>
      </form>
    </div>
  );
}
