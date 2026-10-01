import { describe, expect, it } from "vitest";
import { buildCoverage, periodStart } from "./coverage";

const today = new Date(2026, 8, 30); // 30 Sep 2026, local time
const types = [
  { id: 4, name: "Health Talk", active: true },
  { id: 1, name: "YSLA", active: true },
];
const topics = [
  { id: 10, activityTypeId: 4, name: "Menstrual health", sequenceNo: 1, active: true },
  { id: 11, activityTypeId: 4, name: "Contraception", sequenceNo: 2, active: true },
  { id: 12, activityTypeId: 4, name: "Retired topic", sequenceNo: 3, active: false },
  { id: 20, activityTypeId: 1, name: "Savings cycle", sequenceNo: 1, active: true },
];
const session = (
  id: number,
  typeId: number,
  topicId: number | null,
  date: string,
  free: string | null = null
) => ({
  id,
  activityTypeId: typeId,
  topicId,
  freeTopic: free,
  date,
});

describe("periodStart", () => {
  it("starts the quarter, the year, or nothing", () => {
    expect(periodStart("quarter", today)).toBe("2026-07-01");
    expect(periodStart("year", today)).toBe("2026-01-01");
    expect(periodStart("all", today)).toBeNull();
  });
});

describe("buildCoverage", () => {
  const sessions = [
    session(1, 4, 10, "2026-07-01"),
    session(2, 4, 10, "2026-09-10"),
    session(3, 4, null, "2026-09-24", "Facility referral day"),
    session(4, 1, 20, "2026-03-02"),
  ];
  const attendance = [
    { sessionId: 1, participantId: 5 },
    { sessionId: 2, participantId: 5 },
    { sessionId: 2, participantId: 6 },
    { sessionId: 4, participantId: 7 },
  ];

  it("marks topics covered in the quarter, counting the quarter's first day", () => {
    const { coverage, summary } = buildCoverage({
      types,
      topics,
      sessions,
      attendance,
      period: "quarter",
      today,
    });
    const health = coverage.find((row) => row.activityTypeId === 4)!;
    expect(health.topics.map((row) => [row.name, row.sessions, row.lastDelivered])).toEqual([
      ["Menstrual health", 2, "2026-09-10"],
      ["Contraception", 0, null],
    ]);
    expect(health.otherTopics).toEqual([
      { name: "Facility referral day", sessions: 1, lastDelivered: "2026-09-24" },
    ]);
    expect(summary).toEqual({
      sessionsHeld: 3,
      peopleReached: 2,
      topicsCovered: 1,
      topicsPlanned: 3,
      activeTypes: 2,
    });
  });

  it("widens to the year and to all time", () => {
    expect(
      buildCoverage({ types, topics, sessions, attendance, period: "year", today }).summary
        .topicsCovered
    ).toBe(2);
    expect(
      buildCoverage({ types, topics, sessions, attendance, period: "all", today }).summary
        .sessionsHeld
    ).toBe(4);
  });

  it("still returns a block per type when no topics are planned", () => {
    const { coverage } = buildCoverage({
      types,
      topics: [],
      sessions,
      attendance,
      period: "all",
      today,
    });
    expect(coverage.map((row) => row.topics.length)).toEqual([0, 0]);
  });
});
