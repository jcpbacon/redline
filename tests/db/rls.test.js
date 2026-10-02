import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEVERITY_IDS } from "../../lib/analysis/severity.js";
import { as, bootDatabase, createUser } from "./supabase-shim.js";

/*
 * Story 4 and ticket #18: a Reader can only ever see their own data, verified
 * against the database rather than through the UI.
 *
 * The migrations in supabase/migrations/ run unmodified on an in-memory
 * Postgres (PGlite) with a minimal imitation of Supabase's auth schema and
 * roles (./supabase-shim.js). Every query below runs as a non-superuser role,
 * so row-level security is what decides each result.
 *
 * This proves the SQL. It does not prove a real Supabase project has these
 * migrations applied; tests/integration/rls-live.test.js does that once a
 * project exists (see tests/db/README.md).
 */

const TABLES = ["documents", "analyses", "flags", "red_lines", "questions"];

/** @type {import("@electric-sql/pglite").PGlite} */
let db;
let readerA = "";
let readerB = "";
/** @type {Record<string, string>} */
const own = {};

async function seedFor(readerId, title = "Brand deal with Northwind") {
  return as(db, readerId, async (tx) => {
    const one = async (sql, params) => /** @type {{ id: string }} */ ((await tx.query(sql, params)).rows[0]).id;
    const redLine = await one("insert into red_lines (text) values ('I keep the rights to my work') returning id");
    const document = await one(
      "insert into documents (title, extracted_text) values ($1, 'The Creator assigns all rights in the Content to the Brand.') returning id",
      [title],
    );
    const analysis = await one(
      "insert into analyses (document_id, summary, model_id, checked) values ($1, 'You give the Brand your rights.', 'test-model', '[\"ip-assignment-or-licence-scope\"]') returning id",
      [document],
    );
    const flag = await one(
      `insert into flags (analysis_id, severity, clause_type, source_sentence, what_it_means, why_dangerous,
                          counter_offer, matched_red_line_id, position, order_index)
       values ($1, 'critical', 'ip-assignment-or-licence-scope', 'The Creator assigns all rights in the Content to the Brand.',
               'The Brand owns what you make.', 'You cannot reuse your own work.', 'Grant a licence instead.', $2, 0, 0)
       returning id`,
      [analysis, redLine],
    );
    const question = await one(
      "insert into questions (document_id, question, answer_text, grounded_in) values ($1, 'Who owns the videos?', 'The Brand.', '[\"The Creator assigns all rights in the Content to the Brand.\"]') returning id",
      [document],
    );
    return { documents: document, analyses: analysis, flags: flag, red_lines: redLine, questions: question };
  });
}

/** Read a row with no RLS in the way, to check what really happened. */
async function rawRow(table, id) {
  return (await db.query(`select * from ${table} where id = $1`, [id])).rows[0] ?? null;
}

beforeAll(async () => {
  db = await bootDatabase();
  readerA = await createUser(db);
  readerB = await createUser(db);
  Object.assign(own, await seedFor(readerA));
});

afterAll(async () => {
  await db?.close();
});

