import { notFound } from "next/navigation";
import { analysisFromRecord } from "../../../../lib/documents/rows.js";
import { readerStore } from "../../../../lib/documents/session.js";
import { questionsFromRows } from "../../../../lib/questions/text.js";
import { readerRedLines } from "../../../../lib/red-lines/index.js";
import Notice, { AccountsOff, SignInFirst } from "../../Notice";
import DocumentView from "./DocumentView";

/*
 * /documents/[id]: one saved Document, reopened (stories 39, 41, 47).
 *
 * Shows the stored text and the most recent analysis (summary, ranked Flags,
 * Counter-offers) straight from the database: opening the page never calls
 * the model. The control at the top runs a new analysis by id; that inserts a
 * new analyses row and this page shows it on refresh.
 *
 * A Document that isn't this Reader's is not found: row-level security
 * returns nothing for it, exactly as for an id that never existed, so the
 * answer never says whether it exists.
 *
 * The Reader's current Red Lines are loaded too, so the page can say which
 * Red Lines the shown analysis used (its snapshot) and whether they have
 * changed since, which is the Reader's cue to read it again.
 *
 * A stored Flag whose Source Sentence isn't in the stored text makes
 * analysisFromRecord throw rather than render it (ADR-0001).
 *
 * The questions asked of this Document are loaded too, oldest first, for the
 * question box (ticket #24).
 *
 * Drawing is ./DocumentView.js, which carries the "AI-generated, not legal
 * advice" line.
 */

export const metadata = {
  title: "Document · Redline",
};

export default async function DocumentPage({ params }) {
  const { id } = await params;

  const session = await readerStore();
  if (session.state === "off") return <AccountsOff />;
  if (session.state === "signed-out") {
    return <SignInFirst what="Saved documents open only for the account that saved them. Sign in to see yours." />;
  }

  let document;
  let record;
  let redLines = [];
  let questionRows = [];
  try {
    document = await session.store.getDocument(id);
    record = document ? await session.store.latestAnalysis(document.id) : null;
    if (document) redLines = await readerRedLines(session.store);
    if (document) questionRows = await session.store.listQuestions(document.id);
  } catch (error) {
    console.error("Couldn't load a Document:", error);
    return (
      <Notice heading="This document didn’t load" href={`/documents/${encodeURIComponent(id)}`} action="Try again">
        Redline couldn&rsquo;t reach your saved documents just now. Try again in a moment.
      </Notice>
    );
  }
  if (!document) notFound();

  const analysis = analysisFromRecord(record, document.text);
  // Throws, like a stored Flag, if a stored answer rests on a sentence that
  // isn't in the stored text (ADR-0001).
  const questions = questionsFromRows(questionRows, document.text);
  return <DocumentView document={document} analysis={analysis} redLines={redLines} questions={questions} />;
}
