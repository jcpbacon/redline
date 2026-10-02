import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { analyseSavedDocument } from "../../lib/documents/analyse.js";
import { deleteSavedDocument, renameSavedDocument } from "../../lib/documents/manage.js";
import { loadSavedDocument, showSavedDocument } from "../../lib/documents/reopen.js";
import { MAX_TITLE_LENGTH } from "../../lib/documents/title.js";
import { createPgliteStore } from "./pglite-store.js";
import { as, bootDatabase, createUser } from "./supabase-shim.js";
import { DEFAULT_SUMMARY, loadSidecar, readFixture, stubFromSidecar } from "../helpers/stub-model.js";

/*
 * Ticket #25 (stories 41-43) against supabase/migrations/ on PGlite, through
 * lib/documents/store.js's interface as two Readers (./pglite-store.js), so
 * row-level security and the foreign keys decide every result.
 *
 * - Reopening loads the most recent analysis with no model anywhere on the
 *   path: the loader takes no model, the network is stubbed to throw, and
 *   the OpenRouter settings are removed while it runs.
 * - Renaming writes the title only; the stored text is byte-identical after.
 * - Deleting removes the Document, its analyses, their Flags and its
 *   questions, and the id then loads as null (the page's 404).
 * - A second Reader can neither rename nor delete, and is told "not found".
 */

const contract = readFixture("adhesion-contract.txt");
// The same contract with Windows line endings and a non-breaking space,
// which must survive a rename byte for byte.
const contractCrlf = `Schedule A\r\n${contract.replace(/\n/g, "\r\n")}`;
const sidecar = loadSidecar();
const modelId = () => "stub-model-client";
const GROUNDING = sidecar.flags[0].sourceSentence;

/** @type {import("@electric-sql/pglite").PGlite} */
let db;
/** @type {import("../../lib/documents/store.js").DocumentStore} */
let storeA;
/** @type {import("../../lib/documents/store.js").DocumentStore} */
let storeB;

