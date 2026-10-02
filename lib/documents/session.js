import { assertServerOnly } from "../env.js";
import { createServerSupabase } from "../supabase/server.js";
import { createDocumentStore } from "./store.js";

assertServerOnly("lib/documents/session.js");

/**
 * The signed-in Reader's Document store for this request.
 *
 *   { state: "off" }                  accounts aren't configured here
 *   { state: "signed-out" }           nobody is signed in (or Supabase can't be reached)
 *   { state: "ok", reader, store }    queries run as this Reader, under RLS
 *
 * One Supabase client per request, carrying the Reader's cookies; never the
 * secret-key client. Checking the session here is for the screen's sake: the
 * database checks again on every query through row-level security.
 *
 * @returns {Promise<
 *   | { state: "off" }
 *   | { state: "signed-out" }
 *   | { state: "ok", reader: { id: string, email: string | null }, store: import("./store.js").DocumentStore }
 * >}
 */
export async function readerStore() {
  const supabase = await createServerSupabase();
  if (!supabase) return { state: "off" };
  try {
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims || typeof claims.sub !== "string") return { state: "signed-out" };
    const reader = { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
    return { state: "ok", reader, store: createDocumentStore(supabase) };
  } catch (err) {
    console.error("Couldn't read the Reader's session:", err);
    return { state: "signed-out" };
  }
}
