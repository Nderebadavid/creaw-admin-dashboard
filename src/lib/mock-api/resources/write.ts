import { hasPermission } from "../../auth/permissions";
import { auditWrite } from "../audit";
import { type ResourceContext } from "../context";
import { allowed, envelope, masked, scopes, type Row } from "../core";
import { checkLookupWrite } from "../resources/lookup-writes";
import { checkAccessControlWrite } from "../resources/rbac-writes";
import { checkTrainingWrite, trainingSideEffects } from "../resources/training-writes";
import { checkCounsellingWrite, nextSessionNo } from "../resources/counselling-writes";
import { makeRow } from "../rows";
import { validate } from "../validation";
import { type ApiEnvelope } from "@/types/api";
import type { MockStore, TableName } from "@/types/db";

type Envelope = ApiEnvelope<unknown>;
/** A business rule on the row about to be stored; returns an error envelope or nothing. */
type Invariant = (store: MockStore, next: Row, existing: Row | undefined) => Envelope | undefined;

/** Columns the server owns; a client may never set them. */
const SERVER_COLUMNS = ["id", "created_at", "updated_at", "password_hash"];

const live = (row: { is_deleted: boolean } | undefined) => !!row && !row.is_deleted;
/** A step's outcome: the value to carry on with, or the error envelope to return. */
type Step<T> = { error: Envelope } | { value: T };
const nextId = (rows: { id: number }[]) => Math.max(0, ...rows.map((row) => row.id)) + 1;

const PROVIDER_COLUMNS = [
  "first_name",
  "middle_name",
  "last_name",
  "provider_type",
  "service_description",
  "affiliated_institution_id",
  "phone_number",
  "email",
  "notes",
  "status",
];
const PROVIDER_TYPES = ["counsellor", "nurse", "trainer", "advocate", "facilitator", "other"];

/** Directory rules for external providers: writable columns, type and status values, contact formats. */
function checkProviderWrite(table: TableName, body: Row): Envelope | undefined {
  if (table !== "external_provider") return undefined;
  const invalid = (message: string) => envelope(422, null, message);
  if (Object.keys(body).some((key) => !PROVIDER_COLUMNS.includes(key)))
    return invalid("A provider change names a column that cannot be written");
  if ("provider_type" in body && !PROVIDER_TYPES.includes(String(body.provider_type)))
    return invalid("Unknown provider type");
  if ("status" in body && body.status !== "ACTIVE" && body.status !== "INACTIVE")
    return invalid("Status must be ACTIVE or INACTIVE");
  if (Object.values(body).some((value) => typeof value === "string" && value.includes("•")))
    return invalid("A masked value cannot be saved");
  if (typeof body.phone_number === "string" && !/^[0-9+\-() ]{3,30}$/.test(body.phone_number))
    return invalid("Enter a valid phone number");
  if (typeof body.email === "string" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email))
    return invalid("Enter a valid email address");
  return undefined;
}

/** Checks the method, target and body shape; the body on success, an error envelope otherwise. */
function readWriteBody(ctx: ResourceContext): Step<Row> {
  const { request, query, table, id, existing } = ctx;
  if (
    (request.method !== "POST" && request.method !== "PATCH") ||
    (request.method === "PATCH" && !existing) ||
    (request.method === "POST" && id !== undefined) ||
    table === "audit_logs"
  )
    return { error: envelope(422) };
  if (!request.body || typeof request.body !== "object" || Array.isArray(request.body))
    return { error: envelope(422) };
  const body = request.body as Row;
  if (Object.keys(body).some((key) => SERVER_COLUMNS.includes(key)))
    return { error: envelope(422) };
  if (table === "pipeline_definition" || table === "stage_definition")
    return { error: envelope(422, null, "Use pipeline configuration commands") };
  // The server numbers a survivor's counselling sessions.
  if (
    table === "counselling_session" &&
    "session_no" in body &&
    body.session_no !== existing?.session_no
  )
    return { error: envelope(422, null, "Session numbers are assigned by the system") };
  if (
    table === "counselling_session" &&
    existing &&
    "enrollment_id" in body &&
    body.enrollment_id !== existing.enrollment_id
  )
    return { error: envelope(422, null, "A session cannot move to another survivor") };
  // Only a trainee's grant recommendation links a referral to its training record.
  if (table === "referral" && "source_training_enrollment_id" in body)
    return { error: envelope(422) };
  const guard =
    checkLookupWrite(ctx, body) ??
    checkAccessControlWrite(ctx, body) ??
    checkProviderWrite(table, body);
  if (guard) return { error: guard };
  // `?enroll=true&pillarId=` registers a participant and enrolls them in one step.
  if (
    query.has("enroll") &&
    (table !== "participant" ||
      request.method !== "POST" ||
      query.get("enroll") !== "true" ||
      !query.has("pillarId"))
  )
    return { error: envelope(422) };
  return { value: body };
}

