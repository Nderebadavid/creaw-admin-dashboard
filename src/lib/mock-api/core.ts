import {
  getEffectiveGrants,
  hasPermission,
  type EffectiveGrant,
  hasModulePermission,
} from "../auth/permissions";
import { isSensitiveField, maskSensitiveValue } from "../sensitive-fields";
import { tableDefinitions } from "./schema";
import { type ApiEnvelope } from "@/types/api";
import { type MockStore, type TableName } from "@/types/db";

// Shared building blocks for the mock API: row access, the response envelope,
// route-to-table maps, pillar scoping, permission checks and field masking.
export type Row = Record<string, unknown> & { id: number };
export const rowsFor = (store: MockStore, table: TableName) => store[table] as unknown as Row[];
export const visible = (row: Row) => row.is_deleted !== true;
export function submissionSummary(store: MockStore, row: Row) {
  const enrollment = store.enrollment.find(
    (item) => item.id === row.enrollment_id && !item.is_deleted
  );
  const pillar = store.pillar.find((item) => item.id === enrollment?.pillar_id);
  const stageStatus = String(row.stage_event_status);
  const status: "Approved" | "Flagged" | "Pending review" =
    stageStatus === "verified"
      ? "Approved"
      : stageStatus === "disputed"
        ? "Flagged"
        : "Pending review";
  return {
    id: row.id,
    title: String(row.notes ?? `Submission #${row.id}`).split(" — ")[0],
    type: enrollment?.entry_category ?? "Field update",
    pillar: pillar?.name ?? "Pillar unavailable",
    status,
    captured: String(row.event_date),
    source: String(row.source_channel),
  };
}
export const envelope = (
  resultCode: number,
  data: unknown = null,
  message = resultCode < 400
    ? "OK"
    : resultCode === 404
      ? "Record or route not found"
      : resultCode === 403
        ? "Permission denied"
        : "Invalid request"
): ApiEnvelope<unknown> => ({
  resultCode,
  success: resultCode < 400,
  message,
  data: structuredClone(data),
});
export const routeTables: Record<string, TableName> = {
  participants: "participant",
  referrals: "referral",
  grants: "grant_application",
  assessments: "organisation_assessment",
  reports: "narrative_report",
  "field-submissions": "participant_stage_event",
  "audit-logs": "audit_logs",
  "admin/users": "user",
  "admin/roles": "role",
  "admin/permissions": "permission",
  "admin/pipelines": "pipeline_definition",
  "admin/providers": "external_provider",
};
export const lookups: TableName[] = [
  "pillar",
  "county",
  "sub_county",
  "ward",
  "donor",
  "business_sector",
  "case_type",
  "partner_institution",
  "activity_type_definition",
  "activity_topic",
];
// Related resources use a table query on the owning route family, keeping the
// existing closed route-template catalogue intact and logs free of row IDs.
export const relatedTables: Record<string, TableName[]> = {
  participants: ["enrollment", "document"],
  grants: ["grant_award", "grant_disbursement", "grant_report", "document"],
  assessments: [
    "organisation",
    "organisation_assessment_score",
    "assessment_document_check",
    "assessment_criterion",
    "assessment_instrument",
    "document",
  ],
  reports: ["grant_report", "project", "document"],
  "field-submissions": ["document"],
  "admin/users": ["user_role"],
  "admin/permissions": ["role_permission"],
  "admin/pipelines": ["stage_definition"],
  pillars: [
    "enrollment",
    "legal_case",
    "counselling_session",
    "training_enrollment",
    "activity_session",
    "activity_attendance",
    "organisation",
    "grant_application",
    "participant_stage_event",
    "pipeline_definition",
    "stage_definition",
    "document",
  ],
};
export const permissionCodes: Partial<Record<TableName, [string, string]>> = {
  participant: ["PARTICIPANT_VIEW", "PARTICIPANT_EDIT"],
  enrollment: ["PARTICIPANT_VIEW", "PARTICIPANT_EDIT"],
  organisation: ["ORGANISATION_VIEW", "ORGANISATION_EDIT"],
  referral: ["REFERRAL_VIEW", "REFERRAL_ACCEPT"],
  grant_application: ["GRANT_APPLICATION_VIEW", "GRANT_APPLICATION_EDIT"],
  grant_award: ["GRANT_AWARD_VIEW", "GRANT_AWARD_MANAGE"],
  grant_disbursement: ["GRANT_AWARD_VIEW", "GRANT_DISBURSEMENT_RECORD"],
  grant_report: ["GRANT_REPORT_VIEW", "GRANT_REPORT_MANAGE"],
  organisation_assessment: ["ORG_ASSESSMENT_VIEW", "ORG_ASSESSMENT_EDIT"],
  organisation_assessment_score: ["ORG_ASSESSMENT_VIEW", "ORG_ASSESSMENT_EDIT"],
  assessment_document_check: ["ORG_ASSESSMENT_VIEW", "DUE_DILIGENCE_MANAGE"],
  assessment_criterion: ["ORG_ASSESSMENT_VIEW", "ORG_ASSESSMENT_EDIT"],
  assessment_instrument: ["ORG_ASSESSMENT_VIEW", "ORG_ASSESSMENT_EDIT"],
  narrative_report: ["NARRATIVE_REPORT_MANAGE", "NARRATIVE_REPORT_MANAGE"],
  project: ["DASHBOARD_VIEW", "NARRATIVE_REPORT_MANAGE"],
  participant_stage_event: ["FIELD_SUBMISSION_VIEW", "FIELD_SUBMISSION_REVIEW"],
  user: ["USER_MANAGE", "USER_MANAGE"],
  role: ["ROLE_MANAGE", "ROLE_MANAGE"],
  permission: ["PERMISSION_MANAGE", "PERMISSION_MANAGE"],
  user_role: ["ROLE_MANAGE", "ROLE_MANAGE"],
  role_permission: ["PERMISSION_MANAGE", "PERMISSION_MANAGE"],
  pipeline_definition: ["DASHBOARD_VIEW", "PILLAR_CONFIG_MANAGE"],
  stage_definition: ["DASHBOARD_VIEW", "PILLAR_CONFIG_MANAGE"],
  document: ["DOCUMENT_VIEW", "DOCUMENT_UPLOAD"],
  legal_case: ["CASE_VIEW", "CASE_EDIT"],
  counselling_session: ["COUNSELLING_VIEW", "COUNSELLING_LOG"],
  training_enrollment: ["TRAINING_ENROLLMENT_VIEW", "TRAINING_ENROLLMENT_EDIT"],
  activity_session: ["ACTIVITY_SESSION_VIEW", "ACTIVITY_SESSION_LOG"],
  activity_attendance: ["ACTIVITY_SESSION_VIEW", "ACTIVITY_SESSION_LOG"],
  external_provider: ["PROVIDER_MANAGE", "PROVIDER_MANAGE"],
  audit_logs: ["AUDIT_LOG_VIEW", ""],
};

