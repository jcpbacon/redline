import { describe, expect, it } from "vitest";
import { APP_HOME, routeForRequest, safeNextPath } from "../../lib/auth/routes.js";

describe("safeNextPath", () => {
  it("keeps a path on this site", () => {
    expect(safeNextPath("/read")).toBe("/read");
    expect(safeNextPath("/library?sort=new")).toBe("/library?sort=new");
  });

  it.each([
    ["missing", null],
    ["empty", ""],
    ["another site", "https://evil.example/"],
    ["protocol-relative", "//evil.example/read"],
    ["backslash trick", "/\\evil.example"],
    ["relative path", "read"],
    ["javascript url", "javascript:alert(1)"],
    ["control character", "/read\n"],
  ])("sends %s to the default", (_case, next) => {
    expect(safeNextPath(next)).toBe(APP_HOME);
  });
});

describe("routeForRequest (story 55)", () => {
  it("sends a signed-in Reader opening / to the app home", () => {
    expect(routeForRequest({ pathname: "/", signedIn: true })).toBe(APP_HOME);
  });

  it("shows / to someone who isn't signed in", () => {
    expect(routeForRequest({ pathname: "/", signedIn: false })).toBeNull();
  });

  it.each(["/read", "/library", "/sign-in", "/documents/abc", "/red-lines"])(
    "leaves %s alone whether or not the Reader is signed in",
    (pathname) => {
      expect(routeForRequest({ pathname, signedIn: true })).toBeNull();
      expect(routeForRequest({ pathname, signedIn: false })).toBeNull();
    },
  );

  it("makes the app home a path on this site that isn't / itself", () => {
    expect(safeNextPath(APP_HOME)).toBe(APP_HOME);
    expect(APP_HOME).not.toBe("/");
  });
});
