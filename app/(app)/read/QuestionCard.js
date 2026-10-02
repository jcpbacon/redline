"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MAX_QUESTION_LENGTH, prepareQuestion } from "../../../lib/questions/text.js";
import styles from "./read.module.css";

/*
 * The question box: a ruled index card (stories 29–33, app shell brief).
 * Docked bottom-right of the result on a wide desk, in the page's flow
 * below the Flags otherwise (read.module.css, .questionCard).
 *
 * The Reader types a question; the answer comes back grounded in Source
 * Sentences, set in the contract's face, each with a button that shows it in
 * the Document (ReadingDesk draws the highlight), or as a plain refusal when
 * the Document doesn't cover it. The answer module has already checked every
 * grounding sentence against the text; the card checks again before drawing
 * one (`onShow` throws on a sentence that isn't there), so a citation that
 * can't be shown is never shown (ADR-0001).
 *
 * Questions run oldest first, newest at the bottom by the input, so a
 * follow-up reads in order. `ask` decides where the question goes:
 *
 *   { url, text }  unsaved reading: the text and the earlier questions go
 *                  with every question; nothing is kept after the page goes.
 *   { url }        saved Document: the server reads the text and the earlier
 *                  questions itself and stores the new one; `initial` is the
 *                  stored history, so it's all here again after a reload.
 */

/**
 * @typedef {import("../../../lib/questions/text.js").AskedQuestion} AskedQuestion
 * @typedef {{ url: string, text?: string, initial?: AskedQuestion[] }} QuestionSource
 */

const REFUSAL = "The document doesn’t cover this. Ask the other party about it before you sign.";
const NETWORK_ERROR = "Couldn’t reach Redline. Check your connection, then ask again. Your question is still here.";
const FALLBACK_ERROR = "Redline couldn’t answer that just now. Your question is still here, so you can ask again.";

/**
 * @param {{
 *   source: QuestionSource,
 *   activeKey: string | null,
 *   onShow: (key: string, sentence: string) => void,
 *   showRef: (key: string, node: HTMLButtonElement | null) => void,
 * }} props
 */
export default function QuestionCard({ source, activeKey, onShow, showRef }) {
  const id = useId();
  const [asked, setAsked] = useState(() => /** @type {AskedQuestion[]} */ (source.initial ?? []));
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(/** @type {string | null} */ (null));
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const inFlight = useRef(/** @type {AbortController | null} */ (null));
  const card = useRef(/** @type {HTMLElement | null} */ (null));
  const keys = useRef(new Map());

  useEffect(() => {
    if (pending === null) return undefined;
    setElapsed(0);
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [pending]);

  // Abandon a running question if the Reader leaves the page.
  useEffect(() => () => inFlight.current?.abort(), []);

  /** A stable key per question, for the highlight and its way back. */
  function keyOf(/** @type {AskedQuestion} */ q, /** @type {number} */ i) {
    if (q.id) return q.id;
    if (!keys.current.has(q)) keys.current.set(q, `${id}-${i}`);
    return keys.current.get(q);
  }

  async function ask() {
    if (pending !== null) return;
    const prepared = prepareQuestion(draft);
    if ("error" in prepared) {
      setError(prepared.error);
      return;
    }
    const question = prepared.question;
    const body =
      source.text === undefined
        ? { question }
        : {
            question,
            text: source.text,
            history: asked.map((q) => ({ question: q.question, text: q.text, unanswerable: q.unanswerable })),
          };

    const controller = new AbortController();
    inFlight.current = controller;
    setError("");
    setStatus("");
    setPending(question);

    let response;
    try {
      response = await fetch(source.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) return;
      setPending(null);
      setError(NETWORK_ERROR);
      return;
    }
    const json = await response.json().catch(() => null);
    if (controller.signal.aborted) return;
    setPending(null);

    const answer = json?.question;
    if (!response.ok || !answer || typeof answer.question !== "string" || typeof answer.unanswerable !== "boolean") {
      setError(json && typeof json.error === "string" ? json.error : FALLBACK_ERROR);
      return;
    }
    setAsked((current) => [...current, answer]);
    setDraft("");
    setStatus(answer.unanswerable ? "The document doesn’t cover that question." : "The answer is at the bottom of the card.");
  }

  // When the card is docked and scrolls on its own, keep its newest answer
  // (or the progress line) in view. This moves the card's scroll, never the page's.
  useEffect(() => {
    const node = card.current;
    if (node && node.scrollHeight > node.clientHeight) node.scrollTop = node.scrollHeight;
  }, [asked.length, pending]);

  return (
    <section className={styles.questionCard} ref={card} aria-labelledby={`${id}-heading`}>
      <h2 className={styles.cardHeading} id={`${id}-heading`}>
        Ask the document
      </h2>
      <p className={styles.questionHint}>
        Redline answers only from this document and shows the sentences each answer comes from.
      </p>

      {asked.length > 0 ? (
        <ol className={styles.qaList}>
          {asked.map((q, i) => {
            const key = keyOf(q, i);
            return (
              <li key={key} className={styles.qa}>
                <p className={styles.qaQuestion}>{q.question}</p>
                {q.unanswerable ? (
                  <p className={styles.qaRefusal}>{REFUSAL}</p>
                ) : (
                  <>
                    <p className={styles.qaAnswer}>{q.text}</p>
                    <p className={styles.qaLabel}>From the document</p>
                    <ul className={styles.qaSources}>
                      {q.groundedIn.map((sentence, n) => {
                        const sentenceKey = `${key}:${n}`;
                        return (
                          <li key={sentenceKey}>
                            <blockquote className={styles.qaSentence}>{sentence}</blockquote>
                            <button
                              type="button"
                              className={styles.qaShow}
                              aria-pressed={activeKey === sentenceKey}
                              ref={(node) => showRef(sentenceKey, node)}
                              onClick={() => onShow(sentenceKey, sentence)}
                            >
                              Show it in the document
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}

      {pending !== null ? (
        <div className={styles.qa}>
          <p className={styles.qaQuestion}>{pending}</p>
          <p className={styles.qaProgress}>
            <span className={styles.pulse} aria-hidden="true" />
            Looking for the answer in the document. {elapsed === 1 ? "1 second" : `${elapsed} seconds`} so far.
          </p>
        </div>
      ) : null}

      <p className={styles.visuallyHidden} role="status">
        {status}
      </p>
      {error ? (
        <p className={styles.qaError} role="alert">
          {error}
        </p>
      ) : null}

      <form
        className={styles.qaForm}
        onSubmit={(event) => {
          event.preventDefault();
          ask();
        }}
      >
        <label htmlFor={`${id}-question`} className={styles.qaLabel}>
          Your question
        </label>
        <textarea
          id={`${id}-question`}
          className={styles.qaInput}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter asks; Shift+Enter starts a new line.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              ask();
            }
          }}
          placeholder="Can they end this early?"
          maxLength={MAX_QUESTION_LENGTH}
          rows={2}
        />
        <div className={styles.actions}>
          <button type="submit" className={styles.action} disabled={pending !== null || draft.trim() === ""}>
            {error && draft.trim() !== "" ? "Ask again" : "Ask"}
          </button>
        </div>
      </form>
    </section>
  );
}
