"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session-server";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { createAdminApi } from "./api";
import { pipelineInputSchema, stageAddSchema, stageMoveSchema, stageRemoveSchema, stageRenameSchema } from "./schemas";

const result = (resultCode: number, message: string, id?: number) => ({ resultCode, success: resultCode < 400, message, data: id ? { id } : null });
async function api() { const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value; if (!token) throw new Error("Sign in required"); return createAdminApi(createPortalApiClient(), token); }
async function stageContext(stageId: number) {
  const client = await api();
  const stageResponse = await client.stage(stageId);
  if (!stageResponse.success || !stageResponse.data) return null;
  const pipelineResponse = await client.pipeline(stageResponse.data.pipeline_id);
  return pipelineResponse.success && pipelineResponse.data ? { client, pipeline: pipelineResponse.data, stage: stageResponse.data } : null;
}
function refresh() { revalidatePath("/admin/pipelines"); }
export async function createPipelineAction(input: unknown) {
  const session = await requireSession();
  const parsed = pipelineInputSchema.safeParse(input);
  if (!parsed.success) return result(422, "Check pipeline details");
  if (!hasPermission(session.grants, "PILLAR_CONFIG_MANAGE", { pillarId: parsed.data.pillarId })) return result(403, "Permission denied");
  try { const response = await (await api()).createPipeline({ pillar_id: parsed.data.pillarId, name: parsed.data.name, first_stage: parsed.data.firstStage, last_stage: parsed.data.lastStage }); if (response.success) refresh(); return result(response.resultCode, response.message, response.data?.id); }
  catch { return result(500, "Could not create pipeline"); }
}
export async function addStageAction(input: unknown) {
  const session = await requireSession(); const parsed = stageAddSchema.safeParse(input);
  if (!parsed.success) return result(422, "Check stage details");
  if (!hasModulePermission(session.grants, "PILLAR_CONFIG_MANAGE")) return result(403, "Permission denied");
  try { const client = await api(); const pipelineResponse = await client.pipeline(parsed.data.pipelineId); const pipeline = pipelineResponse.data; if (!pipelineResponse.success || !pipeline || !hasPermission(session.grants, "PILLAR_CONFIG_MANAGE", { pillarId: pipeline.pillar_id })) return result(403, "Permission denied");
    const response = await client.stageCommand(pipeline.id, { action: "add", name: parsed.data.name, position: parsed.data.position }); if (response.success) refresh(); return result(response.resultCode, response.message, response.data?.id); }
  catch { return result(500, "Could not add stage"); }
}
async function changeStage(input: unknown, schema: typeof stageRenameSchema | typeof stageMoveSchema | typeof stageRemoveSchema, command: "rename" | "move" | "remove") {
  const session = await requireSession(); const parsed = schema.safeParse(input);
  if (!parsed.success) return result(422, "Check stage details");
  if (!hasModulePermission(session.grants, "PILLAR_CONFIG_MANAGE")) return result(403, "Permission denied");
  try { const context = await stageContext(parsed.data.stageId); if (!context || !hasPermission(session.grants, "PILLAR_CONFIG_MANAGE", { pillarId: context.pipeline.pillar_id })) return result(403, "Permission denied");
    const values = parsed.data as { stageId: number; name?: string; direction?: "up" | "down" };
    const response = await context.client.stageCommand(context.pipeline.id, { action: command, stageId: values.stageId, ...(command === "rename" ? { name: values.name } : {}), ...(command === "move" ? { direction: values.direction } : {}) });
    if (response.success) refresh(); return result(response.resultCode, response.message, response.data?.id); }
  catch { return result(500, "Could not update stage"); }
}
export async function renameStageAction(input: unknown) { return changeStage(input, stageRenameSchema, "rename"); }
export async function moveStageAction(input: unknown) { return changeStage(input, stageMoveSchema, "move"); }
export async function removeStageAction(input: unknown) { return changeStage(input, stageRemoveSchema, "remove"); }
