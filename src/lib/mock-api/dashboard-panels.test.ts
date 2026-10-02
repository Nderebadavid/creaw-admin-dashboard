import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import type { EffectiveGrant } from "../auth/permissions";
import { handleMockRequest } from "./handlers";
import { currentQuarterStart, pipelineFunnel, referralOversight } from "./routes/dashboard-panels";
import { getMockStore, issueMockToken, resetMockStore } from "./store";

const everywhere = (...codes: string[]): EffectiveGrant[] =>
  codes.map((permissionCode) => ({ permissionCode, pillarId: null }));
const NOW = new Date("2026-10-02T09:00:00Z");
const daysAgo = (count: number) => new Date(NOW.getTime() - count * 86_400_000).toISOString();

beforeEach(() => resetMockStore());

/** Replaces every referral with the given ones, so counts are exact. */
function referrals(rows: { status: string; created: number; updated?: number; to?: number }[]) {
  const store = getMockStore();
  const template = store.referral[0];
  store.referral = rows.map((row, index) => ({
    ...template,
    id: index + 1,
    status: row.status,
    from_pillar_id: 1,
    to_pillar_id: row.to ?? 2,
    to_partner_institution_id: null,
    created_at: daysAgo(row.created),
    updated_at: daysAgo(row.updated ?? row.created),
    is_deleted: false,
  }));
}

describe("referral oversight", () => {
  it("counts open referrals, the overdue ones, and lists the oldest first", () => {
    referrals([
      { status: "NEW", created: 2 },
      { status: "NEW", created: 9, to: 3 },
      { status: "NEW", created: 12 },
      { status: "NEW", created: 7 },
      { status: "ACCEPTED", created: 30 },
    ]);
    const panel = referralOversight(getMockStore(), everywhere("REFERRAL_VIEW"), NOW)!;
    expect(panel.open).toBe(4);
    // Exactly seven days is not yet overdue.
    expect(panel.overdue).toBe(2);
    expect(panel.oldest.map((row) => row.age_days)).toEqual([12, 9, 7, 2]);
    expect(panel.by_destination).toEqual([
      { pillar_id: 2, open: 3, oldest_days: 12 },
      { pillar_id: 3, open: 1, oldest_days: 9 },
    ]);
  });

  it("rates acceptances among this quarter's decisions only", () => {
    const sinceQuarter = (NOW.getTime() - Date.parse(currentQuarterStart(NOW))) / 86_400_000;
    referrals([
      { status: "ACCEPTED", created: 1, updated: 0 },
      { status: "ACCEPTED", created: 1, updated: 0 },
      { status: "DECLINED", created: 1, updated: 0 },
      { status: "WITHDRAWN", created: 1, updated: 0 },
      { status: "DECLINED", created: 200, updated: Math.ceil(sinceQuarter) + 1 },
    ]);
    const panel = referralOversight(getMockStore(), everywhere("REFERRAL_VIEW"), NOW)!;
    expect(panel.decided_this_quarter).toBe(3);
    expect(panel.accepted_rate).toBe(67);
  });

  it("has no rate before anything is decided, and nothing without referral access", () => {
    referrals([{ status: "NEW", created: 1 }]);
    expect(referralOversight(getMockStore(), everywhere("REFERRAL_VIEW"), NOW)?.accepted_rate).toBe(
      null
    );
    expect(referralOversight(getMockStore(), everywhere("DASHBOARD_VIEW"), NOW)).toBeNull();
  });

  it("only counts referrals inside the dashboard's location", () => {
    referrals([
      { status: "NEW", created: 1 },
      { status: "NEW", created: 2 },
    ]);
    const firstOnly = (_table: string, row: { id: number }) => row.id === 1;
    const panel = referralOversight(getMockStore(), everywhere("REFERRAL_VIEW"), NOW, firstOnly)!;
    expect(panel.open).toBe(1);
    expect(panel.oldest.map((row) => row.id)).toEqual([1]);
  });

  it("only counts referrals touching the caller's pillars", () => {
    referrals([
      { status: "NEW", created: 1, to: 2 },
      { status: "NEW", created: 1, to: 3 },
    ]);
    // Pillar 1 is every referral's origin, so scoping to pillar 3 alone excludes the first.
    getMockStore().referral[0].from_pillar_id = 4;
    const grants = [{ permissionCode: "REFERRAL_VIEW", pillarId: 3 }];
    expect(referralOversight(getMockStore(), grants, NOW)?.open).toBe(1);
  });
});

describe("pipeline funnel", () => {
  const vawg = () => getMockStore().pillar.find((row) => row.code === "VAWG")!;

  it("counts enrollments that reached each stage or a later one", () => {
    const store = getMockStore();
    const pillar = vawg();
    const pipeline = store.pipeline_definition.find((row) => row.pillar_id === pillar.id)!;
    const stages = store.stage_definition
      .filter((row) => row.pipeline_id === pipeline.id && !row.is_deleted)
      .sort((a, b) => a.step_no - b.step_no);
    const [first, second] = store.enrollment.filter(
      (row) => !row.is_deleted && row.pillar_id === pillar.id
    );
    const event = store.participant_stage_event[0];
    store.participant_stage_event = [
      // One enrollment jumped straight to stage 3; the other reached stage 1.
      { ...event, id: 1, enrollment_id: first.id, stage_definition_id: stages[2].id },
      { ...event, id: 2, enrollment_id: second.id, stage_definition_id: stages[0].id },
      // Disputed and deleted events don't move anyone forward.
      {
        ...event,
        id: 3,
        enrollment_id: second.id,
        stage_definition_id: stages[4].id,
        stage_event_status: "disputed",
      },
      {
        ...event,
        id: 4,
        enrollment_id: second.id,
        stage_definition_id: stages[5].id,
        is_deleted: true,
      },
    ].map((row) => ({ ...row, is_deleted: row.is_deleted ?? false }));
    const funnel = pipelineFunnel(store, everywhere("FIELD_SUBMISSION_VIEW"), [pillar.id], "vawg")!;
    expect(funnel.stages.slice(0, 5).map((row) => row.reached)).toEqual([2, 1, 1, 0, 0]);
    expect(funnel.code).toBe("vawg");
  });

  it("falls back to the first visible pillar, and is null without stage-event access", () => {
    const store = getMockStore();
    const ids = store.pillar.map((row) => row.id);
    const grants = everywhere("FIELD_SUBMISSION_VIEW");
    expect(pipelineFunnel(store, grants, ids, "nonsense")?.code).toBe(
      pipelineFunnel(store, grants, ids, null)?.code
    );
    // Leadership has no pipeline, so it is never offered.
    expect(pipelineFunnel(store, grants, ids, null)?.available).not.toContain("leadership");
    expect(pipelineFunnel(store, everywhere("DASHBOARD_VIEW"), ids, null)).toBeNull();
    const scoped = [{ permissionCode: "FIELD_SUBMISSION_VIEW", pillarId: vawg().id }];
    expect(pipelineFunnel(store, scoped, ids, "srhr")?.available).toEqual(["vawg"]);
  });
});

describe("overview route", () => {
  it("returns both panels and accepts the funnel filter", async () => {
    const response = await handleMockRequest({
      method: "GET",
      path: "/dashboard",
      routeTemplate: "/dashboard",
      correlationId: "panels",
      token: issueMockToken(1),
      query: { view: "overview", year: "2026", funnel: "srhr" },
    });
    expect(response.resultCode).toBe(200);
    expect(response.data).toMatchObject({
      referrals: { open: expect.any(Number) },
      funnel: { code: "srhr" },
    });
  });
});
