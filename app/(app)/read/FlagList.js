import { CLAUSE_TYPES } from "../../../lib/analysis/clause-types.js";
import { SEVERITY_IDS, severityLabel } from "../../../lib/analysis/severity.js";
import CounterOffer from "./CounterOffer";
import styles from "./flags.module.css";

/*
 * The result after the summary: the ranked Flags as index tabs, or, when
 * nothing survived, one white tab saying so with the list of what was looked
 * for (story 46a).
 *
 * Flags arrive already ranked and already checked: the route ranks them, and
 * the analysis module has dropped any Flag whose Source Sentence is not in the
 * Document (ADR-0001). Nothing here re-checks or reorders.
 *
 * Rank is carried by a word (the ordinal) as well as by colour and size
 * (DESIGN.md, The Word-With-Color Rule). The tab's colour follows the Flag's
 * severity band, so equal severities share a colour. Pulling a tab to scroll
 * to its sentence on the page is ticket #23; here every tab is open.
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

/**
 * @param {{
 *   flags: Array<{ severity: string, clauseType: string, sourceSentence: string, whatItMeans: string, whyDangerous: string, counterOffer: string | null, redLine: { id: string, text: string } | null }>,
 *   checked: Array<{ id: string, label: string }>,
 *   headingId: string,
 * }} props
 */
export default function FlagList({ flags, checked, headingId }) {
  if (flags.length === 0) {
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

  const total = flags.length;

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 className={styles.sectionHeading} id={headingId}>
        {total === 1 ? "1 clause could hurt you" : `${total} clauses could hurt you`}
      </h2>
      <p className={styles.lede}>
        Worst first. Each one quotes the sentence it came from, word for word, so you can find it in
        your copy.
      </p>
      <ol className={styles.list}>
        {flags.map((flag, i) => {
          const rank = ordinal(i + 1);
          const band = SEVERITY_IDS.indexOf(flag.severity) + 1;
          return (
            <li key={`${i}-${flag.sourceSentence}`} className={styles.tab} data-band={band} data-first={i === 0 || undefined}>
              <h3 className={styles.face}>
                <span className={styles.rank}>{rank}</span>
                <span className={styles.heading}>{CLAUSE_LABELS.get(flag.clauseType) ?? flag.clauseType}</span>
              </h3>
              <div className={styles.body}>
                <p className={styles.meta}>
                  Ranked {rank} of {total}. Severity: {severityLabel(flag.severity).toLowerCase()}.
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
        })}
      </ol>
    </section>
  );
}
