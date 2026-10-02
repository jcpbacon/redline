import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, bootDatabase, createUser } from "./supabase-shim.js";
import { readFixture } from "../helpers/stub-model.js";

/*
 * Ticket #21 and #19's persistence criteria, at the SQL level.
 *
 * Runs supabase/migrations/ unmodified on PGlite (./supabase-shim.js), as
 * non-superuser roles, so row-level security decides every result. Covers the
 * pieces lib/documents/store.js reaches through PostgREST: the documents
 * table, the library_entries view, and the save_analysis / latest_analysis
 * functions (20261002000600_library.sql).
 */

/** @type {import("@electric-sql/pglite").PGlite} */
let db;
let readerA = "";
let readerB = "";

const SENTENCE = "The Creator assigns all rights in the Content to the Brand.";

function flagRow(overrides = {}) {
  return {
    severity: "critical",
    clause_type: "ip-assignment-or-licence-scope",
    source_sentence: SENTENCE,
    what_it_means: "The Brand owns what you make.",
    why_dangerous: "You can't reuse your own work.",
    counter_offer: "Could we change this to a licence?",
    matched_red_line_id: null,
    position: 0,
    order_index: 0,
    ...overrides,
  };
}

async function saveDocument(readerId, text, title = "A document") {
  return as(db, readerId, async (tx) => {
    const { rows } = await tx.query("insert into documents (title, extracted_text) values ($1, $2) returning id", [
      title,
      text,
    ]);
    return /** @type {any} */ (rows[0]).id;
  });
}

async function saveAnalysis(readerId, documentId, { summary = "You give the Brand your rights.", flags = [flagRow()] } = {}) {
  return as(db, readerId, async (tx) => {
    const { rows } = await tx.query(
      "select save_analysis($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb) as id",
      [documentId, summary, "stub-model-client", "[]", JSON.stringify(["ip-assignment-or-licence-scope"]), JSON.stringify(flags)],
    );
    return /** @type {any} */ (rows[0]).id;
  });
}

async function latest(readerId, documentId) {
  return as(db, readerId, async (tx) => {
    const { rows } = await tx.query("select latest_analysis($1) as record", [documentId]);
    return /** @type {any} */ (rows[0]).record;
  });
}

/** Count rows with no RLS in the way. */
async function rawCount(table, column, value) {
  const { rows } = await db.query(`select count(*)::int as n from ${table} where ${column} = $1`, [value]);
  return /** @type {any} */ (rows[0]).n;
}

beforeAll(async () => {
  db = await bootDatabase();
  readerA = await createUser(db);
  readerB = await createUser(db);
});

afterAll(async () => {
  await db?.close();
});

describe("extracted_text", () => {
  const cases = {
    "the adhesion contract fixture": readFixture("adhesion-contract.txt"),
    "the clean fixture": readFixture("clean-document.txt"),
    "leading and trailing whitespace": "  \n\t  Clause 1. Fees are due.\n\n   \t",
    "CRLF line endings": "Clause 1.\r\nFees are due.\r\n\r\nClause 2.\r\n",
    "a lone CR": "Clause 1.\rClause 2.",
    "non-breaking spaces": "Payment of $5,000 within 30 days.",
    "smart quotes and dashes": "The “Content” isn’t the Brand’s — it’s ‘yours’ – until paid.",
    "zero-width and combining characters": "Café ​terms﻿ apply.",
  };

  it.each(Object.entries(cases))("round-trips %s byte for byte", async (_name, text) => {
    const id = await saveDocument(readerA, text);
    const stored = await as(db, readerA, async (tx) => {
      const { rows } = await tx.query("select extracted_text from documents where id = $1", [id]);
      return /** @type {any} */ (rows[0]).extracted_text;
    });
    expect(stored).toBe(text);
    expect(Buffer.from(stored, "utf8").equals(Buffer.from(text, "utf8"))).toBe(true);
  });
});

describe("the library_entries view", () => {
  it("lists only the Reader's own Documents, with an analysed date once read", async () => {
    const fresh = await createUser(db);
    const other = await createUser(db);
    const older = await saveDocument(fresh, SENTENCE, "Older");
    const newer = await saveDocument(fresh, SENTENCE, "Newer");
    await saveDocument(other, SENTENCE, "Someone else's");
    // Make the dates distinct and known, as the superuser.
    await db.query("update documents set created_at = '2026-01-01T00:00:00Z' where id = $1", [older]);
    await db.query("update documents set created_at = '2026-02-01T00:00:00Z' where id = $1", [newer]);

    const list = async (readerId) =>
      as(db, readerId, async (tx) => (await tx.query("select * from library_entries order by last_activity_at desc, id")).rows);

    let rows = /** @type {any[]} */ (await list(fresh));
    expect(rows.map((r) => r.title)).toEqual(["Newer", "Older"]);
    expect(rows.every((r) => r.analysed_at === null)).toBe(true);

    // Reading the older one makes it the most recent activity.
    await saveAnalysis(fresh, older);
    rows = /** @type {any[]} */ (await list(fresh));
    expect(rows.map((r) => r.title)).toEqual(["Older", "Newer"]);
    expect(rows[0].analysed_at).not.toBeNull();

    expect(((await list(other))).map((r) => /** @type {any} */ (r).title)).toEqual(["Someone else's"]);
  });

  it("shows a signed-out request nothing", async () => {
    await expect(as(db, null, (tx) => tx.query("select * from library_entries"))).rejects.toThrow(/permission denied/);
  });
});

