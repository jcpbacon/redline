import Link from "next/link";
import Tab from "./Tab";
import styles from "./page.module.css";

const SIGN_IN = "/sign-in";

const FLAGS = {
  license: {
    rank: 1,
    ordinal: "1st",
    heading: "They own your video forever",
    meaning:
      "Once you post it, the brand can use it wherever and for as long as it likes, including in ads or cut a different way, and you can't take that back.",
  },
  indemnity: {
    rank: 2,
    ordinal: "2nd",
    heading: "You pay their legal bills",
    meaning:
      "If anyone sues over the content, including over changes the brand made to it, you cover the brand's costs and its lawyers. There's no cap.",
  },
  payment: {
    rank: 3,
    ordinal: "3rd",
    heading: "Paid 90 days after they say so",
    meaning:
      "The payment clock only starts when the brand approves in writing, and the contract lets them refuse to. Then it's another three months.",
  },
};

function Clause({ number, title, children, flag, id }) {
  return (
    <div className={styles.clause}>
      <p className={styles.clauseText}>
        <b className={styles.clauseTitle}>
          {number}. {title}.
        </b>{" "}
        {children}
      </p>
      {flag ? (
        <Tab
          rank={flag.rank}
          ordinal={flag.ordinal}
          heading={flag.heading}
          meaning={flag.meaning}
          sentenceId={id}
        />
      ) : null}
    </div>
  );
}

function Mark({ rank, id, children }) {
  return (
    <mark id={id} className={styles.mark} data-rank={rank}>
      {children}
    </mark>
  );
}

export default function HomePage() {
  return (
    <main className={styles.table}>
      <h1 className={styles.srOnly}>Redline</h1>

      <aside className={styles.card} aria-label="What Redline is">
        <p className={styles.wordmark}>Redline</p>
        <p className={styles.hook}>
          Read the contract before you sign it. Every warning points at the
          sentence it came from.
        </p>
      </aside>

      <section className={styles.desk} aria-label="A sample agreement with its flags">
        <article className={styles.paper}>
          <p className={styles.stamp} aria-label="Sample agreement, written for this demonstration">
            Sample<span className={styles.stampNote}>written for this demonstration</span>
          </p>

          <h2 className={styles.paperTitle}>Influencer Collaboration Agreement</h2>
          <p className={styles.clauseText}>
            This Agreement is made between Halcyon Skincare, Inc. (&ldquo;Brand&rdquo;) and the
            undersigned content creator (&ldquo;Creator&rdquo;) as of the date last signed below.
          </p>

          <Clause number={1} title="Deliverables">
            Creator will produce two (2) short-form videos and one (1) static post featuring the
            Product, for publication on Creator&rsquo;s channels between October 1 and October 31,
            2026.
          </Clause>

          <Clause number={2} title="Approval">
            Creator will submit each item of Content for Brand&rsquo;s review at least five (5)
            business days before its scheduled publication date.
          </Clause>

          <Clause number={3} title="License" flag={FLAGS.license} id="sentence-license">
            <Mark rank={1} id="sentence-license">
              Creator hereby grants Brand a perpetual, irrevocable, worldwide, royalty-free license
              to use, reproduce, modify, and distribute the Content, in whole or in part, in any
              media now known or hereafter devised.
            </Mark>
          </Clause>

          <Clause number={4} title="Indemnification" flag={FLAGS.indemnity} id="sentence-indemnity">
            <Mark rank={2} id="sentence-indemnity">
              Creator shall indemnify, defend, and hold harmless Brand and its affiliates from and
              against any and all claims, losses, and expenses, including reasonable
              attorneys&rsquo; fees, arising out of or relating to the Content.
            </Mark>
          </Clause>

          <Clause number={5} title="Compensation" flag={FLAGS.payment} id="sentence-payment">
            Brand will pay Creator the Fee set out in Schedule A.{" "}
            <Mark rank={3} id="sentence-payment">
              Payment shall be due ninety (90) days following Brand&rsquo;s written approval of the
              final Content, which approval may be withheld in Brand&rsquo;s sole discretion.
            </Mark>
          </Clause>

          <Clause number={6} title="Disclosure">
            Creator will comply with the FTC Endorsement Guides and clearly disclose the material
            connection to Brand in each post.
          </Clause>

          <Clause number={7} title="Governing Law">
            This Agreement is governed by the laws of the State of Delaware.
          </Clause>

          <div className={styles.signatures} aria-hidden="true">
            <span>Brand ______________________</span>
            <span>Creator ______________________</span>
            <span>Date ____________</span>
          </div>

          <Link href={SIGN_IN} className={styles.action}>
            Try it on a document
          </Link>
        </article>
      </section>

      <section className={styles.sheet} aria-label="About Redline">
        <div className={styles.sheetInner}>
          <h2 className={styles.sheetHeading}>Who it&rsquo;s for</h2>
          <p>
            Creators and freelancers looking at a brand deal, a client agreement, or a licensing
            deal, before signing, while there&rsquo;s still time to ask for a change.
          </p>

          <h2 className={styles.sheetHeading}>What you get</h2>
          <p>
            A plain-English summary, then the clauses that could hurt you, ranked, each with the
            exact sentence it came from and a counter-offer you could send back. You can also ask
            the document questions. It answers only from the text, and says so when the text
            doesn&rsquo;t cover it.
          </p>

          <h2 className={styles.sheetHeading}>The rule</h2>
          <p>
            If Redline can&rsquo;t show you the sentence a warning came from, you don&rsquo;t see
            the warning. Every flag is something you can check against your own copy.
          </p>

          <h2 className={styles.sheetHeading}>Your file stays with you</h2>
          <p>
            The document is read in your browser. Only the text comes to us; the file itself is
            never uploaded.
          </p>

          <h2 className={styles.sheetHeading}>What it reads</h2>
          <p>
            PDFs with a text layer, Word files, and text you paste in. It won&rsquo;t read scans or
            photos, because a warning that points at misread text is worse than none.
          </p>

          <h2 className={styles.sheetHeading}>What it isn&rsquo;t</h2>
          <p>
            Redline tells you what the document says. It&rsquo;s AI-generated analysis, not legal
            advice, and it won&rsquo;t tell you whether to sign.
          </p>

          <Link href={SIGN_IN} className={styles.actionSheet}>
            Try it on a document
          </Link>
        </div>
      </section>
    </main>
  );
}
