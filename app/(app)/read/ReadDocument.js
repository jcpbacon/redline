"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { defaultTitle } from "../../../lib/documents/title.js";
import { saveDocument } from "./actions";
import ReadingDesk from "./ReadingDesk";
import styles from "./read.module.css";

/*
 * One screen, six states:
 *
 *   compose   → the Reader pastes the Document
 *   confirm   → the text shown exactly as pasted, before anything is sent
 *   saving    → a signed-in Reader chose to save it; the Server Action runs
 *   analysing → the request is running; elapsed time shows it is alive
 *   failed    → a retryable error; Try again repeats whatever failed
 *   done      → the summary, then the ranked Flags (or the clean verdict)
 *
 * Two ways through, chosen at confirm:
 *
 *   unsaved  Anyone. The text goes to /api/analyze and nothing is stored.
 *            The text lives in this component's state, so a retry never
 *            asks for it again.
 *   saved    Signed-in Readers (`canSave`). The text is saved as a Document
 *            (title optional), then analysed by id through
 *            /api/documents/[id]/analyses, which reads the stored text and
 *            stores the run. A failed analysis retries by id, from the stored
 *            text. On success the Reader goes to the Document's page, which
 *            shows the stored analysis.
 *
 * The text is sent as-is either way: no trimming, no normalising, because
 * Source Sentences are matched against exactly this string (ADR-0001).
 *
 * The routes rank the Flags and the analysis module has already dropped any
 * whose Source Sentence is not in the text; this screen only draws them,
 * through ./ReadingDesk.js, which also shows each one in the text. There is
 * no dismissing on an unsaved reading: it isn't kept, so a dismissal couldn't
 * be either.
 */

const NETWORK_ERROR = "Couldn’t reach Redline. Check your connection and try again. Your text is still here.";
const FALLBACK_ERROR = "The analysis didn’t finish. Your text is still here, so you can try again.";
const SAVED_FALLBACK_ERROR = "The analysis didn’t finish. Your document is saved, so you can try again.";

