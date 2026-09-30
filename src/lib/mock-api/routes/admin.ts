import { hasPermission, hasModulePermission } from "../../auth/permissions";
import { auditWrite } from "../audit";
import { type MockContext } from "../context";
import { envelope, masked, type Row, isStrictGet } from "../core";
import { makeRow } from "../rows";
import { type ApiEnvelope } from "@/types/api";
import type { MockStore } from "@/types/db";

type Envelope = ApiEnvelope<unknown>;
type Body = Record<string, unknown>;
type Stage = MockStore["stage_definition"][number];

const isActive = (row: { is_deleted: boolean; status: string }) =>
  !row.is_deleted && row.status === "ACTIVE";
const pillarOption = (row: MockStore["pillar"][number]) => ({
  id: row.id,
  name: row.name,
  code: row.code,
});
const nextId = (rows: { id: number }[]) => Math.max(0, ...rows.map((row) => row.id)) + 1;

/** A plain JSON object body, or null. */
const objectBody = (value: unknown): Body | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Body) : null;

/** The body has exactly these keys, no more and no fewer. */
const hasExactKeys = (body: Body, keys: string[]) =>
  Object.keys(body).sort().join() === [...keys].sort().join();

/** Stage and pipeline names are 2–160 characters once trimmed. */
const isValidName = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length >= 2 && value.length <= 160;

/** Another active stage in the pipeline already uses this name (case-insensitive). */
const nameTaken = (stages: Stage[], name: string, exceptId?: number) =>
  stages.some((row) => row.id !== exceptId && row.name.toLowerCase() === name.trim().toLowerCase());

/** Pillars for the user-role scope picker. */
function pillarCatalog({ request, store, query, grants }: MockContext): Envelope {
  if (!isStrictGet(request, query, ["catalog"])) return envelope(422);
  if (!hasPermission(grants, "ROLE_MANAGE")) return envelope(403);
  return envelope(200, store.pillar.filter(isActive).map(pillarOption));
}

/** Pillars whose pipelines the caller may configure. */
function pipelineCatalog({ request, store, query, grants }: MockContext): Envelope {
  if (!isStrictGet(request, query, ["catalog"])) return envelope(422);
  if (!hasModulePermission(grants, "PILLAR_CONFIG_MANAGE")) return envelope(403);
  return envelope(
    200,
    store.pillar
      .filter(
        (row) =>
          isActive(row) && hasPermission(grants, "PILLAR_CONFIG_MANAGE", { pillarId: row.id })
      )
      .map(pillarOption)
  );
}

/** Creates a pillar's only pipeline with its first and last stages. */
function createPipeline({ request, store, userId, grants }: MockContext): Envelope {
  const body = objectBody(request.body);
  if (
    !body ||
    !hasExactKeys(body, ["first_stage", "last_stage", "name", "pillar_id"]) ||
    !Number.isSafeInteger(body.pillar_id) ||
    !isValidName(body.name) ||
    !isValidName(body.first_stage) ||
    !isValidName(body.last_stage) ||
    body.first_stage.toLowerCase() === body.last_stage.toLowerCase()
  )
    return envelope(422);
  const pillar = store.pillar.find((row) => row.id === body.pillar_id && isActive(row));
  if (!pillar) return envelope(422);
  if (!hasPermission(grants, "PILLAR_CONFIG_MANAGE", { pillarId: pillar.id })) return envelope(403);
  if (store.pipeline_definition.some((row) => row.pillar_id === pillar.id && !row.is_deleted))
    return envelope(422, null, "A pipeline already exists for this pillar");

  const now = new Date().toISOString();
  const pipeline = makeRow(
    "pipeline_definition",
    { pillar_id: pillar.id, name: body.name.trim() },
    nextId(store.pipeline_definition),
    now
  );
  const firstId = nextId(store.stage_definition);
  const first = makeRow(
    "stage_definition",
    { pipeline_id: pipeline.id, step_no: 1, name: body.first_stage.trim() },
    firstId,
    now
  );
  const last = makeRow(
    "stage_definition",
    { pipeline_id: pipeline.id, step_no: 2, name: body.last_stage.trim() },
    firstId + 1,
    now
  );
  store.pipeline_definition.push(pipeline);
  store.stage_definition.push(first, last);
  auditWrite(store, request, userId, "pipeline_definition", null, pipeline as unknown as Row);
  auditWrite(store, request, userId, "stage_definition", null, first as unknown as Row);
  auditWrite(store, request, userId, "stage_definition", null, last as unknown as Row);
  return envelope(201, masked("pipeline_definition", pipeline as unknown as Row));
}

interface StageCommand {
  store: MockStore;
  pipelineId: number;
  body: Body;
  /** Active stages in step order; actions reorder this list in place. */
  stages: Stage[];
  /** The stage named by `stageId`, if any. */
  stage: Stage | undefined;
  /** Snapshots of rows before this command changed them, for the audit trail. */
  changes: Map<number, Row>;
  now: string;
}

