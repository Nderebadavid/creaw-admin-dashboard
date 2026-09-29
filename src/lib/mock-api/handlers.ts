import "server-only";
import type { ApiEnvelope, PaginatedData } from "@/types/api";
import type { MockStore, TableName } from "@/types/db";
import type { ApiRequest } from "../api/transport";
import { API_ROUTE_TEMPLATES } from "../api/transport";
import { getEffectiveGrants, hasPermission, type EffectiveGrant } from "../auth/permissions";
import { isSensitiveField, maskSensitiveValue } from "../sensitive-fields";
import { getMockStore, issueMockToken, resolveMockToken, revokeMockToken } from "./store";
import { tableDefinitions } from "./schema";
import { makeRow } from "./rows";
import { MOCK_PASSWORD } from "./seed";
import { uniqueKeys } from "./unique-keys";
import { filterSubmissionRows } from "@/features/submissions/filter";

type Row = Record<string, unknown> & { id: number };
const rowsFor = (store: MockStore, table: TableName) => store[table] as unknown as Row[];
const visible = (row: Row) => row.is_deleted !== true;
function submissionSummary(store: MockStore, row: Row) {
  const enrollment = store.enrollment.find(item => item.id === row.enrollment_id && !item.is_deleted);
  const pillar = store.pillar.find(item => item.id === enrollment?.pillar_id);
  const stageStatus = String(row.stage_event_status);
  const status: "Approved" | "Flagged" | "Pending review" = stageStatus === "verified" ? "Approved" : stageStatus === "disputed" ? "Flagged" : "Pending review";
  return { id: row.id, title: String(row.notes ?? `Submission #${row.id}`).split(" — ")[0], type: enrollment?.entry_category ?? "Field update",
    pillar: pillar?.name ?? "Pillar unavailable", status,
    captured: String(row.event_date), source: String(row.source_channel) };
}
const envelope = (resultCode: number, data: unknown = null, message = resultCode < 400 ? "OK" : resultCode === 404 ? "Record or route not found" : resultCode === 403 ? "Permission denied" : "Invalid request"): ApiEnvelope<unknown> => ({ resultCode, success: resultCode < 400, message, data: structuredClone(data) });
const routeTables: Record<string, TableName> = {
  participants: "participant", referrals: "referral", grants: "grant_application", assessments: "organisation_assessment", reports: "narrative_report", "field-submissions": "participant_stage_event", "audit-logs": "audit_logs",
  "admin/users": "user", "admin/roles": "role", "admin/permissions": "permission", "admin/pipelines": "pipeline_definition",
};
const lookups: TableName[] = ["pillar", "county", "sub_county", "ward", "donor", "business_sector", "case_type", "partner_institution", "activity_type_definition", "assessment_instrument", "assessment_criterion"];
// Related resources use a table query on the owning route family, keeping the
// existing closed route-template catalogue intact and logs free of row IDs.
const relatedTables: Record<string, TableName[]> = {
  participants: ["enrollment", "document"], grants: ["grant_award", "grant_disbursement", "grant_report", "document"],
  assessments: ["organisation", "organisation_assessment_score", "assessment_document_check", "assessment_criterion", "assessment_instrument", "document"],
  reports: ["grant_report", "project", "document"], "admin/users": ["user_role"], "admin/permissions": ["role_permission"], "admin/pipelines": ["stage_definition"],
  pillars: ["enrollment", "legal_case", "counselling_session", "training_enrollment", "activity_session", "activity_attendance", "organisation", "grant_application", "participant_stage_event", "pipeline_definition", "stage_definition"],
};
const permissionCodes: Partial<Record<TableName, [string, string]>> = {
  participant: ["PARTICIPANT_VIEW", "PARTICIPANT_EDIT"], enrollment: ["PARTICIPANT_VIEW", "PARTICIPANT_EDIT"], organisation: ["ORGANISATION_VIEW", "ORGANISATION_EDIT"],
  referral: ["REFERRAL_VIEW", "REFERRAL_ACCEPT"], grant_application: ["GRANT_APPLICATION_VIEW", "GRANT_APPLICATION_EDIT"], grant_award: ["GRANT_AWARD_VIEW", "GRANT_AWARD_MANAGE"],
  grant_disbursement: ["GRANT_AWARD_VIEW", "GRANT_DISBURSEMENT_RECORD"], grant_report: ["GRANT_REPORT_VIEW", "GRANT_REPORT_MANAGE"],
  organisation_assessment: ["ORG_ASSESSMENT_VIEW", "ORG_ASSESSMENT_EDIT"], organisation_assessment_score: ["ORG_ASSESSMENT_VIEW", "ORG_ASSESSMENT_EDIT"], assessment_document_check: ["ORG_ASSESSMENT_VIEW", "DUE_DILIGENCE_MANAGE"],
  assessment_criterion: ["ORG_ASSESSMENT_VIEW", "ORG_ASSESSMENT_EDIT"], assessment_instrument: ["ORG_ASSESSMENT_VIEW", "ORG_ASSESSMENT_EDIT"],
  narrative_report: ["NARRATIVE_REPORT_MANAGE", "NARRATIVE_REPORT_MANAGE"], project: ["DASHBOARD_VIEW", "NARRATIVE_REPORT_MANAGE"], participant_stage_event: ["FIELD_SUBMISSION_VIEW", "FIELD_SUBMISSION_REVIEW"],
  user: ["USER_MANAGE", "USER_MANAGE"], role: ["ROLE_MANAGE", "ROLE_MANAGE"], permission: ["PERMISSION_MANAGE", "PERMISSION_MANAGE"], user_role: ["ROLE_MANAGE", "ROLE_MANAGE"], role_permission: ["PERMISSION_MANAGE", "PERMISSION_MANAGE"],
  pipeline_definition: ["DASHBOARD_VIEW", "PILLAR_CONFIG_MANAGE"], stage_definition: ["DASHBOARD_VIEW", "PILLAR_CONFIG_MANAGE"], document: ["DOCUMENT_VIEW", "DOCUMENT_UPLOAD"],
  legal_case: ["CASE_VIEW", "CASE_EDIT"], counselling_session: ["COUNSELLING_VIEW", "COUNSELLING_LOG"], training_enrollment: ["TRAINING_ENROLLMENT_VIEW", "TRAINING_ENROLLMENT_EDIT"],
  activity_session: ["ACTIVITY_SESSION_VIEW", "ACTIVITY_SESSION_LOG"], activity_attendance: ["ACTIVITY_SESSION_VIEW", "ACTIVITY_SESSION_LOG"], audit_logs: ["AUDIT_LOG_VIEW", ""],
};

