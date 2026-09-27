import { createClient } from "@supabase/supabase-js";
import { assertServerOnly, required } from "../env.js";

assertServerOnly("lib/supabase/admin.js");

/**
 * Supabase client holding the secret key.
 *
 * This key bypasses row-level security, so it stays on the server and is read
 * only when something actually asks for this client. Reader-facing paths should
 * use the browser client or a session-scoped client; this one exists for work
 * that legitimately runs outside a Reader's session.
 *
 * No schema exists yet. Whether a Supabase project exists at all is an open
 * decision (CLAUDE.md, "Ask before you decide"), so nothing here creates tables
 * or runs migrations.
 */

let client = null;

export function getAdminSupabase() {
  assertServerOnly("lib/supabase/admin.js");
  if (client) return client;

  client = createClient(
    required("SUPABASE_URL"),
    required("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return client;
}
