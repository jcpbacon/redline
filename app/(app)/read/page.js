import { getReader } from "../../../lib/supabase/server.js";
import ReadDocument from "./ReadDocument";

/*
 * /read: paste a Document, confirm the text, read the analysis.
 *
 * The verb is the route. Pasting is the only way in for now; upload (PDF and
 * DOCX) joins this same screen, and the result appears on it, so neither
 * /paste nor /upload would stay true. It works for any Reader, signed in or
 * not. A signed-in Reader can also save the Document to their library
 * (ticket #21); getReader() is null when accounts are off, without reading
 * the request, so this page still prerenders then.
 */

export const metadata = {
  title: "Read a document · Redline",
  description: "Paste a contract and get a plain-English summary of what it says.",
};

export default async function ReadPage() {
  const reader = await getReader();
  return <ReadDocument canSave={Boolean(reader)} />;
}
