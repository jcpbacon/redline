import { readerStore } from "../../../lib/documents/session.js";
import Notice, { AccountsOff, SignInFirst } from "../Notice";
import LibraryView from "./LibraryView";

/*
 * /library: the signed-in Reader's saved Documents (stories 39, 40).
 *
 * Each entry shows its title and the date it was last read, or the date it
 * was saved if it never was, newest first. The list comes from the
 * library_entries view, which row-level security limits to this Reader's own
 * Documents. Renaming and deleting are ticket #25.
 *
 * Accounts off → say so and point at /read. Signed out → ask them to sign in.
 */

export const metadata = {
  title: "Your library · Redline",
  description: "The documents you've saved in Redline.",
};

export default async function LibraryPage() {
  const session = await readerStore();
  if (session.state === "off") return <AccountsOff />;
  if (session.state === "signed-out") {
    return <SignInFirst what="Your library holds the documents you’ve saved. Sign in to open it." />;
  }

  let entries;
  try {
    entries = await session.store.listLibrary();
  } catch (error) {
    console.error("Couldn't list the library:", error);
    return (
      <Notice heading="Your library didn’t load" href="/library" action="Try again">
        Redline couldn&rsquo;t reach your saved documents just now. Try again in a moment.
      </Notice>
    );
  }

  return <LibraryView entries={entries} />;
}
