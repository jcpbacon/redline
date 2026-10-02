"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import styles from "../../read/read.module.css";

/*
 * Read a saved Document (again). POSTs to /api/documents/[id]/analyses, which
 * reads the stored text, runs the analysis and stores it as a new run. On
 * success the page refreshes and shows the newest analysis from the
 * database. On failure the error stays here with Try again, which repeats
 * the same request: the text comes from the database, so nothing has to be
 * pasted again (story 47). Elapsed seconds show the request is alive
 * (story 48).
 */

const NETWORK_ERROR = "Couldn’t reach Redline. Check your connection and try again. Your document is saved.";
const FALLBACK_ERROR = "The analysis didn’t finish. Your document is saved, so you can try again.";

/** @param {{ documentId: string, hasAnalysis: boolean }} props */
export default function AnalyseDocument({ documentId, hasAnalysis }) {
  const router = useRouter();
  const [state, setState] = useState(/** @type {"idle" | "running" | "failed"} */ ("idle"));
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [refreshing, startRefresh] = useTransition();
  const inFlight = useRef(/** @type {AbortController | null} */ (null));

  useEffect(() => {
    if (state !== "running") return undefined;
    setElapsed(0);
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [state]);

  useEffect(() => () => inFlight.current?.abort(), []);

  async function analyse() {
    const controller = new AbortController();
    inFlight.current = controller;
    setError("");
    setState("running");

    let response;
    try {
      response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/analyses`, {
        method: "POST",
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) return;
      setError(NETWORK_ERROR);
      setState("failed");
      return;
    }
    const json = await response.json().catch(() => null);
    if (controller.signal.aborted) return;
    if (!response.ok || !json || typeof json.summary !== "string") {
      setError(json && typeof json.error === "string" ? json.error : FALLBACK_ERROR);
      setState("failed");
      return;
    }
    startRefresh(() => {
      router.refresh();
      setState("idle");
    });
  }

  if (state === "running" || refreshing) {
    return (
      <p className={styles.lede} role="status">
        <span className={styles.pulse} aria-hidden="true" />
        Reading the document. {elapsed === 1 ? "1 second so far." : `${elapsed} seconds so far.`}
      </p>
    );
  }

  if (state === "failed") {
    return (
      <div className={styles.stack}>
        <p className={styles.lede} role="alert">
          {error}
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.action} onClick={analyse}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!hasAnalysis) {
    return (
      <div className={styles.stack}>
        <p className={styles.lede}>Redline hasn&rsquo;t read this one yet.</p>
        <div className={styles.actions}>
          <button type="button" className={styles.action} onClick={analyse}>
            Read it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.actions}>
      <button type="button" className={styles.quiet} onClick={analyse}>
        Read it again
      </button>
    </div>
  );
}