beforeAll(async () => {
  db = await bootDatabase();
  storeA = createPgliteStore(db, await createUser(db));
  storeB = createPgliteStore(db, await createUser(db));
  vi.stubGlobal("fetch", () => {
    throw new Error("reached the network");
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await db?.close();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Save `text` as `store`'s Reader, analyse it with the stub, and ask one question. */
async function savedReadAndAsked(store, text = contract, title = "Northwick deal") {
  const { id } = await store.saveDocument({ title, text });
  await analyseSavedDocument(store, id, { model: stubFromSidecar(sidecar), modelId, logDrop: () => {} });
  await store.saveQuestion({
    documentId: id,
    question: "Who owns what I make?",
    answer: { text: "The Brand does.", groundedIn: [GROUNDING] },
  });
  return id;
}

/** Rows with no row-level security in the way. */
async function storedRows(documentId) {
  const one = async (sql) => /** @type {any} */ ((await db.query(sql, [documentId])).rows[0]);
  return {
    documents: (await one("select count(*)::int as n from documents where id = $1")).n,
    analyses: (await one("select count(*)::int as n from analyses where document_id = $1")).n,
    flags: (
      await one("select count(*)::int as n from flags f join analyses a on a.id = f.analysis_id where a.document_id = $1")
    ).n,
    questions: (await one("select count(*)::int as n from questions where document_id = $1")).n,
  };
}

async function storedDocument(documentId) {
  const { rows } = await db.query("select title, extracted_text from documents where id = $1", [documentId]);
  return /** @type {any} */ (rows[0]);
}

describe("reopening a saved Document", () => {
  it("shows the most recent analysis as stored, with no model configured or reachable", async () => {
    const id = await savedReadAndAsked(storeA);
    // A second reading, with a different summary, made later: this is the one to show.
    await analyseSavedDocument(storeA, id, {
      model: stubFromSidecar(sidecar, { summary: "The second reading." }),
      modelId,
      logDrop: () => {},
    });
    const stored = await storeA.latestAnalysis(id);

    // From here on, any attempt to reach a model throws: no key, no model id,
    // and fetch (the only way out) is already stubbed to throw.
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("OPENROUTER_MODEL", "");

    const rows = await loadSavedDocument(storeA, id);
    expect(rows).not.toBeNull();
    const shown = showSavedDocument(/** @type {NonNullable<typeof rows>} */ (rows));

    expect(shown.document.text).toBe(contract);
    expect(shown.analysis?.id).toBe(stored?.id);
    expect(shown.analysis?.summary).toBe("The second reading.");
    expect(shown.analysis?.summary).not.toBe(DEFAULT_SUMMARY);
    expect(shown.analysis?.flags.map((f) => f.sourceSentence).sort()).toEqual(
      sidecar.flags.map((f) => f.sourceSentence).sort(),
    );
    for (const flag of shown.analysis?.flags ?? []) {
      expect(contract.includes(flag.sourceSentence)).toBe(true);
    }
    expect(shown.analysis?.flags.some((f) => typeof f.counterOffer === "string")).toBe(true);
    expect(shown.questions.map((q) => q.question)).toEqual(["Who owns what I make?"]);
  });

  it("shows a never-read Document with no analysis, and still reaches no model", async () => {
    const { id } = await storeA.saveDocument({ title: "Unread", text: contract });
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("OPENROUTER_MODEL", "");
    const rows = await loadSavedDocument(storeA, id);
    const shown = showSavedDocument(/** @type {NonNullable<typeof rows>} */ (rows));
    expect(shown.analysis).toBeNull();
    expect(shown.document.title).toBe("Unread");
  });

  it("loads another Reader's Document as null, the same as an id that never existed", async () => {
    const id = await savedReadAndAsked(storeA);
    expect(await loadSavedDocument(storeB, id)).toBeNull();
    expect(await loadSavedDocument(storeB, "00000000-0000-4000-8000-000000000000")).toBeNull();
    expect(await loadSavedDocument(storeA, "not-a-uuid")).toBeNull();
  });
});

describe("renaming a Document", () => {
  it.each([
    ["the adhesion contract", contract],
    ["the contract with CRLF line endings and a non-breaking space", contractCrlf],
  ])("changes the title of %s and leaves the stored text byte for byte", async (_name, text) => {
    const id = await savedReadAndAsked(storeA, text);
    const before = await storedDocument(id);
    const rowsBefore = await storedRows(id);

    const result = await renameSavedDocument(storeA, id, "  Northwick   brand deal, v2 ");
    expect(result).toEqual({ ok: true, title: "Northwick brand deal, v2" });

    const after = await storedDocument(id);
    expect(after.title).toBe("Northwick brand deal, v2");
    expect(after.extracted_text).toBe(before.extracted_text);
    expect(Buffer.from(after.extracted_text, "utf8").equals(Buffer.from(text, "utf8"))).toBe(true);
    // Nothing made from the Document was touched either.
    expect(await storedRows(id)).toEqual(rowsBefore);

    // The library entry carries the new name, and the Document still reopens.
    const entry = (await storeA.listLibrary()).find((e) => e.id === id);
    expect(entry?.title).toBe("Northwick brand deal, v2");
    const reopened = showSavedDocument(/** @type {any} */ (await loadSavedDocument(storeA, id)));
    expect(reopened.document.title).toBe("Northwick brand deal, v2");
    expect(reopened.analysis?.flags.length).toBe(sidecar.flags.length);
  });

  it("refuses a blank name and writes nothing", async () => {
    const id = await savedReadAndAsked(storeA);
    const result = await renameSavedDocument(storeA, id, "  \t ");
    expect(result).toEqual({ ok: false, reason: "invalid", error: expect.any(String) });
    expect((await storedDocument(id)).title).toBe("Northwick deal");
  });

  it("cuts an over-long name to the limit", async () => {
    const id = await savedReadAndAsked(storeA);
    const result = await renameSavedDocument(storeA, id, "word ".repeat(100));
    expect(result.ok).toBe(true);
    const title = (await storedDocument(id)).title;
    expect(Array.from(title).length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
  });

  it("refuses a change to the extracted text in the database itself", async () => {
    const id = await savedReadAndAsked(storeA);
    await expect(
      as(db, await readerOf(id), (tx) =>
        tx.query("update documents set extracted_text = 'rewritten' where id = $1", [id]),
      ),
    ).rejects.toThrow(/can't be changed/);
    expect((await storedDocument(id)).extracted_text).toBe(contract);
  });

  it("lets a second Reader rename nothing, and tells them it isn't found", async () => {
    const id = await savedReadAndAsked(storeA);
    expect(await renameSavedDocument(storeB, id, "Stolen")).toEqual({ ok: false, reason: "not-found" });
    expect(await storeB.renameDocument(id, "Stolen")).toBeNull();
    expect((await storedDocument(id)).title).toBe("Northwick deal");
    // The same answer as for an id that doesn't exist, or isn't an id.
    expect(await renameSavedDocument(storeB, "00000000-0000-4000-8000-000000000000", "x")).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(await renameSavedDocument(storeB, "nope", "x")).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("deleting a Document", () => {
  it("removes the Document, its analyses, their Flags and its questions; the id is then not found", async () => {
    const id = await savedReadAndAsked(storeA);
    await analyseSavedDocument(storeA, id, { model: stubFromSidecar(sidecar), modelId, logDrop: () => {} });
    const keep = await savedReadAndAsked(storeA, contract, "Keep this one");

    const before = await storedRows(id);
    expect(before).toEqual({ documents: 1, analyses: 2, flags: 2 * sidecar.flags.length, questions: 1 });

    expect(await deleteSavedDocument(storeA, id)).toEqual({ ok: true });

    expect(await storedRows(id)).toEqual({ documents: 0, analyses: 0, flags: 0, questions: 0 });
    expect((await storeA.listLibrary()).map((e) => e.id)).not.toContain(id);
    expect(await storeA.getDocument(id)).toBeNull();
    expect(await loadSavedDocument(storeA, id)).toBeNull();

    // Only that one: the Reader's other Document is all still there.
    expect(await storedRows(keep)).toEqual({ documents: 1, analyses: 1, flags: sidecar.flags.length, questions: 1 });

    // Deleting it again is "not found", not an error.
    expect(await deleteSavedDocument(storeA, id)).toEqual({ ok: false, reason: "not-found" });
  });

  it("lets a second Reader delete nothing, and tells them it isn't found", async () => {
    const id = await savedReadAndAsked(storeA);
    const before = await storedRows(id);
    expect(await deleteSavedDocument(storeB, id)).toEqual({ ok: false, reason: "not-found" });
    expect(await storeB.deleteDocument(id)).toBe(false);
    expect(await storedRows(id)).toEqual(before);
    expect(await deleteSavedDocument(storeB, "nope")).toEqual({ ok: false, reason: "not-found" });
  });
});

/** The reader_id that owns a Document, read as the superuser. */
async function readerOf(documentId) {
  const { rows } = await db.query("select reader_id from documents where id = $1", [documentId]);
  return /** @type {any} */ (rows[0]).reader_id;
}
