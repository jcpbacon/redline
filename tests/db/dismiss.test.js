import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { flagView } from "../../lib/analysis/flag-view.js";
import { analyseSavedDocument } from "../../lib/documents/analyse.js";
import { analysisFromRecord } from "../../lib/documents/rows.js";
import { createPgliteStore } from "./pglite-store.js";
import { bootDatabase, createUser } from "./supabase-shim.js";
import { loadSidecar, readFixture, stubFromSidecar } from "../helpers/stub-model.js";

/*
 * Story 23 at the SQL level: dismissing a Flag writes flags.dismissed_at
 * under the Reader's session, the latest analysis reads it back, putting it
 * back clears it, and another Reader can't touch it. Runs
 * supabase/migrations/ unmodified on PGlite through lib/documents/store.js's
 * interface (./pglite-store.js); row-level security decides every result.
 */

const contract = readFixture("adhesion-contract.txt");
const sidecar = loadSidecar();
const modelId = () => "stub-model-client";

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
  vi.stubGlobal("fetch", () => {
    throw new Error("reached the network");
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await db?.close();
});

/** Save the contract as `store`'s Reader, analyse it, and return what the page would show. */
async function savedAndRead(store) {
  const { id } = await store.saveDocument({ title: "Northwick deal", text: contract });
  await analyseSavedDocument(store, id, { model: stubFromSidecar(sidecar), modelId, logDrop: () => {} });
  return { id, analysis: await shown(store, id) };
}

async function shown(store, documentId) {
  const analysis = analysisFromRecord(await store.latestAnalysis(documentId), contract);
  if (!analysis) throw new Error("No analysis stored.");
  return analysis;
}

async function dismissedAtInDb(flagId) {
  const { rows } = await db.query("select dismissed_at from flags where id = $1", [flagId]);
  return /** @type {any} */ (rows[0]).dismissed_at;
}

describe("dismissing a Flag", () => {
  it("reads back every stored Flag with its id and no dismissal", async () => {
    const { analysis } = await savedAndRead(storeA);
    expect(analysis.flags.length).toBe(sidecar.flags.length);
    for (const flag of analysis.flags) {
      expect(typeof flag.id).toBe("string");
      expect(flag.dismissedAt).toBeNull();
    }
  });

  it("sets dismissed_at for the Reader, keeps it on reload, and clears it when put back", async () => {
    const { id, analysis } = await savedAndRead(storeA);
    const target = analysis.flags[1];
    const flagId = /** @type {string} */ (target.id);

    const dismissed = await storeA.setFlagDismissed(flagId, true);
    expect(dismissed?.id).toBe(flagId);
    expect(typeof dismissed?.dismissedAt).toBe("string");
    expect(await dismissedAtInDb(flagId)).not.toBeNull();

    // A fresh read of the latest analysis (a reload) carries the dismissal.
    const reloaded = await shown(storeA, id);
    const again = reloaded.flags.find((f) => f.id === flagId);
    expect(again?.dismissedAt).toEqual(expect.any(String));
    expect(reloaded.flags.filter((f) => f.dismissedAt)).toHaveLength(1);
    const view = flagView(reloaded.flags);
    expect(view.state).toBe("has-visible");
    expect(view.dismissed.map((e) => [e.rank, e.flag.id])).toEqual([[2, flagId]]);
    expect(view.visible.map((e) => e.flag.id)).not.toContain(flagId);
    // Nothing else about the Flag changed.
    expect({ ...again, dismissedAt: null }).toEqual(target);

    const back = await storeA.setFlagDismissed(flagId, false);
    expect(back).toEqual({ id: flagId, dismissedAt: null });
    expect(await dismissedAtInDb(flagId)).toBeNull();
    expect(flagView((await shown(storeA, id)).flags).dismissed).toEqual([]);
  });

  it("shows a Document whose Flags are all dismissed as all-dismissed, not clean", async () => {
    const { id, analysis } = await savedAndRead(storeA);
    for (const flag of analysis.flags) await storeA.setFlagDismissed(/** @type {string} */ (flag.id), true);
    const reloaded = await shown(storeA, id);
    expect(reloaded.clean).toBe(false);
    expect(flagView(reloaded.flags).state).toBe("all-dismissed");
  });

  it("doesn't let another Reader dismiss or put back someone else's Flag", async () => {
    const { id, analysis } = await savedAndRead(storeA);
    const flagId = /** @type {string} */ (analysis.flags[0].id);

    expect(await storeB.setFlagDismissed(flagId, true)).toBeNull();
    expect(await dismissedAtInDb(flagId)).toBeNull();

    await storeA.setFlagDismissed(flagId, true);
    const before = await dismissedAtInDb(flagId);
    expect(await storeB.setFlagDismissed(flagId, false)).toBeNull();
    expect(await dismissedAtInDb(flagId)).toEqual(before);
    expect(await storeB.latestAnalysis(id)).toBeNull();
  });

  it("answers an id that isn't a uuid as not found", async () => {
    expect(await storeA.setFlagDismissed("not-a-flag", true)).toBeNull();
  });

  it("starts a new reading with no Flag dismissed (dismissals belong to the run's Flags)", async () => {
    const { id, analysis } = await savedAndRead(storeA);
    await storeA.setFlagDismissed(/** @type {string} */ (analysis.flags[0].id), true);
    await analyseSavedDocument(storeA, id, { model: stubFromSidecar(sidecar), modelId, logDrop: () => {} });
    const latest = await shown(storeA, id);
    expect(latest.id).not.toBe(analysis.id);
    expect(latest.flags.every((f) => f.dismissedAt === null)).toBe(true);
  });
});
