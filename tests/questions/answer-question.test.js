import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contentId } from "../../lib/analysis/index.js";
import { GROUNDING_DROPPED, ModelError, answerQuestion } from "../../lib/questions/index.js";
import { FABRICATED_SENTENCE, readFixture, stubContent, stubFailing } from "../helpers/stub-model.js";

/*
 * Seam 1, answerQuestion (stories 29–33): the answer comes only from the
 * Document, every grounding sentence is a verbatim substring of it, and an
 * answer whose grounding fails that check is unanswerable and logged like a
 * dropped Flag. The model is the stub; nothing else is.
 */

const contract = readFixture("adhesion-contract.txt");
const PAYMENT =
  "Brand will pay the Fee within ninety (90) days after Brand's written acceptance of all Deliverables, and Brand may withhold acceptance in its sole discretion.";
const TERMINATION =
  "Brand may terminate this Agreement at any time, for any reason, on seven (7) days' written notice, and in that event no portion of the Fee shall be owed for Deliverables not yet accepted.";

/** @param {Partial<{ answerable: boolean, answer: string, groundedIn: string[] }>} [fields] */
function reply({ answerable = true, answer = "Within 90 days after the brand accepts everything.", groundedIn = [PAYMENT] } = {}) {
  return stubContent({ answerable, answer, groundedIn });
}

beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("reached the network");
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a question the Document answers", () => {
  it("returns the answer and its grounding sentences, each verbatim in the Document", async () => {
    const drops = [];
    const result = await answerQuestion("When do I get paid?", contract, {
      model: reply({ groundedIn: [PAYMENT, TERMINATION] }),
      logDrop: (r) => drops.push(r),
    });

    expect(result).toEqual({ text: "Within 90 days after the brand accepts everything.", groundedIn: [PAYMENT, TERMINATION] });
    if (!("groundedIn" in result)) throw new Error("expected an answer");
    for (const sentence of result.groundedIn) {
      expect(sentence.trim()).not.toBe("");
      expect(contract.includes(sentence)).toBe(true);
    }
    expect(drops).toEqual([]);
  });

  it("lists a sentence the model repeats only once", async () => {
    const result = await answerQuestion("When do I get paid?", contract, { model: reply({ groundedIn: [PAYMENT, PAYMENT] }) });
    expect(result).toEqual({ text: expect.any(String), groundedIn: [PAYMENT] });
  });
});

describe("a question the Document doesn't address", () => {
  it("is unanswerable when the model says so, and nothing is logged", async () => {
    const drops = [];
    const result = await answerQuestion("Is this agreement fair under California law?", contract, {
      model: reply({ answerable: false, answer: "", groundedIn: [] }),
      logDrop: (r) => drops.push(r),
    });
    expect(result).toEqual({ unanswerable: true });
    expect(drops).toEqual([]);
  });

  it("is unanswerable when the model says no but writes an answer anyway", async () => {
    const result = await answerQuestion("What does the law say about this?", contract, {
      model: reply({ answerable: false, answer: "Usually courts…", groundedIn: [PAYMENT] }),
    });
    expect(result).toEqual({ unanswerable: true });
  });
});

