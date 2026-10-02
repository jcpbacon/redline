import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDocumentStore } from "../../lib/documents/store.js";
import { askSavedDocument } from "../../lib/questions/ask.js";
import { questionsFromRows } from "../../lib/questions/text.js";
import { readFixture, stubContent } from "../helpers/stub-model.js";

/*
 * The question box on a saved Document (ticket #24) for two Readers against a
 * real Supabase project, through lib/documents/store.js and the
 * publishable-key client the product uses. The model is the stub.
 *
 * tests/db/questions.test.js runs the same checks on PGlite. This proves
 * PostgREST's `.from("questions")` insert and select, and row-level security
 * on the applied migrations, agree with it.
 *
 * Skipped unless SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
 * SUPABASE_SECRET_KEY are all set. Point it at a project with
 * supabase/migrations/ applied, never at production data: it creates two
 * throwaway users and deletes them (and, by cascade, their rows) afterwards.
 *
 *   SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SECRET_KEY=… \
 *     npx vitest run tests/integration/questions-live.test.js
 */

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(url && publishableKey && secretKey);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const contract = readFixture("adhesion-contract.txt");
const PAYMENT =
  "Brand will pay the Fee within ninety (90) days after Brand's written acceptance of all Deliverables, and Brand may withhold acceptance in its sole discretion.";

describe.skipIf(!configured)("questions on the live Supabase project", () => {
  /** @type {import("@supabase/supabase-js").SupabaseClient} */
  let admin;
  /** @type {ReturnType<typeof createDocumentStore>} */
  let storeA;
  /** @type {ReturnType<typeof createDocumentStore>} */
  let storeB;
  /** @type {string[]} */
  const userIds = [];

  async function signedInClient() {
    const email = `redline-questions-${randomUUID()}@example.com`;
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

  it("stores questions oldest first for their Reader, null text when unanswerable, and none for the other Reader", async () => {
    const { id } = await storeA.saveDocument({ title: "Live questions", text: contract });
    await askSavedDocument(storeA, id, "When do I get paid?", {
      model: stubContent({ answerable: true, answer: "Within 90 days.", groundedIn: [PAYMENT] }),
    });
    await askSavedDocument(storeA, id, "Is this normal?", {
      model: stubContent({ answerable: false, answer: "", groundedIn: [] }),
    });

    const history = questionsFromRows(await storeA.listQuestions(id), contract);
    expect(history.map((q) => q.question)).toEqual(["When do I get paid?", "Is this normal?"]);
    expect(history[0].groundedIn).toEqual([PAYMENT]);
    expect(history[1]).toMatchObject({ unanswerable: true, text: null });

    expect(await storeB.listQuestions(id)).toEqual([]);
    expect(await askSavedDocument(storeB, id, "When?", { model: stubContent({ answerable: false, answer: "", groundedIn: [] }) })).toBeNull();
  }, 30_000);
});
