import { hasPermission } from "../../auth/permissions";
import { auditWrite } from "../audit";
import { type ResourceContext } from "../context";
import { allowed, envelope, masked, scopes, type Row } from "../core";
import { checkLookupWrite } from "../resources/lookup-writes";
import { checkAccessControlWrite } from "../resources/rbac-writes";
import { makeRow } from "../rows";
import { validate } from "../validation";
import { type ApiEnvelope } from "@/types/api";

/** Serves `POST`/`PATCH` for a resolved resource: validation, scope checks, soft-delete-aware storage, side effects and auditing. */
export function writeResource(ctx: ResourceContext): ApiEnvelope<unknown> {
  const { request, store, query, userId, grants, pillar, table, id, rows, existing, permission } =
    ctx;
  if (
    (request.method !== "POST" && request.method !== "PATCH") ||
    (request.method === "PATCH" && !existing) ||
    (request.method === "POST" && id !== undefined) ||
    table === "audit_logs"
  )
    return envelope(422);
  if (!request.body || typeof request.body !== "object" || Array.isArray(request.body))
    return envelope(422);
  const body = request.body as Row;
  if (
    Object.keys(body).some((key) =>
      ["id", "created_at", "updated_at", "password_hash"].includes(key)
    )
  )
    return envelope(422);
  if (table === "pipeline_definition" || table === "stage_definition")
    return envelope(422, null, "Use pipeline configuration commands");
  const guard = checkLookupWrite(ctx, body) ?? checkAccessControlWrite(ctx, body);
  if (guard) return guard;
  if (
    query.has("enroll") &&
    (table !== "participant" ||
      request.method !== "POST" ||
      query.get("enroll") !== "true" ||
      !query.has("pillarId"))
  )
    return envelope(422);
  let next: Row;
  const now = new Date().toISOString();
  const input =
    table === "user" && !existing
      ? { ...body, password_hash: "mock-only:no-real-password-hash" }
      : table === "referral" && !existing
        ? {
            ...body,
            status: "NEW",
            to_project_id:
              body.to_partner_institution_id == null
                ? (body.to_project_id ??
                  store.project.find(
                    (project) => !project.is_deleted && project.pillar_id === body.to_pillar_id
                  )?.id ??
                  null)
                : (body.to_project_id ?? null),
          }
        : body;
  try {
    next = existing
      ? { ...existing, ...body, updated_at: now }
      : (makeRow(
          table,
          input,
          Math.max(0, ...rows.map((row) => row.id)) + 1,
          now
        ) as unknown as Row);
  } catch {
    return envelope(422);
  }
  if (!validate(store, table, next, existing)) return envelope(422);
  if (
    table === "participant" &&
    !existing &&
    typeof next.id_number === "string" &&
    next.id_number &&
    store.participant.some(
      (row) => row.id_number?.toLowerCase() === String(next.id_number).toLowerCase()
    )
  )
    return envelope(422, null, "A participant with this ID number is already registered");
  if (table === "grant_disbursement") {
    const award = store.grant_award.find((row) => row.id === next.grant_id && !row.is_deleted);
    const application =
      award &&
      store.grant_application.find((row) => row.id === award.application_id && !row.is_deleted);
    const paid = store.grant_disbursement
      .filter((row) => !row.is_deleted && row.grant_id === next.grant_id && row.id !== next.id)
      .reduce((sum, row) => sum + row.amount, 0);
    if (
      !award ||
      application?.status !== "APPROVED" ||
      typeof next.amount !== "number" ||
      next.amount <= 0 ||
      paid + next.amount > award.amount_awarded
    )
      return envelope(
        422,
        null,
        "Payment exceeds the approved award or the application is not approved"
      );
  }
  if (table === "grant_award") {
    const application = store.grant_application.find(
      (row) => row.id === next.application_id && !row.is_deleted
    );
    const paid = store.grant_disbursement
      .filter((row) => !row.is_deleted && row.grant_id === next.id)
      .reduce((sum, row) => sum + row.amount, 0);
    if (
      !application ||
      application.status !== "APPROVED" ||
      typeof next.amount_awarded !== "number" ||
      next.amount_awarded <= 0 ||
      next.amount_awarded > application.requested_amount ||
      next.amount_awarded < paid
    )
      return envelope(422, null, "Award must fit the approved application and recorded payments");
  }
  if (table === "grant_report") {
    const award = store.grant_award.find(
      (row) => row.id === next.grant_award_id && !row.is_deleted
    );
    const application =
      award &&
      store.grant_application.find((row) => row.id === award.application_id && !row.is_deleted);
    if (
      !award ||
      application?.status !== "APPROVED" ||
      String(next.reporting_period_start) > String(next.reporting_period_end) ||
      String(next.reporting_period_end) > String(next.due_date) ||
      (existing && next.grant_award_id !== existing.grant_award_id)
    )
      return envelope(422, null, "A reporting period requires an approved award and valid dates");
  }
  if (table === "assessment_document_check" && next.document_id !== null) {
    const document = store.document.find((row) => row.id === next.document_id && !row.is_deleted);
    if (
      !document ||
      document.owner_type !== "organisation_assessment" ||
      document.owner_id !== next.assessment_id ||
      next.document_check_status !== "obtained"
    )
      return envelope(422);
  }
  if (
    (table === "narrative_report" && next.report_status === "submitted" && !next.submitted_date) ||
    (table === "grant_report" && next.submitted_date && !next.document_id)
  )
    return envelope(422);
  const registration = !existing && (table === "participant" || table === "organisation");
  let mayWriteNext: boolean;
  if (registration) {
    // Registration precedes enrollment. The requested pillar supplies only the
    // authorization context; it never becomes an invented identity-table column.
    const pillarId = query.has("pillarId") ? Number(query.get("pillarId")) : undefined;
    if (
      pillarId !== undefined &&
      (!Number.isSafeInteger(pillarId) ||
        !store.pillar.some(
          (row) => row.id === pillarId && !row.is_deleted && row.status === "ACTIVE"
        ))
    )
      return envelope(422);
    if (pillar && pillarId !== undefined && pillarId !== pillar.id) return envelope(422);
    mayWriteNext = hasPermission(grants, permission, { pillarId });
  } else {
    if (pillar && !scopes(store, table, next).includes(pillar.id)) return envelope(403);
    mayWriteNext = allowed(store, grants, permission, table, next);
  }
  // Check both sides of a mutation to prevent moving records into/out of scope.
  if ((existing && !allowed(store, grants, permission, table, existing)) || !mayWriteNext)
    return envelope(403);
  // Match a network boundary: request-owned nested JSON must never become a
  // mutable reference into storage, including when only part of a row changes.
  try {
    next = structuredClone(next);
  } catch {
    return envelope(422);
  }
  const before = existing ? structuredClone(existing) : null;
  if (existing) Object.assign(existing, next);
  else rows.push(next);
  auditWrite(store, request, userId, table, before, next);
  if (
    table === "grant_application" &&
    existing &&
    before?.status === "REVIEWED" &&
    next.status === "APPROVED"
  ) {
    const award = makeRow(
      "grant_award",
      { application_id: next.id, amount_awarded: Number(next.requested_amount) },
      Math.max(0, ...store.grant_award.map((row) => row.id)) + 1,
      now
    );
    store.grant_award.push(award);
    auditWrite(store, request, userId, "grant_award", null, award as unknown as Row);
  }
  if (registration && table === "participant" && query.get("enroll") === "true") {
    const enrollment = makeRow(
      "enrollment",
      {
        participant_id: next.id,
        pillar_id: Number(query.get("pillarId")),
        entry_category: "Intake",
      },
      Math.max(0, ...store.enrollment.map((row) => row.id)) + 1,
      now
    );
    store.enrollment.push(enrollment);
    auditWrite(store, request, userId, "enrollment", null, enrollment as unknown as Row);
  }
  if (
    table === "referral" &&
    existing &&
    next.status === "ACCEPTED" &&
    before?.status === "NEW" &&
    next.to_partner_institution_id === null
  ) {
    const origin = store.enrollment.find((item) => item.id === next.enrollment_id);
    if (
      origin?.participant_id &&
      !store.enrollment.some(
        (item) =>
          !item.is_deleted &&
          item.participant_id === origin.participant_id &&
          item.pillar_id === next.to_pillar_id
      )
    ) {
      const enrollment = makeRow(
        "enrollment",
        {
          participant_id: origin.participant_id,
          pillar_id: Number(next.to_pillar_id),
          entry_category: "Referral intake",
        },
        Math.max(0, ...store.enrollment.map((row) => row.id)) + 1,
        now
      );
      store.enrollment.push(enrollment);
      auditWrite(store, request, userId, "enrollment", null, enrollment as unknown as Row);
    }
  }
  return envelope(existing ? 200 : 201, masked(table, next));
}
