"use client";

import { useId, useRef, useState } from "react";
import { MAX_RED_LINE_LENGTH } from "../../../lib/red-lines/text.js";
import read from "../read/read.module.css";
import { addRedLine, deleteRedLine, updateRedLine } from "./actions";
import styles from "./red-lines.module.css";

/*
 * The Reader's Red Lines as a ruled list on an index card (DESIGN.md, Index
 * Card; the app shell brief: "their Red Lines are a ruled list on a second
 * card"). Each line can be edited in place or deleted; the last line takes a
 * new one. Every change goes through a Server Action (./actions.js), which
 * returns the whole list as it now stands, and that is what is drawn.
 */

/** @typedef {{ id: string, text: string }} RedLine */

/** @param {{ initial: RedLine[] }} props */
export default function RedLinesView({ initial }) {
  const [redLines, setRedLines] = useState(initial);
  const [editing, setEditing] = useState(/** @type {string | null} */ (null));
  const [draft, setDraft] = useState("");
  const [fresh, setFresh] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const newId = useId();
  const newInput = useRef(/** @type {HTMLInputElement | null} */ (null));

  /**
   * @param {() => Promise<{ redLines?: RedLine[], error?: string }>} change
   * @returns {Promise<boolean>} whether it saved
   */
  async function run(change) {
    setBusy(true);
    setError("");
    let result;
    try {
      result = await change();
    } catch {
      result = { error: "Couldn’t reach Redline. Check your connection and try again." };
    }
    setBusy(false);
    if (result.redLines) setRedLines(result.redLines);
    if (result.error) {
      setError(result.error);
      return false;
    }
    return true;
  }

  function startEdit(/** @type {RedLine} */ redLine) {
    setEditing(redLine.id);
    setDraft(redLine.text);
    setError("");
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (editing === null) return;
    const id = editing;
    if (await run(() => updateRedLine(id, draft))) setEditing(null);
  }

  async function remove(/** @type {RedLine} */ redLine) {
    if (await run(() => deleteRedLine(redLine.id))) {
      if (editing === redLine.id) setEditing(null);
    }
  }

  async function add(event) {
    event.preventDefault();
    if (await run(() => addRedLine(fresh))) {
      setFresh("");
      newInput.current?.focus();
    }
  }

  return (
    <main className={read.desk}>
      <article className={read.paper}>
        <div className={read.stack}>
          <h1 className={read.heading}>Your red lines</h1>
          <p className={read.lede}>
            Things you won&rsquo;t agree to. When a clause breaks one, Redline marks it and lists it
            first among clauses of the same severity. It still shows every other clause that could
            hurt you.
          </p>

          <section className={styles.card} aria-labelledby="red-lines-heading">
            <h2 className={read.cardHeading} id="red-lines-heading">
              {redLines.length === 1 ? "1 red line" : `${redLines.length} red lines`}
            </h2>

            {redLines.length === 0 ? (
              <p className={styles.empty}>
                None yet. Redline still checks every document in full, with nothing of yours to
                mark.
              </p>
            ) : (
              <ol className={styles.list}>
                {redLines.map((redLine) =>
                  editing === redLine.id ? (
                    <li key={redLine.id} className={styles.item}>
                      <form className={styles.edit} onSubmit={saveEdit}>
                        <label className={styles.hidden} htmlFor={`edit-${redLine.id}`}>
                          Edit this red line
                        </label>
                        <input
                          id={`edit-${redLine.id}`}
                          className={styles.input}
                          value={draft}
                          maxLength={MAX_RED_LINE_LENGTH}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setEditing(null);
                          }}
                          autoFocus
                          disabled={busy}
                        />
                        <span className={styles.controls}>
                          <button type="submit" className={styles.control} disabled={busy}>
                            Save
                          </button>
                          <button type="button" className={styles.control} onClick={() => setEditing(null)} disabled={busy}>
                            Cancel
                          </button>
                        </span>
                      </form>
                    </li>
                  ) : (
                    <li key={redLine.id} className={styles.item}>
                      <span className={styles.text}>{redLine.text}</span>
                      <span className={styles.controls}>
                        <button
                          type="button"
                          className={styles.control}
                          onClick={() => startEdit(redLine)}
                          disabled={busy}
                          aria-label={`Edit: ${redLine.text}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles.control}
                          onClick={() => remove(redLine)}
                          disabled={busy}
                          aria-label={`Delete: ${redLine.text}`}
                        >
                          Delete
                        </button>
                      </span>
                    </li>
                  ),
                )}
              </ol>
            )}

            <form className={styles.add} onSubmit={add}>
              <label className={styles.addLabel} htmlFor={newId}>
                Add a red line
              </label>
              <input
                id={newId}
                ref={newInput}
                className={styles.input}
                value={fresh}
                maxLength={MAX_RED_LINE_LENGTH}
                placeholder="I get paid within 30 days"
                onChange={(e) => setFresh(e.target.value)}
                disabled={busy}
              />
              <div className={read.actions}>
                <button type="submit" className={read.action} disabled={busy || fresh.trim() === ""}>
                  Add it
                </button>
              </div>
            </form>
          </section>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <p className={read.hint}>
            A change applies to the next document you read. A saved one keeps the red lines it was
            read with until you read it again.
          </p>
        </div>
      </article>
    </main>
  );
}
