import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { analyseSavedDocument } from "../../lib/documents/analyse.js";
import { COPY, createDocumentAnalysisHandler } from "../../lib/documents/http.js";
import { analysisFromRecord } from "../../lib/documents/rows.js";
import { bootDatabase, createUser } from "../db/supabase-shim.js";
import { createPgliteStore } from "../db/pglite-store.js";
import {
  DEFAULT_SUMMARY,
  loadSidecar,
  readFixture,
  stubClean,
  stubFailing,
  stubFromSidecar,
} from "../helpers/stub-model.js";

/*
 * Analysing a saved Document by id, against a real Postgres (PGlite with the
 * migrations applied) through lib/documents/store.js's interface as each
 * Reader (tests/db/pglite-store.js). The model is the stub; nothing else is.
 *
 * #19: a run inserts an analyses row with its Flags; the latest is what's
 * shown; a failed run stores nothing and is retried from the stored text; a
 * second Reader can't read or run the first Reader's analysis.
 */

const contract = readFixture("adhesion-contract.txt");
const cleanText = readFixture("clean-document.txt");
const sidecar = loadSidecar();
// Not a real model id: no model id is written anywhere in this repo.
const modelId = () => "stub-model-client";

/** @type {import("@electric-sql/pglite").PGlite} */
let db;
/** @type {import("../../lib/documents/store.js").DocumentStore} */
let storeA;
/** @type {import("../../lib/documents/store.js").DocumentStore} */
let storeB;

async function analysisCount(documentId) {
  const { rows } = await db.query("select count(*)::int as n from analyses where document_id = $1", [documentId]);
  return /** @type {any} */ (rows[0]).n;
}

beforeAll(async () => {
  db = await bootDatabase();
  storeA = createPgliteStore(db, await createUser(db));
  storeB = createPgliteStore(db, await createUser(db));
});

afterAll(async () => {
  await db?.close();
});

beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("reached the network");
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("saving and reopening", () => {
  it("lists a saved Document in its Reader's library only, and reopens it with the exact text", async () => {
    const text = `  ${contract.replace(/\n/g, "\r\n")}  \n`;
    const { id } = await storeA.saveDocument({ title: "Northwick deal", text });

    const libraryA = await storeA.listLibrary();
    const entry = libraryA.find((e) => e.id === id);
    expect(entry).toMatchObject({ title: "Northwick deal", analysedAt: null });
    expect(typeof entry?.savedAt).toBe("string");

    expect((await storeB.listLibrary()).map((e) => e.id)).not.toContain(id);
    expect(await storeB.getDocument(id)).toBeNull();

    const reopened = await storeA.getDocument(id);
    expect(reopened?.text).toBe(text);
  });

  it("answers an id that isn't a uuid as not found, without asking the database", async () => {
    expect(await storeA.getDocument("../../etc/passwd")).toBeNull();
  });
});

