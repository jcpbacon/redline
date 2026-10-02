import { describe, expect, it } from "vitest";
import { DEFAULT_TITLE_LENGTH, UNTITLED, defaultTitle, prepareDocument, titleFor } from "../../lib/documents/title.js";
import { readFixture } from "../helpers/stub-model.js";

describe("defaultTitle", () => {
  it("uses the first line with text on it, trimmed", () => {
    expect(defaultTitle("\n\n   BRAND PARTNERSHIP AGREEMENT  \r\nThis Agreement…")).toBe("BRAND PARTNERSHIP AGREEMENT");
  });

  it("collapses runs of whitespace, including non-breaking spaces", () => {
    expect(defaultTitle("Lease  of   Flat 4\tB")).toBe("Lease of Flat 4 B");
  });

  it("cuts a long first line at a word and marks the cut", () => {
    const line = "word ".repeat(40);
    const title = defaultTitle(line);
    expect(Array.from(title).length).toBeLessThanOrEqual(DEFAULT_TITLE_LENGTH);
    expect(title.endsWith("word…")).toBe(true);
  });

  it("falls back when there is no text", () => {
    expect(defaultTitle("  \n\t ")).toBe(UNTITLED);
  });

  it("gives each fixture a title from its first line", () => {
    for (const name of ["adhesion-contract.txt", "clean-document.txt"]) {
      const text = readFixture(name);
      const first = text.split(/\r?\n/).find((l) => l.trim() !== "").trim().replace(/\s+/g, " ");
      expect(first.startsWith(defaultTitle(text).replace(/…$/, ""))).toBe(true);
    }
  });
});

describe("titleFor", () => {
  it("keeps the Reader's title, trimmed", () => {
    expect(titleFor("  Northwind deal  ", "Anything")).toBe("Northwind deal");
  });

  it("uses the default when the Reader left it blank", () => {
    expect(titleFor("   ", "First line\nSecond")).toBe("First line");
    expect(titleFor(undefined, "First line\nSecond")).toBe("First line");
  });
});

describe("prepareDocument", () => {
  it("returns the very text it was given, untrimmed", () => {
    const text = "  \r\nClause 1. Fees “due”.\r\n  ";
    const prepared = prepareDocument({ title: "", text });
    expect(prepared).toEqual({ ok: true, title: "Clause 1. Fees “due”.", text });
    if (prepared.ok) expect(prepared.text).toBe(text);
  });

  it.each([
    ["no text", {}],
    ["whitespace only", { text: " \n " }],
    ["text that isn't a string", { text: 5 }],
    ["a NUL character Postgres can't store", { text: "a\u0000b" }],
  ])("refuses %s with a message", (_name, input) => {
    const result = prepareDocument(input);
    expect(result.ok).toBe(false);
    if ("error" in result) expect(result.error.length).toBeGreaterThan(0);
  });
});
