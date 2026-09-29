import { beforeEach, describe, expect, it, vi } from "vitest";
const actor = vi.hoisted(() => ({ id: 1, token: "" }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: actor.token }) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session-server", () => ({ requireSession: async () => ({ user: { id: actor.id }, grants: (await import("@/lib/auth/permissions")).getEffectiveGrants(actor.id) }) }));
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { addStageAction, createPipelineAction, moveStageAction, removeStageAction, renameStageAction } from "./pipeline-actions";
import { reviewSubmissionAction } from "@/features/submissions/actions";
import { createAdminApi } from "./api";
import { createPortalApiClient } from "@/lib/api/portal-client";

beforeEach(() => { resetMockStore(); actor.id = 1; actor.token = issueMockToken(1); });

describe("pipeline configuration", () => {
  it("keeps active step numbers continuous across insert, move, and soft removal", async () => {
    const pipeline = getMockStore().pipeline_definition.find(row => row.pillar_id === 2)!;
    const original = getMockStore().stage_definition.filter(row => row.pipeline_id === pipeline.id);
    const added = await addStageAction({ pipelineId: pipeline.id, name: "Readiness check", position: 2 });
    expect(added.resultCode).toBe(201);
    const id = added.data!.id;
    expect((await moveStageAction({ stageId: id, direction: "down" })).resultCode).toBe(200);
    expect((await renameStageAction({ stageId: id, name: "Readiness review" })).resultCode).toBe(200);
    expect((await removeStageAction({ stageId: id })).resultCode).toBe(200);
    const rows = getMockStore().stage_definition.filter(row => row.pipeline_id === pipeline.id && !row.is_deleted).sort((a, b) => a.step_no - b.step_no);
    expect(rows.map(row => row.step_no)).toEqual(original.map((_, index) => index + 1));
    expect(getMockStore().stage_definition.find(row => row.id === id)).toMatchObject({ is_deleted: true, name: "Readiness review" });
    expect(getMockStore().audit_logs.filter(row => row.entity_type === "stage_definition" && row.entity_id === id).length).toBeGreaterThanOrEqual(3);
    expect((await addStageAction({ pipelineId: pipeline.id, name: "Follow-up one", position: rows.length + 1 })).resultCode).toBe(201);
    expect((await addStageAction({ pipelineId: pipeline.id, name: "Follow-up two", position: rows.length + 2 })).resultCode).toBe(201);
    const stepNumbers = getMockStore().stage_definition.filter(row => row.pipeline_id === pipeline.id).map(row => row.step_no);
    expect(new Set(stepNumbers).size).toBe(stepNumbers.length);
  });

  it("creates the Leadership pipeline once and rejects duplicates", async () => {
    expect((await createPipelineAction({ pillarId: 4, name: "Women in leadership pathway", firstStage: "Mobilisation", lastStage: "Graduation" })).resultCode).toBe(201);
    expect((await createPipelineAction({ pillarId: 4, name: "Another", firstStage: "Start", lastStage: "Finish" })).resultCode).toBe(422);
    const pipeline = getMockStore().pipeline_definition.find(row => row.pillar_id === 4)!;
    expect(getMockStore().stage_definition.filter(row => row.pipeline_id === pipeline.id).map(row => row.step_no)).toEqual([1, 2]);
  });

  it("enforces pillar scope and rejects forged direct handler mutations", async () => {
    const pipeline = getMockStore().pipeline_definition.find(row => row.pillar_id === 2)!;
    actor.id = 3; actor.token = issueMockToken(3);
    expect((await addStageAction({ pipelineId: pipeline.id, name: "Forged", position: 1 })).resultCode).toBe(403);
    const direct = await handleMockRequest({ method: "PATCH", path: `/admin/pipelines/${pipeline.id}`, routeTemplate: "/admin/pipelines/:id", token: actor.token, correlationId: "test", query: { operation: "stage" }, body: { action: "add", name: "Forged", position: 1 } });
    expect(direct.resultCode).toBe(403);
  });

  it("uses a scoped configuration grant for only that pillar", async () => {
    const store = getMockStore();
    store.user[12].status = "ACTIVE";
    store.role.push({ ...store.role[2], id: 100, code: "PIPELINE_OPERATOR", is_system_role: false });
    store.role_permission.push({ ...store.role_permission[0], id: 10000, role_id: 100, permission_id: store.permission.find(row => row.code === "PILLAR_CONFIG_MANAGE")!.id });
    store.user_role.push({ ...store.user_role[0], id: 10000, role_id: 100, user_id: 13, pillar_id: 2 });
    actor.id = 13; actor.token = issueMockToken(13);
    const wee = store.pipeline_definition.find(row => row.pillar_id === 2)!;
    const vawg = store.pipeline_definition.find(row => row.pillar_id === 1)!;
    expect((await addStageAction({ pipelineId: wee.id, name: "Scoped stage", position: 1 })).resultCode).toBe(201);
    expect((await addStageAction({ pipelineId: vawg.id, name: "Other pillar", position: 1 })).resultCode).toBe(403);
    const pipelines = await handleMockRequest({ method: "GET", path: "/admin/pipelines", routeTemplate: "/admin/pipelines", token: actor.token, correlationId: "scope" });
    expect((pipelines.data as { items: { pillar_id: number }[] }).items.every(row => row.pillar_id === 2)).toBe(true);
  });

  it("keeps historical stage references reviewable after stage removal", async () => {
    const store = getMockStore();
    const event = store.participant_stage_event.find(row => row.stage_event_status === "recorded")!;
    const historicalId = event.stage_definition_id;
    expect((await removeStageAction({ stageId: historicalId })).resultCode).toBe(200);
    expect((await reviewSubmissionAction(event.id, "approve")).success).toBe(true);
    expect(event.stage_event_status).toBe("verified");
    const forged = await handleMockRequest({ method: "PATCH", path: `/field-submissions/${event.id}`, routeTemplate: "/field-submissions/:id", token: actor.token, correlationId: "inactive", body: { stage_definition_id: event.stage_definition_id } });
    expect(forged.resultCode).toBe(200);
    const activeStage = store.stage_definition.find(row => row.pipeline_id === store.stage_definition.find(stage => stage.id === historicalId)!.pipeline_id && !row.is_deleted)!;
    const request = (stageId: number) => handleMockRequest({ method: "PATCH", path: `/field-submissions/${event.id}`, routeTemplate: "/field-submissions/:id", token: actor.token, correlationId: "stage-reassign", body: { stage_definition_id: stageId } });
    expect((await request(activeStage.id)).resultCode).toBe(200);
    expect((await request(historicalId)).resultCode).toBe(422);
  });

  it("blocks generic pillar-route mutations of pipeline and stages", async () => {
    const store = getMockStore();
    const pipeline = store.pipeline_definition.find(row => row.pillar_id === 2)!;
    const stages = store.stage_definition.filter(row => row.pipeline_id === pipeline.id).sort((a, b) => a.step_no - b.step_no);
    for (const [table, id, body] of [["stage_definition", stages[0].id, { step_no: 99 }], ["stage_definition", stages.at(-1)!.id, { is_deleted: true }], ["pipeline_definition", pipeline.id, { name: "Bypassed" }]] as const) {
      const response = await handleMockRequest({ method: "PATCH", path: "/pillars/wee", routeTemplate: "/pillars/:pillar", token: actor.token, correlationId: "bypass", query: { table, id }, body });
      expect(response.resultCode).toBe(422);
    }
    expect(stages[0].step_no).toBe(1);
    expect(stages.at(-1)!.is_deleted).toBe(false);
    expect(pipeline.name).not.toBe("Bypassed");
  });

  it("loads all pipeline and stage pages for a 101st-row action and end insertion", async () => {
    const store = getMockStore();
    const basePillar = store.pillar.find(row => row.id === 2)!;
    const basePipeline = store.pipeline_definition.find(row => row.pillar_id === 2)!;
    for (let index = 0; index < 100; index++) {
      const pillarId = 1000 + index;
      store.pillar.push({ ...basePillar, id: pillarId, code: `TEST_${index}`, name: `Test ${index}` });
      store.pipeline_definition.push({ ...basePipeline, id: pillarId, pillar_id: pillarId, name: `Pipeline ${index}` });
    }
    const lastPipeline = store.pipeline_definition.at(-1)!;
    const baseStage = store.stage_definition.find(row => row.pipeline_id === basePipeline.id)!;
    for (let index = 0; index < 101; index++) store.stage_definition.push({ ...baseStage, id: 2000 + index, pipeline_id: lastPipeline.id, step_no: index + 1, name: `Stage ${index}` });
    const api = createAdminApi(createPortalApiClient(), actor.token);
    expect((await api.allPipelines()).some(row => row.id === lastPipeline.id)).toBe(true);
    expect(await api.allStages(lastPipeline.id)).toHaveLength(101);
    expect((await addStageAction({ pipelineId: lastPipeline.id, name: "At the end", position: 102 })).resultCode).toBe(201);
    expect((await renameStageAction({ stageId: 2100, name: "Last stage renamed" })).resultCode).toBe(200);
  });
});
