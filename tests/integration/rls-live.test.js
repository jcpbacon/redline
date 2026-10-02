import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/*
 * Cross-Reader isolation against a real Supabase project (story 4).
 *
 * tests/db/rls.test.js proves the migrations' SQL on an in-memory Postgres.
 * This proves a live project has them applied and that PostgREST, Supabase
 * Auth and RLS together keep one Reader out of another's rows, through the
 * same publishable-key client the product uses.
 *
 * It runs only when SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
 * SUPABASE_SECRET_KEY are all set, and is skipped otherwise. Point it at a
 * project with supabase/migrations/ applied, never at production data: it
 * creates two throwaway users with the admin API and deletes them (and, by
 * cascade, everything they own) afterwards.
 *
 *   SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SECRET_KEY=… \
 *     npx vitest run tests/integration/rls-live.test.js
 */

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(url && publishableKey && secretKey);

const TABLES = ["documents", "analyses", "flags", "red_lines", "questions"];
const SENTENCE = "The Creator assigns all rights in the Content to the Brand.";
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

describe.skipIf(!configured)("row-level security on the live Supabase project", () => {
  /** @type {import("@supabase/supabase-js").SupabaseClient} */
  let admin;
  /** @type {import("@supabase/supabase-js").SupabaseClient} */
  let asA;
  /** @type {import("@supabase/supabase-js").SupabaseClient} */
  let asB;
  /** @type {string[]} */
  const userIds = [];
  /** @type {Record<string, string>} */
  const own = {};

  async function signedInReader() {
    const email = `redline-rls-${randomUUID()}@example.com`;
    const password = `${randomUUID()}Aa1!`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userIds.push(data.user.id);
    const client = createClient(url, publishableKey, noSession);
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
    return client;
  }

  async function insert(client, table, row) {
    const { data, error } = await client.from(table).insert(row).select("id").single();
    if (error) throw error;
    return data.id;
  }

  beforeAll(async () => {
    admin = createClient(url, secretKey, noSession);
    asA = await signedInReader();
    asB = await signedInReader();

    own.red_lines = await insert(asA, "red_lines", { text: "I keep the rights to my work" });
    own.documents = await insert(asA, "documents", { title: "RLS live test", extracted_text: SENTENCE });
    own.analyses = await insert(asA, "analyses", { document_id: own.documents, summary: "s", model_id: "test" });
    own.flags = await insert(asA, "flags", {
      analysis_id: own.analyses,
      severity: "critical",
      clause_type: "ip-assignment-or-licence-scope",
      source_sentence: SENTENCE,
      what_it_means: "m",
      why_dangerous: "w",
      counter_offer: "c",
      matched_red_line_id: own.red_lines,
      position: 0,
      order_index: 0,
    });
    own.questions = await insert(asA, "questions", { document_id: own.documents, question: "Who owns it?" });
  }, 30_000);

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it("lets the owner see every row", async () => {
    for (const table of TABLES) {
      const { data, error } = await asA.from(table).select("id").eq("id", own[table]);
      expect(error, table).toBeNull();
      expect(data, table).toHaveLength(1);
    }
  });

  it("shows another Reader none of them", async () => {
    for (const table of TABLES) {
      const { data, error } = await asB.from(table).select("*").eq("id", own[table]);
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
  });

  it("lets another Reader change none of them", async () => {
    const changes = {
      documents: { title: "stolen" },
      analyses: { summary: "stolen" },
      flags: { counter_offer: "stolen" },
      red_lines: { text: "stolen" },
      questions: { question: "stolen" },
    };
    for (const table of TABLES) {
      const { data } = await asB.from(table).update(changes[table]).eq("id", own[table]).select("id");
      expect(data ?? [], table).toEqual([]);
      const { data: after } = await admin.from(table).select("*").eq("id", own[table]).single();
      expect(Object.values(after), table).not.toContain("stolen");
    }
  });

  it("lets another Reader delete none of them", async () => {
    for (const table of ["flags", "questions", "analyses", "red_lines", "documents"]) {
      const { data } = await asB.from(table).delete().eq("id", own[table]).select("id");
      expect(data ?? [], table).toEqual([]);
      const { data: still } = await admin.from(table).select("id").eq("id", own[table]);
      expect(still, table).toHaveLength(1);
    }
  });

  it("refuses another Reader adding rows under the first Reader's Document", async () => {
    const { error } = await asB.from("analyses").insert({ document_id: own.documents, summary: "s", model_id: "m" });
    expect(error).not.toBeNull();
  });

  it("shows a signed-out request nothing", async () => {
    const anon = createClient(url, publishableKey, noSession);
    for (const table of TABLES) {
      const { data } = await anon.from(table).select("*").eq("id", own[table]);
      expect(data ?? [], table).toEqual([]);
    }
  });
});
