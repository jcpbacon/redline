import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COPY, createAskHandler } from "../../lib/questions/http.js";
import { QUESTION_ERRORS } from "../../lib/questions/text.js";
import { FABRICATED_SENTENCE, readFixture, stubContent, stubFailing } from "../helpers/stub-model.js";

/*
 * POST /api/questions: the question box on an unsaved reading. Nothing is
 * stored, so there is no database here; the saved route is tested against
 * PGlite in tests/db/questions.test.js.
 */

const contract = readFixture("adhesion-contract.txt");
const PAYMENT =
  "Brand will pay the Fee within ninety (90) days after Brand's written acceptance of all Deliverables, and Brand may withhold acceptance in its sole discretion.";

/** @param {unknown} body */
function post(body) {
  return new Request("http://localhost/api/questions", {
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
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/questions", () => {
  it("returns a grounded answer whose sentences are in the text", async () => {
    const handler = createAskHandler({
      model: stubContent({ answerable: true, answer: "Within 90 days of acceptance.", groundedIn: [PAYMENT] }),
      logDrop: () => {},
    });
    const res = await handler(post({ question: "  When do I get paid? ", text: contract }));
    expect(res.status).toBe(200);
    const { question } = await res.json();
    expect(question).toEqual({
      id: null,
      question: "When do I get paid?",
      unanswerable: false,
      text: "Within 90 days of acceptance.",
      groundedIn: [PAYMENT],
      askedAt: null,
    });
    for (const sentence of question.groundedIn) expect(contract.includes(sentence)).toBe(true);
  });

  it("returns unanswerable, as a success, for a question the text doesn't address", async () => {
    const handler = createAskHandler({ model: stubContent({ answerable: false, answer: "", groundedIn: [] }) });
    const res = await handler(post({ question: "Is this legal in Texas?", text: contract }));
    expect(res.status).toBe(200);
    const { question } = await res.json();
    expect(question).toMatchObject({ unanswerable: true, text: null, groundedIn: [] });
  });

  it("returns unanswerable, never the bad citation, when the grounding isn't in the text", async () => {
    const drops = [];
    const handler = createAskHandler({
      model: stubContent({ answerable: true, answer: "You owe $10,000 a post.", groundedIn: [FABRICATED_SENTENCE] }),
      logDrop: (r) => drops.push(r),
    });
    const res = await handler(post({ question: "Is there a penalty?", text: contract }));
    const body = await res.json();
    expect(body.question).toMatchObject({ unanswerable: true, text: null, groundedIn: [] });
    expect(JSON.stringify(body)).not.toContain(FABRICATED_SENTENCE);
    expect(drops).toHaveLength(1);
  });

  it("checks grounding against the text sent, not against the history the browser sends", async () => {
    const earlier = "The brand pays within 90 days.";
    const handler = createAskHandler({
      model: stubContent({ answerable: true, answer: "Yes.", groundedIn: [earlier] }),
      logDrop: () => {},
    });
    const res = await handler(
      post({ question: "Is that firm?", text: contract, history: [{ question: "When?", text: earlier, unanswerable: false }] }),
    );
    expect((await res.json()).question.unanswerable).toBe(true);
  });

  it("refuses an empty question with 400 and Reader copy", async () => {
    const res = await createAskHandler({ model: stubFailing() })(post({ question: "  ", text: contract }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(QUESTION_ERRORS.empty);
  });

  it("refuses a missing text and a body that isn't JSON", async () => {
    const handler = createAskHandler({ model: stubFailing() });
    const noText = await handler(post({ question: "When?" }));
    expect(noText.status).toBe(400);
    expect((await noText.json()).error).toBe(COPY.noText);
    expect((await handler(post("{nope"))).status).toBe(400);
  });

  it("answers 502 retryable when the model fails, without the cause", async () => {
    const res = await createAskHandler({ model: stubFailing(new Error("OpenRouter returned 401: bad key sk-secret")) })(
      post({ question: "When?", text: contract }),
    );
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ error: COPY.modelFailed, retryable: true });
    expect(JSON.stringify(body)).not.toContain("sk-secret");
  });

  it("answers 502 retryable when the model's reply is malformed", async () => {
    const res = await createAskHandler({ model: stubContent("{not json") })(post({ question: "When?", text: contract }));
    expect(res.status).toBe(502);
    expect((await res.json()).retryable).toBe(true);
  });
});
