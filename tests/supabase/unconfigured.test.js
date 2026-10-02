import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createAnalyzeHandler } from "../../lib/analysis/http.js";
import { getSupabaseConfig } from "../../lib/supabase/config.js";
import { getBrowserSupabase } from "../../lib/supabase/browser.js";
import { refreshSession } from "../../lib/supabase/proxy.js";
import { createServerSupabase, getReader } from "../../lib/supabase/server.js";
import { loadSidecar, readFixture, stubFromSidecar } from "../helpers/stub-model.js";

/*
 * The landing page and /read must work on a deployment with no Supabase
 * project (CLAUDE.md, common brief). Every account helper therefore answers
 * "no accounts" with null instead of throwing, and the proxy passes requests
 * straight through. These run with every Supabase variable removed.
 */

const SUPABASE_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
];

/** @type {Record<string, string | undefined>} */
let saved = {};

beforeEach(() => {
  saved = Object.fromEntries(SUPABASE_VARS.map((name) => [name, process.env[name]]));
  for (const name of SUPABASE_VARS) delete process.env[name];
  vi.stubGlobal("fetch", () => {
    throw new Error("reached the network");
  });
});

afterEach(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  vi.unstubAllGlobals();
});

describe("with Supabase unconfigured", () => {
  it("reports accounts as off", () => {
    expect(getSupabaseConfig()).toBeNull();
  });

  it("treats a blank variable the same as a missing one", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "   ";
    expect(getSupabaseConfig()).toBeNull();
  });

  it("gives no browser client, and does not throw", () => {
    expect(getBrowserSupabase()).toBeNull();
  });

  it("gives no server client and no Reader, without touching request cookies", async () => {
    // Outside a request, next/headers' cookies() throws. Resolving to null here
    // shows the helpers return before reading the request at all, which is
    // what lets a page that doesn't need an account render statically.
    await expect(createServerSupabase()).resolves.toBeNull();
    await expect(getReader()).resolves.toBeNull();
  });

  it("lets every request through the proxy untouched", async () => {
    const request = new NextRequest("http://localhost/read", { headers: { cookie: "sb-x-auth-token=stale" } });
    const response = await refreshSession(request);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("still analyses a pasted Document", async () => {
    const contract = readFixture("adhesion-contract.txt");
    const handler = createAnalyzeHandler({ model: stubFromSidecar(loadSidecar()), logDrop: () => {} });
    const res = await handler(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: contract }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flags.length).toBeGreaterThan(0);
    for (const flag of body.flags) expect(contract.includes(flag.sourceSentence)).toBe(true);
  });
});

describe("with Supabase configured", () => {
  it("returns the URL and publishable key, and nothing secret", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = " https://example.supabase.co ";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    expect(getSupabaseConfig()).toEqual({ url: "https://example.supabase.co", publishableKey: "sb_publishable_test" });
  });
});