function scopes(store: MockStore, table: TableName, row: Row, depth = 0): number[] {
  if (depth > 8) return [];
  if (table === "pillar") return [row.id];
  if (table === "participant" || table === "organisation") return store.enrollment.filter((enrollment) => !enrollment.is_deleted && enrollment[table === "participant" ? "participant_id" : "organisation_id"] === row.id).map((enrollment) => enrollment.pillar_id);
  if (table === "referral") return [Number(row.from_pillar_id), Number(row.to_pillar_id)];
  if (typeof row.pillar_id === "number") return [row.pillar_id];
  if (table === "document") {
    const owner = typeof row.owner_type === "string" && Object.hasOwn(tableDefinitions, row.owner_type) ? row.owner_type as TableName : null;
    const parent = owner && rowsFor(store, owner).find((candidate) => candidate.id === row.owner_id && visible(candidate));
    return owner && parent ? scopes(store, owner, parent, depth + 1) : [];
  }
  const links: [string, TableName][] = [["enrollment_id", "enrollment"], ["project_id", "project"], ["pipeline_id", "pipeline_definition"], ["assessment_id", "organisation_assessment"], ["organisation_id", "organisation"], ["application_id", "grant_application"], ["grant_id", "grant_award"], ["grant_award_id", "grant_award"], ["session_id", "activity_session"]];
  for (const [key, parentTable] of links) {
    const parent = rowsFor(store, parentTable).find((candidate) => candidate.id === row[key] && visible(candidate));
    if (parent) return scopes(store, parentTable, parent, depth + 1);
  }
  return [];
}
function allowed(store: MockStore, grants: EffectiveGrant[], code: string, table: TableName, row: Row): boolean {
  if (code === "ORG_ASSESSMENT_VIEW" && (table === "assessment_criterion" || table === "assessment_instrument")) {
    const instrumentId = table === "assessment_instrument" ? row.id : row.instrument_id;
    return store.organisation_assessment.some(assessment => !assessment.is_deleted && assessment.instrument_id === instrumentId && allowed(store, grants, code, "organisation_assessment", assessment as unknown as Row));
  }
  if (table === "referral" && (code === "REFERRAL_CREATE" || code === "REFERRAL_ACCEPT")) {
    return hasPermission(grants, code, { pillarId: Number(code === "REFERRAL_CREATE" ? row.from_pillar_id : row.to_pillar_id) });
  }
  if (code === "DASHBOARD_VIEW" && lookups.includes(table) && (grants.some((grant) => grant.permissionCode === code) || ["pillar", "county", "sub_county", "ward"].includes(table) && grants.some((grant) => ["PARTICIPANT_VIEW", "REFERRAL_VIEW"].includes(grant.permissionCode)))) return true;
  return hasPermission(grants, code) || scopes(store, table, row).some((pillarId) => hasPermission(grants, code, { pillarId }));
}
function masked(table: TableName, row: Row, audit = false): Row {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, key === "password_hash" ? "[REDACTED]" : isSensitiveField(table, key) && value !== null ? audit ? "[REDACTED]" : maskSensitiveValue(value) : value])) as Row;
}
const secretMetadataKey = /(?:password|token|secret|credential|authorization|cookie|email|phone|contact|id_number|first_name|middle_name|last_name|salary|amount|notes?|payload|file_url|address|date_of_birth)/i;
const safeAuditStringKey = /^(?:status|stage_event_status|code|module|action|source|entity_type|type|kind|role_code|permission_code)$/i;
function redactAuditValue(table: string | null, value: unknown, field?: string): unknown {
  if (Array.isArray(value)) return value.map(item => redactAuditValue(table, item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    secretMetadataKey.test(key) || table && isSensitiveField(table, key) ? "[REDACTED]" : redactAuditValue(table, item, key)]));
  if (typeof value === "string" && (!field || !safeAuditStringKey.test(field))) return "[REDACTED]";
  return value;
}
function redactAuditText(table: string | null, text: string | null): string | null {
  if (!text) return text;
  try { return JSON.stringify(redactAuditValue(table, JSON.parse(text))); }
  catch { return "[REDACTED]"; }
}
function safeAuditRow(store: MockStore, row: MockStore["audit_logs"][number]) {
  const actor = store.user.find(user => user.id === row.performed_by && !user.is_deleted);
  return { ...row, performed_by_name: actor ? `${actor.first_name} ${actor.last_name}` : null,
    input_payload: redactAuditText(row.entity_type, row.input_payload),
    previous_state: redactAuditText(row.entity_type, row.previous_state),
    new_state: redactAuditText(row.entity_type, row.new_state) };
}
function addsGrantsBeyondActor(store: MockStore, hypothetical: MockStore, targetUserId: number, actorGrants: EffectiveGrant[]): boolean {
  const current = new Set(getEffectiveGrants(targetUserId, store).map(grant => `${grant.permissionCode}:${grant.pillarId}`));
  return getEffectiveGrants(targetUserId, hypothetical).some(grant => !current.has(`${grant.permissionCode}:${grant.pillarId}`) && !hasPermission(actorGrants, grant.permissionCode, { pillarId: grant.pillarId }));
}
function referralRead(store: MockStore, row: Row): Row {
  const enrollment = store.enrollment.find((item) => item.id === row.enrollment_id && !item.is_deleted);
  const participant = store.participant.find((item) => item.id === enrollment?.participant_id && !item.is_deleted);
  const safeParticipant = participant ? masked("participant", participant as unknown as Row) : null;
  const partner = store.partner_institution.find((item) => item.id === row.to_partner_institution_id);
  return {
    ...masked("referral", row),
    participant_summary: safeParticipant ? {
      id: safeParticipant.id,
      name: [safeParticipant.first_name, safeParticipant.middle_name, safeParticipant.last_name].filter(Boolean).join(" "),
    } : null,
    destination_name: partner?.name ?? null,
  };
}
function enrollmentRead(store: MockStore, row: Row): Row {
  const latestEvent = store.participant_stage_event
    .filter((item) => item.enrollment_id === row.id && !item.is_deleted)
    .sort((a, b) => a.event_date.localeCompare(b.event_date) || a.id - b.id).at(-1);
  const stage = store.stage_definition.find((item) => item.id === latestEvent?.stage_definition_id);
  return { ...masked("enrollment", row), current_stage: stage?.name ?? null, current_stage_date: latestEvent?.event_date ?? null };
}
function auditWrite(store: MockStore, request: ApiRequest<unknown>, userId: number, table: TableName, before: Row | null, after: Row, action?: string) {
  const now = new Date().toISOString();
  store.audit_logs.push(makeRow("audit_logs", {
    entity_type: table, entity_id: after.id, action: action ?? (after.is_deleted ? "DELETE" : before ? "UPDATE" : "CREATE"), source: "HTTP", performed_by: userId,
    performed_at: now, endpoint: request.routeTemplate, input_payload: redactAuditText(table, JSON.stringify(request.body ?? {})),
    previous_state: before ? redactAuditText(table, JSON.stringify(before)) : null, new_state: redactAuditText(table, JSON.stringify(after)),
  }, Math.max(0, ...store.audit_logs.map((row) => row.id)) + 1, now));
}
function signoffActors(store: MockStore, applicationId: number) {
  let preparedBy: number | null = null, reviewedBy: number | null = null, approvedBy: number | null = null;
  for (const entry of store.audit_logs.filter(row => row.entity_type === "grant_application" && row.entity_id === applicationId && row.source === "HTTP" && (row.action === "UPDATE" && row.endpoint === "/grants/:id" || row.action === "CREATE" && ["/grants", "/pillars/:pillar"].includes(row.endpoint ?? ""))).sort((a, b) => a.id - b.id)) {
    let before: string | undefined, after: string | undefined;
    try { before = JSON.parse(entry.previous_state ?? "{}").status; after = JSON.parse(entry.new_state ?? "{}").status; } catch { continue; }
    if (entry.action === "CREATE" && after === "PREPARED" && entry.performed_by || before === "ACTIVE" && after === "PREPARED" && entry.performed_by) { preparedBy = entry.performed_by; reviewedBy = null; approvedBy = null; }
    if (before === "PREPARED" && after === "REVIEWED" && preparedBy && entry.performed_by && entry.performed_by !== preparedBy) { reviewedBy = entry.performed_by; approvedBy = null; }
    if (before === "REVIEWED" && after === "APPROVED" && preparedBy && reviewedBy && entry.performed_by && ![preparedBy, reviewedBy].includes(entry.performed_by)) approvedBy = entry.performed_by;
  }
  return { preparedBy, reviewedBy, approvedBy };
}
function calendarRows(store: MockStore, grants: EffectiveGrant[]) {
  const projects = new Map(store.project.filter(row => !row.is_deleted).map(row => [row.id, row]));
  const pillars = new Map(store.pillar.filter(row => !row.is_deleted).map(row => [row.id, row]));
  const relationForAward = (awardId: number) => {
    const award = store.grant_award.find(row => row.id === awardId && !row.is_deleted);
    const application = store.grant_application.find(row => row.id === award?.application_id && !row.is_deleted);
    return { applicationId: application?.id ?? null, project: application && projects.get(application.project_id) };
  };
  const present = (type: "narrative" | "grant", row: typeof store.narrative_report[number] | typeof store.grant_report[number], project: typeof store.project[number] | undefined, dueDate: string, title: string, submittedDate: string | null, documentId: number | null, storedStatus?: string, applicationId: number | null = null) => {
    if (!project) return null;
    const pillar = pillars.get(project.pillar_id);
    if (!pillar) return null;
    const owner = store.user.find(user => user.id === pillar.lead_user_id && !user.is_deleted);
    const document = documentId && store.document.find(item => item.id === documentId && !item.is_deleted);
    return { key: `${type}-${row.id}`, id: row.id, type, applicationId, title, project: project.name, pillarId: project.pillar_id, pillar: pillar.name, ownerId: pillar.lead_user_id, ownerName: owner ? `${owner.first_name} ${owner.last_name}` : null, periodStart: row.reporting_period_start, periodEnd: row.reporting_period_end, dueDate,
      status: submittedDate || storedStatus === "submitted" ? "submitted" : storedStatus === "overdue" || dueDate < new Date().toISOString().slice(0, 10) ? "overdue" : "pending", submittedDate,
      documentId: document && allowed(store, grants, "DOCUMENT_VIEW", "document", document as unknown as Row) ? document.id : null };
  };
  return [
    ...store.narrative_report.filter(row => !row.is_deleted && allowed(store, grants, "NARRATIVE_REPORT_MANAGE", "narrative_report", row as unknown as Row)).map(row => present("narrative", row, projects.get(row.project_id), row.reporting_period_end, row.notes ?? `Narrative report #${row.id}`, row.submitted_date, store.document.find(document => !document.is_deleted && document.owner_type === "narrative_report" && document.owner_id === row.id)?.id ?? null, row.report_status)),
    ...store.grant_report.filter(row => !row.is_deleted && (allowed(store, grants, "GRANT_REPORT_VIEW", "grant_report", row as unknown as Row) || allowed(store, grants, "GRANT_REPORT_MANAGE", "grant_report", row as unknown as Row))).map(row => { const relation = relationForAward(row.grant_award_id); return present("grant", row, relation.project, row.due_date, row.notes ?? `Grant report #${row.id}`, row.submitted_date, row.document_id, undefined, relation.applicationId); }),
  ].filter((row): row is NonNullable<typeof row> => row !== null).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.key.localeCompare(b.key));
}
function filteredCalendarRows(store: MockStore, grants: EffectiveGrant[], query: URLSearchParams) {
  const pillarId = query.has("pillarId") ? Number(query.get("pillarId")) : undefined;
  const ownerId = query.has("ownerId") ? Number(query.get("ownerId")) : undefined;
  if (pillarId !== undefined && (!Number.isSafeInteger(pillarId) || pillarId < 1) || ownerId !== undefined && (!Number.isSafeInteger(ownerId) || ownerId < 1)) return null;
  const search = query.get("search")?.toLowerCase();
  return calendarRows(store, grants).filter(row => (pillarId === undefined || row.pillarId === pillarId) && (ownerId === undefined || row.ownerId === ownerId) && (!query.get("status") || row.status === query.get("status")) && (!search || `${row.title} ${row.project} ${row.pillar}`.toLowerCase().includes(search)));
}
function validate(store: MockStore, table: TableName, row: Row): boolean {
  const definition = tableDefinitions[table];
  if (Object.keys(row).some((key) => !Object.hasOwn(definition, key))) return false;
  for (const [key, column] of Object.entries(definition)) {
    const value = row[key];
    if (value === null && column.nullable) continue;
    if (value === undefined || value === null) return false;
    if (column.kind !== "json" && typeof value !== column.kind) return false;
    if (typeof value === "number" && (!Number.isFinite(value) || column.integer && !Number.isInteger(value) || column.unsigned && value < 0)) return false;
    if (typeof value === "string" && (column.maxLength && value.length > column.maxLength || !column.nullable && value.trim() === "" && !["notes", "password_hash"].includes(key))) return false;
    if (column.values && !column.values.includes(String(value))) return false;
    if (column.date && (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value) || Number.isNaN(Date.parse(value)))) return false;
    if (column.references && !rowsFor(store, column.references).some((parent) => parent.id === value && visible(parent))) return false;
  }
  if ((table === "enrollment" || table === "grant_application") && Boolean(row.participant_id) === Boolean(row.organisation_id)) return false;
  if (table === "activity_session" && Boolean(row.facilitator_user_id) === Boolean(row.facilitator_provider_id)) return false;
  if (table === "document") {
    if (typeof row.owner_type !== "string" || !Object.hasOwn(tableDefinitions, row.owner_type) || row.owner_type === "document") return false;
    if (!rowsFor(store, row.owner_type as TableName).some((owner) => owner.id === row.owner_id && visible(owner))) return false;
  }
  if (table === "referral") {
    const enrollment = store.enrollment.find((item) => item.id === row.enrollment_id);
    if (enrollment?.pillar_id !== row.from_pillar_id || Boolean(row.to_project_id) === Boolean(row.to_partner_institution_id)) return false;
    if (row.to_project_id && store.project.find((item) => item.id === row.to_project_id)?.pillar_id !== row.to_pillar_id) return false;
  }
  if (table === "participant_stage_event") {
    const enrollment = store.enrollment.find((item) => item.id === row.enrollment_id);
    const stage = store.stage_definition.find((item) => item.id === row.stage_definition_id);
    if (store.pipeline_definition.find((item) => item.id === stage?.pipeline_id)?.pillar_id !== enrollment?.pillar_id) return false;
  }
  for (const keys of uniqueKeys[table] ?? []) {
    if (keys.some((key) => row[key] === null)) continue;
    if (rowsFor(store, table).some((other) => other.id !== row.id && keys.every((key) => typeof row[key] === "string" ? String(other[key]).toLowerCase() === String(row[key]).toLowerCase() : other[key] === row[key]))) return false;
  }
  return true;
}

