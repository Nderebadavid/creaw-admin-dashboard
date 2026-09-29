import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDashboardApi } from "./api";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";

beforeEach(() => resetMockStore());

describe("dashboard API", () => {
  it("derives totals and six scoped pillar summaries from seed records", async () => {
    const overview = await createDashboardApi(createPortalApiClient(), issueMockToken(1)).getOverview("2026");
    const store = getMockStore();
    expect(overview.activeParticipants).toBe(store.participant.filter(row => !row.is_deleted).length);
    expect(overview.pillars.map(pillar => pillar.code)).toEqual(["vawg", "wee", "srhr", "leadership", "wros", "skilling"]);
    expect(overview.pendingSubmissions).toBe(store.participant_stage_event.filter(row => !row.is_deleted && row.stage_event_status !== "verified").length);
    expect(overview.monthly).toHaveLength(12);
    expect(overview.recentSubmissions.length).toBeGreaterThan(0);
    expect(overview.upcomingReports.length).toBeGreaterThan(0);
    expect(overview.recentActivity.length).toBeGreaterThan(0);
  });

  it("keeps a pillar lead inside their scope", async () => {
    const overview = await createDashboardApi(createPortalApiClient(), issueMockToken(5)).getOverview("2026");
    expect(overview.pillars.map(pillar => pillar.code)).toEqual(["vawg"]);
    expect(overview.activeParticipants).toBeLessThan(getMockStore().participant.length);
  });
});
