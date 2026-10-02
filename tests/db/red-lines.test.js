import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createAnalyzeHandler } from "../../lib/analysis/http.js";
import { analyseSavedDocument } from "../../lib/documents/analyse.js";
import { createDocumentAnalysisHandler } from "../../lib/documents/http.js";
import { analysisFromRecord } from "../../lib/documents/rows.js";
import { readerRedLines } from "../../lib/red-lines/index.js";
import { SEED_RED_LINES } from "../../lib/red-lines/seed.js";
import { as, bootDatabase, createUser } from "./supabase-shim.js";
import { createPgliteStore } from "./pglite-store.js";
import { loadSidecar, readFixture, stubReadingDocument } from "../helpers/stub-model.js";

/*
 * Ticket #22 against a real Postgres: supabase/migrations/ on PGlite, every
 * query as a non-superuser Reader so row-level security decides, through
 * lib/documents/store.js's interface (./pglite-store.js). The model is the
 * stub; nothing else is.
 */

const contract = readFixture("adhesion-contract.txt");
const sidecar = loadSidecar();
const exclusivity = sidecar.flags.find((f) => f.id === "category-ban");
const modelId = () => "stub-model-client";

/** @type {import("@electric-sql/pglite").PGlite} */
let db;

/** A fresh Reader and their store. */
async function newReader() {
  const id = await createUser(db);
  return { id, store: createPgliteStore(db, id) };
}

const signedIn = (store) => async () => ({ state: /** @type {const} */ ("ok"), reader: { id: "r", email: null }, store });

