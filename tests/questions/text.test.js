import { describe, expect, it } from "vitest";
import {
  HISTORY_LIMIT,
  MAX_QUESTION_LENGTH,
  QUESTION_ERRORS,
  normaliseHistory,
  prepareQuestion,
  questionsFromRows,
} from "../../lib/questions/text.js";
import { FABRICATED_SENTENCE, readFixture } from "../helpers/stub-model.js";

const contract = readFixture("adhesion-contract.txt");
const PAYMENT =
  "Brand will pay the Fee within ninety (90) days after Brand's written acceptance of all Deliverables, and Brand may withhold acceptance in its sole discretion.";

const row = (overrides = {}) => ({
  id: "q1",
  question: "When do I get paid?",
  answer_text: "Within 90 days.",
  grounded_in: [PAYMENT],
  unanswerable: false,
  created_at: "2026-10-02T10:00:00.000Z",
  ...overrides,
});

describe("prepareQuestion", () => {
  it("trims and accepts a question", () => {
    expect(prepareQuestion("  When?  \n")).toEqual({ ok: true, question: "When?" });
  });

  it("refuses an empty or over-long question", () => {
    expect(prepareQuestion(" ")).toEqual({ ok: false, error: QUESTION_ERRORS.empty });
    expect(prepareQuestion(undefined)).toEqual({ ok: false, error: QUESTION_ERRORS.empty });
    expect(prepareQuestion("a".repeat(MAX_QUESTION_LENGTH + 1))).toEqual({ ok: false, error: QUESTION_ERRORS.tooLong });
  });
});

describe("normaliseHistory", () => {
  it("keeps usable entries, the last few only, and skips junk", () => {
    const many = Array.from({ length: HISTORY_LIMIT + 3 }, (_, i) => ({ question: `Q${i}`, text: `A${i}`, unanswerable: false }));
    const out = normaliseHistory([null, { question: "" }, { question: "No answer", text: "" }, ...many]);
    expect(out).toHaveLength(HISTORY_LIMIT);
    expect(out[out.length - 1]).toEqual({ question: `Q${HISTORY_LIMIT + 2}`, text: `A${HISTORY_LIMIT + 2}`, unanswerable: false });
    expect(normaliseHistory("nope")).toEqual([]);
  });

  it("keeps an unanswerable entry without its text", () => {
    expect(normaliseHistory([{ question: "Q", text: "ignored", unanswerable: true }])).toEqual([
      { question: "Q", text: null, unanswerable: true },
    ]);
  });
});

describe("questionsFromRows", () => {
  it("returns stored questions oldest first, with null text on an unanswerable one", () => {
    const rows = [
      row({ id: "q2", question: "Later", unanswerable: true, answer_text: null, grounded_in: [], created_at: "2026-10-02T11:00:00.000Z" }),
      row(),
    ];
    const out = questionsFromRows(rows, contract);
    expect(out.map((q) => q.id)).toEqual(["q1", "q2"]);
    expect(out[1]).toEqual({ id: "q2", question: "Later", unanswerable: true, text: null, groundedIn: [], askedAt: "2026-10-02T11:00:00.000Z" });
  });

  it("refuses to show a stored answer resting on a sentence that isn't in the Document", () => {
    expect(() => questionsFromRows([row({ grounded_in: [FABRICATED_SENTENCE] })], contract)).toThrow(/ADR-0001/);
  });

  it("refuses to show a stored answer with nothing behind it", () => {
    expect(() => questionsFromRows([row({ grounded_in: [] })], contract)).toThrow(/ADR-0001/);
  });
});
