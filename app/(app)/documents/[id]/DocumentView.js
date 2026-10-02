import Link from "next/link";
import { formatDay } from "../../../../lib/documents/dates.js";
import { sameRedLines } from "../../../../lib/red-lines/text.js";
import FlagList from "../../read/FlagList";
import read from "../../read/read.module.css";
import AnalyseDocument from "./AnalyseDocument";

/*
 * One saved Document and its latest analysis, as page.js loaded them. The
 * "AI-generated, not legal advice" line is in the paper's footer, the same
 * place as on /read, printed whether or not the Document has been read yet.
 *
 * Under the summary: the Red Lines this reading used, from the analysis's
 * snapshot (so an edited or deleted Red Line reads as it did then), and a
 * note when the Reader's Red Lines have changed since, so they know to read
 * it again.
 */

/**
 * @param {{
 *   document: import("../../../../lib/documents/store.js").StoredDocument,
 *   analysis: ReturnType<typeof import("../../../../lib/documents/rows.js").analysisFromRecord>,
 *   redLines: Array<{ id: string, text: string }>,
 * }} props
 */
export default function DocumentView({ document, analysis, redLines }) {
  const dates = [`Saved ${formatDay(document.savedAt)}`];
  if (analysis) dates.push(`read ${formatDay(analysis.createdAt)}`);

  return (
    <main className={read.desk}>
      <article className={read.paper}>
        <div className={read.stack}>
          <p className={read.hint}>
            <Link href="/library" className={read.quiet}>
              Your library
            </Link>
          </p>
          <h1 className={read.heading}>{document.title}</h1>
          <p className={read.hint}>{dates.join(", ")}</p>

          <AnalyseDocument documentId={document.id} hasAnalysis={Boolean(analysis)} />

          {analysis ? (
            <>
              <section className={read.card} aria-labelledby="summary-heading">
                <h2 className={read.cardHeading} id="summary-heading">
                  Summary
                </h2>
                <p className={read.summary}>{analysis.summary}</p>
              </section>
              <UsedRedLines used={analysis.redLines} current={redLines} />
              <FlagList flags={analysis.flags} checked={analysis.checked} headingId="flags-heading" />
            </>
          ) : null}

          <h2 className={read.label}>The document</h2>
          <div className={read.document}>{document.text}</div>
        </div>

        <p className={read.footer}>AI-generated analysis, not legal advice.</p>
      </article>
    </main>
  );
}

/**
 * @param {{ used: Array<{ id: string, text: string }>, current: Array<{ id: string, text: string }> }} props
 */
function UsedRedLines({ used, current }) {
  const changed = !sameRedLines(used, current);
  return (
    <section className={read.stack} aria-labelledby="used-red-lines-heading">
      <h2 className={read.label} id="used-red-lines-heading">
        Red lines this reading used
      </h2>
      {used.length === 0 ? (
        <p className={read.hint}>None. This one was read without red lines.</p>
      ) : (
        <ul className={read.usedRedLines}>
          {used.map((r) => (
            <li key={r.id}>{r.text}</li>
          ))}
        </ul>
      )}
      {changed ? (
        <p className={read.hint} role="note">
          Your red lines have changed since then. Read it again to check it against the ones you
          have now, or <Link href="/red-lines" className={read.inline}>see your red lines</Link>.
        </p>
      ) : null}
    </section>
  );
}
