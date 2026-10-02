import { describe, expect, it } from "vitest";
import { formatDay, libraryDate } from "../../lib/documents/dates.js";

describe("library dates", () => {
  it("prints a day in UTC", () => {
    expect(formatDay("2026-10-02T23:30:00Z")).toBe("2 Oct 2026");
    expect(formatDay("2026-10-02T23:30:00-05:00")).toBe("3 Oct 2026");
    expect(formatDay(null)).toBe("");
    expect(formatDay("not a date")).toBe("");
  });

  it("shows the date read when there is one, else the date saved", () => {
    expect(libraryDate({ savedAt: "2026-09-01T00:00:00Z", analysedAt: "2026-10-02T00:00:00Z" })).toEqual({
      label: "Read 2 Oct 2026",
      iso: "2026-10-02T00:00:00Z",
    });
    expect(libraryDate({ savedAt: "2026-09-01T00:00:00Z", analysedAt: null })).toEqual({
      label: "Saved 1 Sep 2026, not read yet",
      iso: "2026-09-01T00:00:00Z",
    });
  });
});