describe("the schema", () => {
  it("has row-level security switched on for every table", async () => {
    const { rows } = await db.query(
      "select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname",
    );
    // red_line_seeds is keyed by Reader, not by id; tests/db/red-lines.test.js covers its isolation.
    expect(rows.map((r) => r.relname).sort()).toEqual([...TABLES, "red_line_seeds"].sort());
    for (const row of rows) expect(row.relrowsecurity, row.relname).toBe(true);
  });

  it("has nowhere to store a file: no name, body, MIME type or path column", async () => {
    const { rows } = await db.query(
      "select table_name, column_name from information_schema.columns where table_schema = 'public'",
    );
    const fileish = rows.filter((r) => /file|blob|mime|bytes|storage|path|content_type/i.test(r.column_name));
    expect(fileish).toEqual([]);
  });

  it("accepts exactly the severities lib/analysis/severity.js defines", async () => {
    for (const severity of SEVERITY_IDS) {
      await as(db, readerA, (tx) =>
        tx.query(
          `insert into flags (analysis_id, severity, clause_type, source_sentence, what_it_means, why_dangerous, counter_offer, position, order_index)
           values ($1, $2, 'x', 'The Creator assigns all rights in the Content to the Brand.', 'm', 'w', 'c', 0, $3)`,
          [own.analyses, severity, 100 + SEVERITY_IDS.indexOf(severity)],
        ),
      );
    }
    await expect(
      as(db, readerA, (tx) =>
        tx.query(
          `insert into flags (analysis_id, severity, clause_type, source_sentence, what_it_means, why_dangerous, counter_offer, position, order_index)
           values ($1, 'low', 'x', 'The Creator assigns all rights in the Content to the Brand.', 'm', 'w', 'c', 0, 200)`,
          [own.analyses],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("the Reader who owns the rows", () => {
  it("sees each of them", async () => {
    for (const table of TABLES) {
      const { rows } = await as(db, readerA, (tx) => tx.query(`select id from ${table} where id = $1`, [own[table]]));
      expect(rows, table).toHaveLength(1);
    }
  });

  it("can dismiss their own Flag and rename their own Document", async () => {
    await as(db, readerA, async (tx) => {
      expect((await tx.query("update flags set dismissed_at = now() where id = $1", [own.flags])).affectedRows).toBe(1);
      expect((await tx.query("update documents set title = 'Northwind, v2' where id = $1", [own.documents])).affectedRows).toBe(1);
    });
    expect((await rawRow("documents", own.documents)).title).toBe("Northwind, v2");
  });
});

describe("another signed-in Reader", () => {
  it("sees none of the first Reader's rows, by id or by listing the table", async () => {
    for (const table of TABLES) {
      const byId = await as(db, readerB, (tx) => tx.query(`select * from ${table} where id = $1`, [own[table]]));
      expect(byId.rows, table).toEqual([]);
      const all = await as(db, readerB, (tx) => tx.query(`select * from ${table}`));
      expect(all.rows, table).toEqual([]);
    }
  });

  it("changes nothing when updating the first Reader's rows", async () => {
    const updates = {
      documents: "update documents set title = 'stolen' where id = $1",
      analyses: "update analyses set summary = 'stolen' where id = $1",
      flags: "update flags set counter_offer = 'stolen' where id = $1",
      red_lines: "update red_lines set text = 'stolen' where id = $1",
      questions: "update questions set answer_text = 'stolen' where id = $1",
    };
    for (const table of TABLES) {
      const before = await rawRow(table, own[table]);
      const result = await as(db, readerB, (tx) => tx.query(updates[table], [own[table]]));
      expect(result.affectedRows, table).toBe(0);
      expect(await rawRow(table, own[table]), table).toEqual(before);
    }
  });

  it("deletes nothing when deleting the first Reader's rows", async () => {
    // Children first, so a cascade from a parent can't hide a missed child.
    for (const table of ["flags", "questions", "analyses", "red_lines", "documents"]) {
      const result = await as(db, readerB, (tx) => tx.query(`delete from ${table} where id = $1`, [own[table]]));
      expect(result.affectedRows, table).toBe(0);
      expect(await rawRow(table, own[table]), table).not.toBeNull();
    }
  });

  it("cannot add rows under the first Reader's Document or in their name", async () => {
    /** @type {Array<[string, string[]]>} */
    const attempts = [
      ["insert into documents (reader_id, title, extracted_text) values ($1, 't', 'x')", [readerA]],
      ["insert into red_lines (reader_id, text) values ($1, 'x')", [readerA]],
      ["insert into analyses (document_id, summary, model_id) values ($1, 's', 'm')", [own.documents]],
      [
        `insert into flags (analysis_id, severity, clause_type, source_sentence, what_it_means, why_dangerous, counter_offer, position, order_index)
         values ($1, 'high', 'x', 's', 'm', 'w', 'c', 0, 300)`,
        [own.analyses],
      ],
      ["insert into questions (document_id, question) values ($1, 'q')", [own.documents]],
      ["insert into questions (document_id, reader_id, question) values ($1, $2, 'q')", [own.documents, readerA]],
    ];
    for (const [sql, params] of attempts) {
      await expect(as(db, readerB, (tx) => tx.query(sql, params)), sql).rejects.toThrow(/row-level security/);
    }
  });

  it("cannot hand their own Document to the first Reader", async () => {
    const theirs = await seedFor(readerB, "B's own deal");
    await expect(
      as(db, readerB, (tx) => tx.query("update documents set reader_id = $1 where id = $2", [readerA, theirs.documents])),
    ).rejects.toThrow(/row-level security/);
  });

  it("cannot point a Flag of their own at the first Reader's Red Line", async () => {
    const theirs = await seedFor(readerB, "B's second deal");
    await expect(
      as(db, readerB, (tx) =>
        tx.query("update flags set matched_red_line_id = $1 where id = $2", [own.red_lines, theirs.flags]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("a signed-out request", () => {
  it("can read none of the tables", async () => {
    for (const table of TABLES) {
      await expect(as(db, null, (tx) => tx.query(`select * from ${table}`)), table).rejects.toThrow(/permission denied/);
    }
  });

  it("can write to none of the tables", async () => {
    await expect(
      as(db, null, (tx) => tx.query("insert into documents (reader_id, title, extracted_text) values ($1, 't', 'x')", [readerA])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("deletion", () => {
  it("removes a Document's analyses, Flags and questions with it", async () => {
    const rows = await seedFor(readerA, "To be deleted");
    await as(db, readerA, (tx) => tx.query("delete from documents where id = $1", [rows.documents]));
    for (const table of ["documents", "analyses", "flags", "questions"]) {
      expect(await rawRow(table, rows[table]), table).toBeNull();
    }
    expect(await rawRow("red_lines", rows.red_lines)).not.toBeNull();
  });

  it("keeps a Flag when its Red Line is deleted, and clears the link", async () => {
    const rows = await seedFor(readerA, "Red Line goes away");
    await as(db, readerA, (tx) => tx.query("delete from red_lines where id = $1", [rows.red_lines]));
    const flag = await rawRow("flags", rows.flags);
    expect(flag).not.toBeNull();
    expect(flag.matched_red_line_id).toBeNull();
  });

  it("removes everything a Reader owns when their account is deleted", async () => {
    const reader = await createUser(db);
    const rows = await seedFor(reader, "Leaving");
    await db.query("delete from auth.users where id = $1", [reader]);
    for (const table of TABLES) expect(await rawRow(table, rows[table]), table).toBeNull();
  });
});
