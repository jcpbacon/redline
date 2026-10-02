import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { askSavedDocument } from "../../lib/questions/ask.js";
import { COPY, createDocumentQuestionHandler } from "../../lib/questions/http.js";
import { questionsFromRows } from "../../lib/questions/text.js";
import { createPgliteStore } from "./pglite-store.js";
import { bootDatabase, createUser } from "./supabase-shim.js";
import { FABRICATED_SENTENCE, readFixture, stubContent, stubFailing } from "../helpers/stub-model.js";

/*
 * The question box on a saved Document (ticket #24) against a real Postgres:
 * supabase/migrations/ unmodified on PGlite, through lib/documents/store.js's
 * interface as each Reader (./pglite-store.js), so row-level security decides
 * every result. The model is the stub; nothing else is.
 */

const contract = readFixture("adhesion-contract.txt");
const PAYMENT =
  "Brand will pay the Fee within ninety (90) days after Brand's written acceptance of all Deliverables, and Brand may withhold acceptance in its sole discretion.";
const TERMINATION =
  "Brand may terminate this Agreement at any time, for any reason, on seven (7) days' written notice, and in that event no portion of the Fee shall be owed for Deliverables not yet accepted.";

const grounded = (answer, groundedIn) => stubContent({ answerable: true, answer, groundedIn });
const refusing = () => stubContent({ answerable: false, answer: "", groundedIn: [] });

/** @type {import("@electric-sql/pglite").PGlite} */
let db;
/** @type {import("../../lib/documents/store.js").DocumentStore} */
let storeA;
/** @type {import("../../lib/documents/store.js").DocumentStore} */
let storeB;

beforeAll(async () => {
  db = await bootDatabase();
  storeA = createPgliteStore(db, await createUser(db));
  storeB = createPgliteStore(db, await createUser(db));
});

afterAll(async () => {
  await db?.close();
});

beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("reached the network");
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function questionCount(documentId) {
  const { rows } = await db.query("select count(*)::int as n from questions where document_id = $1", [documentId]);
  return /** @type {any} */ (rows[0]).n;
}

describe("asking a saved Document", () => {
  it("stores a grounded answer and an unanswerable one, and lists them oldest first on reload", async () => {
    const { id } = await storeA.saveDocument({ title: "Northwick", text: contract });

    const first = await askSavedDocument(storeA, id, "When do I get paid?", { model: grounded("Within 90 days.", [PAYMENT]) });
    const second = await askSavedDocument(storeA, id, "Is this fair under Texas law?", { model: refusing() });
    const third = await askSavedDocument(storeA, id, "Can they end it early?", { model: grounded("Yes, on 7 days' notice.", [TERMINATION]) });

    expect(first).toMatchObject({ question: "When do I get paid?", unanswerable: false, text: "Within 90 days.", groundedIn: [PAYMENT] });
    expect(typeof first?.id).toBe("string");
    expect(typeof first?.askedAt).toBe("string");
    expect(second).toMatchObject({ unanswerable: true, text: null, groundedIn: [] });

    // A reload reads the rows back from the database.
    const history = questionsFromRows(await storeA.listQuestions(id), contract);
    expect(history.map((q) => q.question)).toEqual(["When do I get paid?", "Is this fair under Texas law?", "Can they end it early?"]);
    expect(history.map((q) => q.id)).toEqual([first?.id, second?.id, third?.id]);
    for (const q of history) for (const s of q.groundedIn) expect(contract.includes(s)).toBe(true);
  });

  it("stores an unanswerable question with null answer text and no grounding", async () => {
    const { id } = await storeA.saveDocument({ title: "Refused", text: contract });
    await askSavedDocument(storeA, id, "What would a court say?", { model: refusing() });
    const { rows } = await db.query("select answer_text, grounded_in, unanswerable from questions where document_id = $1", [id]);
    expect(rows).toEqual([{ answer_text: null, grounded_in: [], unanswerable: true }]);
  });

  it("stores an answer whose grounding isn't in the Document as unanswerable, never the bad sentence", async () => {
    const { id } = await storeA.saveDocument({ title: "Fabricated", text: contract });
    const drops = [];
    const asked = await askSavedDocument(storeA, id, "Is there a penalty?", {
      model: grounded("You owe $10,000 a post.", [FABRICATED_SENTENCE]),
      logDrop: (r) => drops.push(r),
    });
    expect(asked).toMatchObject({ unanswerable: true, text: null });
    expect(drops).toEqual([expect.objectContaining({ documentId: id, answer: "You owe $10,000 a post." })]);
    const { rows } = await db.query("select answer_text, grounded_in from questions where document_id = $1", [id]);
    expect(JSON.stringify(rows)).not.toContain(FABRICATED_SENTENCE);
  });

  it("gives a follow-up the earlier questions from the database", async () => {
    const { id } = await storeA.saveDocument({ title: "Follow-up", text: contract });
    await askSavedDocument(storeA, id, "When do I get paid?", { model: grounded("Within 90 days.", [PAYMENT]) });

    let sent = "";
    /** @type {(messages: any[], options?: object) => Promise<any>} */
    const recording = async (messages, options) => {
      sent = messages.map((m) => String(m.content)).join("\n");
      return grounded("Brand decides when to accept.", [PAYMENT])(messages, options);
    };
    await askSavedDocument(storeA, id, "Who decides that?", { model: recording });
    expect(sent).toContain("When do I get paid?");
    expect(sent).toContain("Within 90 days.");
  });

  it("stores nothing when the model fails", async () => {
    const { id } = await storeA.saveDocument({ title: "Failing", text: contract });
    await expect(askSavedDocument(storeA, id, "When?", { model: stubFailing() })).rejects.toThrow();
    expect(await questionCount(id)).toBe(0);
  });

  it("keeps one Reader's questions from another", async () => {
    const { id } = await storeA.saveDocument({ title: "Private", text: contract });
    await askSavedDocument(storeA, id, "When do I get paid?", { model: grounded("Within 90 days.", [PAYMENT]) });

    expect(await storeB.listQuestions(id)).toEqual([]);
    // Reader B can't ask Reader A's Document anything: it isn't found for them.
    expect(await askSavedDocument(storeB, id, "When?", { model: grounded("x", [PAYMENT]) })).toBeNull();
    // Nor write a question under it directly.
    await expect(
      storeB.saveQuestion({ documentId: id, question: "Sneaky", answer: { unanswerable: true } }),
    ).rejects.toThrow();
    expect(await questionCount(id)).toBe(1);
  });
});

