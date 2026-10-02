import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "../../proxy.js";
import { redirectKeepingSession } from "../../lib/supabase/proxy.js";

/*
 * Accounts switched on, but no Supabase server answering. The proxy runs the
 * real @supabase/ssr client; nothing about the session is faked. A request
 * with no session, or with a cookie that doesn't hold a valid one, must get
 * the landing page at / and never a redirect. The signed-in case needs a real
 * session and lives in tests/integration/root-live.test.js.
 */

const VARS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
/** @type {Record<string, string | undefined>} */
let saved = {};

beforeEach(() => {
  saved = Object.fromEntries(VARS.map((name) => [name, process.env[name]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:9";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_unreachable";
  vi.stubGlobal("fetch", () => Promise.reject(new TypeError("fetch failed")));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the proxy at / with Supabase configured but unreachable", () => {
  it("lets a request with no session through to the landing page", async () => {
    const response = await proxy(new NextRequest("http://localhost/"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("lets a request with an unreadable session cookie through to the landing page", async () => {
    const request = new NextRequest("http://localhost/", {
      headers: { cookie: "sb-127-auth-token=not-a-session" },
    });
    const response = await proxy(request);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("redirectKeepingSession", () => {
  it("carries the refreshed cookies onto the redirect and keeps it out of caches", () => {
    const request = new NextRequest("https://redline.example/");
    const refreshed = NextResponse.next({ request });
    refreshed.cookies.set("sb-project-auth-token", "refreshed", { path: "/", httpOnly: true, maxAge: 3600 });

    const redirect = redirectKeepingSession(request, refreshed, "/read");

    expect(redirect.status).toBe(307);
    expect(redirect.headers.get("location")).toBe("https://redline.example/read");
    const cookie = redirect.cookies.get("sb-project-auth-token");
    expect(cookie?.value).toBe("refreshed");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.maxAge).toBe(3600);
    expect(redirect.headers.get("cache-control")).toContain("no-store");
  });
});
