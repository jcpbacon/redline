import { readerStore } from "../../../lib/documents/session.js";
import { readerRedLines } from "../../../lib/red-lines/index.js";
import Notice, { AccountsOff, SignInFirst } from "../Notice";
import RedLinesView from "./RedLinesView";

/*
 * /red-lines: the signed-in Reader's Red Lines (stories 24, 34–38).
 *
 * A ruled list on an index card, each line editable in place and deletable,
 * with a line at the bottom for a new one. A Reader who has never had Red
 * Lines gets the seed set the first time they are read
 * (lib/red-lines/index.js), here or in their first analysis. Row-level
 * security keeps each Reader's list their own.
 *
 * Accounts off → say so and point at /read. Signed out → ask them to sign in.
 */

export const metadata = {
  title: "Your red lines · Redline",
  description: "The rules Redline checks every document you read against.",
};

export default async function RedLinesPage() {
  const session = await readerStore();
  if (session.state === "off") return <AccountsOff what="there’s nowhere to keep red lines" />;
  if (session.state === "signed-out") {
    return <SignInFirst what="Your red lines are the rules Redline checks every document against. Sign in to see and change yours." />;
  }

  let redLines;
  try {
    redLines = await readerRedLines(session.store);
  } catch (error) {
    console.error("Couldn't load the Red Lines:", error);
    return (
      <Notice heading="Your red lines didn’t load" href="/red-lines" action="Try again">
        Redline couldn&rsquo;t reach your red lines just now. Try again in a moment.
      </Notice>
    );
  }

  return <RedLinesView initial={redLines} />;
}
