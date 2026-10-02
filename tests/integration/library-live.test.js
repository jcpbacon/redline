import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { analyseSavedDocument } from "../../lib/documents/analyse.js";
import { analysisFromRecord } from "../../lib/documents/rows.js";
import { createDocumentStore } from "../../lib/documents/store.js";
import { loadSidecar, readFixture, stubFailing, stubFromSidecar } from "../helpers/stub-model.js";

/*
 * Save → list → open → analyse for two Readers, against a real Supabase
 * project, through lib/documents/store.js and the publishable-key client the
 * product uses (tickets #21 and #19). The model is the stub.
 *
 * tests/documents/analyse-saved.test.js runs the same flow on PGlite. This
 * proves PostgREST, Supabase Auth and the applied migrations agree with it:
 * that `.rpc("save_analysis")`, `.rpc("latest_analysis")` and the
 * library_entries view behave on the live project as they do there.
 *
 * Skipped unless SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
 * SUPABASE_SECRET_KEY are all set. Point it at a project with
 * supabase/migrations/ applied, never at production data: it creates two
 * throwaway users and deletes them (and, by cascade, their rows) afterwards.
 *
 *   SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SECRET_KEY=… \
 *     npx vitest run tests/integration/library-live.test.js
 */

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(url && publishableKey && secretKey);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const contract = readFixture("adhesion-contract.txt");
const sidecar = loadSidecar();
const modelId = () => "stub-model-client";

describe.skipIf(!configured)("the library on the live Supabase project", () => {
  /** @type {import("@supabase/supabase-js").SupabaseClient} */
  let admin;
  /** @type {ReturnType<typeof createDocumentStore>} */
  let storeA;
  /** @type {ReturnType<typeof createDocumentStore>} */
  let storeB;
  /** @type {string[]} */
  const userIds = [];

  async function signedInClient() {
    const email = `redline-library-${randomUUID()}@example.com`;
    const password = `${randomUUID()}Aa1!`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userIds.push(data.user.id);
    const client = createClient(url, publishableKey, noSession);
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
    return client;
  }

  beforeAll(async () => {
    admin = createClient(url, secretKey, noSession);
    storeA = createDocumentStore(await signedInClient());
    storeB = createDocumentStore(await signedInClient());
  }, 30_000);

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it("saves the text byte for byte and lists it for its Reader only", async () => {
    const text = `  ${contract.replace(/\n/g, "\r\n")} “end” \n`;
    const { id } = await storeA.saveDocument({ title: "Live test", text });
    expect((await storeA.getDocument(id))?.text).toBe(text);
    expect((await storeA.listLibrary()).map((e) => e.id)).toContain(id);
    expect((await storeB.listLibrary()).map((e) => e.id)).not.toContain(id);
    expect(await storeB.getDocument(id)).toBeNull();
  });

  it("analyses by id, stores the run, retries after a failure, and keeps it from the other Reader", async () => {
    const { id } = await storeA.saveDocument({ title: "Live analysis", text: contract });

    await expect(analyseSavedDocument(storeA, id, { model: stubFailing(), modelId })).rejects.toThrow();
    expect(await storeA.latestAnalysis(id)).toBeNull();

    const result = await analyseSavedDocument(storeA, id, { model: stubFromSidecar(sidecar), modelId, logDrop: () => {} });
    const stored = analysisFromRecord(await storeA.latestAnalysis(id), contract);
    expect(stored?.id).toBe(result?.analysisId);
    expect(stored?.flags).toEqual(result?.flags);

    const again = await analyseSavedDocument(storeA, id, {
      model: stubFromSidecar(sidecar, { summary: "Second run." }),
      modelId,
      logDrop: () => {},
    });
    expect((await storeA.latestAnalysis(id))?.id).toBe(again?.analysisId);

    expect(await storeB.latestAnalysis(id)).toBeNull();
    expect(await analyseSavedDocument(storeB, id, { model: stubFromSidecar(sidecar), modelId })).toBeNull();
  }, 30_000);
});