beforeAll(async () => {
  db = await bootDatabase();
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

describe("a Reader's own Red Lines", () => {
  it("can be created, edited and deleted, and persist across sessions", async () => {
    const { id, store } = await newReader();
    const added = await store.addRedLine("I keep my raw footage.");
    expect(await store.listRedLines()).toEqual([added]);

    expect(await store.updateRedLine(added.id, "I keep my raw footage and drafts.")).toEqual({
      id: added.id,
      text: "I keep my raw footage and drafts.",
    });

    // A new session for the same Reader (sign out, sign in) reads the same rows.
    const later = createPgliteStore(db, id);
    expect(await later.listRedLines()).toEqual([{ id: added.id, text: "I keep my raw footage and drafts." }]);

    expect(await later.deleteRedLine(added.id)).toBe(true);
    expect(await store.listRedLines()).toEqual([]);
    expect(await store.deleteRedLine(added.id)).toBe(false);
    expect(await store.updateRedLine(added.id, "Back again")).toBeNull();
  });

  it("can't be seen, edited or deleted by a second Reader", async () => {
    const a = await newReader();
    const b = await newReader();
    const mine = await a.store.addRedLine("Nothing renews unless I say yes.");

    expect(await b.store.listRedLines()).toEqual([]);
    expect(await b.store.updateRedLine(mine.id, "stolen")).toBeNull();
    expect(await b.store.deleteRedLine(mine.id)).toBe(false);
    expect(await a.store.listRedLines()).toEqual([mine]);

    // Nor reached by a signed-out request.
    await expect(as(db, null, (tx) => tx.query("select * from red_lines"))).rejects.toThrow(/permission denied/);
  });
});

describe("the seed set", () => {
  it("is given to a new Reader once, in order", async () => {
    const { store } = await newReader();
    const first = await readerRedLines(store);
    expect(first.map((r) => r.text)).toEqual([...SEED_RED_LINES]);
    expect(await readerRedLines(store)).toEqual(first);
    expect(await store.seedRedLines(SEED_RED_LINES)).toBe(false);
  });

  it("removing one removes it for that Reader only", async () => {
    const a = await newReader();
    const b = await newReader();
    const seededA = await readerRedLines(a.store);
    const seededB = await readerRedLines(b.store);

    await a.store.deleteRedLine(seededA[0].id);
    expect((await readerRedLines(a.store)).map((r) => r.text)).toEqual(SEED_RED_LINES.slice(1));
    expect(await readerRedLines(b.store)).toEqual(seededB);
  });

  it("doesn't come back after the Reader deletes every Red Line", async () => {
    const { store } = await newReader();
    for (const r of await readerRedLines(store)) await store.deleteRedLine(r.id);
    expect(await readerRedLines(store)).toEqual([]);
    expect(await readerRedLines(store)).toEqual([]);
  });

  it("can't be written for another Reader, or by a signed-out request", async () => {
    const a = await newReader();
    const b = await newReader();
    await expect(
      as(db, b.id, (tx) => tx.query("insert into red_line_seeds (reader_id) values ($1)", [a.id])),
    ).rejects.toThrow(/row-level security/);
    // So A still gets the seeds.
    expect((await readerRedLines(a.store)).length).toBe(SEED_RED_LINES.length);
    await readerRedLines(b.store);
    // Each sees only their own marker.
    expect(await as(db, b.id, async (tx) => (await tx.query("select * from red_line_seeds")).rows)).toEqual([
      expect.objectContaining({ reader_id: b.id }),
    ]);

    await expect(as(db, null, (tx) => tx.query("select seed_red_lines(array['x'])"))).rejects.toThrow(/permission denied/);
  });
});

describe("Red Lines in a saved Document's analysis", () => {
  it("are passed in, mark the Flag that breaks one, and are stored as the snapshot", async () => {
    const { store } = await newReader();
    await readerRedLines(store); // seeded
    const mine = await store.addRedLine("No bans on working with other brands.");
    const { id } = await store.saveDocument({ title: "Deal", text: contract });

    const model = stubReadingDocument(sidecar, { matches: { "category-ban": mine.id } });
    const result = await analyseSavedDocument(store, id, { model, modelId, logDrop: () => {} });

    const current = await store.listRedLines();
    expect(result?.redLines).toEqual(current);
    const { rows } = await db.query("select red_lines_snapshot from analyses where id = $1", [result?.analysisId]);
    expect(/** @type {any} */ (rows[0]).red_lines_snapshot).toEqual(current);

    const marked = result?.flags.filter((f) => f.redLine !== null) ?? [];
    expect(marked.map((f) => f.sourceSentence)).toEqual([exclusivity.sourceSentence]);
    expect(marked[0].redLine).toEqual(mine);

    const stored = analysisFromRecord(await store.latestAnalysis(id), contract);
    // Read back, a Flag also carries its row id and dismissal (story 23).
    expect(stored?.flags.map(({ id, dismissedAt, ...flag }) => flag)).toEqual(result?.flags);
    expect(stored?.redLines).toEqual(current);
  });

  it("re-running after a change records a new analysis with the new snapshot, and that is the one shown", async () => {
    const { store } = await newReader();
    for (const r of await readerRedLines(store)) await store.deleteRedLine(r.id);
    const { id } = await store.saveDocument({ title: "Deal", text: contract });

    const first = await analyseSavedDocument(store, id, {
      model: stubReadingDocument(sidecar),
      modelId,
      logDrop: () => {},
    });
    expect(first?.redLines).toEqual([]);
    expect(first?.flags.every((f) => f.redLine === null)).toBe(true);

    const added = await store.addRedLine("No bans on working with other brands.");
    const handler = createDocumentAnalysisHandler({
      model: stubReadingDocument(sidecar, { matches: { "category-ban": added.id } }),
      modelId,
      logDrop: () => {},
      connect: signedIn(store),
    });
    const res = await handler(new Request("http://localhost/x", { method: "POST" }), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const second = await res.json();

    const { rows } = await db.query("select count(*)::int as n from analyses where document_id = $1", [id]);
    expect(/** @type {any} */ (rows[0]).n).toBe(2);

    const shown = analysisFromRecord(await store.latestAnalysis(id), contract);
    expect(shown?.id).toBe(second.analysisId);
    expect(shown?.redLines).toEqual([added]);
    expect(shown?.flags.find((f) => f.redLine)?.sourceSentence).toBe(exclusivity.sourceSentence);
    // Same Flags as the first run; only order and marks differ (ADR-0003).
    const set = (flags) => flags.map((f) => `${f.severity} ${f.sourceSentence}`).sort();
    expect(set(shown?.flags ?? [])).toEqual(set(first?.flags ?? []));
  });

  it("deleting a Red Line an analysis used leaves that analysis readable, with the snapshot's wording", async () => {
    const { store } = await newReader();
    const doomed = await store.addRedLine("No bans on working with other brands.");
    const { id } = await store.saveDocument({ title: "Deal", text: contract });
    const result = await analyseSavedDocument(store, id, {
      model: stubReadingDocument(sidecar, { matches: { "category-ban": doomed.id } }),
      modelId,
      logDrop: () => {},
    });

    expect(await store.deleteRedLine(doomed.id)).toBe(true);

    const { rows } = await db.query(
      "select matched_red_line_id from flags where analysis_id = $1 and source_sentence = $2",
      [result?.analysisId, exclusivity.sourceSentence],
    );
    expect(/** @type {any} */ (rows[0]).matched_red_line_id).toBeNull();

    const shown = analysisFromRecord(await store.latestAnalysis(id), contract);
    expect(shown?.flags).toHaveLength(sidecar.flags.length);
    expect(shown?.redLines.map((r) => r.text)).toContain(doomed.text);
    const marked = shown?.flags.find((f) => f.sourceSentence === exclusivity.sourceSentence);
    expect(marked?.redLine?.text).toBe(doomed.text);
    // Still where the ranking put it: first among the high ones.
    expect(shown?.flags.filter((f) => f.severity === "high")[0].sourceSentence).toBe(exclusivity.sourceSentence);
  });

  it("can't mark a Flag with another Reader's Red Line", async () => {
    const a = await newReader();
    const b = await newReader();
    const theirs = await b.store.addRedLine("Someone else's rule.");
    const { id } = await a.store.saveDocument({ title: "Deal", text: contract });
    const result = await analyseSavedDocument(a.store, id, {
      model: stubReadingDocument(sidecar, { matches: { "category-ban": theirs.id } }),
      modelId,
      logDrop: () => {},
    });
    expect(result?.flags.every((f) => f.redLine === null)).toBe(true);
  });
});

describe("Red Lines in an unsaved run on /read", () => {
  const post = (text) =>
    new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });

  it("uses a signed-in Reader's Red Lines, and stores nothing", async () => {
    const { store } = await newReader();
    for (const r of await readerRedLines(store)) await store.deleteRedLine(r.id);
    const mine = await store.addRedLine("No bans on working with other brands.");
    const handler = createAnalyzeHandler({
      model: stubReadingDocument(sidecar, { matches: { "category-ban": mine.id } }),
      logDrop: () => {},
      connect: signedIn(store),
    });

    const body = await (await handler(post(contract))).json();
    expect(body.redLines).toEqual([mine]);
    expect(body.flags.filter((f) => f.redLine).map((f) => f.redLine)).toEqual([mine]);
    expect(await store.listLibrary()).toEqual([]);
  });

  it("uses none for a signed-out Reader, whatever the model claims", async () => {
    const handler = createAnalyzeHandler({
      model: stubReadingDocument(sidecar, { matches: { "category-ban": "00000000-0000-4000-8000-000000000000" } }),
      logDrop: () => {},
      connect: async () => ({ state: "signed-out" }),
    });
    const body = await (await handler(post(contract))).json();
    expect(body.redLines).toEqual([]);
    expect(body.flags).toHaveLength(sidecar.flags.length);
    expect(body.flags.every((f) => f.redLine === null)).toBe(true);
  });

  it("still reads the Document, without Red Lines, when they can't be loaded", async () => {
    const handler = createAnalyzeHandler({
      model: stubReadingDocument(sidecar),
      logDrop: () => {},
      connect: async () => {
        throw new Error("database down");
      },
    });
    const res = await handler(post(contract));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.redLines).toEqual([]);
    expect(body.flags).toHaveLength(sidecar.flags.length);
  });
});
