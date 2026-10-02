import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CITATION_DROPPED, ModelError, analyzeDocument } from "../../lib/analysis/index.js";
import { SEVERITY_IDS } from "../../lib/analysis/severity.js";
import {
  DEFAULT_SUMMARY,
  FABRICATED_SENTENCE,
  createStubModel,
  loadSidecar,
  readFixture,
  stubClean,
  stubContent,
  stubFailing,
  stubFromSidecar,
  stubWithFabricatedSentence,
} from "../helpers/stub-model.js";

const contract = readFixture("adhesion-contract.txt");
const clean = readFixture("clean-document.txt");
const sidecar = loadSidecar();

// Any network call during these tests is a failure: the stub is the only
// model, and nothing else may be reached.
beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("analyzeDocument reached the network");
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("analyzeDocument with a stubbed model", () => {
  it("returns the stub's summary and a non-empty checked list, without the network", async () => {
    const result = await analyzeDocument(contract, [], { model: stubFromSidecar(sidecar) });
    expect(result.summary).toBe(DEFAULT_SUMMARY);
    expect(result.checked.length).toBeGreaterThan(0);
    for (const type of result.checked) {
      expect(typeof type.id).toBe("string");
      expect(type.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("reports what it checked even when nothing is flagged", async () => {
    const result = await analyzeDocument(clean, [], { model: stubClean() });
    expect(result.flags).toEqual([]);
    expect(result.checked.length).toBeGreaterThan(0);
  });

  it("returns the planted Flags for the adhesion contract", async () => {
    const result = await analyzeDocument(contract, [], { model: stubFromSidecar(sidecar) });
    expect(result.flags.map((f) => f.sourceSentence)).toEqual(sidecar.flags.map((f) => f.sourceSentence));
  });
});

describe("Flags as analysis returns them", () => {
  it("carry the severity analysis assigned, from the scale, and their place in the Document", async () => {
    const result = await analyzeDocument(contract, [], { model: stubFromSidecar(sidecar) });
    expect(result.flags).toHaveLength(sidecar.flags.length);
    result.flags.forEach((flag, i) => {
      const planted = sidecar.flags[i];
      expect(SEVERITY_IDS).toContain(flag.severity);
      expect(flag.severity).toBe(planted.severity);
      expect(flag.clauseType).toBe(planted.clauseType);
      expect(flag.whatItMeans).toBe(planted.whatItMeans);
      expect(flag.whyDangerous).toBe(planted.whyDangerous);
      expect(flag.counterOffer).toBe(planted.counterOffer);
      expect(flag.matchedRedLineId).toBeNull();
      expect(flag.position).toBe(contract.indexOf(planted.sourceSentence));
    });
  });

  it("fails as a retryable ModelError when a Flag's severity is not on the scale", async () => {
    const reply = { summary: "S", flags: [{ ...sidecar.flags[0], severity: "catastrophic" }] };
    const error = await analyzeDocument(contract, [], { model: stubContent(reply) }).catch((e) => e);
    expect(error).toBeInstanceOf(ModelError);
    expect(error.retryable).toBe(true);
  });
});

describe("Source Sentences (ADR-0001)", () => {
  it("drops a Flag whose Source Sentence is not in the Document, and logs the drop with the Document id and what the model returned", async () => {
    const drops = [];
    const result = await analyzeDocument(contract, [], {
      model: stubWithFabricatedSentence(sidecar),
      documentId: "doc-123",
      logDrop: (record) => drops.push(record),
    });
    expect(result.flags.map((f) => f.sourceSentence)).not.toContain(FABRICATED_SENTENCE);
    expect(result.flags).toHaveLength(sidecar.flags.length);
    expect(drops).toEqual([
      {
        tag: CITATION_DROPPED,
        documentId: "doc-123",
        clauseType: "payment-terms",
        severity: "critical",
        sourceSentence: FABRICATED_SENTENCE,
      },
    ]);
  });

  it("names an unsaved Document in the drop log by a stable hash of its text", async () => {
    const drops = [];
    const logDrop = (record) => drops.push(record);
    await analyzeDocument(contract, [], { model: stubWithFabricatedSentence(sidecar), logDrop });
    await analyzeDocument(contract, [], { model: stubWithFabricatedSentence(sidecar), logDrop });
    await analyzeDocument(clean, [], { model: stubWithFabricatedSentence(sidecar, { only: [] }), logDrop });
    expect(drops).toHaveLength(3);
    expect(drops[0].documentId).toMatch(/^unsaved:sha256:[0-9a-f]{64}$/);
    expect(drops[1].documentId).toBe(drops[0].documentId);
    expect(drops[2].documentId).not.toBe(drops[0].documentId);
    expect(drops[0].documentId).not.toContain("Brand");
  });

  it("writes each drop to the server log as one tagged JSON line by default", async () => {
    const lines = [];
    vi.spyOn(console, "error").mockImplementation((line) => lines.push(line));
    await analyzeDocument(contract, [], { model: stubWithFabricatedSentence(sidecar), documentId: "doc-9" });
    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0]);
    expect(record).toMatchObject({ tag: "redline.citation_dropped", documentId: "doc-9", sourceSentence: FABRICATED_SENTENCE });
  });

  it("drops a Flag whose Source Sentence is a near miss of a real one", async () => {
    const real = sidecar.flags[0].sourceSentence;
    const nearMiss = real.replace("’", "'");
    expect(nearMiss).not.toBe(real);
    const result = await analyzeDocument(contract, [], {
      model: stubFromSidecar(sidecar, {
        only: [],
        extraFlags: [{ ...sidecar.flags[0], id: undefined, sourceSentence: nearMiss }],
      }),
    });
    expect(result.flags).toEqual([]);
  });

  it("drops a Flag with an empty Source Sentence", async () => {
    const result = await analyzeDocument(contract, [], {
      model: stubFromSidecar(sidecar, { only: [], extraFlags: [{ ...sidecar.flags[0], sourceSentence: "" }] }),
    });
    expect(result.flags).toEqual([]);
  });

  it.each([
    ["adhesion-contract.txt", contract],
    ["clean-document.txt", clean],
  ])("returns only Flags quoted verbatim from %s", async (_name, documentText) => {
    // The same canned reply against both Documents: every planted sentence
    // plus a fabricated one. Against the clean Document, none of them is real.
    const result = await analyzeDocument(documentText, [], { model: stubWithFabricatedSentence(sidecar) });
    for (const flag of result.flags) {
      expect(documentText.includes(flag.sourceSentence)).toBe(true);
    }
    if (documentText === clean) expect(result.flags).toEqual([]);
  });
});

describe("the checked list (story 46a)", () => {
  it.each([
    ["adhesion-contract.txt with every planted Flag", contract, () => stubFromSidecar(sidecar)],
    ["adhesion-contract.txt when nothing is flagged", contract, () => stubClean()],
    ["clean-document.txt when nothing is flagged", clean, () => stubClean()],
    ["clean-document.txt when every Flag is dropped", clean, () => stubWithFabricatedSentence(sidecar)],
  ])("is non-empty for %s", async (_case, documentText, stub) => {
    const result = await analyzeDocument(documentText, [], { model: stub(), logDrop: () => {} });
    expect(result.checked.length).toBeGreaterThan(0);
  });
});

describe("Red Lines", () => {
  const redLines = [{ id: "rl-1", text: "I keep ownership of everything I make." }];

  it("keeps a Flag's match to a Red Line the Reader set", async () => {
    const stub = stubFromSidecar(sidecar, { only: ["ip-assignment"] });
    const matched = createStubModel(async (messages, options) => {
      const body = await stub(messages, options);
      const reply = JSON.parse(body.choices[0].message.content);
      reply.flags[0].matchedRedLineId = "rl-1";
      return reply;
    });
    const result = await analyzeDocument(contract, redLines, { model: matched });
    expect(result.flags[0].matchedRedLineId).toBe("rl-1");
  });

  it("clears a match to a Red Line the Reader never set", async () => {
    const reply = { summary: "S", flags: [{ ...sidecar.flags[0], matchedRedLineId: "not-a-red-line" }] };
    const result = await analyzeDocument(contract, redLines, { model: stubContent(reply) });
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0].matchedRedLineId).toBeNull();
  });
});