describe("POST /api/documents/[id]/questions", () => {
  const post = (body) =>
    new Request("http://localhost/api/documents/x/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const ctx = (/** @type {string} */ id) => ({ params: Promise.resolve({ id }) });
  const as = (store) => async () => ({ state: /** @type {const} */ ("ok"), reader: { id: "r", email: null }, store });

  it("answers, stores the question, and returns the stored row", async () => {
    const { id } = await storeA.saveDocument({ title: "Route", text: contract });
    const handler = createDocumentQuestionHandler({ model: grounded("Within 90 days.", [PAYMENT]), connect: as(storeA) });
    const res = await handler(post({ question: "When do I get paid?" }), ctx(id));
    expect(res.status).toBe(200);
    const { question } = await res.json();
    expect(question).toMatchObject({ question: "When do I get paid?", unanswerable: false, groundedIn: [PAYMENT] });
    expect(typeof question.id).toBe("string");

    const stored = questionsFromRows(await storeA.listQuestions(id), contract);
    expect(stored).toEqual([question]);
  });

  it("stores and returns an unanswerable question", async () => {
    const { id } = await storeA.saveDocument({ title: "Route refusal", text: contract });
    const handler = createDocumentQuestionHandler({ model: refusing(), connect: as(storeA) });
    const res = await handler(post({ question: "Is this normal?" }), ctx(id));
    expect(res.status).toBe(200);
    expect((await res.json()).question).toMatchObject({ unanswerable: true, text: null });
    expect(await questionCount(id)).toBe(1);
  });

  it("answers 502 retryable when the model fails, and stores nothing", async () => {
    const { id } = await storeA.saveDocument({ title: "Route failure", text: contract });
    const handler = createDocumentQuestionHandler({ model: stubFailing(), connect: as(storeA) });
    const res = await handler(post({ question: "When?" }), ctx(id));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: COPY.modelFailed, retryable: true });
    expect(await questionCount(id)).toBe(0);
  });

  it("answers 404 for another Reader's Document, and stores nothing", async () => {
    const { id } = await storeA.saveDocument({ title: "Not B's", text: contract });
    const handler = createDocumentQuestionHandler({ model: grounded("x", [PAYMENT]), connect: as(storeB) });
    const res = await handler(post({ question: "When?" }), ctx(id));
    expect(res.status).toBe(404);
    expect(await questionCount(id)).toBe(0);
  });

  it("answers 400 for an empty question, 401 signed out and 503 with accounts off", async () => {
    const { id } = await storeA.saveDocument({ title: "Edges", text: contract });
    const model = stubFailing();
    expect((await createDocumentQuestionHandler({ model, connect: as(storeA) })(post({ question: " " }), ctx(id))).status).toBe(400);
    expect(
      (await createDocumentQuestionHandler({ model, connect: async () => ({ state: "signed-out" }) })(post({ question: "q" }), ctx(id))).status,
    ).toBe(401);
    expect(
      (await createDocumentQuestionHandler({ model, connect: async () => ({ state: "off" }) })(post({ question: "q" }), ctx(id))).status,
    ).toBe(503);
    expect(await questionCount(id)).toBe(0);
  });
});
