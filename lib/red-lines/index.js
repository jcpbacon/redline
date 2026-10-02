import { SEED_RED_LINES } from "./seed.js";

/**
 * The signed-in Reader's Red Lines, seeding them first if this Reader has
 * never had the seed set.
 *
 *   readerRedLines(store) -> Array<{ id, text }>   (oldest first)
 *
 * Every place that reads a Reader's Red Lines goes through this: the
 * /red-lines screen, analysis of a saved Document, and analysis of pasted
 * text by a signed-in Reader. So a new Reader's first analysis already uses
 * the seed set, even if they never opened /red-lines. Seeding is decided in
 * the database (seed_red_lines), once per Reader: after that this is a plain
 * read, and deleting every Red Line does not bring the seeds back.
 *
 * @param {Pick<import("../documents/store.js").DocumentStore, "seedRedLines" | "listRedLines">} store
 * @returns {Promise<Array<{ id: string, text: string }>>}
 */
export async function readerRedLines(store) {
  await store.seedRedLines(SEED_RED_LINES);
  return store.listRedLines();
}
