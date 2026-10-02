import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The recall eval's labelled corpus: a directory of pairs
 *
 *   <name>.txt          the Document's text, exactly as extracted
 *   <name>.labels.json  { "clauses": [{ "sourceSentence": "...", ...anything else }] }
 *
 * Adding a Document is adding its two files. Each label's `sourceSentence`
 * is the expert's clause, copied verbatim from the .txt; other keys (id,
 * clauseType, severity, note) are carried through for printing and ignored by
 * scoring. An empty `clauses` list is a Document the expert says has nothing
 * to flag.
 *
 * A pair that is incomplete, or a label sentence that is not in its Document
 * verbatim, throws: a label that cannot be found would quietly lower recall.
 *
 * @typedef {{ sourceSentence: string, id?: string, clauseType?: string, severity?: string }} ExpertClause
 * @typedef {{ name: string, text: string, clauses: ExpertClause[] }} CorpusDocument
 */

/**
 * @param {string} dir
 * @returns {CorpusDocument[]} sorted by name
 */
export function loadCorpus(dir) {
  const files = readdirSync(dir);
  const texts = files.filter((f) => f.endsWith(".txt")).map((f) => f.slice(0, -".txt".length));
  const labels = files.filter((f) => f.endsWith(".labels.json")).map((f) => f.slice(0, -".labels.json".length));

  const unlabelled = texts.filter((n) => !labels.includes(n));
  if (unlabelled.length) throw new Error(`Corpus Documents with no labels file: ${unlabelled.join(", ")} (in ${dir}).`);
  const orphaned = labels.filter((n) => !texts.includes(n));
  if (orphaned.length) throw new Error(`Labels files with no Document: ${orphaned.join(", ")} (in ${dir}).`);
  if (texts.length === 0) throw new Error(`The corpus at ${dir} has no Documents.`);

  return texts.sort().map((name) => {
    const text = readFileSync(join(dir, `${name}.txt`), "utf8");
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(join(dir, `${name}.labels.json`), "utf8"));
    } catch (cause) {
      throw new Error(`${name}.labels.json is not valid JSON.`, { cause });
    }
    if (!parsed || !Array.isArray(parsed.clauses)) {
      throw new Error(`${name}.labels.json needs a "clauses" array (it may be empty).`);
    }
    const clauses = parsed.clauses.map((clause, i) => {
      if (!clause || typeof clause.sourceSentence !== "string" || clause.sourceSentence.trim() === "") {
        throw new Error(`${name}.labels.json clause ${i} has no sourceSentence.`);
      }
      if (!text.includes(clause.sourceSentence)) {
        throw new Error(`${name}.labels.json clause ${i} (${clause.id ?? "no id"}) is not in ${name}.txt verbatim.`);
      }
      return clause;
    });
    return { name, text, clauses };
  });
}