export async function handleMockRequest(request: ApiRequest<unknown>): Promise<ApiEnvelope<unknown>> {
  const store = getMockStore();
  const url = new URL(request.path, "http://mock.invalid");
  if (!request.path.startsWith("/") || url.origin !== "http://mock.invalid") return envelope(404);
  for (const [key, value] of Object.entries(request.query ?? {})) if (value !== undefined) url.searchParams.set(key, String(value));
  const query = url.searchParams;
  const parts = url.pathname.split("/").filter(Boolean);
  const template = API_ROUTE_TEMPLATES.find((route) => new RegExp("^" + route.replace(/:[^/]+/g, "[^/]+") + "$").test(url.pathname));
  if (!template || request.routeTemplate !== template) return envelope(404);
  if (url.pathname === "/auth/login" && request.method === "POST") {
    const body = request.body as { username?: unknown; password?: unknown } | undefined;
    if (typeof body?.username !== "string" || typeof body?.password !== "string") return envelope(422);
    const user = store.user.find((row) => row.username === body.username && !row.is_deleted && row.status === "ACTIVE");
    if (!user || body.password !== MOCK_PASSWORD) return envelope(403);
    return envelope(200, { token: issueMockToken(user.id), user: masked("user", user as unknown as Row), grants: getEffectiveGrants(user.id) });
  }
  if (url.pathname === "/auth/logout") {
    if (request.method !== "POST") return envelope(422);
    if (!request.token || !revokeMockToken(request.token)) return envelope(403);
    return envelope(200);
  }
  const userId = resolveMockToken(request.token) ?? 0;
  const grants = getEffectiveGrants(userId);
  if (!grants.length) return envelope(403);
  if (url.pathname === "/auth/me") return request.method === "GET" ? envelope(200, { user: masked("user", store.user.find((row) => row.id === userId)! as unknown as Row), grants }) : envelope(422);
  if (url.pathname === "/audit-logs") {
    if (!hasPermission(grants, "AUDIT_LOG_VIEW")) return envelope(403);
    if (request.method !== "GET" || [...query.keys()].some(key => !["id", "page", "pageSize", "search", "source", "module", "action", "performed_by", "from", "to", "format", "sortBy", "sortOrder"].includes(key))) return envelope(422);
    const readInt = (key: string, defaultValue?: number) => query.has(key) ? Number(query.get(key)) : defaultValue;
    const id = readInt("id"), page = readInt("page", 1)!, pageSize = readInt("pageSize", 25)!, actorId = readInt("performed_by");
    if ([id, page, pageSize, actorId].some(value => value !== undefined && (!Number.isSafeInteger(value) || value < 1)) || pageSize > 100 || id && query.size !== 1) return envelope(422);
    if (query.has("source") && !["HTTP", "KAFKA"].includes(query.get("source")!) || query.has("from") && !/^\d{4}-\d{2}-\d{2}$/.test(query.get("from")!) || query.has("to") && !/^\d{4}-\d{2}-\d{2}$/.test(query.get("to")!) || query.has("from") && query.has("to") && query.get("from")! > query.get("to")! || query.has("sortBy") && !["id", "performed_at"].includes(query.get("sortBy")!) || query.has("sortOrder") && !["asc", "desc"].includes(query.get("sortOrder")!)) return envelope(422);
    if (id) { const row = store.audit_logs.find(item => item.id === id); return row ? envelope(200, safeAuditRow(store, row)) : envelope(404); }
    const search = query.get("search")?.toLowerCase();
    const filtered = store.audit_logs.map(row => safeAuditRow(store, row)).filter(row =>
      (!query.get("source") || row.source === query.get("source")) &&
      (!query.get("module") || row.entity_type === query.get("module")) &&
      (!query.get("action") || row.action === query.get("action")) &&
      (actorId === undefined || row.performed_by === actorId) &&
      (!query.get("from") || row.performed_at.slice(0, 10) >= query.get("from")!) &&
      (!query.get("to") || row.performed_at.slice(0, 10) <= query.get("to")!) &&
      (!search || `${row.entity_type ?? ""} ${row.entity_id ?? ""} ${row.action} ${row.performed_by_name ?? ""} ${row.endpoint ?? ""} ${row.event_name ?? ""}`.toLowerCase().includes(search))
    ).sort((a, b) => (query.get("sortBy") === "id" ? a.id - b.id : a.performed_at.localeCompare(b.performed_at) || a.id - b.id) * (query.get("sortOrder") === "asc" ? 1 : -1));
    if (query.has("format")) {
      if (query.get("format") !== "csv" || !hasPermission(grants, "REPORT_EXPORT_CSV")) return envelope(403);
      const columns = ["id", "entity_type", "entity_id", "action", "source", "performed_by", "performed_by_name", "performed_at", "endpoint", "event_name", "input_payload", "previous_state", "new_state"] as const;
      const cell = (value: unknown) => { const text = String(value ?? ""); return '"' + (/^[=+\-@\t\r\n]/.test(text) ? "'" : "") + text.replaceAll('"', '""') + '"'; };
      const content = [columns.join(","), ...filtered.map(row => columns.map(column => cell(row[column])).join(","))].join("\r\n");
      const now = new Date().toISOString();
      store.audit_logs.push(makeRow("audit_logs", { entity_type: "audit_logs", action: "EXPORT", source: "HTTP", performed_by: userId, performed_at: now, endpoint: request.routeTemplate, input_payload: JSON.stringify({ filters: Object.fromEntries([...query].filter(([key]) => key !== "format")), totalItems: filtered.length }) }, Math.max(0, ...store.audit_logs.map(row => row.id)) + 1, now));
      return envelope(200, { filename: "audit-log.csv", content, totalItems: filtered.length });
    }
    return envelope(200, { items: filtered.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalItems: filtered.length, totalPages: Math.ceil(filtered.length / pageSize) });
  }
  if (url.pathname === "/admin/users" && query.get("catalog") === "pillars") {
    if (request.method !== "GET" || [...query.keys()].some(key => key !== "catalog")) return envelope(422);
    if (!hasPermission(grants, "ROLE_MANAGE")) return envelope(403);
    return envelope(200, store.pillar.filter(row => !row.is_deleted && row.status === "ACTIVE").map(row => ({ id: row.id, name: row.name, code: row.code })));
  }
  if (url.pathname === "/reports" && query.get("catalog") === "true") {
    if (request.method !== "GET" || [...query.keys()].some(key => key !== "catalog")) return envelope(422);
    if (!grants.some(grant => ["NARRATIVE_REPORT_MANAGE", "GRANT_REPORT_VIEW", "GRANT_REPORT_MANAGE"].includes(grant.permissionCode))) return envelope(403);
    const projects = store.project.filter(project => !project.is_deleted && hasPermission(grants, "NARRATIVE_REPORT_MANAGE", { pillarId: project.pillar_id })).map(project => ({ id: project.id, pillar_id: project.pillar_id, name: project.name, donor_id: project.donor_id }));
    const pillarIds = new Set([...calendarRows(store, grants).map(row => row.pillarId), ...projects.map(row => row.pillar_id), ...store.project.filter(project => !project.is_deleted && hasPermission(grants, "GRANT_REPORT_MANAGE", { pillarId: project.pillar_id })).map(row => row.pillar_id)]);
    const pillars = store.pillar.filter(pillar => !pillar.is_deleted && pillarIds.has(pillar.id)).map(pillar => ({ id: pillar.id, name: pillar.name, lead_user_id: pillar.lead_user_id }));
    const owners = [...new Set(pillars.map(pillar => pillar.lead_user_id).filter((id): id is number => id !== null))].map(id => store.user.find(user => user.id === id && !user.is_deleted)).filter((user): user is NonNullable<typeof user> => Boolean(user)).map(user => ({ id: user.id, name: `${user.first_name} ${user.last_name}` }));
    const awards = store.grant_award.filter(award => !award.is_deleted).map(award => ({ award, application: store.grant_application.find(application => !application.is_deleted && application.id === award.application_id) })).filter(({ application }) => application?.status === "APPROVED" && store.project.some(project => !project.is_deleted && project.id === application.project_id && hasPermission(grants, "GRANT_REPORT_MANAGE", { pillarId: project.pillar_id }))).map(({ award, application }) => ({ id: award.id, applicationId: application!.id, projectId: application!.project_id, pillarId: store.project.find(project => project.id === application!.project_id)!.pillar_id }));
    return envelope(200, { projects, pillars, owners, awards });
  }
  if (url.pathname === "/reports" && query.get("calendar") === "true") {
    if (request.method !== "GET" || [...query.keys()].some(key => !["calendar", "format", "pillarId", "ownerId", "status", "search", "page", "pageSize"].includes(key))) return envelope(422);
    if (!grants.some(grant => ["NARRATIVE_REPORT_MANAGE", "GRANT_REPORT_VIEW", "GRANT_REPORT_MANAGE"].includes(grant.permissionCode))) return envelope(403);
    const records = filteredCalendarRows(store, grants, query);
    if (!records) return envelope(422);
    if (!query.has("format")) {
      const page = Number(query.get("page") ?? 1), pageSize = Number(query.get("pageSize") ?? 25);
      if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) return envelope(422);
      return envelope(200, { items: records.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalItems: records.length, totalPages: Math.ceil(records.length / pageSize) });
    }
    if (query.get("format") !== "csv" || !grants.some(grant => grant.permissionCode === "REPORT_EXPORT_CSV") || records.some(row => !hasPermission(grants, "REPORT_EXPORT_CSV", { pillarId: row.pillarId }))) return envelope(403);
    const cell = (value: unknown) => '"' + (/^[=+\-@\t\r\n]/.test(String(value)) ? "'" : "") + String(value ?? "").replaceAll('"', '""') + '"';
    const content = ["type,id,title,programme,pillar_id,owner_id,due_date,status", ...records.map(item => [item.type, item.id, item.title, item.project, item.pillarId, item.ownerId ?? "", item.dueDate, item.status].map(cell).join(","))].join("\r\n");
    const now = new Date().toISOString();
    store.audit_logs.push(makeRow("audit_logs", { entity_type: "narrative_report", action: "EXPORT", source: "HTTP", performed_by: userId, performed_at: now, endpoint: request.routeTemplate }, Math.max(0, ...store.audit_logs.map(row => row.id)) + 1, now));
    return envelope(200, { filename: "reporting-calendar.csv", content, totalItems: records.length });
  }
  if (url.pathname === "/dashboard") {
    if (request.method !== "GET") return envelope(422);
    const pillars = store.pillar.filter((pillar) => !pillar.is_deleted && hasPermission(grants, "DASHBOARD_VIEW", { pillarId: pillar.id }));
    if (!pillars.length) return envelope(403);
    return envelope(200, { pillars, participantCount: store.participant.filter((row) => !row.is_deleted && allowed(store, grants, "PARTICIPANT_VIEW", "participant", row as unknown as Row)).length, enrollmentCount: store.enrollment.filter((row) => !row.is_deleted && pillars.some((pillar) => pillar.id === row.pillar_id)).length });
  }
  const family = parts[0] === "admin" ? parts.slice(0, 2).join("/") : parts[0];
  const pillar = family === "pillars" ? store.pillar.find((row) => !row.is_deleted && (row.code.toLowerCase() === parts[1].toLowerCase() || String(row.id) === parts[1])) : undefined;
  if (family === "pillars" && !pillar) return envelope(404);
  let table = family === "lookups" ? lookups.find((name) => name === parts[1]) : family === "pillars" ? "enrollment" as TableName : routeTables[family];
  if (!table) return envelope(404);
  if (query.has("table")) {
    const selected = query.get("table") as TableName;
    if (!relatedTables[family]?.includes(selected)) return envelope(422);
    table = selected;
  }
  const idText = family === "lookups" || parts[0] === "admin" ? parts[2] : family === "pillars" ? query.get("id") ?? undefined : parts[1];
  if (idText !== undefined && (!/^\d+$/.test(idText) || Number(idText) < 1)) return envelope(404);
  const id = idText ? Number(idText) : undefined;
  const rows = rowsFor(store, table);
  const existing = id === undefined ? undefined : rows.find((row) => row.id === id && (visible(row) || (table === "user_role" || table === "role_permission")));
  if (id !== undefined && !existing) return envelope(404);
  if (pillar && existing && !scopes(store, table, existing).includes(pillar.id)) return envelope(404);
  let permission = permissionCodes[table]?.[request.method === "GET" ? 0 : 1] ?? (request.method === "GET" ? "DASHBOARD_VIEW" : "LOOKUP_MANAGE");
  if (table === "role" && request.method === "GET" && hasPermission(grants, "PERMISSION_MANAGE")) permission = "PERMISSION_MANAGE";
  if (family === "assessments" && table === "organisation" && request.method === "GET") permission = "ORG_ASSESSMENT_VIEW";
  if (table === "referral" && request.method === "POST") permission = "REFERRAL_CREATE";
  if (table === "grant_application" && request.method !== "GET" && request.body && typeof request.body === "object" && "status" in request.body) {
    const status = request.body.status;
    if (status !== existing?.status) permission = ({ PREPARED: "GRANT_APPLICATION_PREPARE", REVIEWED: "GRANT_APPLICATION_REVIEW", APPROVED: "GRANT_APPLICATION_APPROVE" } as Record<string, string>)[String(status)] ?? permission;
  }
  if (table === "grant_application" && request.method === "PATCH" && existing && request.body && typeof request.body === "object" && "status" in request.body) {
    const change = request.body as unknown as Row;
    const order = ["ACTIVE", "PREPARED", "REVIEWED", "APPROVED"];
    if (Object.keys(change).some(key => key !== "status" && key !== "status_description") || order.indexOf(String(change.status)) !== order.indexOf(String(existing.status)) + 1) return envelope(422, null, "Grant sign-off must follow prepared, reviewed, approved order");
    const actors = signoffActors(store, existing.id);
    if (change.status === "REVIEWED" && !actors.preparedBy || change.status === "APPROVED" && (!actors.preparedBy || !actors.reviewedBy)) return envelope(422, null, "A complete audited sign-off history is required");
    if (change.status === "REVIEWED" && actors.preparedBy === userId || change.status === "APPROVED" && [actors.preparedBy, actors.reviewedBy].includes(userId)) return envelope(403, null, "A different officer must complete this sign-off step");
    if (change.status === "APPROVED" && store.grant_award.some(award => !award.is_deleted && award.application_id === existing.id)) return envelope(422, null, "Application already has an award");
  }
  if (table === "grant_application" && request.method === "POST" && request.body && typeof request.body === "object" && "status" in request.body && !["ACTIVE", "PREPARED"].includes(String(request.body.status))) return envelope(422, null, "New applications can only begin active or prepared");
  if (table === "grant_award" && request.method === "POST") permission = "GRANT_APPLICATION_APPROVE";
  if (table === "grant_award" && request.method === "POST") return envelope(422, null, "Awards are created by application approval");
  if (table === "grant_award" && request.method === "PATCH" && request.body && typeof request.body === "object") {
    if ("application_id" in request.body) return envelope(422, null, "An award cannot be moved to another application");
    if ("amount_awarded" in request.body || "currency" in request.body) permission = "GRANT_APPLICATION_APPROVE";
  }
  if (table === "organisation_assessment" && request.body && typeof request.body === "object" && "overall_recommendation" in request.body) {
    const recommendation = request.body.overall_recommendation;
    const requiresApproval = request.method === "POST" ? recommendation != null : request.method === "PATCH" && recommendation !== existing?.overall_recommendation;
    if (requiresApproval) permission = "ORG_ASSESSMENT_APPROVE";
  }
  if (table === "referral" && request.method === "PATCH" && request.body && typeof request.body === "object" && !Array.isArray(request.body)) {
    const change = request.body as Row;
    const keys = Object.keys(change);
    if (!existing || existing.status !== "NEW" || !keys.length || keys.some((key) => !["status", "trigger_reason", "notes"].includes(key))) return envelope(422);
    if (change.status === "ACCEPTED" || change.status === "DECLINED") {
      if (keys.some((key) => key !== "status" && key !== "notes")) return envelope(422);
      permission = "REFERRAL_ACCEPT";
    } else if (change.status === "WITHDRAWN" || change.status === undefined) {
      if (change.status === "WITHDRAWN" && keys.some((key) => key !== "status")) return envelope(422);
      permission = "REFERRAL_CREATE";
    } else return envelope(422);
  }
  if (!permission || !grants.some((grant) => grant.permissionCode === permission) && !(request.method === "GET" && ["pillar", "county", "sub_county", "ward"].includes(table) && grants.some((grant) => ["PARTICIPANT_VIEW", "REFERRAL_VIEW"].includes(grant.permissionCode)))) return envelope(403);
  if (pillar && !hasPermission(grants, permission, { pillarId: pillar.id })) return envelope(403);
  if (request.method === "GET") {
    if (table === "grant_application" && existing && query.get("signoffs") === "true") {
      if (!allowed(store, grants, "GRANT_APPLICATION_VIEW", table, existing)) return envelope(403);
      return envelope(200, signoffActors(store, existing.id));
    }
    if (table === "grant_application" && existing && query.get("pack") === "true") {
      if (!allowed(store, grants, "GRANT_APPLICATION_VIEW", table, existing) || !allowed(store, grants, "DOCUMENT_DOWNLOAD", table, existing)) return envelope(403);
      auditWrite(store, request, userId, table, existing, existing, "DOWNLOAD");
      return envelope(200, { application_id: existing.id, simulated: true }, "Mock application pack metadata only");
    }
    if (table === "referral" && id === undefined && query.has("catalog")) {
      if (query.get("catalog") !== "destinations") return envelope(422);
      if (!grants.some((grant) => grant.permissionCode === "REFERRAL_CREATE")) return envelope(403);
      return envelope(200, {
        internalPillarIds: [...new Set(store.project.filter((item) => !item.is_deleted).map((item) => item.pillar_id))],
        partnerInstitutions: store.partner_institution.filter((item) => !item.is_deleted).map((item) => ({ id: item.id, name: item.name })),
      });
    }
    if (existing) {
      if (!allowed(store, grants, permission, table, existing)) return envelope(403);
      const result = table === "referral" ? referralRead(store, existing) : table === "enrollment" ? enrollmentRead(store, existing) : masked(table, existing);
      if (query.has("reveal")) {
        const field = query.get("reveal")!;
        if (!isSensitiveField(table, field) || field === "password_hash") return envelope(422);
        if (!allowed(store, grants, "SENSITIVE_REVEAL", table, existing) || pillar && !hasPermission(grants, "SENSITIVE_REVEAL", { pillarId: pillar.id })) return envelope(403);
        result[field] = existing[field];
        auditWrite(store, request, userId, table, existing, existing, "REVEAL");
      }
      if (query.has("download")) {
        if (table !== "document" || query.get("download") !== "true") return envelope(422);
        if (!allowed(store, grants, "DOCUMENT_DOWNLOAD", table, existing)) return envelope(403);
        auditWrite(store, request, userId, table, existing, existing, "DOWNLOAD");
        return envelope(200, { ...result, file_url: existing.file_url, simulated: true }, "Mock metadata only; no remote file was uploaded or downloaded");
      }
      return envelope(200, result);
    }
    const page = Number(query.get("page") ?? 1), pageSize = Number(query.get("pageSize") ?? 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) return envelope(422);
    const pillarFilter = pillar?.id ?? (query.has("pillarId") ? Number(query.get("pillarId")) : undefined);
    if (pillarFilter !== undefined && (!Number.isInteger(pillarFilter) || pillarFilter < 1)) return envelope(422);
    const search = (query.get("search") ?? query.get("q") ?? "").toLowerCase();
    const countyId = query.has("countyId") ? Number(query.get("countyId")) : undefined;
    if (countyId !== undefined && (table !== "participant" || !Number.isSafeInteger(countyId) || countyId < 1)) return envelope(422);
    const reserved = new Set(["page", "pageSize", "pillarId", "countyId", "table", "search", "q", "sortBy", "sortOrder", "format", "includeDeleted"]);
    if (query.has("includeDeleted") && (!(table === "user_role" || table === "role_permission") || query.get("includeDeleted") !== "true")) return envelope(422);
    for (const [key] of query) if (!reserved.has(key) && (!Object.hasOwn(tableDefinitions[table], key) || isSensitiveField(table, key))) return envelope(422);
    let filtered = rows.filter((row) => (visible(row) || query.get("includeDeleted") === "true") && allowed(store, grants, permission, table, row) && (pillarFilter === undefined || scopes(store, table, row).includes(pillarFilter)));
    if (countyId !== undefined) filtered = filtered.filter((row) => {
      const ward = store.ward.find((item) => item.id === row.ward_id);
      return store.sub_county.some((item) => item.id === ward?.sub_county_id && item.county_id === countyId);
    });
    for (const [key, value] of query) if (!reserved.has(key)) filtered = filtered.filter((row) => String(row[key]) === value);
    // Search uses the visible representation so it cannot become an oracle for
    // masked identity numbers or other hidden data.
    if (search) filtered = filtered.filter((row) => table === "participant_stage_event"
      ? filterSubmissionRows([submissionSummary(store, row)], { search }).length > 0
      : Object.values(masked(table, row)).some((value) => typeof value === "string" && value.toLowerCase().includes(search)));
    const sortBy = query.get("sortBy") ?? "id", sortOrder = query.get("sortOrder") ?? "asc";
    if (!Object.hasOwn(tableDefinitions[table], sortBy) || !["asc", "desc"].includes(sortOrder) || isSensitiveField(table, sortBy)) return envelope(422);
    filtered.sort((a, b) => (typeof a[sortBy] === "number" && typeof b[sortBy] === "number" ? Number(a[sortBy]) - Number(b[sortBy]) : String(a[sortBy] ?? "").localeCompare(String(b[sortBy] ?? ""))) * (sortOrder === "desc" ? -1 : 1));
    if (query.has("format")) {
      if (query.get("format") !== "csv") return envelope(422);
      if (!grants.some((grant) => grant.permissionCode === "REPORT_EXPORT_CSV") || pillar && !hasPermission(grants, "REPORT_EXPORT_CSV", { pillarId: pillar.id }) || filtered.some((row) => !allowed(store, grants, "REPORT_EXPORT_CSV", table, row))) return envelope(403);
      const columns = table === "participant_stage_event" ? ["id", "pillar", "captured", "status", "source"] : Object.keys(tableDefinitions[table]).filter((key) => key !== "password_hash");
      const csvCell = (value: unknown) => {
        const text = value === null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
        return '"' + (/^[=+\-@\t\r\n]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"';
      };
      const content = [columns.join(","), ...filtered.map((row) => {
        const safe = table === "participant_stage_event" ? (() => { const summary = submissionSummary(store, row); return { id: summary.id, pillar: summary.pillar, captured: summary.captured, status: summary.status, source: summary.source }; })() : masked(table, row);
        return columns.map((key) => csvCell(safe[key as keyof typeof safe])).join(",");
      })].join("\r\n");
      const now = new Date().toISOString();
      store.audit_logs.push(makeRow("audit_logs", { entity_type: table, action: "EXPORT", source: "HTTP", performed_by: userId, performed_at: now, endpoint: request.routeTemplate }, Math.max(0, ...store.audit_logs.map((row) => row.id)) + 1, now));
      return envelope(200, { filename: `${table}.csv`, content, totalItems: filtered.length });
    }
    const data: PaginatedData<Row> = { items: filtered.slice((page - 1) * pageSize, page * pageSize).map((row) => table === "referral" ? referralRead(store, row) : table === "enrollment" ? enrollmentRead(store, row) : masked(table, row)), page, pageSize, totalItems: filtered.length, totalPages: Math.ceil(filtered.length / pageSize) };
    return envelope(200, data);
  }
  if (request.method !== "POST" && request.method !== "PATCH" || request.method === "PATCH" && !existing || request.method === "POST" && id !== undefined || table === "audit_logs") return envelope(422);
  if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) return envelope(422);
  const body = request.body as Row;
  if (Object.keys(body).some((key) => ["id", "created_at", "updated_at", "password_hash"].includes(key))) return envelope(422);
  if (table === "user") {
    const permitted = request.method === "POST" ? ["first_name", "middle_name", "last_name", "username", "phone_number", "email"] : ["first_name", "middle_name", "last_name", "phone_number", "email", "status", "status_description", "is_deleted"];
    if (Object.keys(body).some(key => !permitted.includes(key))) return envelope(422);
    if (request.method === "PATCH" && existing?.id === userId && (body.is_deleted === true || body.status && body.status !== "ACTIVE")) return envelope(403, null, "You cannot disable your own account");
    if (existing && existing.status !== "ACTIVE" && body.status === "ACTIVE") {
      const hypothetical = { ...store, user: store.user.map(row => row.id === existing.id
        ? { ...row, status: "ACTIVE", is_deleted: body.is_deleted === undefined ? row.is_deleted : body.is_deleted as boolean }
        : row) };
      if (addsGrantsBeyondActor(store, hypothetical, existing.id, grants)) return envelope(403, null, "Account grants exceed your grants");
    }
  }
  if (table === "role") {
    const permitted = request.method === "POST" ? ["code", "name", "description"] : ["name", "description", "status", "status_description", "is_deleted"];
    if (Object.keys(body).some(key => !permitted.includes(key))) return envelope(422);
    if (existing?.is_system_role) return envelope(403, null, "Built-in roles cannot be edited");
    if (existing && existing.status !== "ACTIVE" && body.status === "ACTIVE") {
      const hypothetical = { ...store, role: store.role.map(row => row.id === existing.id
        ? { ...row, status: "ACTIVE", is_deleted: body.is_deleted === undefined ? row.is_deleted : body.is_deleted as boolean }
        : row) };
      if (store.user_role.some(link => link.role_id === existing.id && addsGrantsBeyondActor(store, hypothetical, link.user_id, grants))) return envelope(403, null, "Role exceeds your grants");
    }
  }
  if (table === "permission") {
    const permitted = request.method === "POST" ? ["code", "module", "name", "description"] : ["name", "description"];
    if (Object.keys(body).some(key => !permitted.includes(key))) return envelope(422);
  }
  if (table === "user_role") {
    const permitted = request.method === "POST" ? ["user_id", "role_id", "pillar_id"] : ["status", "is_deleted"];
    if (Object.keys(body).some(key => !permitted.includes(key))) return envelope(422);
    if (existing?.user_id === userId && (body.is_deleted === true || body.status && body.status !== "ACTIVE")) return envelope(403, null, "You cannot revoke your own role");
    const becomingActive = request.method === "POST" || !!existing && (existing.is_deleted || existing.status !== "ACTIVE") && (body.is_deleted ?? existing.is_deleted) === false && (body.status ?? existing.status) === "ACTIVE";
    if (becomingActive) {
      const targetRole = store.role.find(role => role.id === (request.method === "POST" ? body.role_id : existing?.role_id) && !role.is_deleted && role.status === "ACTIVE");
      const targetUser = store.user.find(user => user.id === (request.method === "POST" ? body.user_id : existing?.user_id) && !user.is_deleted && user.status === "ACTIVE");
      const scope = request.method === "POST" ? body.pillar_id : existing?.pillar_id;
      if (!targetRole || !targetUser || scope !== null && (!Number.isSafeInteger(scope) || !store.pillar.some(pillar => pillar.id === scope && !pillar.is_deleted && pillar.status === "ACTIVE"))) return envelope(422);
      const roleCodes = targetRole.is_system_role && targetRole.code === "SYSTEM_ADMIN"
        ? store.permission.filter(permission => !permission.is_deleted && permission.status === "ACTIVE").map(permission => permission.code)
        : store.role_permission.filter(link => link.role_id === targetRole.id && !link.is_deleted && link.status === "ACTIVE").map(link => store.permission.find(permission => permission.id === link.permission_id && !permission.is_deleted && permission.status === "ACTIVE")?.code).filter((code): code is string => !!code);
      if (roleCodes.some(code => !hasPermission(grants, code, { pillarId: scope as number | null }))) return envelope(403, null, "Role exceeds your grants");
    }
  }
  if (table === "role_permission") {
    const permitted = request.method === "POST" ? ["role_id", "permission_id"] : ["status", "is_deleted"];
    if (Object.keys(body).some(key => !permitted.includes(key))) return envelope(422);
    const targetRoleId = request.method === "POST" ? body.role_id : existing?.role_id;
    const targetRole = store.role.find(role => role.id === targetRoleId && !role.is_deleted && role.status === "ACTIVE");
    if (!targetRole) return envelope(422);
    if (targetRole.is_system_role) return envelope(403, null, "Built-in role permissions cannot be edited");
    const targetPermissionId = request.method === "POST" ? body.permission_id : existing?.permission_id;
    const targetPermission = store.permission.find(item => item.id === targetPermissionId && !item.is_deleted && item.status === "ACTIVE");
    if (!targetPermission) return envelope(422);
    const becomingActive = request.method === "POST" || !!existing && (existing.is_deleted || existing.status !== "ACTIVE") && (body.is_deleted ?? existing.is_deleted) === false && (body.status ?? existing.status) === "ACTIVE";
    if (becomingActive && !hasPermission(grants, targetPermission.code)) return envelope(403, null, "Permission exceeds your grants");
    if (request.method === "PATCH" && (body.is_deleted === true || body.status && body.status !== "ACTIVE") && targetPermission.code === "PERMISSION_MANAGE") {
      const hypothetical = { ...store, role_permission: store.role_permission.map(link => link.id === existing?.id
        ? { ...link, is_deleted: body.is_deleted === undefined ? link.is_deleted : body.is_deleted as boolean, status: body.status === undefined ? link.status : body.status as string }
        : link) };
      if (!hasPermission(getEffectiveGrants(userId, hypothetical), "PERMISSION_MANAGE")) return envelope(403, null, "You cannot remove your last global permission-management grant");
    }
  }
  if (query.has("enroll") && (table !== "participant" || request.method !== "POST" || query.get("enroll") !== "true" || !query.has("pillarId"))) return envelope(422);
  let next: Row;
  const now = new Date().toISOString();
  const input = table === "user" && !existing ? { ...body, password_hash: "mock-only:no-real-password-hash" }
    : table === "referral" && !existing ? { ...body, status: "NEW", to_project_id: body.to_partner_institution_id == null
      ? body.to_project_id ?? store.project.find((project) => !project.is_deleted && project.pillar_id === body.to_pillar_id)?.id ?? null
      : body.to_project_id ?? null }
    : body;
  try { next = existing ? { ...existing, ...body, updated_at: now } : makeRow(table, input, Math.max(0, ...rows.map((row) => row.id)) + 1, now) as unknown as Row; } catch { return envelope(422); }
  if (!validate(store, table, next)) return envelope(422);
  if (table === "participant" && !existing && typeof next.id_number === "string" && next.id_number && store.participant.some((row) => row.id_number?.toLowerCase() === String(next.id_number).toLowerCase())) return envelope(422, null, "A participant with this ID number is already registered");
  if (table === "grant_disbursement") {
    const award = store.grant_award.find(row => row.id === next.grant_id && !row.is_deleted);
    const application = award && store.grant_application.find(row => row.id === award.application_id && !row.is_deleted);
    const paid = store.grant_disbursement.filter(row => !row.is_deleted && row.grant_id === next.grant_id && row.id !== next.id).reduce((sum, row) => sum + row.amount, 0);
    if (!award || application?.status !== "APPROVED" || typeof next.amount !== "number" || next.amount <= 0 || paid + next.amount > award.amount_awarded) return envelope(422, null, "Payment exceeds the approved award or the application is not approved");
  }
  if (table === "grant_award") {
    const application = store.grant_application.find(row => row.id === next.application_id && !row.is_deleted);
    const paid = store.grant_disbursement.filter(row => !row.is_deleted && row.grant_id === next.id).reduce((sum, row) => sum + row.amount, 0);
    if (!application || application.status !== "APPROVED" || typeof next.amount_awarded !== "number" || next.amount_awarded <= 0 || next.amount_awarded > application.requested_amount || next.amount_awarded < paid) return envelope(422, null, "Award must fit the approved application and recorded payments");
  }
  if (table === "grant_report") {
    const award = store.grant_award.find(row => row.id === next.grant_award_id && !row.is_deleted);
    const application = award && store.grant_application.find(row => row.id === award.application_id && !row.is_deleted);
    if (!award || application?.status !== "APPROVED" || String(next.reporting_period_start) > String(next.reporting_period_end) || String(next.reporting_period_end) > String(next.due_date) || existing && next.grant_award_id !== existing.grant_award_id) return envelope(422, null, "A reporting period requires an approved award and valid dates");
  }
  if (table === "assessment_document_check" && next.document_id !== null) {
    const document = store.document.find(row => row.id === next.document_id && !row.is_deleted);
    if (!document || document.owner_type !== "organisation_assessment" || document.owner_id !== next.assessment_id || next.document_check_status !== "obtained") return envelope(422);
  }
  if (table === "narrative_report" && next.report_status === "submitted" && !next.submitted_date || table === "grant_report" && next.submitted_date && !next.document_id) return envelope(422);
  const registration = !existing && (table === "participant" || table === "organisation");
  let mayWriteNext: boolean;
  if (registration) {
    // Registration precedes enrollment. The requested pillar supplies only the
    // authorization context; it never becomes an invented identity-table column.
    const pillarId = query.has("pillarId") ? Number(query.get("pillarId")) : undefined;
    if (pillarId !== undefined && (!Number.isSafeInteger(pillarId) || !store.pillar.some((row) => row.id === pillarId && !row.is_deleted && row.status === "ACTIVE"))) return envelope(422);
    if (pillar && pillarId !== undefined && pillarId !== pillar.id) return envelope(422);
    mayWriteNext = hasPermission(grants, permission, { pillarId });
  } else {
    if (pillar && !scopes(store, table, next).includes(pillar.id)) return envelope(403);
    mayWriteNext = allowed(store, grants, permission, table, next);
  }
  // Check both sides of a mutation to prevent moving records into/out of scope.
  if (existing && !allowed(store, grants, permission, table, existing) || !mayWriteNext) return envelope(403);
  // Match a network boundary: request-owned nested JSON must never become a
  // mutable reference into storage, including when only part of a row changes.
  try { next = structuredClone(next); } catch { return envelope(422); }
  const before = existing ? structuredClone(existing) : null;
  if (existing) Object.assign(existing, next); else rows.push(next);
  auditWrite(store, request, userId, table, before, next);
  if (table === "grant_application" && existing && before?.status === "REVIEWED" && next.status === "APPROVED") {
    const award = makeRow("grant_award", { application_id: next.id, amount_awarded: Number(next.requested_amount) }, Math.max(0, ...store.grant_award.map(row => row.id)) + 1, now);
    store.grant_award.push(award);
    auditWrite(store, request, userId, "grant_award", null, award as unknown as Row);
  }
  if (registration && table === "participant" && query.get("enroll") === "true") {
    const enrollment = makeRow("enrollment", { participant_id: next.id, pillar_id: Number(query.get("pillarId")), entry_category: "Intake" }, Math.max(0, ...store.enrollment.map((row) => row.id)) + 1, now);
    store.enrollment.push(enrollment);
    auditWrite(store, request, userId, "enrollment", null, enrollment as unknown as Row);
  }
  if (table === "referral" && existing && next.status === "ACCEPTED" && before?.status === "NEW" && next.to_partner_institution_id === null) {
    const origin = store.enrollment.find((item) => item.id === next.enrollment_id);
    if (origin?.participant_id && !store.enrollment.some((item) => !item.is_deleted && item.participant_id === origin.participant_id && item.pillar_id === next.to_pillar_id)) {
      const enrollment = makeRow("enrollment", { participant_id: origin.participant_id, pillar_id: Number(next.to_pillar_id), entry_category: "Referral intake" }, Math.max(0, ...store.enrollment.map((row) => row.id)) + 1, now);
      store.enrollment.push(enrollment);
      auditWrite(store, request, userId, "enrollment", null, enrollment as unknown as Row);
    }
  }
  return envelope(existing ? 200 : 201, masked(table, next));
}
