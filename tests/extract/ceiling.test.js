import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CEILING_VARIABLE, overCeiling, documentCeiling, documentLength } from "../../lib/documents/ceiling.js";
import { prepareDocument } from "../../lib/documents/title.js";
import { createAnalyzeHandler } from "../../lib/analysis/http.js";
import { createAskHandler } from "../../lib/questions/http.js";
import { createStubModel, loadSidecar, readFixture, stubFromSidecar } from "../helpers/stub-model.js";

const contract = readFixture("adhesion-contract.txt");
const length = documentLength(contract);

/** @param {string} url @param {unknown} body */
function post(url, body) {
  return new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

// If a route called the model for an over-long Document it would answer 502
// with this stub, not 413.
const failingModel = createStubModel(new Error("the model was called for a Document over the ceiling"));

beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("reached the network");
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("with no ceiling configured", () => {
  beforeEach(() => {
    vi.stubEnv(CEILING_VARIABLE, "");
  });

  it("has no limit and refuses no length", () => {
    expect(documentCeiling()).toBeNull();
    expect(overCeiling(contract)).toBeNull();
    expect(overCeiling("x".repeat(5_000_000))).toBeNull();
  });

  it("lets the route read the Document", async () => {
    const res = await createAnalyzeHandler({ model: stubFromSidecar(loadSidecar()) })(
      post("http://localhost/api/analyze", { text: contract }),
    );
    expect(res.status).toBe(200);
  });
});

describe("with a ceiling configured", () => {
  beforeEach(() => {
    vi.stubEnv(CEILING_VARIABLE, String(length - 1));
  });

  it("refuses a Document one character over, and names both numbers", () => {
    const result = overCeiling(contract);
    expect(result).not.toBeNull();
    expect(result.length).toBe(length);
    expect(result.limit).toBe(length - 1);
    expect(result.error).toContain(length.toLocaleString("en-US"));
    expect(result.error).toContain((length - 1).toLocaleString("en-US"));
  });

  it("accepts a Document exactly at the ceiling", () => {
    vi.stubEnv(CEILING_VARIABLE, String(length));
    expect(overCeiling(contract)).toBeNull();
  });

  it("counts characters, not UTF-16 units", () => {
    vi.stubEnv(CEILING_VARIABLE, "3");
    expect(overCeiling("😀😀😀")).toBeNull();
    expect(overCeiling("😀😀😀😀")).not.toBeNull();
  });

  it("is refused at /api/analyze before the model is called", async () => {
    const res = await createAnalyzeHandler({ model: failingModel })(post("http://localhost/api/analyze", { text: contract }));
    expect(res.status).toBe(413);
    const refusal = overCeiling(contract);
    expect((await res.json()).error).toBe(refusal?.error);
  });

  it("is refused at /api/questions before the model is called", async () => {
    const res = await createAskHandler({ model: failingModel })(
      post("http://localhost/api/questions", { question: "When am I paid?", text: contract }),
    );
    expect(res.status).toBe(413);
  });

  it("is refused when saving", () => {
    expect(prepareDocument({ title: "", text: contract }).ok).toBe(false);
  });
});

describe("a ceiling that isn't a whole number", () => {
  it("throws, naming the variable", () => {
    vi.stubEnv(CEILING_VARIABLE, "lots");
    expect(() => documentCeiling()).toThrow(CEILING_VARIABLE);
    vi.stubEnv(CEILING_VARIABLE, "0");
    expect(() => documentCeiling()).toThrow(CEILING_VARIABLE);
  });
});