describe("an answer whose grounding fails the check", () => {
  it("is unanswerable when a grounding sentence isn't in the Document, and the drop is logged with the Document and what the model returned", async () => {
    const drops = [];
    const answer = "You pay $10,000 for every late post.";
    const result = await answerQuestion("Is there a late penalty?", contract, {
      model: reply({ answer, groundedIn: [PAYMENT, FABRICATED_SENTENCE] }),
      documentId: "doc-123",
      logDrop: (r) => drops.push(r),
    });

    expect(result).toEqual({ unanswerable: true });
    expect(drops).toHaveLength(1);
    expect(drops[0]).toMatchObject({
      tag: GROUNDING_DROPPED,
      documentId: "doc-123",
      answer,
      groundedIn: [PAYMENT, FABRICATED_SENTENCE],
      notInDocument: [FABRICATED_SENTENCE],
    });
  });

  it("is unanswerable when the sentence is only close to the Document's (one character changed)", async () => {
    const drops = [];
    const near = PAYMENT.replace("ninety (90)", "ninety(90)");
    const result = await answerQuestion("When do I get paid?", contract, {
      model: reply({ groundedIn: [near] }),
      logDrop: (r) => drops.push(r),
    });
    expect(result).toEqual({ unanswerable: true });
    expect(drops).toHaveLength(1);
  });

  it("is unanswerable when the model claims an answer with no grounding sentences", async () => {
    const drops = [];
    const result = await answerQuestion("When do I get paid?", contract, {
      model: reply({ groundedIn: [] }),
      logDrop: (r) => drops.push(r),
    });
    expect(result).toEqual({ unanswerable: true });
    expect(drops).toHaveLength(1);
    expect(drops[0]).toMatchObject({ tag: GROUNDING_DROPPED, answer: expect.any(String), groundedIn: [] });
  });

  it("treats an empty or whitespace-only grounding sentence as not in the Document", async () => {
    const drops = [];
    const result = await answerQuestion("When do I get paid?", contract, {
      model: reply({ groundedIn: [PAYMENT, "  "] }),
      logDrop: (r) => drops.push(r),
    });
    expect(result).toEqual({ unanswerable: true });
    expect(drops).toHaveLength(1);
  });

  it("names an unsaved Document in the log by a hash of its text", async () => {
    const drops = [];
    await answerQuestion("Is there a late penalty?", contract, {
      model: reply({ groundedIn: [FABRICATED_SENTENCE] }),
      logDrop: (r) => drops.push(r),
    });
    expect(drops[0].documentId).toBe(contentId(contract));
  });

  it("logs to stderr by default, as one JSON line carrying the tag and not the Document", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await answerQuestion("Is there a late penalty?", contract, {
        model: reply({ groundedIn: [FABRICATED_SENTENCE] }),
        documentId: "d",
      });
      expect(spy).toHaveBeenCalledTimes(1);
      const record = JSON.parse(String(spy.mock.calls[0][0]));
      expect(record).toMatchObject({ tag: GROUNDING_DROPPED, documentId: "d" });
      expect(JSON.stringify(record)).not.toContain(contract);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("follow-up questions", () => {
  it("sends the earlier questions with a follow-up, but still checks grounding against the Document only", async () => {
    const earlierAnswer = "Within 90 days after the brand accepts everything.";
    let sent = "";
    /** @type {(messages: any[], options?: object) => Promise<any>} */
    const recording = async (messages, options) => {
      sent = messages.map((m) => String(m.content)).join("\n");
      // The model cites the earlier answer rather than the Document.
      return stubContent({ answerable: true, answer: "Yes, 90 days.", groundedIn: [earlierAnswer] })(messages, options);
    };
    const drops = [];
    const result = await answerQuestion("Can they make it longer?", contract, {
      model: recording,
      history: [{ question: "When do I get paid?", text: earlierAnswer, unanswerable: false }],
      logDrop: (r) => drops.push(r),
    });

    expect(sent).toContain("When do I get paid?");
    expect(sent).toContain(earlierAnswer);
    expect(result).toEqual({ unanswerable: true });
    expect(drops).toHaveLength(1);
  });

  it("answers a follow-up grounded in the Document", async () => {
    const result = await answerQuestion("And can they end it early?", contract, {
      model: reply({ answer: "Yes, on seven days' notice.", groundedIn: [TERMINATION] }),
      history: [{ question: "When do I get paid?", text: "Within 90 days.", unanswerable: false }],
    });
    expect(result).toEqual({ text: "Yes, on seven days' notice.", groundedIn: [TERMINATION] });
  });
});

describe("failures", () => {
  it("throws a retryable ModelError on malformed JSON", async () => {
    const error = await answerQuestion("When do I get paid?", contract, { model: stubContent("{not json") }).catch((e) => e);
    expect(error).toBeInstanceOf(ModelError);
    expect(error.retryable).toBe(true);
    expect(error.kind).toBe("output");
  });

  it("throws a retryable ModelError on JSON of the wrong shape", async () => {
    const error = await answerQuestion("When do I get paid?", contract, { model: stubContent({ answer: "x" }) }).catch((e) => e);
    expect(error).toBeInstanceOf(ModelError);
    expect(error.retryable).toBe(true);
  });

  it("throws a retryable ModelError when the model says it can answer but gives no answer", async () => {
    const error = await answerQuestion("When do I get paid?", contract, { model: reply({ answer: " " }) }).catch((e) => e);
    expect(error).toBeInstanceOf(ModelError);
  });

  it("throws a retryable ModelError when the call fails", async () => {
    const error = await answerQuestion("When do I get paid?", contract, { model: stubFailing() }).catch((e) => e);
    expect(error).toBeInstanceOf(ModelError);
    expect(error.kind).toBe("request");
    expect(error.retryable).toBe(true);
  });

  it("refuses an empty question before calling the model", async () => {
    await expect(answerQuestion("   ", contract, { model: stubFailing() })).rejects.toBeInstanceOf(TypeError);
  });

  it("refuses empty Document text before calling the model", async () => {
    await expect(answerQuestion("When?", " \n", { model: stubFailing() })).rejects.toBeInstanceOf(TypeError);
  });
});

describe("the request sent to OpenRouter", () => {
  it("pins the provider, sets low reasoning effort, asks for strict JSON schema output, and leaves the model to the client", async () => {
    let seen;
    const stub = reply();
    /** @type {(messages: any[], options?: object) => Promise<any>} */
    const recording = async (messages, options) => {
      seen = { messages, options };
      return stub(messages, options);
    };
    await answerQuestion("When do I get paid?", contract, { model: recording });

    expect(seen.messages.some((m) => m.content.includes(contract))).toBe(true);
    expect(seen.messages.some((m) => m.content.includes("When do I get paid?"))).toBe(true);
    expect(seen.options.provider).toEqual({ order: ["fireworks"], allow_fallbacks: false, require_parameters: true });
    expect(seen.options.reasoning).toEqual({ effort: "low" });
    expect(seen.options.response_format.type).toBe("json_schema");
    expect(seen.options.response_format.json_schema.strict).toBe(true);
    expect(typeof seen.options.response_format.json_schema.name).toBe("string");
    expect(seen.options.response_format.json_schema.schema.type).toBe("object");
    expect(Object.keys(seen.options)).not.toContain("model");
  });
});
