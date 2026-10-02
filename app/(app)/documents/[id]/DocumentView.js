import Link from "next/link";
import { formatDay } from "../../../../lib/documents/dates.js";
import FlagList from "../../read/FlagList";
import read from "../../read/read.module.css";
import AnalyseDocument from "./AnalyseDocument";

/*
 * One saved Document and its latest analysis, as page.js loaded them. The
 * "AI-generated, not legal advice" line is in the paper's footer, the same
 * place as on /read, printed whether or not the Document has been read yet.
 */

/**
 * @param {{
 *   document: import("../../../../lib/documents/store.js").StoredDocument,
 *   analysis: ReturnType<typeof import("../../../../lib/documents/rows.js").analysisFromRecord>,
 * }} props
 */
export default function DocumentView({ document, analysis }) {
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
