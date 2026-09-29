import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDashboardApi } from "./api";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";

beforeEach(() => resetMockStore());

describe("dashboard API", () => {
  it("derives totals and six scoped pillar summaries from seed records", async () => {
    const overview = await createDashboardApi(
      createPortalApiClient(),
      issueMockToken(1)
    ).getOverview("2026");
    const store = getMockStore();
    expect(overview.activeParticipants).toBe(
      store.participant.filter((row) => !row.is_deleted).length
    );
    expect(overview.pillars.map((pillar) => pillar.code)).toEqual([
      "vawg",
      "wee",
      "srhr",
      "leadership",
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
  });

  it("keeps a pillar lead inside their scope", async () => {
    const overview = await createDashboardApi(
      createPortalApiClient(),
      issueMockToken(5)
    ).getOverview("2026");
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
    ).getOverview("2026");
    expect(overview.newThisQuarter).toBeGreaterThanOrEqual(110);
    expect(overview.pendingSubmissions).toBeGreaterThanOrEqual(110);
    expect(overview.monthly[7].newCount).toBeGreaterThanOrEqual(110);
  });
});
