import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FABRICATED_SENTENCE,
  analysisFromSidecar,
  createStubModel,
  loadSidecar,
  readFixture,
  stubClean,
  stubContent,
  stubFailing,
  stubFromSidecar,
  stubWithFabricatedSentence,
} from "./helpers/stub-model.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const contract = readFixture("adhesion-contract.txt");
const clean = readFixture("clean-document.txt");
const sidecar = loadSidecar();
const BANDS = ["critical", "high", "medium"];
const MESSAGES = [{ role: "user", content: "anything" }];

function occurrences(haystack, needle) {
  let count = 0;
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + 1)) count++;
  return count;
}

function words(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

async function contentOf(stub) {
  const body = await stub(MESSAGES, {});
  return JSON.parse(body.choices[0].message.content);
}

describe("adhesion-contract fixture", () => {
  it("is a full-length agreement with numbered sections and a signature block", () => {
    expect(words(contract)).toBeGreaterThanOrEqual(1200);
    expect(words(contract)).toBeLessThanOrEqual(2000);
    expect(contract).toMatch(/^1\. DEFINITIONS$/m);
    expect(contract).toMatch(/^10\. GENERAL$/m);
    expect(contract).toMatch(/Signature: _+/);
  });

  it("plants at least four flags across at least two severity bands", () => {
    expect(sidecar.flags.length).toBeGreaterThanOrEqual(4);
    const bands = new Set(sidecar.flags.map((f) => f.severity));
    expect(bands.size).toBeGreaterThanOrEqual(2);
    for (const band of bands) expect(BANDS).toContain(band);
  });

  it("gives every flag a unique id and every field the stub sends", () => {
    const ids = sidecar.flags.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const flag of sidecar.flags) {
      for (const key of ["clauseType", "sourceSentence", "whatItMeans", "whyDangerous", "counterOffer"]) {
        expect(typeof flag[key], `${flag.id}.${key}`).toBe("string");
        expect(flag[key].trim().length, `${flag.id}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it.each(sidecar.flags.map((f) => [f.id, f.sourceSentence]))(
    "contains the Source Sentence for %s verbatim, exactly once",
    (_id, sentence) => {
      expect(occurrences(contract, sentence)).toBe(1);
    },
  );

  it("keeps real-world typography in at least one planted sentence", () => {
    const typographic = sidecar.flags.filter((f) => /[‘’“”—–]/.test(f.sourceSentence));
    expect(typographic.length).toBeGreaterThan(0);
  });

  it("contains every merely-unusual sentence, none of which is a flag", () => {
    expect(sidecar.notFlags.length).toBeGreaterThan(0);
    const flagged = new Set(sidecar.flags.map((f) => f.sourceSentence));
    for (const sentence of sidecar.notFlags) {
      expect(occurrences(contract, sentence)).toBe(1);
      expect(flagged.has(sentence)).toBe(false);
    }
  });
});

describe("clean-document fixture", () => {
  it("is a comparable agreement with a signature block", () => {
    expect(words(clean)).toBeGreaterThanOrEqual(1000);
    expect(clean).toMatch(/^10\. GENERAL$/m);
    expect(clean).toMatch(/Signature: _+/);
  });

  it("contains none of the planted sentences", () => {
    for (const sentence of [...sidecar.flags.map((f) => f.sourceSentence), ...sidecar.notFlags]) {
      expect(clean.includes(sentence)).toBe(false);
    }
  });

  it("does not contain the one-sided wording the planted clauses turn on", () => {
    for (const phrase of [/perpetual/i, /irrevocable/i, /sole (discretion|judgment)/i, /automatically renew/i, /without limitation as to amount/i, /hereby assigns/i]) {
      expect(clean).not.toMatch(phrase);
    }
  });
});

describe("stub model client", () => {
  it("returns an OpenRouter-shaped completion with the sidecar's flags as JSON content", async () => {
    const body = await stubFromSidecar(sidecar)(MESSAGES, { temperature: 0 });
    expect(body.choices).toHaveLength(1);
    expect(body.choices[0].message.role).toBe("assistant");
    expect(typeof body.choices[0].message.content).toBe("string");
    const content = JSON.parse(body.choices[0].message.content);
    expect(content).toEqual(analysisFromSidecar(sidecar));
    expect(content.flags.map((f) => f.sourceSentence)).toEqual(sidecar.flags.map((f) => f.sourceSentence));
  });

  it("honours a custom summary, extra flags and a subset of ids", async () => {
    const extra = { clauseType: "x", sourceSentence: "y", severity: "medium", whatItMeans: "a", whyDangerous: "b", counterOffer: "c" };
    const firstId = sidecar.flags[0].id;
    const content = await contentOf(stubFromSidecar(sidecar, { summary: "S", only: [firstId], extraFlags: [extra] }));
    expect(content.summary).toBe("S");
    expect(content.flags).toHaveLength(2);
    expect(content.flags[0].sourceSentence).toBe(sidecar.flags[0].sourceSentence);
    expect(content.flags[1]).toEqual(extra);
  });

  it("returns no flags for the clean case", async () => {
    const content = await contentOf(stubClean());
    expect(content.flags).toEqual([]);
    expect(content.summary.length).toBeGreaterThan(0);
  });

  it("can return a Source Sentence that is in neither Document", async () => {
    expect(contract.includes(FABRICATED_SENTENCE)).toBe(false);
    expect(clean.includes(FABRICATED_SENTENCE)).toBe(false);
    const content = await contentOf(stubWithFabricatedSentence(sidecar));
    expect(content.flags).toHaveLength(sidecar.flags.length + 1);
    expect(content.flags.at(-1).sourceSentence).toBe(FABRICATED_SENTENCE);
  });

  it("rejects when told to fail, and on an empty message list", async () => {
    await expect(stubFailing()(MESSAGES)).rejects.toThrow(/503/);
    await expect(stubFailing(new Error("boom"))(MESSAGES)).rejects.toThrow("boom");
    await expect(stubFromSidecar(sidecar)([])).rejects.toThrow(/at least one message/);
  });

  it("returns arbitrary content, and a raw string untouched", async () => {
    const answer = { answer: "Ninety days after acceptance.", sourceSentence: sidecar.flags[1].sourceSentence };
    expect(await contentOf(stubContent(answer))).toEqual(answer);
    const raw = await stubContent("not json {")(MESSAGES);
    expect(raw.choices[0].message.content).toBe("not json {");
  });

  it("lets a responder function answer by what it was sent", async () => {
    const stub = createStubModel((messages) => ({ echoed: messages.length }));
    expect(await contentOf(stub)).toEqual({ echoed: 1 });
  });

  it("never sets a model field", async () => {
    const stubs = [stubFromSidecar(sidecar), stubClean(), stubWithFabricatedSentence(sidecar), stubContent({ a: 1 })];
    for (const stub of stubs) {
      const body = await stub(MESSAGES, {});
      expect(JSON.stringify(body)).not.toMatch(/"model"\s*:/);
    }
  });
});

describe("no model id in the repo's code or fixtures", () => {
  // Shapes of an OpenRouter model id: "<vendor>/<model>". The vendor list is
  // the providers OpenRouter routes to; extend it when one is added.
  const VENDOR_SLUG =
    /\b(openai|anthropic|google|meta-llama|mistralai|deepseek|qwen|moonshotai|x-ai|cohere|nvidia|microsoft|z-ai|minimax|amazon|perplexity|nousresearch|01-ai|ai21|inflection)\/[a-z0-9][\w.:-]*/i;
  // Assigning OPENROUTER_MODEL a value in code (env files are not scanned).
  const ASSIGNS_MODEL = /OPENROUTER_MODEL\s*[=:]\s*["'`]/;
  // A literal model key in a request body or stub response.
  const MODEL_KEY = /["']?\bmodel["']?\s*:\s*["'`][^"'`]+["'`]/;

  function files(dir) {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });
  }

  const scanned = [...files(join(ROOT, "tests")), ...files(join(ROOT, "lib"))].filter(
    (path) => path !== fileURLToPath(import.meta.url),
  );

  it.each(scanned.map((path) => [relative(ROOT, path), path]))("%s has no model id", (_name, path) => {
    const text = readFileSync(path, "utf8");
    expect(text).not.toMatch(VENDOR_SLUG);
    expect(text).not.toMatch(ASSIGNS_MODEL);
    expect(text).not.toMatch(MODEL_KEY);
  });
});
