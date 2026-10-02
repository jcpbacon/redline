"use client";

import { useEffect, useId, useReducer } from "react";
import { copyText, counterOfferReducer, initialCounterOffer } from "./counter-offer.js";
import styles from "./flags.module.css";

/*
 * One Flag's drafted Counter-offer, editable in place and copied from the tab
 * (stories 25–28). Edits live in this component's state only: they are never
 * sent or stored, so reloading shows the original draft (spec, "Client-only
 * behaviour"). The logic is in ./counter-offer.js.
 *
 * The copy result is announced through a status region that is always in the
 * DOM, and cleared after a few seconds so copying the same text again is
 * announced again.
 */

const MESSAGES = {
  idle: "",
  copied: "Copied. Paste it into your email.",
  failed: "Your browser blocked the copy. Select the text and copy it yourself.",
};

const SETTLE_MS = 4000;

/** @param {{ draft: string }} props */
export default function CounterOffer({ draft }) {
  const [state, dispatch] = useReducer(counterOfferReducer, draft, initialCounterOffer);
  const id = useId();

  useEffect(() => {
    if (state.status === "idle") return undefined;
    const timer = setTimeout(() => dispatch({ type: "settle" }), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [state.status]);

  async function copy() {
    const text = state.text;
    const outcome = await copyText(text, typeof navigator === "undefined" ? undefined : navigator.clipboard);
    dispatch({ type: outcome, text });
  }

  return (
    <div className={styles.counter}>
      <label className={styles.label} htmlFor={`${id}-text`}>
        What you could ask for instead
      </label>
      <p className={styles.meta} id={`${id}-hint`}>
        Edit it to fit before you send it. Redline doesn&rsquo;t save your changes.
      </p>
      <textarea
        id={`${id}-text`}
        className={styles.counterText}
        aria-describedby={`${id}-hint`}
        value={state.text}
        onChange={(event) => dispatch({ type: "edit", text: event.target.value })}
        spellCheck
      />
      <div className={styles.counterActions}>
        <button type="button" className={styles.copy} onClick={copy} disabled={state.text.trim() === ""}>
          Copy
        </button>
        <p className={styles.copyStatus} role="status" data-status={state.status}>
          {MESSAGES[state.status]}
        </p>
      </div>
    </div>
  );
}
