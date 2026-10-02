import { as } from "./supabase-shim.js";

/*
 * lib/documents/store.js's interface over the PGlite database, as one Reader.
 *
 * This is not a fake: every method runs the same SQL objects the Supabase
 * store reaches through PostgREST — the documents, flags and red_lines tables, the
 * library_entries view, and the save_analysis / latest_analysis /
 * seed_red_lines functions from
 * supabase/migrations/ — as the `authenticated` role with the Reader's JWT
 * claims, so row-level security decides every result. Only the transport
 * differs: PostgREST turns `.from(...).select(...)` and `.rpc(...)` into
 * these statements; here they are written out.
 *
 * Tests use it to drive the code above the store (analyseSavedDocument, the
 * route handler) against a real database, two Readers at a time.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (value) => (value instanceof Date ? value.toISOString() : value == null ? null : String(value));

/**
 * @param {import("@electric-sql/pglite").PGlite} db
 * @param {string} readerId
 * @returns {import("../../lib/documents/store.js").DocumentStore}
 */
export function createPgliteStore(db, readerId) {
  const run = (fn) => as(db, readerId, fn);

  return {
    async saveDocument({ title, text }) {
      return run(async (tx) => {
        const { rows } = await tx.query(
          "insert into public.documents (title, extracted_text) values ($1, $2) returning id",
          [title, text],
        );
        return { id: /** @type {any} */ (rows[0]).id };
      });
    },

    async listLibrary() {
      return run(async (tx) => {
        const { rows } = await tx.query(
          `select id, title, saved_at, analysed_at, last_activity_at
           from public.library_entries
           order by last_activity_at desc, id asc`,
        );
        return rows.map((/** @type {any} */ row) => ({
          id: row.id,
          title: row.title,
          savedAt: iso(row.saved_at),
          analysedAt: iso(row.analysed_at),
          lastActivityAt: iso(row.last_activity_at),
        }));
      });
    },

    async getDocument(id) {
      if (!UUID.test(id)) return null;
      return run(async (tx) => {
        const { rows } = await tx.query(
          "select id, title, extracted_text, created_at from public.documents where id = $1",
          [id],
        );
        const row = /** @type {any} */ (rows[0]);
        return row ? { id: row.id, title: row.title, text: row.extracted_text, savedAt: iso(row.created_at) } : null;
      });
    },

    async latestAnalysis(documentId) {
      if (!UUID.test(documentId)) return null;
      return run(async (tx) => {
        const { rows } = await tx.query("select public.latest_analysis($1) as record", [documentId]);
        return /** @type {any} */ (rows[0])?.record ?? null;
      });
    },

    async saveAnalysis({ documentId, summary, modelId, redLinesSnapshot, checked, flags }) {
      return run(async (tx) => {
        const { rows } = await tx.query(
          "select public.save_analysis($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb) as id",
          [documentId, summary, modelId, JSON.stringify(redLinesSnapshot), JSON.stringify(checked), JSON.stringify(flags)],
        );
        return { id: /** @type {any} */ (rows[0]).id };
      });
    },

    async setFlagDismissed(flagId, dismissed) {
      if (!UUID.test(flagId)) return null;
      return run(async (tx) => {
        const { rows } = await tx.query(
          "update public.flags set dismissed_at = $2 where id = $1 returning id, dismissed_at",
          [flagId, dismissed ? new Date().toISOString() : null],
        );
        const row = /** @type {any} */ (rows[0]);
        return row ? { id: row.id, dismissedAt: iso(row.dismissed_at) } : null;
      });
    },

    async listRedLines() {
      return run(async (tx) => {
        const { rows } = await tx.query(
          "select id, text from public.red_lines where archived_at is null order by created_at asc, id asc",
        );
        return rows.map((/** @type {any} */ row) => ({ id: row.id, text: row.text }));
      });
    },

    async addRedLine(text) {
      return run(async (tx) => {
        const { rows } = await tx.query("insert into public.red_lines (text) values ($1) returning id, text", [text]);
        const row = /** @type {any} */ (rows[0]);
        return { id: row.id, text: row.text };
      });
    },

    async updateRedLine(id, text) {
      if (!UUID.test(id)) return null;
      return run(async (tx) => {
        const { rows } = await tx.query(
          "update public.red_lines set text = $2 where id = $1 and archived_at is null returning id, text",
          [id, text],
        );
        const row = /** @type {any} */ (rows[0]);
        return row ? { id: row.id, text: row.text } : null;
      });
    },

    async deleteRedLine(id) {
      if (!UUID.test(id)) return false;
      return run(async (tx) => {
        const { rows } = await tx.query("delete from public.red_lines where id = $1 returning id", [id]);
        return rows.length > 0;
      });
    },

    async seedRedLines(texts) {
      return run(async (tx) => {
        const { rows } = await tx.query("select public.seed_red_lines($1::text[]) as seeded", [[...texts]]);
        return /** @type {any} */ (rows[0]).seeded === true;
      });
    },
  };
}