/** Each action returns the stage it acted on, or an error envelope. */
const stageActions: Record<string, (cmd: StageCommand) => Stage | Envelope> = {
  add({ store, pipelineId, body, stages, now }) {
    const position = Number(body.position);
    if (
      !hasExactKeys(body, ["action", "name", "position"]) ||
      !isValidName(body.name) ||
      !Number.isSafeInteger(body.position) ||
      position < 1 ||
      position > stages.length + 1
    )
      return envelope(422);
    if (nameTaken(stages, body.name)) return envelope(422, null, "Stage name already exists");
    const stage = makeRow(
      "stage_definition",
      { pipeline_id: pipelineId, step_no: position, name: body.name.trim() },
      nextId(store.stage_definition),
      now
    );
    stages.splice(position - 1, 0, stage);
    return stage;
  },
  rename({ body, stages, stage, changes }) {
    if (
      !hasExactKeys(body, ["action", "name", "stageId"]) ||
      !stage ||
      !isValidName(body.name) ||
      nameTaken(stages, body.name, stage.id)
    )
      return envelope(422);
    changes.set(stage.id, structuredClone(stage as unknown as Row));
    stage.name = body.name.trim();
    return stage;
  },
  move({ body, stages, stage }) {
    if (
      !hasExactKeys(body, ["action", "direction", "stageId"]) ||
      !stage ||
      !["up", "down"].includes(String(body.direction))
    )
      return envelope(422);
    const from = stages.indexOf(stage);
    const to = from + (body.direction === "up" ? -1 : 1);
    if (to < 0 || to >= stages.length) return envelope(422, null, "Stage is already at the edge");
    stages.splice(from, 1);
    stages.splice(to, 0, stage);
    return stage;
  },
  remove({ body, stages, stage, changes }) {
    if (!hasExactKeys(body, ["action", "stageId"]) || !stage || stages.length <= 1)
      return envelope(422);
    changes.set(stage.id, structuredClone(stage as unknown as Row));
    stages.splice(stages.indexOf(stage), 1);
    stage.is_deleted = true;
    stage.status = "INACTIVE";
    // The SQL unique key includes soft-removed rows. Reserve a stable negative
    // number for history so future active steps can reuse the positive range.
    stage.step_no = -stage.id;
    return stage;
  },
};

/** Gives the remaining stages continuous step numbers 1..n, recording what moved. */
function renumber({ stages, changes }: StageCommand) {
  for (const [index, row] of stages.entries())
    if (row.step_no !== index + 1) {
      if (!changes.has(row.id)) changes.set(row.id, structuredClone(row as unknown as Row));
      row.step_no = index + 1;
    }
}

/** PATCH /admin/pipelines/:id?operation=stage — add, rename, move or remove one stage atomically. */
function stageCommand({ request, store, query, parts, userId, grants }: MockContext): Envelope {
  if (query.get("operation") !== "stage" || query.size !== 1 || !/^\d+$/.test(parts[2]))
    return envelope(422);
  const pipeline = store.pipeline_definition.find(
    (row) => row.id === Number(parts[2]) && isActive(row)
  );
  if (!pipeline) return envelope(404);
  if (!hasPermission(grants, "PILLAR_CONFIG_MANAGE", { pillarId: pipeline.pillar_id }))
    return envelope(403);
  const body = objectBody(request.body);
  if (!body || typeof body.action !== "string") return envelope(422);
  const action = stageActions[body.action];
  if (!action) return envelope(422);

  const stages = store.stage_definition
    .filter((row) => row.pipeline_id === pipeline.id && !row.is_deleted)
    .sort((a, b) => a.step_no - b.step_no);
  const cmd: StageCommand = {
    store,
    pipelineId: pipeline.id,
    body,
    stages,
    stage: stages.find((row) => row.id === body.stageId),
    changes: new Map(),
    now: new Date().toISOString(),
  };
  const target = action(cmd);
  if ("resultCode" in target) return target;
  renumber(cmd);

  const adding = body.action === "add";
  if (adding) {
    store.stage_definition.push(target);
    auditWrite(store, request, userId, "stage_definition", null, target as unknown as Row);
  }
  for (const [id, before] of cmd.changes) {
    const row = store.stage_definition.find((item) => item.id === id)!;
    row.updated_at = cmd.now;
    auditWrite(store, request, userId, "stage_definition", before, row as unknown as Row);
  }
  return envelope(adding ? 201 : 200, masked("stage_definition", target as unknown as Row));
}

/** Admin catalogues and the guarded pipeline/stage commands; undefined for other routes. */
export function handleAdminCommands(ctx: MockContext): Envelope | undefined {
  const { request, url, query, parts } = ctx;
  if (url.pathname === "/admin/users" && query.get("catalog") === "pillars")
    return pillarCatalog(ctx);
  if (url.pathname === "/admin/pipelines" && query.get("catalog") === "pillars")
    return pipelineCatalog(ctx);
  if (url.pathname === "/admin/pipelines" && request.method === "POST") return createPipeline(ctx);
  if (parts[0] === "admin" && parts[1] === "pipelines" && parts[2] && request.method === "PATCH")
    return stageCommand(ctx);
  return undefined;
}
