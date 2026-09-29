import { hasPermission } from "../../auth/permissions";
import { auditWrite } from "../audit";
import { type MockContext } from "../context";
import { envelope, masked, type Row } from "../core";
import { makeRow } from "../rows";
import { type ApiEnvelope } from "@/types/api";

/** Admin catalogues and the guarded pipeline/stage commands. */
export function handleAdminCommands(ctx: MockContext): ApiEnvelope<unknown> | undefined {
  const { request, store, url, query, parts, userId, grants } = ctx;
  if (url.pathname === "/admin/users" && query.get("catalog") === "pillars") {
    if (request.method !== "GET" || [...query.keys()].some((key) => key !== "catalog"))
      return envelope(422);
    if (!hasPermission(grants, "ROLE_MANAGE")) return envelope(403);
    return envelope(
      200,
      store.pillar
        .filter((row) => !row.is_deleted && row.status === "ACTIVE")
        .map((row) => ({ id: row.id, name: row.name, code: row.code }))
    );
  }
  if (url.pathname === "/admin/pipelines" && query.get("catalog") === "pillars") {
    if (request.method !== "GET" || [...query.keys()].some((key) => key !== "catalog"))
      return envelope(422);
    if (!grants.some((grant) => grant.permissionCode === "PILLAR_CONFIG_MANAGE"))
      return envelope(403);
    return envelope(
      200,
      store.pillar
        .filter(
          (row) =>
            !row.is_deleted &&
            row.status === "ACTIVE" &&
            hasPermission(grants, "PILLAR_CONFIG_MANAGE", { pillarId: row.id })
        )
        .map((row) => ({ id: row.id, name: row.name, code: row.code }))
    );
  }
  if (url.pathname === "/admin/pipelines" && request.method === "POST") {
    const body = request.body as Record<string, unknown> | null;
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).sort().join() !==
        ["first_stage", "last_stage", "name", "pillar_id"].join() ||
      !Number.isSafeInteger(body.pillar_id) ||
      typeof body.name !== "string" ||
      typeof body.first_stage !== "string" ||
      typeof body.last_stage !== "string" ||
      ![body.name, body.first_stage, body.last_stage].every(
        (value) => (value as string).trim().length >= 2 && (value as string).length <= 160
      ) ||
      body.first_stage.toLowerCase() === body.last_stage.toLowerCase()
    )
      return envelope(422);
    const pillar = store.pillar.find(
      (row) => row.id === body.pillar_id && !row.is_deleted && row.status === "ACTIVE"
    );
    if (!pillar) return envelope(422);
    if (!hasPermission(grants, "PILLAR_CONFIG_MANAGE", { pillarId: pillar.id }))
      return envelope(403);
    if (store.pipeline_definition.some((row) => row.pillar_id === pillar.id && !row.is_deleted))
      return envelope(422, null, "A pipeline already exists for this pillar");
    const now = new Date().toISOString();
    const pipeline = makeRow(
      "pipeline_definition",
      { pillar_id: pillar.id, name: body.name.trim() },
      Math.max(0, ...store.pipeline_definition.map((row) => row.id)) + 1,
      now
    );
    const first = makeRow(
      "stage_definition",
      { pipeline_id: pipeline.id, step_no: 1, name: body.first_stage.trim() },
      Math.max(0, ...store.stage_definition.map((row) => row.id)) + 1,
      now
    );
    const last = makeRow(
      "stage_definition",
      { pipeline_id: pipeline.id, step_no: 2, name: body.last_stage.trim() },
      first.id + 1,
      now
    );
    store.pipeline_definition.push(pipeline);
    store.stage_definition.push(first, last);
    auditWrite(store, request, userId, "pipeline_definition", null, pipeline as unknown as Row);
    auditWrite(store, request, userId, "stage_definition", null, first as unknown as Row);
    auditWrite(store, request, userId, "stage_definition", null, last as unknown as Row);
    return envelope(201, masked("pipeline_definition", pipeline as unknown as Row));
  }
  if (parts[0] === "admin" && parts[1] === "pipelines" && parts[2] && request.method === "PATCH") {
    if (query.get("operation") !== "stage" || query.size !== 1 || !/^\d+$/.test(parts[2]))
      return envelope(422);
    const pipeline = store.pipeline_definition.find(
      (row) => row.id === Number(parts[2]) && !row.is_deleted && row.status === "ACTIVE"
    );
    if (!pipeline) return envelope(404);
    if (!hasPermission(grants, "PILLAR_CONFIG_MANAGE", { pillarId: pipeline.pillar_id }))
      return envelope(403);
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.action !== "string")
      return envelope(422);
    const stages = store.stage_definition
      .filter((row) => row.pipeline_id === pipeline.id && !row.is_deleted)
      .sort((a, b) => a.step_no - b.step_no);
    const stage = stages.find((row) => row.id === body.stageId);
    const now = new Date().toISOString();
    const changes = new Map<number, Row>();
    let target: (typeof stages)[number] | undefined;
    if (body.action === "add") {
      if (
        Object.keys(body).sort().join() !== ["action", "name", "position"].join() ||
        typeof body.name !== "string" ||
        body.name.trim().length < 2 ||
        body.name.length > 160 ||
        !Number.isSafeInteger(body.position) ||
        Number(body.position) < 1 ||
        Number(body.position) > stages.length + 1
      )
        return envelope(422);
      if (
        stages.some((row) => row.name.toLowerCase() === body.name!.toString().trim().toLowerCase())
      )
        return envelope(422, null, "Stage name already exists");
      target = makeRow(
        "stage_definition",
        { pipeline_id: pipeline.id, step_no: Number(body.position), name: body.name.trim() },
        Math.max(0, ...store.stage_definition.map((row) => row.id)) + 1,
        now
      );
      stages.splice(Number(body.position) - 1, 0, target);
    } else if (body.action === "rename") {
      if (
        Object.keys(body).sort().join() !== ["action", "name", "stageId"].join() ||
        !stage ||
        typeof body.name !== "string" ||
        body.name.trim().length < 2 ||
        body.name.length > 160 ||
        stages.some(
          (row) =>
            row.id !== stage.id &&
            row.name.toLowerCase() === body.name!.toString().trim().toLowerCase()
        )
      )
        return envelope(422);
      changes.set(stage.id, structuredClone(stage as unknown as Row));
      stage.name = body.name.trim();
      target = stage;
    } else if (body.action === "move") {
      if (
        Object.keys(body).sort().join() !== ["action", "direction", "stageId"].join() ||
        !stage ||
        !["up", "down"].includes(String(body.direction))
      )
        return envelope(422);
      const from = stages.indexOf(stage),
        to = from + (body.direction === "up" ? -1 : 1);
      if (to < 0 || to >= stages.length) return envelope(422, null, "Stage is already at the edge");
      stages.splice(from, 1);
      stages.splice(to, 0, stage);
      target = stage;
    } else if (body.action === "remove") {
      if (
        Object.keys(body).sort().join() !== ["action", "stageId"].join() ||
        !stage ||
        stages.length <= 1
      )
        return envelope(422);
      changes.set(stage.id, structuredClone(stage as unknown as Row));
      stages.splice(stages.indexOf(stage), 1);
      stage.is_deleted = true;
      stage.status = "INACTIVE";
      // The SQL unique key includes soft-removed rows. Reserve a stable negative
      // number for history so future active steps can reuse the positive range.
      stage.step_no = -stage.id;
      target = stage;
    } else return envelope(422);
    for (const [index, row] of stages.entries())
      if (row.step_no !== index + 1) {
        if (!changes.has(row.id)) changes.set(row.id, structuredClone(row as unknown as Row));
        row.step_no = index + 1;
      }
    if (body.action === "add") {
      store.stage_definition.push(target!);
      auditWrite(store, request, userId, "stage_definition", null, target as unknown as Row);
    }
    for (const [id, before] of changes) {
      const row = store.stage_definition.find((item) => item.id === id)!;
      row.updated_at = now;
      auditWrite(store, request, userId, "stage_definition", before, row as unknown as Row);
    }
    return envelope(
      body.action === "add" ? 201 : 200,
      masked("stage_definition", target as unknown as Row)
    );
  }
  return undefined;
}