export function scopes(store: MockStore, table: TableName, row: Row, depth = 0): number[] {
  if (depth > 8) return [];
  if (table === "pillar") return [row.id];
  if (table === "participant" || table === "organisation")
    return store.enrollment
      .filter(
        (enrollment) =>
          !enrollment.is_deleted &&
          enrollment[table === "participant" ? "participant_id" : "organisation_id"] === row.id
      )
      .map((enrollment) => enrollment.pillar_id);
  if (table === "referral") return [Number(row.from_pillar_id), Number(row.to_pillar_id)];
  if (typeof row.pillar_id === "number") return [row.pillar_id];
  if (table === "document") {
    const owner =
      typeof row.owner_type === "string" && Object.hasOwn(tableDefinitions, row.owner_type)
        ? (row.owner_type as TableName)
        : null;
    const parent =
      owner &&
      rowsFor(store, owner).find(
        (candidate) => candidate.id === row.owner_id && visible(candidate)
      );
    return owner && parent ? scopes(store, owner, parent, depth + 1) : [];
  }
  const links: [string, TableName][] = [
    ["enrollment_id", "enrollment"],
    ["project_id", "project"],
    ["pipeline_id", "pipeline_definition"],
    ["assessment_id", "organisation_assessment"],
    ["organisation_id", "organisation"],
    ["application_id", "grant_application"],
    ["grant_id", "grant_award"],
    ["grant_award_id", "grant_award"],
    ["session_id", "activity_session"],
  ];
  for (const [key, parentTable] of links) {
    const parent = rowsFor(store, parentTable).find(
      (candidate) => candidate.id === row[key] && visible(candidate)
    );
    if (parent) return scopes(store, parentTable, parent, depth + 1);
  }
  return [];
}
export function allowed(
  store: MockStore,
  grants: EffectiveGrant[],
  code: string,
  table: TableName,
  row: Row
): boolean {
  if (
    code === "ORG_ASSESSMENT_VIEW" &&
    (table === "assessment_criterion" || table === "assessment_instrument")
  ) {
    const instrumentId = table === "assessment_instrument" ? row.id : row.instrument_id;
    return store.organisation_assessment.some(
      (assessment) =>
        !assessment.is_deleted &&
        assessment.instrument_id === instrumentId &&
        allowed(store, grants, code, "organisation_assessment", assessment as unknown as Row)
    );
  }
  if (table === "referral" && (code === "REFERRAL_CREATE" || code === "REFERRAL_ACCEPT")) {
    return hasPermission(grants, code, {
      pillarId: Number(code === "REFERRAL_CREATE" ? row.from_pillar_id : row.to_pillar_id),
    });
  }
  if (
    code === "DASHBOARD_VIEW" &&
    lookups.includes(table) &&
    (hasModulePermission(grants, code) || readableAsReference(grants, table))
  )
    return true;
  return (
    hasPermission(grants, code) ||
    scopes(store, table, row).some((pillarId) => hasPermission(grants, code, { pillarId }))
  );
}
export function masked(table: TableName, row: Row, audit = false): Row {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      key === "password_hash"
        ? "[REDACTED]"
        : isSensitiveField(table, key) && value !== null
          ? audit
            ? "[REDACTED]"
            : maskSensitiveValue(value)
          : value,
    ])
  ) as Row;
}
export function addsGrantsBeyondActor(
  store: MockStore,
  hypothetical: MockStore,
  targetUserId: number,
  actorGrants: EffectiveGrant[]
): boolean {
  const current = new Set(
    getEffectiveGrants(targetUserId, store).map(
      (grant) => `${grant.permissionCode}:${grant.pillarId}`
    )
  );
  return getEffectiveGrants(targetUserId, hypothetical).some(
    (grant) =>
      !current.has(`${grant.permissionCode}:${grant.pillarId}`) &&
      !hasPermission(actorGrants, grant.permissionCode, { pillarId: grant.pillarId })
  );
}
export function referralRead(store: MockStore, row: Row): Row {
  const enrollment = store.enrollment.find(
    (item) => item.id === row.enrollment_id && !item.is_deleted
  );
  const participant = store.participant.find(
    (item) => item.id === enrollment?.participant_id && !item.is_deleted
  );
  const safeParticipant = participant ? masked("participant", participant as unknown as Row) : null;
  const partner = store.partner_institution.find(
    (item) => item.id === row.to_partner_institution_id
  );
  return {
    ...masked("referral", row),
    participant_summary: safeParticipant
      ? {
          id: safeParticipant.id,
          name: [safeParticipant.first_name, safeParticipant.middle_name, safeParticipant.last_name]
            .filter(Boolean)
            .join(" "),
        }
      : null,
    destination_name: partner?.name ?? null,
    referred_by_name: referrerName(store, row.id),
  };
}

