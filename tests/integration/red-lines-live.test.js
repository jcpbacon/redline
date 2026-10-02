import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { analyseSavedDocument } from "../../lib/documents/analyse.js";
import { analysisFromRecord } from "../../lib/documents/rows.js";
import { createDocumentStore } from "../../lib/documents/store.js";
import { readerRedLines } from "../../lib/red-lines/index.js";
import { SEED_RED_LINES } from "../../lib/red-lines/seed.js";
import { loadSidecar, readFixture, stubReadingDocument } from "../helpers/stub-model.js";

/*
 * Red Lines for two Readers against a real Supabase project, through
 * lib/documents/store.js and the publishable-key client the product uses
 * (ticket #22). The model is the stub.
 *
 * tests/db/red-lines.test.js runs the same checks on PGlite. This proves
 * PostgREST, Supabase Auth and the applied migrations agree with it: the
 * red_lines table and its policies, `.rpc("seed_red_lines")`, and the
 * snapshot and Red Line wording that save_analysis stores.
 *
 * Skipped unless SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
 * SUPABASE_SECRET_KEY are all set. Point it at a project with
 * supabase/migrations/ applied, never at production data: it creates two
 * throwaway users and deletes them (and, by cascade, their rows) afterwards.
 *
 *   SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SECRET_KEY=… \
 *     npx vitest run tests/integration/red-lines-live.test.js
 */

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(url && publishableKey && secretKey);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const contract = readFixture("adhesion-contract.txt");
const sidecar = loadSidecar();
const exclusivity = sidecar.flags.find((f) => f.id === "category-ban");
const modelId = () => "stub-model-client";

describe.skipIf(!configured)("Red Lines on the live Supabase project", () => {
  /** @type {import("@supabase/supabase-js").SupabaseClient} */
  let admin;
  /** @type {{ email: string, password: string }} */
  let credentialsA;
  /** @type {ReturnType<typeof createDocumentStore>} */
  let storeA;
  /** @type {ReturnType<typeof createDocumentStore>} */
  let storeB;
  /** @type {string[]} */
  const userIds = [];

  async function newUser() {
    const email = `redline-red-lines-${randomUUID()}@example.com`;
    const password = `${randomUUID()}Aa1!`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userIds.push(data.user.id);
    return { email, password };
  }

  async function signIn({ email, password }) {
    const client = createClient(url, publishableKey, noSession);
    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;
    return createDocumentStore(client);
  }

  beforeAll(async () => {
    admin = createClient(url, secretKey, noSession);
    credentialsA = await newUser();
    storeA = await signIn(credentialsA);
    storeB = await signIn(await newUser());
  }, 30_000);

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it("seeds a new Reader once, and not again after they delete every Red Line", async () => {
    const seeded = await readerRedLines(storeB);
    expect(seeded.map((r) => r.text)).toEqual([...SEED_RED_LINES]);
    for (const r of seeded) expect(await storeB.deleteRedLine(r.id)).toBe(true);
    expect(await readerRedLines(storeB)).toEqual([]);
  });

  it("creates, edits and deletes; survives a new session; hidden from the other Reader", async () => {
    await readerRedLines(storeA);
    const added = await storeA.addRedLine("I keep my raw footage.");
    expect(await storeA.updateRedLine(added.id, "I keep my raw footage and drafts.")).toEqual({
      id: added.id,
      text: "I keep my raw footage and drafts.",
    });

    const again = await signIn(credentialsA);
    expect(await again.listRedLines()).toContainEqual({ id: added.id, text: "I keep my raw footage and drafts." });

    expect((await storeB.listRedLines()).map((r) => r.id)).not.toContain(added.id);
    expect(await storeB.updateRedLine(added.id, "stolen")).toBeNull();
    expect(await storeB.deleteRedLine(added.id)).toBe(false);

    expect(await again.deleteRedLine(added.id)).toBe(true);
    expect((await storeA.listRedLines()).map((r) => r.id)).not.toContain(added.id);
  });

  it("stores the snapshot with an analysis, and keeps the mark after the Red Line is deleted", async () => {
    const mine = await storeA.addRedLine("No bans on working with other brands.");
    const { id } = await storeA.saveDocument({ title: "Live Red Lines", text: contract });
    const result = await analyseSavedDocument(storeA, id, {
      model: stubReadingDocument(sidecar, { matches: { "category-ban": mine.id } }),
      modelId,
      logDrop: () => {},
    });
    expect(result?.redLines).toEqual(await storeA.listRedLines());

    await storeA.deleteRedLine(mine.id);
    const shown = analysisFromRecord(await storeA.latestAnalysis(id), contract);
    expect(shown?.redLines).toContainEqual(mine);
    expect(shown?.flags.find((f) => f.sourceSentence === exclusivity.sourceSentence)?.redLine?.text).toBe(mine.text);
  });
});
