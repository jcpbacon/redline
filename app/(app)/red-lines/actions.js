"use server";

import { readerStore } from "../../../lib/documents/session.js";
import { readerRedLines } from "../../../lib/red-lines/index.js";
import { prepareRedLine } from "../../../lib/red-lines/text.js";

/*
 * Change the signed-in Reader's Red Lines (ticket #22).
 *
 * Each action checks the session itself; the database checks again through
 * row-level security, so an id that isn't this Reader's changes nothing and
 * reads as already gone. Every success returns the Reader's whole list as it
 * now stands, so the screen never guesses at it.
 *
 * Returns { redLines } or { error } with Reader-facing copy. The database's
 * own message is logged, never returned.
 */

const COPY = {
  off: "Accounts aren’t switched on here, so there’s nowhere to keep red lines.",
  signedOut: "You’ve been signed out. Sign in again to change your red lines.",
  gone: "That red line was already deleted. Here’s your list as it is now.",
  failed: "Redline couldn’t save that. Try again.",
};

/**
 * @param {(store: import("../../../lib/documents/store.js").DocumentStore) => Promise<boolean | void>} change
 *   resolves false when the Red Line wasn't there to change
 * @returns {Promise<{ redLines: Array<{ id: string, text: string }>, error?: string } | { error: string }>}
 */
async function withReader(change) {
  const session = await readerStore();
  if (session.state === "off") return { error: COPY.off };
  if (session.state === "signed-out") return { error: COPY.signedOut };
  try {
    const found = await change(session.store);
    const redLines = await readerRedLines(session.store);
    return found === false ? { redLines, error: COPY.gone } : { redLines };
  } catch (error) {
    console.error("Changing a Red Line failed:", error);
    return { error: COPY.failed };
  }
}

/** @param {string} text */
export async function addRedLine(text) {
  const prepared = prepareRedLine(text);
  if (prepared.ok === false) return { error: prepared.error };
  return withReader(async (store) => {
    await store.addRedLine(prepared.text);
  });
}

/** @param {string} id @param {string} text */
export async function updateRedLine(id, text) {
  const prepared = prepareRedLine(text);
  if (prepared.ok === false) return { error: prepared.error };
  return withReader(async (store) => (await store.updateRedLine(String(id), prepared.text)) !== null);
}

/** @param {string} id */
export async function deleteRedLine(id) {
  return withReader((store) => store.deleteRedLine(String(id)));
}
