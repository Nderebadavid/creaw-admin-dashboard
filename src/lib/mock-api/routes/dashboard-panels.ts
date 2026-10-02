import { hasModulePermission, hasPermission, type EffectiveGrant } from "../../auth/permissions";
import { allowed, type Row } from "../core";
import { displayName } from "../references";
import { inPeriod, type Period } from "../period";
import type { MockStore, TableName } from "@/types/db";

/** Keeps records inside the dashboard's location filter; every record when there is none. */
type InArea = (table: TableName, row: Row) => boolean;
const everywhere: InArea = () => true;

// The cross-pillar panels of `GET /dashboard?view=overview`: referral oversight and the
// pipeline funnel. Each returns null when the caller may see none of it.

/** An open referral older than this many days is overdue for a response. */
export const REFERRAL_OVERDUE_DAYS = 7;
const DAY_MS = 24 * 60 * 60_000;

/** Whole days from a timestamp to now. */
const ageInDays = (iso: string, now: number) =>
  Math.max(0, Math.floor((now - Date.parse(iso)) / DAY_MS));

/** The first day of the calendar quarter `now` falls in, as YYYY-MM-DD. */
export const currentQuarterStart = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1))
    .toISOString()
    .slice(0, 10);

/**
 * Referrals waiting on a response, where they are waiting, the five waiting longest, and
 * how many decided in the period were accepted (the current quarter so far by default).
 * Scoped to referrals the caller may view.
 */
export function referralOversight(
  store: MockStore,
  grants: EffectiveGrant[],
  now = new Date(),
  inArea: InArea = everywhere,
  period: Period = { from: currentQuarterStart(now), to: now.toISOString().slice(0, 10) }
) {
  if (!hasModulePermission(grants, "REFERRAL_VIEW")) return null;
  const visible = store.referral.filter(
    (row) =>
      !row.is_deleted &&
      allowed(store, grants, "REFERRAL_VIEW", "referral", row as unknown as Row) &&
      inArea("referral", row as unknown as Row)
  );
  const at = now.getTime();
  const open = visible
    .filter((row) => row.status === "NEW")
    .map((row) => ({ row, age: ageInDays(row.created_at, at) }))
    .sort((a, b) => b.age - a.age || a.row.id - b.row.id);

  const destinations = new Map<number, { open: number; oldest_days: number }>();
  for (const { row, age } of open) {
    const entry = destinations.get(row.to_pillar_id) ?? { open: 0, oldest_days: 0 };
    entry.open += 1;
    entry.oldest_days = Math.max(entry.oldest_days, age);
    destinations.set(row.to_pillar_id, entry);
  }

  // A referral's last change is its decision: only NEW referrals are ever edited.
  const decided = visible.filter(
    (row) => ["ACCEPTED", "DECLINED"].includes(row.status) && inPeriod(period, row.updated_at)
  );
  const accepted = decided.filter((row) => row.status === "ACCEPTED").length;

  return {
    open: open.length,
    overdue: open.filter(({ age }) => age > REFERRAL_OVERDUE_DAYS).length,
    overdue_after_days: REFERRAL_OVERDUE_DAYS,
    decided_in_period: decided.length,
    accepted_rate: decided.length ? Math.round((accepted / decided.length) * 100) : null,
    by_destination: [...destinations.entries()]
      .map(([pillar_id, entry]) => ({ pillar_id, ...entry }))
      .sort((a, b) => b.open - a.open || b.oldest_days - a.oldest_days),
    oldest: open.slice(0, 5).map(({ row, age }) => ({
      id: row.id,
      participant_name: displayName(store, "enrollment", row.enrollment_id),
      from_pillar_id: row.from_pillar_id,
      to_pillar_id: row.to_pillar_id,
      destination_name: displayName(store, "partner_institution", row.to_partner_institution_id),
      raised_on: row.created_at.slice(0, 10),
      age_days: age,
    })),
  };
}

/** Pillars whose funnel the caller may see: a configured pipeline and stage-event access. */
function funnelPillars(store: MockStore, grants: EffectiveGrant[], pillarIds: number[]) {
  return store.pillar.filter(
    (pillar) =>
      pillarIds.includes(pillar.id) &&
      hasPermission(grants, "FIELD_SUBMISSION_VIEW", { pillarId: pillar.id }) &&
      store.pipeline_definition.some((row) => !row.is_deleted && row.pillar_id === pillar.id)
  );
}

/**
 * How far the pillar's current enrollments have got: for each stage, how many have reached
 * it or a later one (disputed stage events don't count). `requested` is a pillar code; the
 * first pillar with a visible funnel is used when it is missing or not visible.
 */
export function pipelineFunnel(
  store: MockStore,
  grants: EffectiveGrant[],
  pillarIds: number[],
  requested: string | null,
  inArea: InArea = everywhere
) {
  const options = funnelPillars(store, grants, pillarIds);
  const pillar =
    options.find((row) => row.code.toLowerCase() === requested?.toLowerCase()) ?? options[0];
  if (!pillar) return null;
  const pipeline = store.pipeline_definition.find(
    (row) => !row.is_deleted && row.pillar_id === pillar.id
  )!;
  const stages = store.stage_definition
    .filter((row) => !row.is_deleted && row.pipeline_id === pipeline.id)
    .sort((a, b) => a.step_no - b.step_no);
  const stepOf = new Map(stages.map((stage) => [stage.id, stage.step_no]));
  const enrollmentIds = new Set(
    store.enrollment
      .filter(
        (row) =>
          !row.is_deleted &&
          row.pillar_id === pillar.id &&
          inArea("enrollment", row as unknown as Row)
      )
      .map((row) => row.id)
  );
  // The furthest stage each enrollment has reached.
  const furthest = new Map<number, number>();
  for (const event of store.participant_stage_event) {
    const step = stepOf.get(event.stage_definition_id);
    if (
      event.is_deleted ||
      event.stage_event_status === "disputed" ||
      step === undefined ||
      !enrollmentIds.has(event.enrollment_id)
    )
      continue;
    furthest.set(event.enrollment_id, Math.max(furthest.get(event.enrollment_id) ?? 0, step));
  }
  const reached = [...furthest.values()];
  return {
    pillar_id: pillar.id,
    code: pillar.code.toLowerCase(),
    pipeline_name: pipeline.name,
    enrollments: enrollmentIds.size,
    stages: stages.map((stage) => ({
      id: stage.id,
      step_no: stage.step_no,
      name: stage.name,
      reached: reached.filter((step) => step >= stage.step_no).length,
    })),
    available: options.map((row) => row.code.toLowerCase()),
  };
}
