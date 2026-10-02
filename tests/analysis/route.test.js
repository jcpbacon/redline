import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAnalyzeHandler } from "../../lib/analysis/http.js";
import { DEFAULT_SUMMARY, loadSidecar, readFixture, stubContent, stubFailing, stubFromSidecar } from "../helpers/stub-model.js";

const contract = readFixture("adhesion-contract.txt");
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
