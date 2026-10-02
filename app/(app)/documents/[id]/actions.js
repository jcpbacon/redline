"use server";

import { readerStore } from "../../../../lib/documents/session.js";
import { isDocumentId } from "../../../../lib/documents/store.js";

/*
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