/** @param {{ canSave?: boolean }} props */
export default function ReadDocument({ canSave = false }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [documentId, setDocumentId] = useState(/** @type {string | null} */ (null));
  const [retry, setRetry] = useState(/** @type {"unsaved" | "save" | "saved"} */ ("unsaved"));
  const [stage, setStage] = useState(
    /** @type {"compose" | "confirm" | "saving" | "analysing" | "failed" | "done"} */ ("compose"),
  );
  const [summary, setSummary] = useState("");
  const [result, setResult] = useState(/** @type {{ flags: any[], checked: Array<{ id: string, label: string }> } | null} */ (null));
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const inFlight = useRef(/** @type {AbortController | null} */ (null));
  const headingRef = useRef(/** @type {HTMLHeadingElement | null} */ (null));
  const textareaId = useId();
  const titleId = useId();
  const hintId = useId();

  const hasText = text.trim() !== "";

  // Move focus to each new stage's heading so keyboard and screen-reader
  // users land on what changed.
  useEffect(() => {
    if (stage !== "compose") headingRef.current?.focus();
  }, [stage]);

  // Count seconds while the request runs.
  useEffect(() => {
    if (stage !== "analysing") return undefined;
    setElapsed(0);
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [stage]);

  // Abandon a running request if the Reader leaves the page.
  useEffect(() => () => inFlight.current?.abort(), []);

  /** Read the pasted text without saving it. */
  async function analyse() {
    setRetry("unsaved");
    await run("/api/analyze", JSON.stringify({ text }), null);
  }

  /** Save the Document, then analyse it by id. */
  async function saveAndRead() {
    setRetry("save");
    setError("");
    setStage("saving");
    /** @type {{ id: string } | { error: string }} */
    let saved;
    try {
      saved = await saveDocument({ title, text });
    } catch {
      saved = { error: NETWORK_ERROR };
    }
    if ("error" in saved) {
      setError(saved.error);
      setStage("failed");
      return;
    }
    setDocumentId(saved.id);
    await analyseSaved(saved.id);
  }

  /** Analyse a saved Document from its stored text. Also the retry. */
  async function analyseSaved(id) {
    setRetry("saved");
    await run(`/api/documents/${encodeURIComponent(id)}/analyses`, undefined, id);
  }

  /**
   * @param {string} url
   * @param {string | undefined} body
   * @param {string | null} savedId the Document's id when it is saved
   */
  async function run(url, body, savedId) {
    const controller = new AbortController();
    inFlight.current = controller;
    setError("");
    setStage("analysing");

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) return;
      setError(NETWORK_ERROR);
      setStage("failed");
      return;
    }

    const json = await response.json().catch(() => null);
    if (controller.signal.aborted) return;
    if (
      !response.ok ||
      !json ||
      typeof json.summary !== "string" ||
      !Array.isArray(json.flags) ||
      !Array.isArray(json.checked) ||
      json.checked.length === 0
    ) {
      setError(json && typeof json.error === "string" ? json.error : savedId ? SAVED_FALLBACK_ERROR : FALLBACK_ERROR);
      setStage("failed");
      return;
    }
    if (savedId) {
      // The stored analysis is what the Document's page shows.
      router.push(`/documents/${encodeURIComponent(savedId)}`);
      return;
    }
    setSummary(json.summary);
    setResult({ flags: json.flags, checked: json.checked });
    setStage("done");
  }

  function tryAgain() {
    if (retry === "saved" && documentId) analyseSaved(documentId);
    else if (retry === "save") saveAndRead();
    else analyse();
  }

  function changeText() {
    // Changed text is a new Document; one already saved stays in the library.
    setDocumentId(null);
    setStage("compose");
  }

  function startOver() {
    setText("");
    setTitle("");
    setDocumentId(null);
    setSummary("");
    setResult(null);
    setError("");
    setStage("compose");
  }

  return (
    <main className={styles.desk}>
      <article className={styles.paper}>
        {stage === "compose" ? (
          <form
            className={styles.stack}
            onSubmit={(event) => {
              event.preventDefault();
              if (hasText) setStage("confirm");
            }}
          >
            <h1 className={styles.heading}>Paste the document</h1>
            <p className={styles.lede} id={hintId}>
              {canSave ? (
                <>
                  Paste the full text of the agreement. You&rsquo;ll see it exactly as pasted before
                  it&rsquo;s read, and you decide whether to save it to your library.
                </>
              ) : (
                <>
                  Paste the full text of the agreement. You&rsquo;ll see it exactly as pasted before
                  it&rsquo;s read, and Redline doesn&rsquo;t keep a copy.
                </>
              )}
            </p>
            <label htmlFor={textareaId} className={styles.label}>
              Document text
            </label>
            <textarea
              id={textareaId}
              className={styles.textarea}
              aria-describedby={hintId}
              value={text}
              onChange={(event) => setText(event.target.value)}
              spellCheck={false}
              rows={16}
            />
            <div className={styles.actions}>
              <button type="submit" className={styles.action} disabled={!hasText}>
                Check the text
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.stack}>
            {stage === "confirm" ? (
              <>
                <h1 className={styles.heading} ref={headingRef} tabIndex={-1}>
                  Is this everything?
                </h1>
                <p className={styles.lede}>
                  This is exactly what Redline will read. If anything is cut off or missing, go back
                  and paste it again.
                </p>
                {canSave ? (
                  <form
                    className={styles.stack}
                    onSubmit={(event) => {
                      event.preventDefault();
                      saveAndRead();
                    }}
                  >
                    <label htmlFor={titleId} className={styles.label}>
                      Title
                    </label>
                    <input
                      id={titleId}
                      className={styles.input}
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder={defaultTitle(text)}
                      aria-describedby={`${titleId}-hint`}
                      maxLength={200}
                      autoComplete="off"
                    />
                    <p className={styles.hint} id={`${titleId}-hint`}>
                      Leave it blank to use the first line.
                    </p>
                    <div className={styles.actions}>
                      <button type="submit" className={styles.action}>
                        Save and read it
                      </button>
                      <button type="button" className={styles.quiet} onClick={analyse}>
                        Read it without saving
                      </button>
                      <button type="button" className={styles.quiet} onClick={changeText}>
                        Change the text
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className={styles.actions}>
                    <button type="button" className={styles.action} onClick={analyse}>
                      Read it
                    </button>
                    <button type="button" className={styles.quiet} onClick={changeText}>
                      Change the text
                    </button>
                  </div>
                )}
              </>
            ) : null}

            {stage === "saving" ? (
              <div className={styles.progress}>
                <h1 className={styles.heading} ref={headingRef} tabIndex={-1}>
                  Saving the document
                </h1>
                <p className={styles.lede}>
                  <span className={styles.pulse} aria-hidden="true" />
                  Redline reads it as soon as it&rsquo;s saved.
                </p>
              </div>
            ) : null}

            {stage === "analysing" ? (
              <div className={styles.progress}>
                <h1 className={styles.heading} ref={headingRef} tabIndex={-1}>
                  Reading the document
                </h1>
                <p className={styles.lede}>
                  <span className={styles.pulse} aria-hidden="true" />
                  {elapsed === 1 ? "1 second so far." : `${elapsed} seconds so far.`}
                </p>
              </div>
            ) : null}

            {stage === "failed" ? (
              <>
                <h1 className={styles.heading} ref={headingRef} tabIndex={-1}>
                  That didn&rsquo;t work
                </h1>
                <p className={styles.lede} role="alert">
                  {error}
                </p>
                <div className={styles.actions}>
                  <button type="button" className={styles.action} onClick={tryAgain}>
                    Try again
                  </button>
                  {documentId ? (
                    <Link className={styles.quiet} href={`/documents/${encodeURIComponent(documentId)}`}>
                      Open it in your library
                    </Link>
                  ) : (
                    <button type="button" className={styles.quiet} onClick={changeText}>
                      Change the text
                    </button>
                  )}
                </div>
              </>
            ) : null}

            {stage === "done" ? (
              <>
                <section className={styles.card} aria-labelledby={`${hintId}-summary`}>
                  <h1 className={styles.cardHeading} id={`${hintId}-summary`} ref={headingRef} tabIndex={-1}>
                    Summary
                  </h1>
                  <p className={styles.summary}>{summary}</p>
                </section>
                {result ? (
                  // Unsaved: no dismissing here. A dismissal is kept per Flag in
                  // the library, and nothing about this reading is kept.
                  <ReadingDesk
                    text={text}
                    flags={result.flags}
                    checked={result.checked}
                    headingId={`${hintId}-flags`}
                    // Questions about an unsaved reading carry the text with them
                    // and are kept only on this page.
                    questions={{ url: "/api/questions", text }}
                  >
                    <div className={styles.actions}>
                      <button type="button" className={styles.quiet} onClick={startOver}>
                        Read another document
                      </button>
                    </div>
                  </ReadingDesk>
                ) : null}
              </>
            ) : null}

            {stage === "done" && result ? null : (
              <>
                <h2 className={styles.label}>The document</h2>
                <div
                  className={styles.document}
                  data-busy={stage === "analysing" || stage === "saving" || undefined}
                >
                  {text}
                </div>
              </>
            )}
          </div>
        )}

        <p className={styles.footer}>AI-generated analysis, not legal advice.</p>
      </article>
    </main>
  );
}
