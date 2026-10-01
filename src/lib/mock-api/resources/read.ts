import { hasPermission, hasModulePermission } from "../../auth/permissions";
import { isSensitiveField } from "../../sensitive-fields";
import { auditWrite } from "../audit";
import { type ResourceContext } from "../context";
import {
  allowed,
  rowsFor,
  enrollmentRead,
  envelope,
  masked,
  referralRead,
  scopes,
  submissionSummary,
  type Row,
  visible,
} from "../core";
import { signoffActors, signoffHistory } from "../reporting";
import { makeRow } from "../rows";
import { tableDefinitions } from "../schema";
import { filterSubmissionRows } from "@/features/submissions/filter";
import { type ApiEnvelope, type PaginatedData } from "@/types/api";
import type { MockStore, TableName } from "@/types/db";

type Envelope = ApiEnvelope<unknown>;

/** Query keys the list endpoint interprets itself; any other key filters a column by equality. */
const RESERVED_KEYS = new Set([
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

const fullName = (row: Row | undefined) =>
  row ? [row.first_name, row.last_name].filter(Boolean).join(" ") : null;
const providerName = (store: MockStore, id: unknown) =>
  id ? fullName(rowsFor(store, "external_provider").find((row) => row.id === id)) : null;

/** Derived display-name columns per table; never stored, so writes naming them are rejected. */
const DERIVED_NAME_COLUMNS: Partial<Record<TableName, string[]>> = {
  activity_session: ["facilitator_name", "facilitator_kind"],
  training_enrollment: ["trainer_name"],
  counselling_session: ["counsellor_name"],
  legal_case: ["advocate_name"],
};

/** Read-only display names for the people a record links; names only, never contacts. */
function withNames(store: MockStore, table: TableName, row: Row): Row {
  if (table === "activity_session") {
    const staff = row.facilitator_user_id
      ? fullName(rowsFor(store, "user").find((user) => user.id === row.facilitator_user_id))
      : null;
    return {
      ...row,
      facilitator_name: staff ?? providerName(store, row.facilitator_provider_id),
      facilitator_kind: row.facilitator_user_id
        ? "staff"
        : row.facilitator_provider_id
          ? "provider"
          : null,
    };
  }
  if (table === "training_enrollment")
    return { ...row, trainer_name: providerName(store, row.trainer_provider_id) };
  if (table === "counselling_session")
    return { ...row, counsellor_name: providerName(store, row.counsellor_provider_id) };
  if (table === "legal_case")
    return { ...row, advocate_name: providerName(store, row.advocate_provider_id) };
  return row;
}

/** Rows as the API returns them: referrals and enrollments carry derived fields, all are masked. */
function presentRow(store: MockStore, table: TableName, row: Row): Row {
  if (table === "referral") return referralRead(store, row);
  if (table === "enrollment") return enrollmentRead(store, row);
  return withNames(store, table, masked(table, row));
}

/** Named views that bypass the generic row/list handling; undefined when none applies. */
function readSpecialView(ctx: ResourceContext): Envelope | undefined {
  const { request, store, query, userId, grants, table, id, existing } = ctx;
  if (table === "grant_application" && existing && query.get("signoffs") === "true") {
    if (!allowed(store, grants, "GRANT_APPLICATION_VIEW", table, existing)) return envelope(403);
    return envelope(200, {
      ...signoffActors(store, existing.id),
      history: signoffHistory(store, existing.id),
    });
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
    if (!hasModulePermission(grants, "REFERRAL_CREATE")) return envelope(403);
    return envelope(200, {
      internalPillarIds: [
        ...new Set(store.project.filter((item) => !item.is_deleted).map((item) => item.pillar_id)),
      ],
      partnerInstitutions: store.partner_institution
        .filter((item) => !item.is_deleted)
        .map((item) => ({ id: item.id, name: item.name })),
    });
  }
  if (table === "external_provider" && existing && query.get("include") === "workload") {
    if (!hasPermission(grants, "PROVIDER_MANAGE")) return envelope(403);
    return envelope(200, {
      ...masked(table, existing),
      workload: providerWorkload(store, existing.id),
    });
  }
  return undefined;
}

interface WorkloadItem {
  id: number;
  date: string;
  label: string;
  pillar?: string;
}

/** A group's total and its five newest items. */
function workloadGroup(items: WorkloadItem[]) {
  const recent = [...items].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return { count: items.length, recent };
}

/** Work linked to a provider as counts and short labels; labels never name a participant. */
function providerWorkload(store: MockStore, providerId: number) {
  const sessions = store.activity_session
    .filter((row) => !row.is_deleted && row.facilitator_provider_id === providerId)
    .map((row) => ({
      id: row.id,
      date: row.session_date,
      label:
        store.activity_topic.find((topic) => topic.id === row.activity_topic_id)?.name ??
        row.topic ??
        "Group session",
      pillar: store.pillar.find((item) => item.id === row.pillar_id)?.code.toUpperCase(),
    }));
  const counselling = store.counselling_session
    .filter((row) => !row.is_deleted && row.counsellor_provider_id === providerId)
    .map((row) => ({ id: row.id, date: row.session_date, label: `Session ${row.session_no}` }));
  const trainees = store.training_enrollment
    .filter((row) => !row.is_deleted && row.trainer_provider_id === providerId)
    .map((row) => ({
      id: row.id,
      date: row.start_date ?? row.created_at.slice(0, 10),
      label: `${row.course_name ?? "Course not recorded"} · ${row.training_status}`,
    }));
  const cases = store.legal_case
    .filter((row) => !row.is_deleted && row.advocate_provider_id === providerId)
    .map((row) => ({
      id: row.id,
      date: row.opened_date,
      label: `CRW-VAWG-${String(row.id).padStart(4, "0")} · ${(row.court_status ?? "opened").replaceAll("_", " ")}`,
    }));
  return {
    sessions: workloadGroup(sessions),
    counselling: workloadGroup(counselling),
    trainees: workloadGroup(trainees),
    cases: workloadGroup(cases),
  };
}

/** One row, optionally with an audited reveal of a sensitive field or a document download. */
function readSingle(ctx: ResourceContext, existing: Row): Envelope {
  const { request, store, query, userId, grants, pillar, table, permission } = ctx;
  // Providers have no pillar scope, so a reveal-only caller is judged by the reveal rule below.
  const revealOnly =
    table === "external_provider" && permission === "SENSITIVE_REVEAL" && query.has("reveal");
  if (!revealOnly && !allowed(store, grants, permission, table, existing)) return envelope(403);
  const result = presentRow(store, table, existing);
  if (query.has("reveal")) {
    const field = query.get("reveal")!;
    if (!isSensitiveField(table, field) || field === "password_hash") return envelope(422);
    const mayReveal =
      table === "external_provider"
        ? hasPermission(grants, "PROVIDER_MANAGE") ||
          hasModulePermission(grants, "SENSITIVE_REVEAL")
        : allowed(store, grants, "SENSITIVE_REVEAL", table, existing) &&
          !(pillar && !hasPermission(grants, "SENSITIVE_REVEAL", { pillarId: pillar.id }));
    if (!mayReveal) return envelope(403);
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

interface ListParams {
  page: number;
  pageSize: number;
  pillarFilter: number | undefined;
  search: string;
  countyId: number | undefined;
  /** Rows chosen for a lookup CSV export, or null when not exporting a selection. */
  exportIds: number[] | null;
}

/** Validates paging, filters and export options; a 422 envelope for anything malformed. */
function parseListQuery(ctx: ResourceContext): ListParams | Envelope {
  const { query, grants, family, pillar, table } = ctx;
  const page = Number(query.get("page") ?? 1);
  const pageSize = Number(query.get("pageSize") ?? 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize)) return envelope(422);
  if (pageSize < 1 || pageSize > 100) return envelope(422);

  const pillarFilter =
    pillar?.id ?? (query.has("pillarId") ? Number(query.get("pillarId")) : undefined);
  if (pillarFilter !== undefined && (!Number.isInteger(pillarFilter) || pillarFilter < 1))
    return envelope(422);

  const countyId = query.has("countyId") ? Number(query.get("countyId")) : undefined;
  if (
    countyId !== undefined &&
    (table !== "participant" || !Number.isSafeInteger(countyId) || countyId < 1)
  )
    return envelope(422);

  // `ids` selects rows for a lookup CSV export only.
  if (
    query.has("ids") &&
    (family !== "lookups" ||
      query.get("format") !== "csv" ||
      !/^(?:[1-9]\d*(?:,[1-9]\d*)*)?$/.test(query.get("ids") ?? ""))
  )
    return envelope(422);
  const idsText = query.get("ids");
  const exportIds = query.has("ids") ? (idsText ? idsText.split(",").map(Number) : []) : null;
  if (exportIds && (exportIds.length > 5000 || exportIds.some((v) => !Number.isSafeInteger(v))))
    return envelope(422);

  // Deleted rows are visible only for grant links and to lookup managers.
  const mayIncludeDeleted =
    table === "user_role" ||
    table === "role_permission" ||
    (table === "activity_attendance" &&
      hasPermission(
        grants,
        "ACTIVITY_SESSION_LOG",
        pillar ? { pillarId: pillar.id } : undefined
      )) ||
    (family === "lookups" && hasPermission(grants, "LOOKUP_MANAGE")) ||
    // Session staff need a retired topic or type's name to show and edit old sessions.
    ((table === "activity_topic" || table === "activity_type_definition") &&
      hasModulePermission(grants, "ACTIVITY_SESSION_VIEW"));
  if (query.has("includeDeleted") && (!mayIncludeDeleted || query.get("includeDeleted") !== "true"))
    return envelope(422);

  // Column filters must name a real, non-sensitive column.
  for (const [key] of query)
    if (
      !RESERVED_KEYS.has(key) &&
      (!Object.hasOwn(tableDefinitions[table], key) || isSensitiveField(table, key))
    )
      return envelope(422);

  const search = (query.get("search") ?? query.get("q") ?? "").toLowerCase();
  return { page, pageSize, pillarFilter, search, countyId, exportIds };
}

/** Rows the caller may see after scope, county, column, selection and search filters. */
function filterRows(ctx: ResourceContext, params: ListParams): Row[] {
  const { store, query, grants, table, rows, permission } = ctx;
  const includeDeleted = query.get("includeDeleted") === "true";
  let result = rows.filter(
    (row) =>
      (visible(row) || includeDeleted) &&
      allowed(store, grants, permission, table, row) &&
      (params.pillarFilter === undefined || scopes(store, table, row).includes(params.pillarFilter))
  );
  if (params.countyId !== undefined)
    result = result.filter((row) => {
      const ward = store.ward.find((item) => item.id === row.ward_id);
      return store.sub_county.some(
        (item) => item.id === ward?.sub_county_id && item.county_id === params.countyId
      );
    });
  for (const [key, value] of query)
    if (!RESERVED_KEYS.has(key)) result = result.filter((row) => String(row[key]) === value);
  if (params.exportIds) {
    const selected = new Set(params.exportIds);
    result = result.filter((row) => selected.has(row.id));
  }
  // Search uses the visible representation so it cannot become an oracle for
  // masked identity numbers or other hidden data.
  if (params.search)
    result = result.filter((row) =>
      table === "participant_stage_event"
        ? filterSubmissionRows([submissionSummary(store, row)], { search: params.search }).length >
          0
        : Object.values(masked(table, row)).some(
            (value) => typeof value === "string" && value.toLowerCase().includes(params.search)
          )
    );
  return result;
}

/** Sorts in place by a non-sensitive column; a 422 envelope for an invalid sort. */
function sortRows(ctx: ResourceContext, rows: Row[]): Envelope | undefined {
  const { query, table } = ctx;
  const sortBy = query.get("sortBy") ?? "id";
  const sortOrder = query.get("sortOrder") ?? "asc";
  if (
    !Object.hasOwn(tableDefinitions[table], sortBy) ||
    !["asc", "desc"].includes(sortOrder) ||
    isSensitiveField(table, sortBy)
  )
    return envelope(422);
  const direction = sortOrder === "desc" ? -1 : 1;
  rows.sort(
    (a, b) =>
      (typeof a[sortBy] === "number" && typeof b[sortBy] === "number"
        ? Number(a[sortBy]) - Number(b[sortBy])
        : String(a[sortBy] ?? "").localeCompare(String(b[sortBy] ?? ""))) * direction
  );
  return undefined;
}

/** Quotes a CSV cell and neutralises spreadsheet formulas (=, +, -, @ …). */
function csvCell(value: unknown) {
  const text =
    value === null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return '"' + (/^[=+\-@\t\r\n]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"';
}

/** Audited CSV of the filtered rows, masked the same way as the list. */
function exportCsv(ctx: ResourceContext, rows: Row[]): Envelope {
  const { request, store, query, userId, grants, family, pillar, table } = ctx;
  if (query.get("format") !== "csv") return envelope(422);
  if (
    (family === "lookups" && !hasPermission(grants, "LOOKUP_MANAGE")) ||
    !hasModulePermission(grants, "REPORT_EXPORT_CSV") ||
    (pillar && !hasPermission(grants, "REPORT_EXPORT_CSV", { pillarId: pillar.id })) ||
    rows.some((row) => !allowed(store, grants, "REPORT_EXPORT_CSV", table, row))
  )
    return envelope(403);
  const submissions = table === "participant_stage_event";
  const columns = submissions
    ? ["id", "pillar", "captured", "status", "source"]
    : [
        ...Object.keys(tableDefinitions[table]).filter((key) => key !== "password_hash"),
        ...(DERIVED_NAME_COLUMNS[table] ?? []),
      ];
  const safeRow = (row: Row): Record<string, unknown> => {
    if (!submissions) return presentRow(store, table, row);
    const { id, pillar: pillarName, captured, status, source } = submissionSummary(store, row);
    return { id, pillar: pillarName, captured, status, source };
  };
  const content = [
    columns.join(","),
    ...rows.map((row) => {
      const safe = safeRow(row);
      return columns.map((key) => csvCell(safe[key])).join(",");
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
  return envelope(200, { filename: `${table}.csv`, content, totalItems: rows.length });
}

/** Serves `GET` for a resolved resource: named views, single rows, CSV exports and paged lists. */
export function readResource(ctx: ResourceContext): Envelope {
  const special = readSpecialView(ctx);
  if (special) return special;
  if (ctx.existing) return readSingle(ctx, ctx.existing);

  const params = parseListQuery(ctx);
  if ("resultCode" in params) return params;
  const rows = filterRows(ctx, params);
  const invalidSort = sortRows(ctx, rows);
  if (invalidSort) return invalidSort;
  if (ctx.query.has("format")) return exportCsv(ctx, rows);

  const { page, pageSize } = params;
  const data: PaginatedData<Row> = {
    items: rows
      .slice((page - 1) * pageSize, page * pageSize)
      .map((row) => presentRow(ctx.store, ctx.table, row)),
    page,
    pageSize,
    totalItems: rows.length,
    totalPages: Math.ceil(rows.length / pageSize),
  };
  return envelope(200, data);
}
