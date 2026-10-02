"use server";

import { prepareDocument } from "../../../lib/documents/title.js";
import { readerStore } from "../../../lib/documents/session.js";

/*
 * Save a pasted Document to the signed-in Reader's library (ticket #21).
 *
 * Takes the title and the text exactly as the Reader confirmed it. The text is
 * stored as given, byte for byte: only the title is trimmed, and a blank title
 * becomes one taken from the Document's first line. Nothing about a file is
 * accepted, so nothing about one can be stored.
 *
 * Returns { id } or { error } with Reader-facing copy. The database's own
 * message is logged, never returned.
 */

const COPY = {
  off: "Accounts aren’t switched on here, so Redline can’t save documents. You can still read this one without saving it.",
  signedOut: "You’ve been signed out. Sign in again to save this document.",
  failed: "Redline couldn’t save the document. Your text is still here, so you can try again.",
};

/**
 * @param {{ title?: string, text?: string }} input
 * @returns {Promise<{ id: string } | { error: string }>}
 */
export async function saveDocument(input) {
  const prepared = prepareDocument(input ?? {});
  if ("error" in prepared) return { error: prepared.error };

  const session = await readerStore();
  if (session.state === "off") return { error: COPY.off };
  if (session.state === "signed-out") return { error: COPY.signedOut };

  try {
    return await session.store.saveDocument({ title: prepared.title, text: prepared.text });
  } catch (error) {
    console.error("saveDocument failed:", error);
    return { error: COPY.failed };
  }
}
