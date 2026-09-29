import { hasPermission } from "../../auth/permissions";
import { isSensitiveField } from "../../sensitive-fields";
import { auditWrite } from "../audit";
import { type ResourceContext } from "../context";
import {
  allowed,
  enrollmentRead,
  envelope,
  masked,
  referralRead,
  scopes,
  submissionSummary,
  type Row,
  visible,
} from "../core";
import { signoffActors } from "../reporting";
import { makeRow } from "../rows";
import { tableDefinitions } from "../schema";
import { filterSubmissionRows } from "@/features/submissions/filter";
import { type ApiEnvelope, type PaginatedData } from "@/types/api";

/** Serves `GET` for a resolved resource: single rows, related views and paginated lists. */
export function readResource(ctx: ResourceContext): ApiEnvelope<unknown> {
  const {
    request,
    store,
    query,
    userId,
    grants,
    family,
    pillar,
    table,
    id,
    rows,
    existing,
    permission,
  } = ctx;
  if (table === "grant_application" && existing && query.get("signoffs") === "true") {
    if (!allowed(store, grants, "GRANT_APPLICATION_VIEW", table, existing)) return envelope(403);
    return envelope(200, signoffActors(store, existing.id));
  }
  if (table === "grant_application" && existing && query.get("pack") === "true") {
    if (
      !allowed(store, grants, "GRANT_APPLICATION_VIEW", table, existing) ||
      !allowed(store, grants, "DOCUMENT_DOWNLOAD", table, existing)
    )
      return envelope(403);
    auditWrite(store, request, userId, table, existing, existing, "DOWNLOAD");
    return envelope(
      200,
      { application_id: existing.id, simulated: true },
      "Mock application pack metadata only"
    );
  }
  if (table === "referral" && id === undefined && query.has("catalog")) {
    if (query.get("catalog") !== "destinations") return envelope(422);
    if (!grants.some((grant) => grant.permissionCode === "REFERRAL_CREATE")) return envelope(403);
    return envelope(200, {
      internalPillarIds: [
        ...new Set(store.project.filter((item) => !item.is_deleted).map((item) => item.pillar_id)),
      ],
      partnerInstitutions: store.partner_institution
        .filter((item) => !item.is_deleted)
        .map((item) => ({ id: item.id, name: item.name })),
    });
  }
  if (existing) {
    if (!allowed(store, grants, permission, table, existing)) return envelope(403);
    const result =
      table === "referral"
        ? referralRead(store, existing)
        : table === "enrollment"
          ? enrollmentRead(store, existing)
          : masked(table, existing);
    if (query.has("reveal")) {
      const field = query.get("reveal")!;
      if (!isSensitiveField(table, field) || field === "password_hash") return envelope(422);
      if (
        !allowed(store, grants, "SENSITIVE_REVEAL", table, existing) ||
        (pillar && !hasPermission(grants, "SENSITIVE_REVEAL", { pillarId: pillar.id }))
      )
        return envelope(403);
      result[field] = existing[field];
      auditWrite(store, request, userId, table, existing, existing, "REVEAL");
    }
    if (query.has("download")) {
      if (table !== "document" || query.get("download") !== "true") return envelope(422);
      if (!allowed(store, grants, "DOCUMENT_DOWNLOAD", table, existing)) return envelope(403);
      auditWrite(store, request, userId, table, existing, existing, "DOWNLOAD");
      return envelope(
        200,
        { ...result, file_url: existing.file_url, simulated: true },
        "Mock metadata only; no remote file was uploaded or downloaded"
      );
    }
    return envelope(200, result);
  }
  const page = Number(query.get("page") ?? 1),
    pageSize = Number(query.get("pageSize") ?? 20);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  )
    return envelope(422);
  const pillarFilter =
    pillar?.id ?? (query.has("pillarId") ? Number(query.get("pillarId")) : undefined);
  if (pillarFilter !== undefined && (!Number.isInteger(pillarFilter) || pillarFilter < 1))
    return envelope(422);
  const search = (query.get("search") ?? query.get("q") ?? "").toLowerCase();
  const countyId = query.has("countyId") ? Number(query.get("countyId")) : undefined;
  if (
    countyId !== undefined &&
    (table !== "participant" || !Number.isSafeInteger(countyId) || countyId < 1)
  )
    return envelope(422);
  const reserved = new Set([
    "page",
    "pageSize",
    "pillarId",
    "countyId",
    "table",
    "search",
    "q",
    "sortBy",
    "sortOrder",
    "format",
    "includeDeleted",
    "ids",
  ]);
  if (
    query.has("ids") &&
    (family !== "lookups" ||
      query.get("format") !== "csv" ||
      !/^(?:[1-9]\d*(?:,[1-9]\d*)*)?$/.test(query.get("ids") ?? ""))
  )
    return envelope(422);
  const exportIds = query.has("ids")
    ? query.get("ids")
      ? query.get("ids")!.split(",").map(Number)
      : []
    : null;
  if (
    exportIds &&
    (exportIds.length > 5000 || exportIds.some((value) => !Number.isSafeInteger(value)))
  )
    return envelope(422);
  if (
    query.has("includeDeleted") &&
    (!(
      table === "user_role" ||
      table === "role_permission" ||
      (family === "lookups" && hasPermission(grants, "LOOKUP_MANAGE"))
    ) ||
      query.get("includeDeleted") !== "true")
  )
    return envelope(422);
  for (const [key] of query)
    if (
      !reserved.has(key) &&
      (!Object.hasOwn(tableDefinitions[table], key) || isSensitiveField(table, key))
    )
      return envelope(422);
  let filtered = rows.filter(
    (row) =>
      (visible(row) || query.get("includeDeleted") === "true") &&
      allowed(store, grants, permission, table, row) &&
      (pillarFilter === undefined || scopes(store, table, row).includes(pillarFilter))
  );
  if (countyId !== undefined)
    filtered = filtered.filter((row) => {
      const ward = store.ward.find((item) => item.id === row.ward_id);
      return store.sub_county.some(
        (item) => item.id === ward?.sub_county_id && item.county_id === countyId
      );
    });
  for (const [key, value] of query)
    if (!reserved.has(key)) filtered = filtered.filter((row) => String(row[key]) === value);
  if (exportIds) {
    const selected = new Set(exportIds);
    filtered = filtered.filter((row) => selected.has(row.id));
  }
  // Search uses the visible representation so it cannot become an oracle for
  // masked identity numbers or other hidden data.
  if (search)
    filtered = filtered.filter((row) =>
      table === "participant_stage_event"
        ? filterSubmissionRows([submissionSummary(store, row)], { search }).length > 0
        : Object.values(masked(table, row)).some(
            (value) => typeof value === "string" && value.toLowerCase().includes(search)
          )
    );
  const sortBy = query.get("sortBy") ?? "id",
    sortOrder = query.get("sortOrder") ?? "asc";
  if (
    !Object.hasOwn(tableDefinitions[table], sortBy) ||
    !["asc", "desc"].includes(sortOrder) ||
    isSensitiveField(table, sortBy)
  )
    return envelope(422);
  filtered.sort(
    (a, b) =>
      (typeof a[sortBy] === "number" && typeof b[sortBy] === "number"
        ? Number(a[sortBy]) - Number(b[sortBy])
        : String(a[sortBy] ?? "").localeCompare(String(b[sortBy] ?? ""))) *
      (sortOrder === "desc" ? -1 : 1)
  );
  if (query.has("format")) {
    if (query.get("format") !== "csv") return envelope(422);
    if (
      (family === "lookups" && !hasPermission(grants, "LOOKUP_MANAGE")) ||
      !grants.some((grant) => grant.permissionCode === "REPORT_EXPORT_CSV") ||
      (pillar && !hasPermission(grants, "REPORT_EXPORT_CSV", { pillarId: pillar.id })) ||
      filtered.some((row) => !allowed(store, grants, "REPORT_EXPORT_CSV", table, row))
    )
      return envelope(403);
    const columns =
      table === "participant_stage_event"
        ? ["id", "pillar", "captured", "status", "source"]
        : Object.keys(tableDefinitions[table]).filter((key) => key !== "password_hash");
    const csvCell = (value: unknown) => {
      const text =
        value === null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
      return '"' + (/^[=+\-@\t\r\n]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"';
    };
    const content = [
      columns.join(","),
      ...filtered.map((row) => {
        const safe =
          table === "participant_stage_event"
            ? (() => {
                const summary = submissionSummary(store, row);
                return {
                  id: summary.id,
                  pillar: summary.pillar,
                  captured: summary.captured,
                  status: summary.status,
                  source: summary.source,
                };
              })()
            : masked(table, row);
        return columns.map((key) => csvCell(safe[key as keyof typeof safe])).join(",");
      }),
    ].join("\r\n");
    const now = new Date().toISOString();
    store.audit_logs.push(
      makeRow(
        "audit_logs",
        {
          entity_type: table,
          action: "EXPORT",
          source: "HTTP",
          performed_by: userId,
          performed_at: now,
          endpoint: request.routeTemplate,
        },
        Math.max(0, ...store.audit_logs.map((row) => row.id)) + 1,
        now
      )
    );
    return envelope(200, { filename: `${table}.csv`, content, totalItems: filtered.length });
  }
  const data: PaginatedData<Row> = {
    items: filtered
      .slice((page - 1) * pageSize, page * pageSize)
      .map((row) =>
        table === "referral"
          ? referralRead(store, row)
          : table === "enrollment"
            ? enrollmentRead(store, row)
            : masked(table, row)
      ),
    page,
    pageSize,
    totalItems: filtered.length,
    totalPages: Math.ceil(filtered.length / pageSize),
  };
  return envelope(200, data);
}