/** Server-set values for a new row: a placeholder password, or a new referral's status and project. */
function creationDefaults(store: MockStore, table: TableName, body: Row): Row {
  if (table === "user") return { ...body, password_hash: "mock-only:no-real-password-hash" };
  if (table === "counselling_session")
    return { ...body, session_no: nextSessionNo(store, body.enrollment_id) };
  if (table !== "referral") return body;
  // An internal referral lands on the destination pillar's project unless one was named.
  const defaultProject = store.project.find(
    (project) => !project.is_deleted && project.pillar_id === body.to_pillar_id
  )?.id;
  const toProject =
    body.to_partner_institution_id == null
      ? (body.to_project_id ?? defaultProject ?? null)
      : (body.to_project_id ?? null);
  return { ...body, status: "NEW", to_project_id: toProject };
}

/** The row as it would be stored: the existing row patched, or a new row with defaults. */
function buildNextRow(ctx: ResourceContext, body: Row, now: string): Step<Row> {
  const { store, table, rows, existing } = ctx;
  if (existing) return { value: { ...existing, ...body, updated_at: now } };
  try {
    const row = makeRow(table, creationDefaults(store, table, body), nextId(rows), now);
    return { value: row as unknown as Row };
  } catch {
    return { error: envelope(422) };
  }
}

const invariants: Partial<Record<TableName, Invariant>> = {
  participant(store, next, existing) {
    const idNumber = typeof next.id_number === "string" ? next.id_number.toLowerCase() : "";
    if (
      !existing &&
      idNumber &&
      store.participant.some((row) => row.id_number?.toLowerCase() === idNumber)
    )
      return envelope(422, null, "A participant with this ID number is already registered");
  },
  grant_disbursement(store, next) {
    const award = store.grant_award.find((row) => row.id === next.grant_id && live(row));
    const application =
      award && store.grant_application.find((row) => row.id === award.application_id && live(row));
    const paid = store.grant_disbursement
      .filter((row) => live(row) && row.grant_id === next.grant_id && row.id !== next.id)
      .reduce((sum, row) => sum + row.amount, 0);
    const amount = next.amount;
    if (
      !award ||
      application?.status !== "APPROVED" ||
      typeof amount !== "number" ||
      amount <= 0 ||
      paid + amount > award.amount_awarded
    )
      return envelope(
        422,
        null,
        "Payment exceeds the approved award or the application is not approved"
      );
  },
  grant_award(store, next) {
    const application = store.grant_application.find(
      (row) => row.id === next.application_id && live(row)
    );
    const paid = store.grant_disbursement
      .filter((row) => live(row) && row.grant_id === next.id)
      .reduce((sum, row) => sum + row.amount, 0);
    const amount = next.amount_awarded;
    if (
      !application ||
      application.status !== "APPROVED" ||
      typeof amount !== "number" ||
      amount <= 0 ||
      amount > application.requested_amount ||
      amount < paid
    )
      return envelope(422, null, "Award must fit the approved application and recorded payments");
  },
  grant_report(store, next, existing) {
    const award = store.grant_award.find((row) => row.id === next.grant_award_id && live(row));
    const application =
      award && store.grant_application.find((row) => row.id === award.application_id && live(row));
    if (
      !award ||
      application?.status !== "APPROVED" ||
      String(next.reporting_period_start) > String(next.reporting_period_end) ||
      String(next.reporting_period_end) > String(next.due_date) ||
      (existing && next.grant_award_id !== existing.grant_award_id)
    )
      return envelope(422, null, "A reporting period requires an approved award and valid dates");
    // A submitted compliance report must carry its document.
    if (next.submitted_date && !next.document_id) return envelope(422);
  },
  assessment_document_check(store, next) {
    if (next.document_id === null) return undefined;
    const document = store.document.find((row) => row.id === next.document_id && live(row));
    if (
      !document ||
      document.owner_type !== "organisation_assessment" ||
      document.owner_id !== next.assessment_id ||
      next.document_check_status !== "obtained"
    )
      return envelope(422);
  },
  narrative_report(_store, next) {
    if (next.report_status === "submitted" && !next.submitted_date) return envelope(422);
  },
};

/**
 * Scope checks on both sides of the change, so a record can't be moved into or
 * out of a pillar the caller doesn't hold. A new participant or organisation
 * is authorized against the pillar it is being registered into.
 */
