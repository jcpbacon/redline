import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeDocument } from "../../lib/analysis/index.js";
import { createAnalyzeHandler } from "../../lib/analysis/http.js";
import { rankFlags } from "../../lib/analysis/rank.js";
import { DEFAULT_SUMMARY, loadSidecar, readFixture, stubContent, stubFromSidecar } from "../helpers/stub-model.js";

/*
 * Counter-offers through the analysis seam and the route (stories 25–28).
 * The model client is the stub; everything after it is real.
 */

const contract = readFixture("adhesion-contract.txt");
const sidecar = loadSidecar();

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

function post(text) {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

/** The sidecar with planted clause `id`'s Counter-offer replaced by `value`, or removed when `value` is undefined. */
function withCounterOffer(id, value) {
  return {
    flags: sidecar.flags.map((f) => {
      if (f.id !== id) return f;
      const { counterOffer: _dropped, ...rest } = f;
      return value === undefined ? rest : { ...rest, counterOffer: value };
    }),
  };
}

const bySentence = (flags) => new Map(flags.map((f) => [f.sourceSentence, f]));

describe("each Flag carries its drafted Counter-offer", () => {
  it("in analyzeDocument's return value", async () => {
    const result = await analyzeDocument(contract, [], { model: stubFromSidecar(sidecar) });
    expect(result.flags).toHaveLength(sidecar.flags.length);
    const flags = bySentence(result.flags);
    for (const planted of sidecar.flags) {
      expect(flags.get(planted.sourceSentence)?.counterOffer).toBe(planted.counterOffer);
    }
  });

  it("in the route's ranked output", async () => {
    const res = await createAnalyzeHandler({ model: stubFromSidecar(sidecar) })(post(contract));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flags).toHaveLength(sidecar.flags.length);
    const flags = bySentence(body.flags);
    for (const planted of sidecar.flags) {
      expect(flags.get(planted.sourceSentence)?.counterOffer).toBe(planted.counterOffer);
    }
  });
});

describe("a Flag with no Counter-offer is still a Flag", () => {
  const target = sidecar.flags[1];

  it.each([
    ["null", null],
    ["an empty string", ""],
    ["only whitespace", "  \n "],
    ["left out", undefined],
  ])("when the model's Counter-offer is %s, analysis keeps the Flag with counterOffer null", async (_case, value) => {
    const drops = [];
    const result = await analyzeDocument(contract, [], {
      model: stubFromSidecar(withCounterOffer(target.id, value)),
      logDrop: (r) => drops.push(r),
    });
    expect(drops).toEqual([]);
    expect(result.flags).toHaveLength(sidecar.flags.length);
    const flags = bySentence(result.flags);
    const flag = flags.get(target.sourceSentence);
    expect(flag).toBeDefined();
    expect(flag.counterOffer).toBeNull();
    expect(flag.severity).toBe(target.severity);
    expect(flag.whatItMeans).toBe(target.whatItMeans);
    // The other Flags keep theirs.
    for (const planted of sidecar.flags.filter((f) => f.id !== target.id)) {
      expect(flags.get(planted.sourceSentence).counterOffer).toBe(planted.counterOffer);
    }
  });

  it("survives ranking", async () => {
    const result = await analyzeDocument(contract, [], { model: stubFromSidecar(withCounterOffer(target.id, null)) });
    const ranked = rankFlags(result.flags);
    expect(ranked.clean).toBe(false);
    expect(ranked.flags).toHaveLength(sidecar.flags.length);
    expect(bySentence(ranked.flags).get(target.sourceSentence).counterOffer).toBeNull();
  });

  it("reaches the Reader through the route", async () => {
    const res = await createAnalyzeHandler({ model: stubFromSidecar(withCounterOffer(target.id, null)) })(post(contract));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flags).toHaveLength(sidecar.flags.length);
    const flag = bySentence(body.flags).get(target.sourceSentence);
    expect(flag.counterOffer).toBeNull();
    expect(contract.includes(flag.sourceSentence)).toBe(true);
  });

  it("but a Counter-offer that is not text makes the reply malformed", async () => {
    const reply = { summary: DEFAULT_SUMMARY, flags: [{ ...sidecar.flags[0], counterOffer: 42 }] };
    await expect(analyzeDocument(contract, [], { model: stubContent(reply) })).rejects.toMatchObject({ retryable: true });
  });
});

describe("the strict JSON schema sent to OpenRouter", () => {
  it("lists every Flag property as required and lets only the optional ones be null", async () => {
    let schema;
    const stub = stubFromSidecar(sidecar);
    await analyzeDocument(contract, [], {
      model: async (messages, /** @type {any} */ options) => {
        schema = options.response_format.json_schema.schema;
        return stub(messages, options);
      },
    });
    const item = schema.properties.flags.items;
    // Strict mode rejects a schema whose properties are not all in `required`.
    expect([...item.required].sort()).toEqual(Object.keys(item.properties).sort());
    expect(item.properties.counterOffer.type).toEqual(["string", "null"]);
    expect(item.properties.sourceSentence.type).toBe("string");
  });
});
