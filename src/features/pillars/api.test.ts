import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createPillarsApi } from "./api";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";

beforeEach(() => resetMockStore());

describe("pillar API", () => {
  it("returns not-found for an unsupported pillar code", async () => {
    await expect(
      createPillarsApi(createPortalApiClient(), issueMockToken(1)).get("unknown")
    ).rejects.toMatchObject({ status: 404 });
  });

  it("shows only the lead's scoped pillar and rows", async () => {
    const api = createPillarsApi(createPortalApiClient(), issueMockToken(5));
    const vawg = await api.get("vawg");
    expect(vawg.code).toBe("vawg");
    expect(vawg.records.every((row) => row.pillarId === vawg.id)).toBe(true);
    await expect(api.get("wee")).rejects.toMatchObject({ status: 403 });
  });
  it("counts every enrollment, pages the first records and counts observed stage events", async () => {
    const store = getMockStore();
    const enrollment = store.enrollment.find((row) => row.pillar_id === 1)!;
    for (let index = 0; index < 110; index += 1)
      store.enrollment.push({ ...enrollment, id: 1000 + index });
    const stage = store.stage_definition.find(
      (row) =>
        row.pipeline_id === store.pipeline_definition.find((pipe) => pipe.pillar_id === 1)?.id &&
        row.step_no === 2
    )!;
    const event = store.participant_stage_event.find((row) => row.enrollment_id === enrollment.id)!;
    store.participant_stage_event.push({
      ...event,
      id: 1000,
      stage_definition_id: stage.id,
      local_ref: "later-stage",
    });
    const view = await createPillarsApi(createPortalApiClient(), issueMockToken(1)).get("vawg");
    // The page holds the first page of records; the totals come from the summary.
    expect(view.recordCount).toBe(115);
    expect(view.records).toHaveLength(25);
    expect(view.stageCounts?.find((row) => row.name === stage.name)?.count).toBe(1);
    expect(view.stageCounts?.[0].count).toBeLessThan(view.recordCount);
  });
  it("names each record and pages them on the server", async () => {
    const api = createPillarsApi(createPortalApiClient(), issueMockToken(1));
    const first = await api.listRecords("vawg", { page: 1, pageSize: 5 });
    expect(first.items).toHaveLength(5);
    expect(first.items.every((row) => !/#\d/.test(row.title))).toBe(true);
    const sorted = await api.listRecords("vawg", {
      page: 1,
      pageSize: 100,
      sort: { by: "record", order: "asc" },
    });
    const titles = sorted.items.map((row) => row.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
    const found = await api.listRecords("vawg", { search: first.items[0].title.split(" ")[0] });
    expect(found.items.some((row) => row.id === first.items[0].id)).toBe(true);
  });
  it("keeps the generic register for WEE only; the other pillars use their workspaces", async () => {
    const api = createPillarsApi(createPortalApiClient(), issueMockToken(1));
    const wee = await api.get("wee");
    expect(wee.domain?.title).toBe("Grant applications");
    expect(wee.domain?.totalItems).toBe(getMockStore().grant_application.length);
    expect(wee.domain?.rows[0].values[0]).not.toMatch(/#\d/);
    for (const code of ["vawg", "srhr", "skilling", "wros", "leadership"] as const)
      expect((await api.get(code)).domain).toBeNull();
  });
  it("carries the pillar's cards from the summary", async () => {
    const api = createPillarsApi(createPortalApiClient(), issueMockToken(1));
    expect((await api.get("vawg")).cards.vawg).toMatchObject({ survivors: expect.any(Number) });
    expect((await api.get("skilling")).cards.trainees).toMatchObject({ enrolled: 5 });
    expect(
      (await api.get("srhr", { period: "all" })).cards.sessions?.summary.sessionsHeld
    ).toBeGreaterThan(0);
  });
  it("does not expose the WRO register without its explicit organisation grant", async () => {
    const view = await createPillarsApi(createPortalApiClient(), issueMockToken(8)).get("wros");
    expect(view.domain).toBeNull();
  });
});
