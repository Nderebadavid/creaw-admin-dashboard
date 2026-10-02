import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDashboardApi } from "./api";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";

beforeEach(() => resetMockStore());
const YEAR_2026 = { from: "2026-01-01", to: "2026-12-31" };

describe("dashboard API", () => {
  it("derives totals and the shown pillars' summaries (Leadership is hidden) from seed records", async () => {
    const overview = await createDashboardApi(
      createPortalApiClient(),
      issueMockToken(1)
    ).getOverview(YEAR_2026);
    const store = getMockStore();
    expect(overview.activeParticipants).toBe(
      store.participant.filter((row) => !row.is_deleted).length
    );
    expect(overview.pillars.map((pillar) => pillar.code)).toEqual([
      "vawg",
      "wee",
      "srhr",
      "wros",
      "skilling",
    ]);
    expect(overview.pendingSubmissions).toBe(
      store.participant_stage_event.filter(
        (row) => !row.is_deleted && row.stage_event_status !== "verified"
      ).length
    );
    expect(overview.monthly).toHaveLength(12);
    expect(overview.recentSubmissions.length).toBeGreaterThan(0);
    expect(overview.upcomingReports.length).toBeGreaterThan(0);
    expect(overview.recentActivity.length).toBeGreaterThan(0);
    expect(overview.recentActivity.every((item) => item.who.length > 0)).toBe(true);
    expect(overview.reportingAlerts.length).toBeGreaterThan(0);
    for (const alert of overview.reportingAlerts) expect(alert).toMatch(/ is \d+ days? overdue$/);
  });

  it("keeps a pillar lead inside their scope", async () => {
    const overview = await createDashboardApi(
      createPortalApiClient(),
      issueMockToken(5)
    ).getOverview(YEAR_2026);
    expect(overview.pillars.map((pillar) => pillar.code)).toEqual(["vawg"]);
    expect(overview.activeParticipants).toBeLessThan(getMockStore().participant.length);
  });
  it("counts records after page one in monthly and pending aggregates", async () => {
    const store = getMockStore();
    const person = store.participant[0];
    const event = store.participant_stage_event.find(
      (row) => row.stage_event_status === "recorded"
    )!;
    for (let index = 0; index < 110; index += 1) {
      store.participant.push({
        ...person,
        id: 1000 + index,
        created_at: "2026-08-15T12:00:00.000Z",
      });
      store.participant_stage_event.push({ ...event, id: 1000 + index, event_date: "2026-08-15" });
    }
    const overview = await createDashboardApi(
      createPortalApiClient(),
      issueMockToken(1)
    ).getOverview(YEAR_2026);
    expect(overview.newInPeriod).toBeGreaterThanOrEqual(110);
    expect(overview.pendingSubmissions).toBeGreaterThanOrEqual(110);
    expect(overview.monthly[7].newCount).toBeGreaterThanOrEqual(110);
  });

  it("maps referral oversight and the requested pillar's funnel to view models", async () => {
    const overview = await createDashboardApi(
      createPortalApiClient(),
      issueMockToken(1)
    ).getOverview(YEAR_2026, undefined, "srhr");
    const open = getMockStore().referral.filter((row) => !row.is_deleted && row.status === "NEW");
    expect(overview.referrals?.open).toBe(open.length);
    expect(overview.referrals?.oldest[0]).toMatchObject({
      participant: expect.any(String),
      from: expect.any(String),
      to: expect.any(String),
    });
    expect(overview.referrals?.byDestination.every((row) => row.color.startsWith("#"))).toBe(true);
    expect(overview.funnel).toMatchObject({ pillar: "srhr", name: "SRHR" });
    expect(overview.funnel?.available.map((row) => row.slug)).toContain("vawg");
    // Reaching a later stage means having passed the earlier ones.
    const counts = overview.funnel!.stages.map((row) => row.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});
