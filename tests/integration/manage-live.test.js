import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { analyseSavedDocument } from "../../lib/documents/analyse.js";
import { deleteSavedDocument, renameSavedDocument } from "../../lib/documents/manage.js";
import { loadSavedDocument, showSavedDocument } from "../../lib/documents/reopen.js";
import { createDocumentStore } from "../../lib/documents/store.js";
import { loadSidecar, readFixture, stubFromSidecar } from "../helpers/stub-model.js";

/*
 * Reopen, rename and delete (ticket #25) for two Readers against a real
 * Supabase project, through lib/documents/store.js and the publishable-key
 * client the product uses. The model is the stub, used only to create the
 * analysis that is then reopened.
 *
 * tests/db/manage.test.js runs the same checks on PGlite. This proves
 * PostgREST's update/delete and row-level security on the applied migrations
 * agree with it, including the cascade from documents to analyses, Flags and
 * questions.
 *
 * Skipped unless SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
 * SUPABASE_SECRET_KEY are all set. Point it at a project with
 * supabase/migrations/ applied, never at production data: it creates two
 * throwaway users and deletes them (and, by cascade, their rows) afterwards.
 *
 *   SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SECRET_KEY=… \
 *     npx vitest run tests/integration/manage-live.test.js
 */

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(url && publishableKey && secretKey);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const contract = readFixture("adhesion-contract.txt");
const sidecar = loadSidecar();
const modelId = () => "stub-model-client";

describe.skipIf(!configured)("reopening, renaming and deleting on the live Supabase project", () => {
  /** @type {import("@supabase/supabase-js").SupabaseClient} */
  let admin;
  /** @type {ReturnType<typeof createDocumentStore>} */
  let storeA;
  /** @type {ReturnType<typeof createDocumentStore>} */
  let storeB;
  /** @type {string[]} */
  const userIds = [];

  async function signedInClient() {
    const email = `redline-manage-${randomUUID()}@example.com`;
    const password = `${randomUUID()}Aa1!`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userIds.push(data.user.id);
    const client = createClient(url, publishableKey, noSession);
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
    return client;
  }

  /** Rows for the Document as the admin client sees them, past row-level security. */
  async function counts(documentId) {
    // Untyped: supabase-js's generated types recurse too deep for a dynamic table name.
    const db = /** @type {any} */ (admin);
    const count = async (table, column) => {
      const { count: n, error } = await db.from(table).select("id", { count: "exact", head: true }).eq(column, documentId);
      if (error) throw error;
      return n;
    };
    const analyses = await db.from("analyses").select("id").eq("document_id", documentId);
    if (analyses.error) throw analyses.error;
    const ids = (analyses.data ?? []).map((a) => a.id);
    const flags = ids.length
      ? (await db.from("flags").select("id", { count: "exact", head: true }).in("analysis_id", ids)).count
      : 0;
    return {
      documents: await count("documents", "id"),
      analyses: ids.length,
      flags,
      questions: await count("questions", "document_id"),
    };
  }

  beforeAll(async () => {
    admin = createClient(url, secretKey, noSession);
    storeA = createDocumentStore(await signedInClient());
    storeB = createDocumentStore(await signedInClient());
  }, 30_000);

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it("reopens the latest analysis, renames the title only, refuses the other Reader, and deletes everything", async () => {
    const { id } = await storeA.saveDocument({ title: "Live manage", text: contract });
    await analyseSavedDocument(storeA, id, { model: stubFromSidecar(sidecar), modelId, logDrop: () => {} });
    await storeA.saveQuestion({
      documentId: id,
      question: "Who owns what I make?",
      answer: { text: "The Brand does.", groundedIn: [sidecar.flags[0].sourceSentence] },
    });

    // Reopen: no model passed, nothing to call one with.
    const reopened = showSavedDocument(/** @type {any} */ (await loadSavedDocument(storeA, id)));
    expect(reopened.analysis?.flags.length).toBe(sidecar.flags.length);

    // Rename: the title changes, the text doesn't.
    expect(await renameSavedDocument(storeB, id, "Stolen")).toEqual({ ok: false, reason: "not-found" });
    expect(await renameSavedDocument(storeA, id, " Live  manage, renamed ")).toEqual({
      ok: true,
      title: "Live manage, renamed",
    });
    const renamed = await storeA.getDocument(id);
    expect(renamed?.title).toBe("Live manage, renamed");
    expect(renamed?.text).toBe(contract);
    expect((await storeA.listLibrary()).find((e) => e.id === id)?.title).toBe("Live manage, renamed");

    // Delete: refused for the other Reader, then everything goes.
    const before = await counts(id);
    expect(before).toEqual({ documents: 1, analyses: 1, flags: sidecar.flags.length, questions: 1 });
    expect(await deleteSavedDocument(storeB, id)).toEqual({ ok: false, reason: "not-found" });
    expect(await counts(id)).toEqual(before);

    expect(await deleteSavedDocument(storeA, id)).toEqual({ ok: true });
    expect(await counts(id)).toEqual({ documents: 0, analyses: 0, flags: 0, questions: 0 });
    expect(await loadSavedDocument(storeA, id)).toBeNull();
  }, 60_000);
});