describe("analyseSavedDocument", () => {
  it("analyses the stored text, stores the run, and reads back the same ranked Flags", async () => {
    const { id } = await storeA.saveDocument({ title: "Contract", text: contract });
    const result = await analyseSavedDocument(storeA, id, { model: stubFromSidecar(sidecar), modelId, logDrop: () => {} });

    expect(result?.summary).toBe(DEFAULT_SUMMARY);
    expect(result?.flags.length).toBe(sidecar.flags.length);
    expect(result?.flags[0].severity).toBe("critical");
    expect(await analysisCount(id)).toBe(1);

    const stored = analysisFromRecord(await storeA.latestAnalysis(id), contract);
    expect(stored?.id).toBe(result?.analysisId);
    expect(stored?.summary).toBe(result?.summary);
    expect(stored?.flags).toEqual(result?.flags);
    expect(stored?.checked).toEqual(result?.checked);

    const { rows } = await db.query("select model_id, red_lines_snapshot from analyses where id = $1", [result?.analysisId]);
    expect(rows[0]).toEqual({ model_id: "stub-model-client", red_lines_snapshot: [] });

    const entry = (await storeA.listLibrary()).find((e) => e.id === id);
    expect(entry?.analysedAt).not.toBeNull();
  });

  it("stores a clean run with no Flags and the list of what was checked", async () => {
    const { id } = await storeA.saveDocument({ title: "Clean", text: cleanText });
    await analyseSavedDocument(storeA, id, { model: stubClean(), modelId });
    const stored = analysisFromRecord(await storeA.latestAnalysis(id), cleanText);
    expect(stored?.clean).toBe(true);
    expect(stored?.checked.length).toBeGreaterThan(0);
  });

  it("inserts a new row on every run and shows the latest", async () => {
    const { id } = await storeA.saveDocument({ title: "Twice", text: contract });
    const first = await analyseSavedDocument(storeA, id, { model: stubFromSidecar(sidecar), modelId, logDrop: () => {} });
    const second = await analyseSavedDocument(storeA, id, {
      model: stubFromSidecar(sidecar, { summary: "The second reading." }),
      modelId,
      logDrop: () => {},
    });
    await db.query("update analyses set created_at = created_at - interval '1 minute' where id = $1", [first?.analysisId]);

    expect(await analysisCount(id)).toBe(2);
    const latest = await storeA.latestAnalysis(id);
    expect(latest?.id).toBe(second?.analysisId);
    expect(latest?.summary).toBe("The second reading.");
  });

  it("stores nothing when the model fails, and a retry by id uses the stored text", async () => {
    const { id } = await storeA.saveDocument({ title: "Retry", text: contract });
    await expect(analyseSavedDocument(storeA, id, { model: stubFailing(), modelId })).rejects.toThrow();
    expect(await analysisCount(id)).toBe(0);
    expect(await storeA.latestAnalysis(id)).toBeNull();

    // The retry passes only the id; every Flag it stores quotes the stored text.
    const retried = await analyseSavedDocument(storeA, id, { model: stubFromSidecar(sidecar), modelId, logDrop: () => {} });
    expect(await analysisCount(id)).toBe(1);
    for (const flag of retried?.flags ?? []) expect(contract.includes(String(flag.sourceSentence))).toBe(true);
  });

  it("returns null for another Reader's Document and stores nothing", async () => {
    const { id } = await storeA.saveDocument({ title: "Private", text: contract });
    expect(await analyseSavedDocument(storeB, id, { model: stubFromSidecar(sidecar), modelId })).toBeNull();
    expect(await analysisCount(id)).toBe(0);
  });

  it("doesn't let another Reader read the first Reader's analysis", async () => {
    const { id } = await storeA.saveDocument({ title: "Mine", text: contract });
    await analyseSavedDocument(storeA, id, { model: stubFromSidecar(sidecar), modelId, logDrop: () => {} });
    expect(await storeB.latestAnalysis(id)).toBeNull();
  });
});

describe("POST /api/documents/[id]/analyses", () => {
  const post = () => new Request("http://localhost/api/documents/x/analyses", { method: "POST" });
  const ctx = (/** @type {string} */ id) => ({ params: Promise.resolve({ id }) });
  const as = (store) => async () => ({ state: /** @type {const} */ ("ok"), reader: { id: "r", email: null }, store });

  it("analyses the Reader's Document and stores the run", async () => {
    const { id } = await storeA.saveDocument({ title: "Route", text: contract });
    const handler = createDocumentAnalysisHandler({ model: stubFromSidecar(sidecar), modelId, logDrop: () => {}, connect: as(storeA) });
    const res = await handler(post(), ctx(id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flags.length).toBe(sidecar.flags.length);
    expect(body.clean).toBe(false);
    expect(await analysisCount(id)).toBe(1);
  });

  it("answers another Reader's id exactly like a missing one: 404, nothing stored", async () => {
    const { id } = await storeA.saveDocument({ title: "Route private", text: contract });
    const handler = createDocumentAnalysisHandler({ model: stubFromSidecar(sidecar), modelId, connect: as(storeB) });
    const theirs = await handler(post(), ctx(id));
    const missing = await handler(post(), ctx("00000000-0000-4000-8000-000000000000"));
    const garbage = await handler(post(), ctx("not-an-id"));
    for (const res of [theirs, missing, garbage]) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: COPY.notFound });
    }
    expect(await analysisCount(id)).toBe(0);
  });

  it("answers a failed model call with a retryable 502 and stores nothing", async () => {
    const { id } = await storeA.saveDocument({ title: "Route fail", text: contract });
    const handler = createDocumentAnalysisHandler({
      model: stubFailing(new Error("OpenRouter returned 401: sk-or-123")),
      modelId,
      connect: as(storeA),
    });
    const res = await handler(post(), ctx(id));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.retryable).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/sk-or|401|OpenRouter/);
    expect(await analysisCount(id)).toBe(0);
  });

  it("asks a signed-out request to sign in", async () => {
    const handler = createDocumentAnalysisHandler({ model: stubClean(), modelId, connect: async () => ({ state: "signed-out" }) });
    expect((await handler(post(), ctx("00000000-0000-4000-8000-000000000000"))).status).toBe(401);
  });

  it("says accounts are off when Supabase isn't configured", async () => {
    const saved = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    try {
      // The real session lookup, with no Supabase variables set.
      const handler = createDocumentAnalysisHandler({ model: stubClean(), modelId });
      const res = await handler(post(), ctx("00000000-0000-4000-8000-000000000000"));
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: COPY.off });
    } finally {
      if (saved.url !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
      if (saved.key !== undefined) process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = saved.key;
    }
  });
});
