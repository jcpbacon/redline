/**
 * Every database read and write for Documents and their analyses, through a
 * Supabase client that carries the Reader's session.
 *
 *   createDocumentStore(supabase) -> {
 *     saveDocument({ title, text })   -> { id }
 *     listLibrary()                   -> LibraryEntry[]  (newest activity first)
 *     getDocument(id)                 -> StoredDocument | null
 *     latestAnalysis(documentId)      -> the latest_analysis() record | null
 *     saveAnalysis({ ... })           -> { id }
 *   }
 *
 * A thin pass-through on purpose. Every query it makes is SQL that lives in
 * supabase/migrations/ — the documents table, the library_entries view, and
 * the save_analysis / latest_analysis functions — and that SQL is what
 * tests/db/ runs on PGlite, as two Readers, to prove what it does. Access is
 * decided by row-level security in the database, never here: another
 * Reader's Document comes back as null, the same as one that doesn't exist.
 *
 * Takes the client rather than making one, so Server Components, Server
 * Functions and Route Handlers share it, and a test can hand the same
 * interface a different database (tests/db/pglite-store.js).
 *
 * Nothing about a file is accepted or written: the only Document fields are
 * title and extracted text.
 */

/**
 * @typedef {{ id: string, title: string, savedAt: string, analysedAt: string | null, lastActivityAt: string }} LibraryEntry
 * @typedef {{ id: string, title: string, text: string, savedAt: string }} StoredDocument
 * @typedef {{
 *   saveDocument(input: { title: string, text: string }): Promise<{ id: string }>,
 *   listLibrary(): Promise<LibraryEntry[]>,
 *   getDocument(id: string): Promise<StoredDocument | null>,
 *   latestAnalysis(documentId: string): Promise<Record<string, any> | null>,
 *   saveAnalysis(input: {
 *     documentId: string,
 *     summary: string,
 *     modelId: string,
 *     redLinesSnapshot: Array<{ id: string, text: string }>,
 *     checked: string[],
 *     flags: Array<Record<string, unknown>>,
 *   }): Promise<{ id: string }>,
 * }} DocumentStore
 */

/** A failed query. `cause` holds Supabase's error; its message is not Reader copy. */
export class StoreError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = "StoreError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether `id` could be a row id. Anything else can't name a Document, so it
 * is answered "not found" without asking the database (which would reject it
 * with a type error rather than an empty result).
 *
 * @param {unknown} id
 * @returns {id is string}
 */
export function isDocumentId(id) {
  return typeof id === "string" && UUID.test(id);
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @returns {DocumentStore}
 */
export function createDocumentStore(supabase) {
  if (!supabase) throw new TypeError("createDocumentStore needs a Supabase client.");

  return {
    async saveDocument({ title, text }) {
      const { data, error } = await supabase
        .from("documents")
        .insert({ title, extracted_text: text })
        .select("id")
        .single();
      if (error || !data) throw new StoreError("Couldn't save the Document.", error);
      return { id: data.id };
    },

    async listLibrary() {
      const { data, error } = await supabase
        .from("library_entries")
        .select("id, title, saved_at, analysed_at, last_activity_at")
        .order("last_activity_at", { ascending: false })
        .order("id", { ascending: true });
      if (error) throw new StoreError("Couldn't list the library.", error);
      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        savedAt: row.saved_at,
        analysedAt: row.analysed_at ?? null,
        lastActivityAt: row.last_activity_at,
      }));
    },

    async getDocument(id) {
      if (!isDocumentId(id)) return null;
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, extracted_text, created_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new StoreError("Couldn't load the Document.", error);
      if (!data) return null;
      return { id: data.id, title: data.title, text: data.extracted_text, savedAt: data.created_at };
    },

    async latestAnalysis(documentId) {
      if (!isDocumentId(documentId)) return null;
      const { data, error } = await supabase.rpc("latest_analysis", { p_document_id: documentId });
      if (error) throw new StoreError("Couldn't load the analysis.", error);
      return data ?? null;
    },

    async saveAnalysis({ documentId, summary, modelId, redLinesSnapshot, checked, flags }) {
      const { data, error } = await supabase.rpc("save_analysis", {
        p_document_id: documentId,
        p_summary: summary,
        p_model_id: modelId,
        p_red_lines_snapshot: redLinesSnapshot,
        p_checked: checked,
        p_flags: flags,
      });
      if (error || typeof data !== "string") throw new StoreError("Couldn't save the analysis.", error);
      return { id: data };
    },
  };
}
