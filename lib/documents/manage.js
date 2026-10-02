import { isDocumentId } from "./store.js";
import { prepareTitle } from "./title.js";

/**
 * Renaming and deleting a saved Document (story 42, 43), behind the Server
 * Actions in app/(app)/documents/[id]/actions.js. Takes the store, so tests
 * run it against the real SQL as two Readers (tests/db/manage.test.js).
 *
 *   renameSavedDocument(store, id, title)
 *     -> { ok: true, title }                         the title as stored
 *     -> { ok: false, reason: "invalid", error }     the title was refused; nothing written
 *     -> { ok: false, reason: "not-found" }          no such Document for this Reader
 *   deleteSavedDocument(store, id)
 *     -> { ok: true }
 *     -> { ok: false, reason: "not-found" }
 *
 * Only the title is written on a rename; the extracted text is never sent.
 * Deleting takes the analyses, Flags and questions with it (the foreign keys
 * cascade). Another Reader's Document is "not-found", exactly like an id that
 * never existed or was already deleted, so the answer never says whether it
 * exists. Store failures throw (StoreError).
 */

/**
 * @param {Pick<import("./store.js").DocumentStore, "renameDocument">} store
 * @param {unknown} id
 * @param {unknown} title
 * @returns {Promise<{ ok: true, title: string } | { ok: false, reason: "invalid", error: string } | { ok: false, reason: "not-found" }>}
 */
export async function renameSavedDocument(store, id, title) {
  if (!isDocumentId(id)) return { ok: false, reason: "not-found" };
  const prepared = prepareTitle(title);
  if (prepared.ok === false) return { ok: false, reason: "invalid", error: prepared.error };
  const renamed = await store.renameDocument(id, prepared.title);
  if (!renamed) return { ok: false, reason: "not-found" };
  return { ok: true, title: renamed.title };
}

/**
 * @param {Pick<import("./store.js").DocumentStore, "deleteDocument">} store
 * @param {unknown} id
 * @returns {Promise<{ ok: true } | { ok: false, reason: "not-found" }>}
 */
export async function deleteSavedDocument(store, id) {
  if (!isDocumentId(id)) return { ok: false, reason: "not-found" };
  return (await store.deleteDocument(id)) ? { ok: true } : { ok: false, reason: "not-found" };
}
