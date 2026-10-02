import ReadDocument from "./ReadDocument";

/*
 * /read: paste a Document, confirm the text, read the analysis.
 *
 * The verb is the route. Pasting is the only way in for now; upload (PDF and
 * DOCX) joins this same screen, and the result appears on it, so neither
 * /paste nor /upload would stay true. It is not the library, which needs an
 * account; this works for any Reader, signed in or not.
 */

export const metadata = {
  title: "Read a document · Redline",
  description: "Paste a contract and get a plain-English summary of what it says.",
};

export default function ReadPage() {
  return <ReadDocument />;
}
