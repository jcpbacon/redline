import { describe, expect, it } from "vitest";
import { AFTER_SIGN_IN, safeNextPath } from "../../lib/auth/routes.js";

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
    expect(safeNextPath(next)).toBe(AFTER_SIGN_IN);
  });
});
