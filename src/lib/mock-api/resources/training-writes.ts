import { hasPermission } from "../../auth/permissions";
import { auditWrite } from "../audit";
import { type ResourceContext } from "../context";
import { envelope, type Row } from "../core";
import { makeRow } from "../rows";
import {
  EARNING_STATUSES,
  linkedReferral,
  participantIdOf,
  pillarIdOf,
  recommendationReason,
} from "../training";
import type { ApiEnvelope } from "@/types/api";

type Envelope = ApiEnvelope<unknown>;
const invalid = (message: string) => envelope(422, null, message);

/**
 * Trainee outcome rules and the grant-recommendation gate: an ongoing trainee has no
 * outcome; a finished one has a date no earlier than the start; only earners have a
 * salary; only completed trainees may be recommended, and a recommendation WEE has
 * accepted is locked.
 */
export function checkTrainingWrite(
  ctx: ResourceContext,
  next: Row,
  existing: Row | undefined
): Envelope | undefined {
  if (ctx.table !== "training_enrollment") return undefined;
  const { store, grants } = ctx;
  if (existing && next.enrollment_id !== existing.enrollment_id)
    return invalid("A trainee record cannot move to another enrollment");
  const status = String(next.training_status);
  if (
    status === "ongoing" &&
    [next.completion_date, next.current_work_status, next.workstation, next.monthly_salary].some(
      (value) => value !== null && value !== undefined
    )
  )
    return invalid("An ongoing trainee has no completion date or work outcome yet");
  if (status !== "ongoing" && !next.completion_date)
    return invalid("Record the completion or drop-out date");
  if (
    next.start_date &&
    next.completion_date &&
    String(next.completion_date) < String(next.start_date)
  )
    return invalid("The completion date cannot be before the start date");
  if (next.monthly_salary !== null && next.monthly_salary !== undefined) {
    if (!EARNING_STATUSES.includes(String(next.current_work_status)))
      return invalid("A salary needs an employed or self-employed work status");
    if (typeof next.monthly_salary !== "number" || next.monthly_salary <= 0)
      return invalid("Enter a monthly salary above zero");
  }

  const was = existing?.recommended_for_grant === true;
  const now = next.recommended_for_grant === true;
  const link = linkedReferral(store, existing?.id);
  if (
    was !== now &&
    !hasPermission(grants, "REFERRAL_CREATE", { pillarId: pillarIdOf(store, "skilling") })
  )
    return envelope(403, null, "You cannot refer trainees to WEE");
  if (was && !now && link?.status === "ACCEPTED")
    return invalid("WEE has already accepted this recommendation");
  if (now && status !== "completed")
    return invalid(
      !was
        ? "Only completed trainees can be recommended for a grant"
        : link?.status === "ACCEPTED"
          ? "WEE has already accepted this recommendation"
          : "Withdraw the grant recommendation first"
    );
  if (now && !was) {
    const participantId = participantIdOf(store, next.enrollment_id);
    const alreadyAccepted = store.referral.some(
      (row) =>
        !row.is_deleted &&
        row.status === "ACCEPTED" &&
        row.source_training_enrollment_id !== null &&
        participantIdOf(store, row.enrollment_id) === participantId
    );
    if (alreadyAccepted) return invalid("Already referred to WEE");
    if (!weeProjectId(ctx)) return invalid("WEE has no programme to receive the referral");
  }
  return undefined;
}

const weeProjectId = ({ store }: ResourceContext) => {
  const wee = pillarIdOf(store, "wee");
  return store.project.find((row) => !row.is_deleted && row.pillar_id === wee)?.id;
};

/** Patches a stored row of another table and writes its UPDATE audit entry. */
function updateAudited(
  ctx: ResourceContext,
  table: "referral" | "training_enrollment",
  row: Row,
  change: Record<string, unknown>,
  now: string
) {
  const before = structuredClone(row);
  Object.assign(row, change, { updated_at: now });
  auditWrite(ctx.store, ctx.request, ctx.userId, table, before, row);
}

/**
 * Recommending a trainee refers them to WEE; withdrawing a pending recommendation
 * withdraws that referral; a declined or withdrawn recommendation referral clears
 * the trainee's flag so they can be recommended again later.
 */
export function trainingSideEffects(
  ctx: ResourceContext,
  before: Row | null,
  next: Row,
  now: string
) {
  const { store, request, userId, table } = ctx;
  if (table === "training_enrollment") {
    const was = before?.recommended_for_grant === true;
    const isNow = next.recommended_for_grant === true;
    if (isNow && !was) {
      const referral = makeRow(
        "referral",
        {
          enrollment_id: Number(next.enrollment_id),
          from_pillar_id: pillarIdOf(store, "skilling"),
          to_pillar_id: pillarIdOf(store, "wee"),
          to_project_id: weeProjectId(ctx) ?? null,
          trigger_reason: recommendationReason(next),
          status: "NEW",
          source_training_enrollment_id: next.id,
        },
        Math.max(0, ...store.referral.map((row) => row.id)) + 1,
        now
      );
      store.referral.push(referral);
      auditWrite(store, request, userId, "referral", null, referral as unknown as Row);
    }
    if (was && !isNow) {
      const link = linkedReferral(store, next.id);
      if (link?.status === "NEW")
        updateAudited(ctx, "referral", link as unknown as Row, { status: "WITHDRAWN" }, now);
    }
    return;
  }
  if (table !== "referral" || before?.status !== "NEW") return;
  if (next.status !== "DECLINED" && next.status !== "WITHDRAWN") return;
  const trainee = store.training_enrollment.find(
    (row) => row.id === next.source_training_enrollment_id
  );
  if (trainee?.recommended_for_grant)
    updateAudited(
      ctx,
      "training_enrollment",
      trainee as unknown as Row,
      { recommended_for_grant: false },
      now
    );
}