/** Who created a referral, from its CREATE audit entry; null when none was recorded. */
function referrerName(store: MockStore, referralId: number): string | null {
  const created = store.audit_logs.findLast(
    (entry) =>
      entry.entity_type === "referral" &&
      entry.entity_id === referralId &&
      entry.action === "CREATE"
  );
  if (!created) return null;
  if (created.source === "KAFKA") return "System (background job)";
  const user = store.user.find((row) => row.id === created.performed_by);
  return user ? `${user.first_name} ${user.last_name}` : null;
}
export function enrollmentRead(store: MockStore, row: Row): Row {
  const latestEvent = store.participant_stage_event
    .filter((item) => item.enrollment_id === row.id && !item.is_deleted)
    .sort((a, b) => a.event_date.localeCompare(b.event_date) || a.id - b.id)
    .at(-1);
  const stage = store.stage_definition.find((item) => item.id === latestEvent?.stage_definition_id);
  return {
    ...masked("enrollment", row),
    current_stage: stage?.name ?? null,
    current_stage_date: latestEvent?.event_date ?? null,
  };
}

/** A GET whose query uses only the listed keys; anything else is a 422. */
export const isStrictGet = (
  request: { method: string },
  query: URLSearchParams,
  allowed: readonly string[]
) => request.method === "GET" && [...query.keys()].every((key) => allowed.includes(key));

/**
 * Pillar and geography tables back the participant and referral forms, so
 * anyone who can view participants or referrals may read them.
 */
export const readableAsReference = (grants: readonly EffectiveGrant[], table: TableName) =>
  ["pillar", "county", "sub_county", "ward"].includes(table) &&
  (hasModulePermission(grants, "PARTICIPANT_VIEW") || hasModulePermission(grants, "REFERRAL_VIEW"));
