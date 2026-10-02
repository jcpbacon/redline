import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/*
 * An in-memory Postgres with the smallest slice of Supabase's environment the
 * migrations depend on, then every migration in supabase/migrations/ applied
 * in filename order.
 *
 * This shim is test scaffolding for the database, which is what's under test.
 * The product never uses it. The migrations' SQL runs unmodified; if PGlite
 * could not run something Supabase-specific in them, this file would change,
 * not the migrations.
 *
 * What Supabase provides and this imitates:
 *   - schema `auth` with `auth.users(id)`, which the tables reference;
 *   - `auth.uid()`, which reads the `sub` claim of the request's JWT from the
 *     `request.jwt.claims` setting (PostgREST sets it per request);
 *   - the `anon` and `authenticated` roles PostgREST switches into, neither of
 *     which bypasses row-level security;
 *   - Supabase's default privileges, which grant both roles full table
 *     privileges in `public` so that RLS policies (and any explicit revokes in
 *     a migration) are what decide access.
 */

const MIGRATIONS_DIR = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));

const SHIM = `
  create schema auth;
  create table auth.users (id uuid primary key);

  create function auth.uid() returns uuid
  language sql stable
  as $$
    select (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub')::uuid
  $$;

  create role anon nologin noinherit;
  create role authenticated nologin noinherit;

  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`;

export function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

/** Boot Postgres, install the shim, apply every migration. */
export async function bootDatabase() {
  const db = new PGlite();
  await db.exec(SHIM);
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return db;
}

/** Create a user the way Supabase Auth would, and return its id. */
export async function createUser(db) {
  const { rows } = await db.query("insert into auth.users (id) values (gen_random_uuid()) returning id");
  return /** @type {{ id: string }} */ (rows[0]).id;
}

/**
 * Run `fn` as a signed-in Reader (role `authenticated`, JWT `sub` = readerId)
 * or, with readerId null, as a signed-out request (role `anon`, no claims).
 * Everything inside runs in a transaction so the role and claims can't leak
 * into the next call, and the transaction commits unless `fn` throws.
 *
 * @template T
 * @param {PGlite} db
 * @param {string | null} readerId
 * @param {(tx: import("@electric-sql/pglite").Transaction) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function as(db, readerId, fn) {
  return db.transaction(async (tx) => {
    const claims = readerId ? JSON.stringify({ sub: readerId, role: "authenticated" }) : "";
    await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await tx.exec(readerId ? "set local role authenticated" : "set local role anon");
    return fn(tx);
  });
}
