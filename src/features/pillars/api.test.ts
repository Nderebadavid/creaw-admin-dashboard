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
  it("reads all enrollment pages and counts observed stage events", async () => {
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
    expect(view.records).toHaveLength(114);
    expect(view.stageCounts?.find((row) => row.name === stage.name)?.count).toBe(1);
    expect(view.stageCounts?.[0].count).toBeLessThan(view.records.length);
  });
  it("uses the five domain registers rather than enrollment rows as the primary table", async () => {
    const api = createPillarsApi(createPortalApiClient(), issueMockToken(1));
    const expected = [
      ["vawg", "Legal case register", "legal_case"],
      ["wee", "Grant applications", "grant_application"],
      ["srhr", "Outreach sessions", "activity_session"],
      ["skilling", "Trainee enrollments", "training_enrollment"],
      ["wros", "Partner organisations", "organisation"],
    ] as const;
    for (const [code, title, table] of expected) {
      const view = await api.get(code);
      expect(view.domain?.title).toBe(title);
      expect(view.domain?.rows).toHaveLength(getMockStore()[table].length);
    }
  });
  it("labels the legal case ruling date without implying a future appointment", async () => {
    getMockStore().legal_case[0].ruling_date = "2026-10-20";
    const view = await createPillarsApi(createPortalApiClient(), issueMockToken(1)).get("vawg");
    expect(view.domain?.columns[4]).toBe("Ruling date");
    expect(view.domain?.rows.find((row) => row.id === 1)?.values[4]).toBe("2026-10-20");
  });
  it("does not expose the WRO register without its explicit organisation grant", async () => {
    const view = await createPillarsApi(createPortalApiClient(), issueMockToken(8)).get("wros");
    expect(view.domain).toBeNull();
  });
});