describe("save_analysis", () => {
  it("stores the analysis and its Flags together, including a Flag with no Counter-offer", async () => {
    const doc = await saveDocument(readerA, SENTENCE);
    const id = await saveAnalysis(readerA, doc, {
      flags: [flagRow(), flagRow({ severity: "medium", counter_offer: null, order_index: 1 })],
    });
    expect(await rawCount("analyses", "id", id)).toBe(1);
    expect(await rawCount("flags", "analysis_id", id)).toBe(2);
  });

  it("stores nothing at all when one Flag is refused", async () => {
    const doc = await saveDocument(readerA, SENTENCE);
    await expect(
      saveAnalysis(readerA, doc, { flags: [flagRow(), flagRow({ severity: "low", order_index: 1 })] }),
    ).rejects.toThrow(/check constraint/);
    expect(await rawCount("analyses", "document_id", doc)).toBe(0);
  });

  it("refuses a blank Counter-offer; null is the one way to say none", async () => {
    const doc = await saveDocument(readerA, SENTENCE);
    await expect(saveAnalysis(readerA, doc, { flags: [flagRow({ counter_offer: "   " })] })).rejects.toThrow(
      /check constraint/,
    );
  });

  it("refuses another Reader saving an analysis on the first Reader's Document, and stores nothing", async () => {
    const doc = await saveDocument(readerA, SENTENCE);
    await expect(saveAnalysis(readerB, doc)).rejects.toThrow(/row-level security/);
    expect(await rawCount("analyses", "document_id", doc)).toBe(0);
  });

  it("can't be called by a signed-out request", async () => {
    const doc = await saveDocument(readerA, SENTENCE);
    await expect(
      as(db, null, (tx) =>
        tx.query("select save_analysis($1, 's', 'm', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)", [doc]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("latest_analysis", () => {
  it("returns the most recent run, with its Flags in ranked order", async () => {
    const doc = await saveDocument(readerA, SENTENCE);
    const first = await saveAnalysis(readerA, doc, { summary: "First run." });
    const second = await saveAnalysis(readerA, doc, {
      summary: "Second run.",
      flags: [flagRow({ order_index: 1, severity: "medium" }), flagRow({ order_index: 0 })],
    });
    await db.query("update analyses set created_at = '2026-03-01T00:00:00Z' where id = $1", [first]);
    await db.query("update analyses set created_at = '2026-03-02T00:00:00Z' where id = $1", [second]);

    const record = await latest(readerA, doc);
    expect(record.id).toBe(second);
    expect(record.summary).toBe("Second run.");
    expect(record.flags.map((f) => f.order_index)).toEqual([0, 1]);
    expect(record.flags.map((f) => f.severity)).toEqual(["critical", "medium"]);
    expect(record.checked).toEqual(["ip-assignment-or-licence-scope"]);
    expect(await rawCount("analyses", "document_id", doc)).toBe(2);

    // Each re-run is a new row; the older one is still there, and still not shown.
    await db.query("update analyses set created_at = '2026-03-03T00:00:00Z' where id = $1", [first]);
    expect((await latest(readerA, doc)).id).toBe(first);
  });

  it("returns null for a Document with no analysis", async () => {
    const doc = await saveDocument(readerA, SENTENCE);
    expect(await latest(readerA, doc)).toBeNull();
  });

  it("returns null to another Reader, exactly as for an id that doesn't exist", async () => {
    const doc = await saveDocument(readerA, SENTENCE);
    await saveAnalysis(readerA, doc);
    expect(await latest(readerB, doc)).toBeNull();
    expect(await latest(readerB, "00000000-0000-4000-8000-000000000000")).toBeNull();

    const visible = await as(db, readerB, async (tx) => ({
      analyses: (await tx.query("select * from analyses where document_id = $1", [doc])).rows,
      flags: (await tx.query("select f.* from flags f join analyses a on a.id = f.analysis_id where a.document_id = $1", [doc])).rows,
    }));
    expect(visible).toEqual({ analyses: [], flags: [] });
  });
});
