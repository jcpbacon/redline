"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./read.module.css";

/*
 * One screen, five states:
 *
 *   compose   → the Reader pastes the Document
 *   confirm   → the text shown exactly as pasted, before anything is sent
 *   analysing → the request is running; elapsed time shows it is alive
 *   failed    → a retryable error; Retry sends the same text again
 *   done      → the summary
 *
 * The text lives in this component's state from paste to result, so a retry
 * never asks for it again. It is sent as-is: no trimming, no normalising,
 * because Source Sentences are matched against exactly this string
 * (ADR-0001).
 *
 * Flags are in the response but not drawn here; ticket #29 builds that list.
 */

const NETWORK_ERROR = "Couldn’t reach Redline. Check your connection and try again. Your text is still here.";
const FALLBACK_ERROR = "The analysis didn’t finish. Your text is still here, so you can try again.";

export default function ReadDocument() {
  const [text, setText] = useState("");
  const [stage, setStage] = useState(/** @type {"compose" | "confirm" | "analysing" | "failed" | "done"} */ ("compose"));
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const inFlight = useRef(/** @type {AbortController | null} */ (null));
  const headingRef = useRef(/** @type {HTMLHeadingElement | null} */ (null));
  const textareaId = useId();
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

  async function analyse() {
    const controller = new AbortController();
    inFlight.current = controller;
    setError("");
    setStage("analysing");

    let response;
    try {
      response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) return;
      setError(NETWORK_ERROR);
      setStage("failed");
      return;
    }

    const body = await response.json().catch(() => null);
    if (controller.signal.aborted) return;
    if (!response.ok || !body || typeof body.summary !== "string") {
      setError(body && typeof body.error === "string" ? body.error : FALLBACK_ERROR);
      setStage("failed");
      return;
    }
    setSummary(body.summary);
    setStage("done");
  }

  function startOver() {
    setText("");
    setSummary("");
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
              Paste the full text of the agreement. You&rsquo;ll see it exactly as pasted before
              it&rsquo;s read, and Redline doesn&rsquo;t keep a copy.
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
                <div className={styles.actions}>
                  <button type="button" className={styles.action} onClick={analyse}>
                    Read it
                  </button>
                  <button type="button" className={styles.quiet} onClick={() => setStage("compose")}>
                    Change the text
                  </button>
                </div>
              </>
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
                  <button type="button" className={styles.action} onClick={analyse}>
                    Try again
                  </button>
                  <button type="button" className={styles.quiet} onClick={() => setStage("compose")}>
                    Change the text
                  </button>
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
                <p className={styles.note}>
                  Only the summary is shown for now. The list of clauses that could hurt you
                  isn&rsquo;t built yet, so don&rsquo;t read this as a clean result.
                </p>
                <div className={styles.actions}>
                  <button type="button" className={styles.quiet} onClick={startOver}>
                    Read another document
                  </button>
                </div>
              </>
            ) : null}

            <h2 className={styles.label}>The document</h2>
            <div className={styles.document} data-busy={stage === "analysing" || undefined}>
              {text}
            </div>
          </div>
        )}

        <p className={styles.footer}>AI-generated analysis, not legal advice.</p>
      </article>
    </main>
  );
}
