import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { APP_HOME } from "../../lib/auth/routes.js";
import { proxy } from "../../proxy.js";

/*
 * Story 55 against a real Supabase project: a Reader with a real session who
 * opens / is redirected to the app home by the proxy, before anything
 * renders; the same request without the session gets the landing page.
 *
 * The session cookies are produced by @supabase/ssr itself (the same library
 * the app signs in with), captured from its setAll, and sent back as a
 * browser would send them.
 *
 * Skipped unless SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
 * SUPABASE_SECRET_KEY are all set. Creates one throwaway user and deletes it.
 *
 *   SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SECRET_KEY=… \
 *     npx vitest run tests/integration/root-live.test.js
 */

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(url && publishableKey && secretKey);

describe.skipIf(!configured)("a signed-in Reader opening / on the live Supabase project", () => {
  /** @type {import("@supabase/supabase-js").SupabaseClient} */
  let admin;
  /** @type {string | undefined} */
  let userId;
  let cookieHeader = "";
  /** @type {string | undefined} */
  let savedPublicUrl;

  beforeAll(async () => {
    savedPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;

    admin = createClient(String(url), String(secretKey), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = `redline-root-${randomUUID()}@example.com`;
    const password = `${randomUUID()}Aa1!`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userId = data.user.id;

    /** @type {Map<string, string>} */
    const jar = new Map();
    const browserLike = createServerClient(String(url), String(publishableKey), {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => {
          for (const { name, value } of cookies) {
            if (value) jar.set(name, value);
            else jar.delete(name);
          }
        },
      },
    });
    const signIn = await browserLike.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
    cookieHeader = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  }, 30_000);

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
    if (savedPublicUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = savedPublicUrl;
  });

  it("redirects / to the app home without rendering the landing page", async () => {
    const response = await proxy(new NextRequest("http://localhost/", { headers: { cookie: cookieHeader } }));
    expect(response.status).toBe(307);
    expect(new URL(String(response.headers.get("location"))).pathname).toBe(APP_HOME);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("lets the app home itself through, so there is no loop", async () => {
    const response = await proxy(new NextRequest(`http://localhost${APP_HOME}`, { headers: { cookie: cookieHeader } }));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("shows / to the same browser without the session", async () => {
    const response = await proxy(new NextRequest("http://localhost/"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });
});
