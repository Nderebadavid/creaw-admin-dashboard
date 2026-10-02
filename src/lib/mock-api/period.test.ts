import { describe, expect, it } from "vitest";
import { inPeriod, monthsOf, parsePeriod, previousPeriod } from "./period";

const query = (text: string) => new URLSearchParams(text);

describe("dashboard period", () => {
  it("defaults to the calendar quarter so far", () => {
    expect(parsePeriod(query(""), new Date("2026-10-02T09:00:00Z"))).toEqual({
      from: "2026-10-01",
      to: "2026-10-02",
    });
  });

  it("takes the previous period of the same length, ending the day before", () => {
    // 1 Jul – 30 Sep is 92 days, so the 92 days before start on 31 Mar.
    expect(previousPeriod({ from: "2026-07-01", to: "2026-09-30" })).toEqual({
      from: "2026-03-31",
      to: "2026-06-30",
    });
    expect(previousPeriod({ from: "2026-03-01", to: "2026-03-01" })).toEqual({
      from: "2026-02-28",
      to: "2026-02-28",
    });
  });

  it("lists every month the period touches, across years", () => {
    expect(monthsOf({ from: "2025-11-15", to: "2026-02-03" })).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("counts whole days, including both ends", () => {
    const period = { from: "2026-07-01", to: "2026-07-31" };
    expect(inPeriod(period, "2026-07-31T23:59:59.000Z")).toBe(true);
    expect(inPeriod(period, "2026-08-01T00:00:00.000Z")).toBe(false);
  });
});
