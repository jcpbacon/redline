/**
 * Where a Flag's Source Sentence sits in its Document, and the Document split
 * around it so a screen can draw the sentence highlighted in place (story 22).
 *
 * Pure; no imports, no I/O. Safe in browser and server code.
 *
 *   locateSourceSentence(text, flag) -> { start, end }
 *   sourceContext(text, flag)        -> { before, sentence, after, start, end }
 *
 * `flag` needs `sourceSentence` and, ideally, `position` (the index analysis
 * found the sentence at). The stored or pasted text is the authority:
 *
 *   1. text.slice(position, position + length) === sourceSentence → use it.
 *      This also picks the right occurrence when a sentence appears twice.
 *   2. Otherwise the first occurrence of the sentence in the text.
 *   3. Otherwise throw SourceSentenceNotFound. A highlight over text that is
 *      not the Source Sentence would be a citation that lies, so there is no
 *      fuzzy match and no partial highlight (ADR-0001, CLAUDE.md).
 *
 * `before + sentence + after === text`, always: nothing is trimmed or
 * normalised, so line breaks and spacing survive for `white-space: pre-wrap`.
 * The window is the whole Document because both screens that use this show
 * the whole Document; the highlight is what moves.
 */

/** A Flag whose Source Sentence can't be found in the Document's text. */
export class SourceSentenceNotFound extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = "SourceSentenceNotFound";
  }
}

/**
 * @param {string} text the Document's text, exactly as stored or pasted
 * @param {{ sourceSentence: string, position?: number | null }} flag
 * @returns {{ start: number, end: number }}
 */
export function locateSourceSentence(text, flag) {
  if (typeof text !== "string") throw new TypeError("locateSourceSentence needs the Document's text.");
  const sentence = flag?.sourceSentence;
  if (typeof sentence !== "string" || sentence.trim() === "") {
    throw new SourceSentenceNotFound("This Flag has no Source Sentence, so there is nothing to show (ADR-0001).");
  }

  const position = flag.position;
  if (
    typeof position === "number" &&
    Number.isInteger(position) &&
    position >= 0 &&
    text.slice(position, position + sentence.length) === sentence
  ) {
    return { start: position, end: position + sentence.length };
  }

  const start = text.indexOf(sentence);
  if (start === -1) {
    throw new SourceSentenceNotFound(
      "A Flag's Source Sentence isn't in the Document's text. Refusing to highlight anything (ADR-0001).",
    );
  }
  return { start, end: start + sentence.length };
}

/**
 * @param {string} text
 * @param {{ sourceSentence: string, position?: number | null }} flag
 * @returns {{ before: string, sentence: string, after: string, start: number, end: number }}
 */
export function sourceContext(text, flag) {
  const { start, end } = locateSourceSentence(text, flag);
  const sentence = text.slice(start, end);
  // Belt and braces: what is highlighted is the Source Sentence, character for character.
  if (sentence !== flag.sourceSentence) {
    throw new SourceSentenceNotFound("The highlighted text differs from the Source Sentence (ADR-0001).");
  }
  return { before: text.slice(0, start), sentence, after: text.slice(end), start, end };
}
