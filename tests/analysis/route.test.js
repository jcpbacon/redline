import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAnalyzeHandler } from "../../lib/analysis/http.js";
import {
  DEFAULT_SUMMARY,
  FABRICATED_SENTENCE,
  loadSidecar,
  readFixture,
  stubClean,
  stubContent,
  stubFailing,
  stubFromSidecar,
  stubWithFabricatedSentence,
} from "../helpers/stub-model.js";
import { SEVERITY_IDS } from "../../lib/analysis/severity.js";

const contract = readFixture("adhesion-contract.txt");
const cleanText = readFixture("clean-document.txt");
const sidecar = loadSidecar();

function post(body) {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("the route reached the network");
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/analyze", () => {
  it("returns the summary, Flags and checked list for pasted text", async () => {
    const res = await createAnalyzeHandler({ model: stubFromSidecar(sidecar) })(post({ text: contract }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toBe(DEFAULT_SUMMARY);
    expect(body.checked.length).toBeGreaterThan(0);
    for (const flag of body.flags) expect(contract.includes(flag.sourceSentence)).toBe(true);
  });

  it("returns the Flags ranked, with the critical IP clause first and Document order within each severity", async () => {
    const drops = [];
    // The stub lists the planted clauses lowest severity first, so the order
    // the route returns can only come from ranking.
    const reversed = stubFromSidecar({ flags: [...sidecar.flags].reverse() }, { extraFlags: [] });
    const res = await createAnalyzeHandler({ model: reversed, logDrop: (r) => drops.push(r) })(post({ text: contract }));
    const body = await res.json();

    expect(body.clean).toBe(false);
    expect(body.flags).toHaveLength(sidecar.flags.length);
    expect(body.flags[0].clauseType).toBe("ip-assignment-or-licence-scope");
    expect(body.flags[0].severity).toBe("critical");
    for (let i = 1; i < body.flags.length; i++) {
      const [a, b] = [body.flags[i - 1], body.flags[i]];
      const order = SEVERITY_IDS.indexOf(a.severity) - SEVERITY_IDS.indexOf(b.severity);
      expect(order).toBeLessThanOrEqual(0);
      if (order === 0) expect(contract.indexOf(a.sourceSentence)).toBeLessThan(contract.indexOf(b.sourceSentence));
    }
    for (const flag of body.flags) {
      expect(typeof flag.whatItMeans).toBe("string");
      expect(typeof flag.whyDangerous).toBe("string");
      expect(flag.redLine).toBeNull();
    }
    expect(drops).toEqual([]);
  });

  it("never sends a Flag whose Source Sentence is not in the Document", async () => {
    const drops = [];
    const res = await createAnalyzeHandler({ model: stubWithFabricatedSentence(sidecar), logDrop: (r) => drops.push(r) })(
      post({ text: contract }),
    );
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain(FABRICATED_SENTENCE);
    expect(drops).toHaveLength(1);
  });

  it("marks a Document with no Flags as clean and still lists what was checked", async () => {
    const res = await createAnalyzeHandler({ model: stubClean() })(post({ text: cleanText }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.flags).toEqual([]);
    expect(body.clean).toBe(true);
    expect(body.checked.length).toBeGreaterThan(0);
  });

  it.each([
    ["empty text", { text: "" }],
    ["whitespace only", { text: " \n\t " }],
    ["no text field", {}],
    ["text that is not a string", { text: 42 }],
    ["a body that is not JSON", "text=hello"],
  ])("rejects %s with 400 and a message", async (_case, body) => {
    const res = await createAnalyzeHandler({ model: stubFromSidecar(sidecar) })(post(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(typeof json.error).toBe("string");
    expect(json.error.length).toBeGreaterThan(0);
  });

  it("answers a failed model call with a retryable error and no internal detail", async () => {
    const res = await createAnalyzeHandler({ model: stubFailing(new Error("OpenRouter returned 401: bad key sk-or-123")) })(
      post({ text: contract }),
    );
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.retryable).toBe(true);
    expect(JSON.stringify(json)).not.toMatch(/sk-or|401|OpenRouter/);
  });

  it("answers malformed model output with a retryable error", async () => {
    const res = await createAnalyzeHandler({ model: stubContent("not json {") })(post({ text: contract }));
    expect(res.status).toBe(502);
    expect((await res.json()).retryable).toBe(true);
  });
});
