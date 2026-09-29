import { describe, expect, it } from "vitest";
import { formatDate } from "./format";

describe("formatDate", () => {
  it("formats a timestamp as a short Kenyan-English date", () => {
    expect(formatDate("2026-09-27T09:00:00.000Z")).toBe("27 Sept 2026");
  });

  it("treats a date-only value as a local calendar day", () => {
    expect(formatDate("2026-01-05")).toBe("05 Jan 2026");
  });
});