function authorizeWrite(ctx: ResourceContext, next: Row): Envelope | undefined {
  const { store, query, grants, pillar, table, existing, permission } = ctx;
  let mayWriteNext: boolean;
  if (isRegistration(ctx)) {
    // The requested pillar supplies only the authorization context; it never
    // becomes an invented identity-table column.
    const pillarId = query.has("pillarId") ? Number(query.get("pillarId")) : undefined;
    if (
      pillarId !== undefined &&
      (!Number.isSafeInteger(pillarId) ||
        !store.pillar.some((row) => row.id === pillarId && live(row) && row.status === "ACTIVE"))
    )
      return envelope(422);
    if (pillar && pillarId !== undefined && pillarId !== pillar.id) return envelope(422);
    mayWriteNext = hasPermission(grants, permission, { pillarId });
  } else {
    if (pillar && !scopes(store, table, next).includes(pillar.id)) return envelope(403);
    mayWriteNext = allowed(store, grants, permission, table, next);
  }
  if ((existing && !allowed(store, grants, permission, table, existing)) || !mayWriteNext)
    return envelope(403);
  return undefined;
}

const isRegistration = ({ table, existing }: ResourceContext) =>
  !existing && (table === "participant" || table === "organisation");

/** Stores a derived row and writes its CREATE audit entry. */
function insertAudited<T extends TableName>(
  ctx: ResourceContext,
  table: T,
  input: Partial<MockStore[T][number]>,
  now: string
) {
  const { request, store, userId } = ctx;
  const rows = store[table] as unknown as Row[];
  const row = makeRow(table, input as never, nextId(rows), now) as unknown as Row;
  rows.push(row);
  auditWrite(store, request, userId, table, null, row);
}

/** Approving an application creates its award for the requested amount. */
function awardOnApproval(ctx: ResourceContext, before: Row | null, next: Row, now: string) {
  if (ctx.table !== "grant_application" || before?.status !== "REVIEWED") return;
  if (next.status !== "APPROVED") return;
  insertAudited(
    ctx,
    "grant_award",
    { application_id: next.id, amount_awarded: Number(next.requested_amount) },
    now
  );
}

/** `?enroll=true` enrolls a newly registered participant in the requested pillar. */
function enrollOnRegistration(ctx: ResourceContext, next: Row, now: string) {
  if (!isRegistration(ctx) || ctx.table !== "participant") return;
  if (ctx.query.get("enroll") !== "true") return;
  insertAudited(
    ctx,
    "enrollment",
    {
      participant_id: next.id,
      pillar_id: Number(ctx.query.get("pillarId")),
      entry_category: "Intake",
    },
    now
  );
}

/** Accepting an internal referral enrolls the same participant in the destination pillar once. */
function enrollOnAcceptedReferral(
  ctx: ResourceContext,
  before: Row | null,
  next: Row,
  now: string
) {
  const { store, table } = ctx;
  if (table !== "referral" || before?.status !== "NEW" || next.status !== "ACCEPTED") return;
  if (next.to_partner_institution_id !== null) return;
  const origin = store.enrollment.find((item) => item.id === next.enrollment_id);
  const participantId = origin?.participant_id;
  if (!participantId) return;
  const alreadyEnrolled = store.enrollment.some(
    (item) =>
      live(item) && item.participant_id === participantId && item.pillar_id === next.to_pillar_id
  );
  if (alreadyEnrolled) return;
  insertAudited(
    ctx,
    "enrollment",
    {
      participant_id: participantId,
      pillar_id: Number(next.to_pillar_id),
      entry_category: "Referral intake",
    },
    now
  );
}

/**
 * Serves `POST`/`PATCH` for a resolved resource: body checks, the row to store,
 * schema validation, business invariants, scope checks, the audited write and
 * its side effects.
 */
export function writeResource(ctx: ResourceContext): Envelope {
  const { request, store, userId, table, rows, existing } = ctx;
  const read = readWriteBody(ctx);
  if ("error" in read) return read.error;
  const now = new Date().toISOString();
  const built = buildNextRow(ctx, read.value, now);
  if ("error" in built) return built.error;
  let next = built.value;
  if (!validate(store, table, next, existing)) return envelope(422);
  const broken =
    invariants[table]?.(store, next, existing) ??
    checkTrainingWrite(ctx, next, existing) ??
    checkCounsellingWrite(ctx, next, existing);
  if (broken) return broken;
  const denied = authorizeWrite(ctx, next);
  if (denied) return denied;

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

  awardOnApproval(ctx, before, next, now);
  enrollOnRegistration(ctx, next, now);
  enrollOnAcceptedReferral(ctx, before, next, now);
  trainingSideEffects(ctx, before, next, now);
  return envelope(existing ? 200 : 201, masked(table, next));
}
