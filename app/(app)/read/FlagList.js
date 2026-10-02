import { CLAUSE_TYPES } from "../../../lib/analysis/clause-types.js";
import { SEVERITY_IDS, severityLabel } from "../../../lib/analysis/severity.js";
import CounterOffer from "./CounterOffer";
import styles from "./flags.module.css";

/*
 * The pieces of the Flag list: one index tab per Flag, and the single white
 * tab for a clean Document (story 46a). ./ReadingDesk.js arranges them, keeps
 * track of which tab is pulled and which the Reader has dismissed, and draws
 * the Document beside them.
 *
 * Flags arrive already ranked and already checked: the route ranks them, and
 * the analysis module has dropped any Flag whose Source Sentence is not in the
 * Document (ADR-0001). Nothing here re-checks or reorders.
 *
 * Rank is carried by a word (the ordinal) as well as by colour and size
 * (DESIGN.md, The Word-With-Color Rule). The tab's colour follows the Flag's
 * severity band, so equal severities share a colour. `rank` is the Flag's
 * place in the analysis's ranking and stays the same when others are
 * dismissed.
 *
 * Each tab ends with its drafted Counter-offer (./CounterOffer.js). The
 * Counter-offer is optional: a Flag without one is still drawn, with a line
 * saying none was drafted. The Source Sentence is not optional, and is never
 * missing here (ADR-0001).
 */

const CLAUSE_LABELS = new Map(CLAUSE_TYPES.map((t) => [t.id, t.label]));

/** 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd". */
export function ordinal(n) {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** The band a Flag's colour comes from: 1 is the most severe. */
export function bandOf(flag) {
  return SEVERITY_IDS.indexOf(flag.severity) + 1;
}

/**
 * @typedef {{ severity: string, clauseType: string, sourceSentence: string, whatItMeans: string, whyDangerous: string, counterOffer: string | null, redLine: { id: string | null, text: string } | null, position?: number, id?: string, dismissedAt?: string | null }} TabFlag
 */

/**
 * @param {{ checked: Array<{ id: string, label: string }>, headingId: string }} props
 */
export function CleanVerdict({ checked, headingId }) {
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.tab} data-band="clean">
        <h2 className={styles.face} id={headingId}>
          <span className={styles.heading}>Nothing flagged</span>
        </h2>
        <div className={styles.body}>
          <p className={styles.text}>
            Redline looked for these kinds of clauses and found none that could hurt you:
          </p>
          <ul className={styles.checked}>
            {checked.map((type) => (
              <li key={type.id}>{type.label}</li>
            ))}
          </ul>
          <p className={styles.meta}>
            It didn&rsquo;t check for anything else, so read the rest before you sign.
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * One Flag as an index tab.
 *
 * @param {{
 *   flag: TabFlag,
 *   rank: number,
 *   total: number,
 *   active: boolean,
 *   onShow: () => void,
 *   showRef: (node: HTMLButtonElement | null) => void,
 *   documentId: string,
 *   dismiss?: { dismissed: boolean, pending: boolean, onToggle: () => void },
 * }} props
 */
export function FlagTab({ flag, rank, total, active, onShow, showRef, documentId, dismiss }) {
  const place = ordinal(rank);
  const band = bandOf(flag);
  const headingId = `flag-${rank}-heading`;
  return (
    <li
      className={styles.tab}
      data-band={band}
      data-first={rank === 1 || undefined}
      data-active={active || undefined}
      data-dismissed={dismiss?.dismissed || undefined}
    >
      <h3 className={styles.face} id={headingId}>
        <span className={styles.rank}>{place}</span>
        <span className={styles.heading}>{CLAUSE_LABELS.get(flag.clauseType) ?? flag.clauseType}</span>
      </h3>
      <div className={styles.body}>
        <p className={styles.meta}>
          Ranked {place} of {total}. Severity: {severityLabel(flag.severity).toLowerCase()}.
          {dismiss?.dismissed ? " You dismissed this one." : null}
        </p>
        {flag.redLine ? (
          <p className={styles.redLine}>
            <span className={styles.redLineTag}>Breaks your red line</span>{" "}
            <span className={styles.redLineText}>{flag.redLine.text}</span>
          </p>
        ) : null}
        <p className={styles.label}>The sentence</p>
        <blockquote className={styles.sentence}>
          <mark className={styles.mark} data-band={band}>
            {flag.sourceSentence}
          </mark>
        </blockquote>
        <div className={styles.tabActions}>
          <button
            type="button"
            className={styles.find}
            onClick={onShow}
            ref={showRef}
            aria-controls={documentId}
            aria-describedby={headingId}
          >
            Show it in the document
          </button>
          {dismiss ? (
            <button
              type="button"
              className={styles.dismiss}
              onClick={dismiss.onToggle}
              disabled={dismiss.pending}
              aria-describedby={headingId}
            >
              {dismiss.pending ? "Saving…" : dismiss.dismissed ? "Put it back" : "Dismiss"}
            </button>
          ) : null}
        </div>
        <p className={styles.label}>What it means</p>
        <p className={styles.text}>{flag.whatItMeans}</p>
        <p className={styles.label}>Why it&rsquo;s dangerous</p>
        <p className={styles.text}>{flag.whyDangerous}</p>
        {typeof flag.counterOffer === "string" && flag.counterOffer.trim() !== "" ? (
          <CounterOffer draft={flag.counterOffer} />
        ) : (
          <p className={`${styles.meta} ${styles.noCounter}`}>
            Redline didn&rsquo;t draft a counter-offer for this clause.
          </p>
        )}
      </div>
    </li>
  );
}
