import { beforeEach, describe, expect, it, vi } from "vitest";
const actor = vi.hoisted(() => ({ id: 1, token: "" }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: actor.token }) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session-server", () => ({ requireSession: async () => ({ user: { id: actor.id }, grants: (await import("@/lib/auth/permissions")).getEffectiveGrants(actor.id) }) }));
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { addStageAction, createPipelineAction, moveStageAction, removeStageAction, renameStageAction } from "./pipeline-actions";

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
});
