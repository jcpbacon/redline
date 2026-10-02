import { describe, expect, it } from "vitest";
import { SourceSentenceNotFound, locateSourceSentence, sourceContext } from "../../lib/analysis/context.js";
import { FABRICATED_SENTENCE, loadSidecar, readFixture } from "../helpers/stub-model.js";

/*
 * Story 22: from a Flag, the Document around its Source Sentence, with the
 * sentence highlighted. The highlighted text must be the Source Sentence,
 * character for character, and nothing around it may be altered.
 */

const contract = readFixture("adhesion-contract.txt");
const cleanText = readFixture("clean-document.txt");
const sidecar = loadSidecar();

/** A Flag as analysis returns it: position is where the sentence starts. */
const flagAt = (text, sourceSentence) => ({ sourceSentence, position: text.indexOf(sourceSentence) });

/** Sentences taken verbatim from the clean fixture (it has no planted clauses). */
const CLEAN_SENTENCES = [
  '1.2 "Deliverables" means the specific videos and posts listed in Schedule A.',
  'The Parties negotiated these terms and each had the opportunity to review them with an advisor before signing.',
];

describe("sourceContext over the fixtures", () => {
  it("highlights exactly each planted Source Sentence, with the untouched text either side", () => {
    expect(sidecar.flags.length).toBeGreaterThan(0);
    for (const planted of sidecar.flags) {
      const flag = flagAt(contract, planted.sourceSentence);
      expect(flag.position).toBeGreaterThanOrEqual(0);

      const shown = sourceContext(contract, flag);
      expect(shown.sentence).toBe(planted.sourceSentence);
      expect(shown.before + shown.sentence + shown.after).toBe(contract);
      expect(contract.slice(0, shown.start)).toBe(shown.before);
      expect(contract.slice(shown.end)).toBe(shown.after);
      expect(shown.start).toBe(flag.position);
      // There is real context: text before and after, with its paragraph breaks.
      expect(shown.before).toContain("\n\n");
      expect(shown.after).toContain("\n\n");
    }
  });

  it("works on the clean fixture's sentences too", () => {
    for (const sentence of CLEAN_SENTENCES) {
      expect(cleanText).toContain(sentence);
      const shown = sourceContext(cleanText, flagAt(cleanText, sentence));
      expect(shown.sentence).toBe(sentence);
      expect(shown.before + shown.sentence + shown.after).toBe(cleanText);
    }
  });

  it("keeps CRLF line breaks and surrounding whitespace exactly as stored", () => {
    const text = `  ${contract.replace(/\n/g, "\r\n")} \n`;
    for (const planted of sidecar.flags) {
      const shown = sourceContext(text, flagAt(text, planted.sourceSentence));
      expect(shown.sentence).toBe(planted.sourceSentence);
      expect(shown.before + shown.sentence + shown.after).toBe(text);
      expect(shown.before).toContain("\r\n\r\n");
      expect(shown.before.startsWith("  ")).toBe(true);
      expect(shown.after.endsWith(" \n")).toBe(true);
    }
  });
});

describe("locateSourceSentence", () => {
  const sentence = sidecar.flags[0].sourceSentence;

  it("uses the stored position, so a repeated sentence highlights the occurrence the Flag came from", () => {
    const twice = contract + contract;
    const second = contract.length + contract.indexOf(sentence);
    expect(twice.indexOf(sentence)).toBeLessThan(second);
    expect(locateSourceSentence(twice, { sourceSentence: sentence, position: second })).toEqual({
      start: second,
      end: second + sentence.length,
    });
  });

  it("falls back to the first occurrence when the position doesn't point at the sentence", () => {
    const first = contract.indexOf(sentence);
    for (const position of [0, first + 1, contract.length + 50, -3, 2.5, null, undefined, Number.NaN]) {
      expect(locateSourceSentence(contract, { sourceSentence: sentence, position })).toEqual({
        start: first,
        end: first + sentence.length,
      });
    }
  });

  it("throws, rather than highlight anything, when the sentence isn't in the text", () => {
    expect(contract).not.toContain(FABRICATED_SENTENCE);
    expect(() => sourceContext(contract, { sourceSentence: FABRICATED_SENTENCE, position: 0 })).toThrow(
      SourceSentenceNotFound,
    );
    // Nearly the sentence is not the sentence: no fuzzy match.
    const altered = sentence.replace(/\.$/, "");
    expect(() => sourceContext(cleanText, { sourceSentence: altered, position: 0 })).toThrow(SourceSentenceNotFound);
    expect(() => sourceContext(contract, { sourceSentence: sentence.toUpperCase(), position: 0 })).toThrow(
      SourceSentenceNotFound,
    );
  });

  it("throws on a Flag with no Source Sentence", () => {
    expect(() => locateSourceSentence(contract, { sourceSentence: "", position: 0 })).toThrow(SourceSentenceNotFound);
    expect(() => locateSourceSentence(contract, { sourceSentence: "   ", position: 0 })).toThrow(SourceSentenceNotFound);
    expect(() => locateSourceSentence(contract, /** @type {any} */ ({ position: 0 }))).toThrow(SourceSentenceNotFound);
  });
});
