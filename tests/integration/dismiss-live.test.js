import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { flagView } from "../../lib/analysis/flag-view.js";
import { analyseSavedDocument } from "../../lib/documents/analyse.js";
import { analysisFromRecord } from "../../lib/documents/rows.js";
import { createDocumentStore } from "../../lib/documents/store.js";
import { loadSidecar, readFixture, stubFromSidecar } from "../helpers/stub-model.js";

/*
 * Dismissing a Flag (story 23) for two Readers against a real Supabase
 * project, through lib/documents/store.js and the publishable-key client the
 * product uses. The model is the stub.
 *
 * tests/db/dismiss.test.js runs the same checks on PGlite. This proves
 * PostgREST's `.from("flags").update(...)` and row-level security on the
 * applied migrations agree with it.
 *
 * Skipped unless SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
 * SUPABASE_SECRET_KEY are all set. Point it at a project with
 * supabase/migrations/ applied, never at production data: it creates two
 * throwaway users and deletes them (and, by cascade, their rows) afterwards.
 *
 *   SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SECRET_KEY=… \
 *     npx vitest run tests/integration/dismiss-live.test.js
 */

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(url && publishableKey && secretKey);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const contract = readFixture("adhesion-contract.txt");
const sidecar = loadSidecar();
const modelId = () => "stub-model-client";

describe.skipIf(!configured)("dismissing Flags on the live Supabase project", () => {
  /** @type {import("@supabase/supabase-js").SupabaseClient} */
  let admin;
  /** @type {ReturnType<typeof createDocumentStore>} */
  let storeA;
  /** @type {ReturnType<typeof createDocumentStore>} */
  let storeB;
  /** @type {string[]} */
  const userIds = [];

  async function signedInClient() {
    const email = `redline-dismiss-${randomUUID()}@example.com`;
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

  it("dismisses, keeps it on reload, refuses the other Reader, and puts it back", async () => {
    const { id } = await storeA.saveDocument({ title: "Live dismiss", text: contract });
    await analyseSavedDocument(storeA, id, { model: stubFromSidecar(sidecar), modelId, logDrop: () => {} });
    const first = analysisFromRecord(await storeA.latestAnalysis(id), contract);
    const flagId = /** @type {string} */ (first?.flags[0].id);
    expect(typeof flagId).toBe("string");

    expect(await storeB.setFlagDismissed(flagId, true)).toBeNull();

    const dismissed = await storeA.setFlagDismissed(flagId, true);
    expect(typeof dismissed?.dismissedAt).toBe("string");
    const reloaded = analysisFromRecord(await storeA.latestAnalysis(id), contract);
    expect(flagView(reloaded?.flags ?? []).dismissed.map((e) => e.flag.id)).toEqual([flagId]);

    expect(await storeB.setFlagDismissed(flagId, false)).toBeNull();
    const still = analysisFromRecord(await storeA.latestAnalysis(id), contract);
    expect(still?.flags[0].dismissedAt).toEqual(expect.any(String));

    expect(await storeA.setFlagDismissed(flagId, false)).toEqual({ id: flagId, dismissedAt: null });
  }, 30_000);
});
