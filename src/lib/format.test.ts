import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDayMonth,
  formatUpdated,
  initials,
  MONTHS_SHORT,
  titleCase,
} from "./format";

describe("formatDate", () => {
  it("formats a timestamp as a short Kenyan-English date", () => {
    expect(formatDate("2026-09-27T09:00:00.000Z")).toBe("27 Sept 2026");
  });

  it("treats a date-only value as a local calendar day", () => {
    expect(formatDate("2026-01-05")).toBe("05 Jan 2026");
  });
});

describe("text helpers", () => {
  it("takes up to two initials", () => {
    expect(initials("Faith Wanjiku Njeri")).toBe("FW");
    expect(initials("judy")).toBe("J");
    expect(initials("  ")).toBe("");
  });

  it("title-cases an upper-case status", () => {
    expect(titleCase("PENDING_REVIEW")).toBe("Pending review");
    expect(titleCase("NEW")).toBe("New");
  });

  it("formats a day and fixed short month", () => {
    expect(MONTHS_SHORT[8]).toBe("Sep");
    expect(formatDayMonth("2026-09-07T10:00:00")).toBe("7 Sep");
  });
});

describe("formatUpdated", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  it("reads recent changes as relative time", () => {
    expect(formatUpdated("2026-10-01T11:59:40Z", now)).toBe("Just now");
    expect(formatUpdated("2026-10-01T11:59:00Z", now)).toBe("1 minute ago");
    expect(formatUpdated("2026-10-01T11:30:00Z", now)).toBe("30 minutes ago");
    expect(formatUpdated("2026-10-01T10:00:00Z", now)).toBe("2 hours ago");
    expect(formatUpdated("2026-09-29T12:00:00Z", now)).toBe("2 days ago");
  });
  it("switches to the date after a week, for future times and for blanks", () => {
    expect(formatUpdated("2026-09-24T12:00:00Z", now)).toBe("24 Sept 2026");
    expect(formatUpdated("2026-10-05T12:00:00Z", now)).toBe("05 Oct 2026");
    expect(formatUpdated("not a date", now)).toBe("—");
  });
});
