# Database tests

`rls.test.js` applies every file in `supabase/migrations/` to an in-memory
Postgres (PGlite) and checks row-level security: one Reader can't select,
update, delete or insert another Reader's Documents, analyses, Flags, Red
Lines or questions, and a signed-out request can read none of them. It runs in
`npm test` with no network and no Supabase project.

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

It's skipped whenever any of those three variables is missing, which is why
`npm test` reports it as skipped today.