describe("failures are retryable ModelErrors", () => {
  it("when the model call fails", async () => {
    const error = await analyzeDocument(contract, [], { model: stubFailing() }).catch((e) => e);
    expect(error).toBeInstanceOf(ModelError);
    expect(error.retryable).toBe(true);
  });

  it.each([
    ["malformed JSON", "{ \"summary\": \"cut off"],
    ["an empty reply", ""],
    ["a JSON array", "[]"],
    ["no summary", { flags: [] }],
    ["no flags list", { summary: "S" }],
    ["a flag missing its Source Sentence", { summary: "S", flags: [{ clauseType: "payment-terms", severity: "high", whatItMeans: "a", whyDangerous: "b", counterOffer: "c" }] }],
  ])("when the model returns %s", async (_case, content) => {
    const error = await analyzeDocument(contract, [], { model: stubContent(content) }).catch((e) => e);
    expect(error).toBeInstanceOf(ModelError);
    expect(error.retryable).toBe(true);
  });
});

describe("the request sent to OpenRouter", () => {
  it("pins the provider, sets low reasoning effort, asks for strict JSON schema output, and leaves the model to the client", async () => {
    let seen;
    const stub = stubFromSidecar(sidecar);
    const recording = async (messages, options) => {
      seen = { messages, options };
      return stub(messages, options);
    };
    await analyzeDocument(contract, [], { model: recording });

    expect(seen.messages.length).toBeGreaterThan(0);
    expect(seen.messages.some((m) => m.content.includes(contract))).toBe(true);
    expect(seen.options.provider).toEqual({ order: ["fireworks"], allow_fallbacks: false, require_parameters: true });
    expect(seen.options.reasoning).toEqual({ effort: "low" });
    expect(seen.options.response_format.type).toBe("json_schema");
    expect(seen.options.response_format.json_schema.strict).toBe(true);
    expect(typeof seen.options.response_format.json_schema.name).toBe("string");
    expect(seen.options.response_format.json_schema.schema.type).toBe("object");
    expect(Object.keys(seen.options)).not.toContain("model");
  });
});

describe("input", () => {
  it("refuses empty text before calling the model", async () => {
    await expect(analyzeDocument("   \n", [], { model: stubFailing() })).rejects.toBeInstanceOf(TypeError);
  });
});
