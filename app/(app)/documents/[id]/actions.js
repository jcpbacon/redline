"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { deleteSavedDocument, renameSavedDocument } from "../../../../lib/documents/manage.js";
import { readerStore } from "../../../../lib/documents/session.js";
import { isDocumentId } from "../../../../lib/documents/store.js";

/*
 * Changes a Reader makes on a saved Document's page: dismiss a Flag, rename
 * the Document, delete it.
 *
 * Dismiss a Flag on a saved Document, or put it back (story 23).
 *
 * Runs under the signed-in Reader's session; row-level security on `flags`
 * decides whose Flag it is. Another Reader's Flag, or an id that doesn't
 * exist, changes nothing and gets the same answer. Only dismissed_at is
 * written.
 *
 * Returns { dismissedAt } (an ISO time, or null after putting it back) or
 * { error } with Reader-facing copy. The database's own message is logged,
 * never returned.
 */

const COPY = {
  off: "Accounts aren’t switched on here, so Redline can’t save that.",
  signedOut: "You’ve been signed out. Sign in, then try again.",
  missing: "Redline couldn’t find that flag. Reload the page and try again.",
  failed: "Redline couldn’t save that change. Try again in a moment.",
};

/**
 * @param {string} flagId
 * @param {boolean} dismissed true to dismiss, false to put it back
 * @returns {Promise<{ dismissedAt: string | null } | { error: string }>}
 */
export async function setFlagDismissed(flagId, dismissed) {
  if (!isDocumentId(flagId) || typeof dismissed !== "boolean") return { error: COPY.missing };

  const session = await readerStore();
  if (session.state === "off") return { error: COPY.off };
  if (session.state === "signed-out") return { error: COPY.signedOut };

  try {
    const changed = await session.store.setFlagDismissed(flagId, dismissed);
    if (!changed) return { error: COPY.missing };
    return { dismissedAt: changed.dismissedAt };
  } catch (error) {
    console.error("setFlagDismissed failed:", error);
    return { error: COPY.failed };
  }
}

const DOCUMENT_COPY = {
  off: "Accounts aren’t switched on here, so there are no saved documents to change.",
  signedOut: "You’ve been signed out. Sign in, then try again.",
  missing: "That document isn’t in your library. It may have been deleted already.",
  renameFailed: "Redline couldn’t rename it. Try again in a moment.",
  deleteFailed: "Redline couldn’t delete it. Try again in a moment.",
};

/*
 * Rename a saved Document (story 42). Only the title is written; the stored
 * text is never sent. Another Reader's Document, or one already deleted,
 * gets the same "isn't in your library" answer and changes nothing.
 *
 * Returns { title } (as stored) or { error } with Reader-facing copy, and
 * refreshes the page so the heading and library show the new title.
 */

/**
 * @param {string} documentId
 * @param {string} title
 * @returns {Promise<{ title: string } | { error: string }>}
 */
export async function renameDocument(documentId, title) {
  const session = await readerStore();
  if (session.state === "off") return { error: DOCUMENT_COPY.off };
  if (session.state === "signed-out") return { error: DOCUMENT_COPY.signedOut };

  let result;
  try {
    result = await renameSavedDocument(session.store, documentId, title);
  } catch (error) {
    console.error("renameDocument failed:", error);
    return { error: DOCUMENT_COPY.renameFailed };
  }
  if (result.ok === false) {
    return { error: result.reason === "invalid" ? result.error : DOCUMENT_COPY.missing };
  }
  refresh();
  return { title: result.title };
}

/*
 * Delete a saved Document and everything made from it: its analyses, their
 * Flags, and its questions (story 43). Called from the confirm step on the
 * Document's page as a form action (useActionState), with the id in the
 * form. On success it sends the Reader to /library, which says it's done;
 * the id is then not found. Another Reader's Document is "not in your
 * library" and nothing is deleted.
 *
 * Returns { error } with Reader-facing copy when it didn't delete.
 */

/**
 * @param {unknown} _previous useActionState's previous result
 * @param {FormData} form
 * @returns {Promise<{ error: string }>}
 */
export async function deleteDocument(_previous, form) {
  const documentId = form?.get?.("documentId");
  const session = await readerStore();
  if (session.state === "off") return { error: DOCUMENT_COPY.off };
  if (session.state === "signed-out") return { error: DOCUMENT_COPY.signedOut };

  let result;
  try {
    result = await deleteSavedDocument(session.store, documentId);
  } catch (error) {
    console.error("deleteDocument failed:", error);
    return { error: DOCUMENT_COPY.deleteFailed };
  }
  if (result.ok === false) return { error: DOCUMENT_COPY.missing };
  // Outside the try: redirect() works by throwing.
  redirect("/library?deleted=1");
}
