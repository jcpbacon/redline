# Database tests

`rls.test.js` applies every file in `supabase/migrations/` to an in-memory
Postgres (PGlite) and checks row-level security: one Reader can't select,
update, delete or insert another Reader's Documents, analyses, Flags, Red
Lines or questions, and a signed-out request can read none of them. It runs in
`npm test` with no network and no Supabase project.

`library.test.js` covers the library migration (`20261002000600_library.sql`)
the same way: a Document's extracted text round-trips byte for byte (both
fixtures, CRLF, NBSP, smart quotes, leading and trailing whitespace); the
`library_entries` view lists only the Reader's own Documents, newest activity
first; `save_analysis` stores an analysis and its Flags in one transaction and
refuses another Reader; `latest_analysis` returns the newest run, and null to
anyone else.

`red-lines.test.js` covers Red Lines (ticket #22,
`20261002000700_red_line_seeds.sql`): create, edit and delete as one Reader
and not as another; the seed set given once per Reader and not again after
they delete every Red Line; the snapshot stored with an analysis; a deleted
Red Line nulling `matched_red_line_id` while the Flag keeps its mark; and the
`/api/analyze` handler using a signed-in Reader's Red Lines.

`dismiss.test.js` covers dismissing a Flag (ticket #23): `dismissed_at` set
and cleared through the store as its Reader, read back by `latest_analysis`,
untouchable by another Reader, and absent from the Flags of a new run.

`pglite-store.js` gives lib/documents/store.js's interface over this database
as one Reader, running the same view and functions, so
`tests/documents/analyse-saved.test.js` can drive the analyse-by-id code and
its route handler against real SQL for two Readers.

`supabase-shim.js` stands in for the parts of Supabase the migrations rely on:
the `auth` schema with `auth.users(id)`, `auth.uid()` reading the JWT `sub`
from `request.jwt.claims`, the `anon` and `authenticated` roles, and
Supabase's default table grants. Only the tests use it. The migrations run
unmodified; if PGlite ever can't run something Supabase-specific in them,
change the shim, not the migration.

## Once a Supabase project exists

The shim proves the SQL, not that a real project has it applied. When there is
a project (a dev or staging one, never production data), apply the migrations
and run the live test, which creates two throwaway users with the admin API
and checks the same isolation through the publishable-key client:

```
SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SECRET_KEY=… \
  npx vitest run tests/integration/rls-live.test.js
```

`tests/integration/library-live.test.js` runs save → list → open → analyse for
two Readers the same way, through lib/documents/store.js;
`tests/integration/red-lines-live.test.js` does the same for Red Lines, and
`tests/integration/dismiss-live.test.js` for dismissing a Flag.

All of them are skipped whenever any of those three variables is missing, which is why
`npm test` reports it as skipped today.
