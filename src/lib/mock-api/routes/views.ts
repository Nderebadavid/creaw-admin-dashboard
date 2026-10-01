import { hasModulePermission, hasPermission } from "../../auth/permissions";
import { safeAuditRow } from "../audit";
import { type MockContext } from "../context";
import {
  allowed,
  envelope,
  lookups,
  readableAsReference,
  rowsFor,
  visible,
  type Row,
} from "../core";
import { calendarRows } from "../reporting";
import { presentRow } from "../resources/read";
import { displayName } from "../references";
import { grantHandoff } from "../training";
import { peopleOptions } from "./facilitators";
import { buildCoverage } from "@/features/sessions/coverage";
import { parsePeriod } from "@/features/sessions/model";
import type { MockStore, TableName } from "@/types/db";

// Composite reads: what has to be computed or gathered on the server, so a screen
// does not download whole tables to count or join them. Lists and drawers use the
// generic resource endpoints with their query conventions instead.

const pillarOf = (store: MockStore, code: string | undefined) =>
  store.pillar.find(
    (row) =>
      !row.is_deleted && (row.code.toLowerCase() === code?.toLowerCase() || String(row.id) === code)
  );

/** A version string that changes whenever any of the rows change, for client caching. */
function versionOf(rows: Row[]) {
  const latest = rows.reduce(
    (max, row) => (String(row.updated_at) > max ? String(row.updated_at) : max),
    ""
  );
  return `${rows.length}-${latest}`;
}

/**
 * `GET /lookups?tables=ward,county`: several lookup tables in one call. Tables the
 * caller may not read are listed under `denied` rather than failing the request.
 */
export function handleLookupBatch(ctx: MockContext) {
  const { request, store, url, query, grants } = ctx;
  if (url.pathname !== "/lookups") return undefined;
  if (
    request.method !== "GET" ||
    [...query.keys()].some((key) => !["tables", "includeDeleted"].includes(key))
  )
    return envelope(422);
  const names = [...new Set((query.get("tables") ?? "").split(",").filter(Boolean))];
  if (
    !names.length ||
    names.length > 12 ||
    names.some((name) => !lookups.includes(name as TableName))
  )
    return envelope(422);
  const manager = hasPermission(grants, "LOOKUP_MANAGE");
  const tables: Record<string, Row[]> = {};
  const denied: string[] = [];
  const all: Row[] = [];
  for (const name of names as TableName[]) {
    const permission = manager ? "LOOKUP_MANAGE" : "DASHBOARD_VIEW";
    if (!hasModulePermission(grants, permission) && !readableAsReference(grants, name)) {
      denied.push(name);
      continue;
    }
    // Retired rows: lookup managers, and session staff for retired topic and type names.
    const withDeleted =
      query.get("includeDeleted") === "true" &&
      (manager ||
        ((name === "activity_topic" || name === "activity_type_definition") &&
          hasModulePermission(grants, "ACTIVITY_SESSION_VIEW")));
    const rows = rowsFor(store, name).filter(
      (row) =>
        (visible(row) || withDeleted) &&
        (manager || allowed(store, grants, "DASHBOARD_VIEW", name, row))
    );
    all.push(...rows);
    tables[name] = rows.map((row) => presentRow(store, name, row));
  }
  return envelope(200, { tables, denied, version: versionOf(all) });
}

const quarterStart = (today: Date) =>
  new Date(Date.UTC(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1))
    .toISOString()
    .slice(0, 10);

/** Counties of the given participants, most common first. */
function countiesOf(store: MockStore, participantIds: Set<number>) {
  const tally = new Map<string, number>();
  for (const participant of store.participant) {
    if (!participantIds.has(participant.id)) continue;
    const ward = store.ward.find((row) => row.id === participant.ward_id);
    const subCounty = store.sub_county.find((row) => row.id === ward?.sub_county_id);
    const county = store.county.find((row) => row.id === subCounty?.county_id);
    if (county) tally.set(county.name, (tally.get(county.name) ?? 0) + 1);
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

/** The pillar's group-session cards and curriculum coverage for the period. */
function sessionCards(store: MockStore, pillarId: number, periodText: string | null) {
  const period = parsePeriod(periodText);
  const active = (row: { status: string; is_deleted: boolean }) =>
    row.status === "ACTIVE" && !row.is_deleted;
  const types = store.activity_type_definition
    .filter((row) => row.pillar_id === pillarId)
    .map((row) => ({ id: row.id, name: row.name, active: active(row) }));
  const typeIds = new Set(types.map((row) => row.id));
  const topics = store.activity_topic
    .filter((row) => typeIds.has(row.activity_type_id))
    .map((row) => ({
      id: row.id,
      activityTypeId: row.activity_type_id,
      name: row.name,
      sequenceNo: row.sequence_no,
      active: active(row),
    }));
  const sessions = store.activity_session.filter(
    (row) => !row.is_deleted && row.pillar_id === pillarId
  );
  const sessionIds = new Set(sessions.map((row) => row.id));
  const { coverage, summary } = buildCoverage({
    types,
    topics,
    sessions: sessions.map((row) => ({
      id: row.id,
      activityTypeId: row.activity_type_id,
      topicId: row.activity_topic_id,
      freeTopic: row.topic?.trim() ? row.topic : null,
      date: row.session_date,
    })),
    attendance: store.activity_attendance
      .filter((row) => !row.is_deleted && sessionIds.has(row.session_id))
      .map((row) => ({ sessionId: row.session_id, participantId: row.participant_id })),
    period,
    today: new Date(),
  });
  return { period, summary, coverage };
}

/** Skilling's trainee cards: completion, work outcomes and grant recommendations. */
function traineeCards(store: MockStore) {
  const rows = rowsFor(store, "training_enrollment").filter(visible);
  const completed = rows.filter((row) => row.training_status === "completed");
  const droppedOut = rows.filter((row) => row.training_status === "dropped_out").length;
  const inWork = completed.filter((row) =>
    ["employed", "self_employed"].includes(String(row.current_work_status))
  ).length;
  const stages = rows.map((row) => grantHandoff(store, row).grant_handoff);
  const percent = (part: number, whole: number) =>
    whole ? Math.round((part / whole) * 100) : null;
  return {
    enrolled: rows.length,
    completed: completed.length,
    dropped_out: droppedOut,
    completion_rate: percent(completed.length, completed.length + droppedOut),
    in_work: inWork,
    in_work_rate: percent(inWork, completed.length),
    recommended: stages.filter((stage) => !["none", "declined"].includes(stage)).length,
    accepted_by_wee: stages.filter((stage) =>
      ["accepted", "application_filed", "awarded"].includes(stage)
    ).length,
  };
}

/** VAWG's case and counselling cards. */
function vawgCards(store: MockStore, pillarId: number, counselling: boolean) {
  const enrollments = store.enrollment.filter(
    (row) => !row.is_deleted && row.pillar_id === pillarId
  );
  const enrollmentIds = new Set(enrollments.map((row) => row.id));
  const cases = store.legal_case.filter(
    (row) => !row.is_deleted && enrollmentIds.has(row.enrollment_id)
  );
  const sessions = store.counselling_session.filter(
    (row) => !row.is_deleted && enrollmentIds.has(row.enrollment_id)
  );
  const since = quarterStart(new Date());
  return {
    survivors: enrollments.length,
    open_cases: cases.filter((row) => !row.closed_date).length,
    concluded: cases.filter((row) => row.closed_date || row.court_status === "judgment_delivered")
      .length,
    counselling_sessions: counselling ? sessions.length : null,
    counselling_this_quarter: counselling
      ? sessions.filter((row) => row.session_date >= since).length
      : null,
  };
}

/**
 * `GET /pillars/:pillar/summary?period=`: the pillar header, its pipeline with the
 * number of enrollments at each stage, where participants live, and the pillar's
 * own headline cards. Each block is present only when the caller may see it.
 */
export function handlePillarSummary(ctx: MockContext) {
  const { request, store, query, parts, grants } = ctx;
  if (parts[0] !== "pillars" || parts[2] !== "summary" || parts.length !== 3) return undefined;
  if (request.method !== "GET" || [...query.keys()].some((key) => key !== "period"))
    return envelope(422);
  const pillar = pillarOf(store, parts[1]);
  if (!pillar) return envelope(404);
  const scope = { pillarId: pillar.id };
  if (!hasPermission(grants, "DASHBOARD_VIEW", scope)) return envelope(403);
  const can = (code: string) => hasPermission(grants, code, scope);
  const pipeline = store.pipeline_definition.find(
    (row) => !row.is_deleted && row.pillar_id === pillar.id
  );
  const stages = pipeline
    ? store.stage_definition
        .filter((row) => !row.is_deleted && row.pipeline_id === pipeline.id)
        .sort((a, b) => a.step_no - b.step_no)
    : [];
  const events = store.participant_stage_event.filter((row) => !row.is_deleted);
  const enrollments = store.enrollment.filter(
    (row) => !row.is_deleted && row.pillar_id === pillar.id
  );
  const code = pillar.code.toLowerCase();
  return envelope(200, {
    pillar: {
      id: pillar.id,
      code,
      name: pillar.name,
      lead_user_id: pillar.lead_user_id,
      lead_name: displayName(store, "user", pillar.lead_user_id),
      status: pillar.status,
    },
    pipeline: pipeline
      ? {
          id: pipeline.id,
          name: pipeline.name,
          stages: stages.map((stage) => ({
            id: stage.id,
            step_no: stage.step_no,
            name: stage.name,
            // Distinct enrollments with an event at the stage; needs field-submission access.
            count: can("FIELD_SUBMISSION_VIEW")
              ? new Set(
                  events
                    .filter((event) => event.stage_definition_id === stage.id)
                    .map((event) => event.enrollment_id)
                ).size
              : null,
          })),
        }
      : null,
    enrollments: can("PARTICIPANT_VIEW")
      ? {
          total: enrollments.length,
          active: enrollments.filter((row) => row.status === "ACTIVE").length,
          counties: countiesOf(
            store,
            new Set(enrollments.map((row) => row.participant_id).filter((id): id is number => !!id))
          ),
        }
      : null,
    cards: {
      vawg:
        code === "vawg" && can("CASE_VIEW")
          ? vawgCards(store, pillar.id, can("COUNSELLING_VIEW"))
          : null,
      sessions:
        (code === "srhr" || code === "skilling") && can("ACTIVITY_SESSION_VIEW")
          ? sessionCards(store, pillar.id, query.get("period"))
          : null,
      trainees: code === "skilling" && can("TRAINING_ENROLLMENT_VIEW") ? traineeCards(store) : null,
    },
  });
}

const FORMS: Record<string, { pillars: string[]; permission: string }> = {
  session: { pillars: ["srhr", "skilling"], permission: "ACTIVITY_SESSION_LOG" },
  trainee: { pillars: ["skilling"], permission: "TRAINING_ENROLLMENT_EDIT" },
  counselling: { pillars: ["vawg"], permission: "COUNSELLING_LOG" },
  case: { pillars: ["vawg"], permission: "CASE_EDIT" },
};

/** Enrollments of a pillar as `{id, label}`: the person's name, plus the entry category. */
function enrollmentOptions(store: MockStore, pillarId: number, withCategory: boolean) {
  return store.enrollment
    .filter((row) => !row.is_deleted && row.pillar_id === pillarId)
    .map((row) => {
      const name = displayName(store, "enrollment", row.id) ?? "Enrollment record";
      return {
        id: row.id,
        label: withCategory && row.entry_category ? `${name} · ${row.entry_category}` : name,
      };
    });
}

/**
 * `GET /pillars/:pillar/form-options?form=session|trainee|counselling|case`: every
 * option list one form needs, in one call, when the form opens. People are names
 * only. Picking participants for attendance uses `/participants?search=` instead.
 */
export function handleFormOptions(ctx: MockContext) {
  const { request, store, query, parts, grants } = ctx;
  if (parts[0] !== "pillars" || parts[2] !== "form-options" || parts.length !== 3) return undefined;
  if (request.method !== "GET" || [...query.keys()].some((key) => key !== "form"))
    return envelope(422);
  const pillar = pillarOf(store, parts[1]);
  if (!pillar) return envelope(404);
  const form = FORMS[query.get("form") ?? ""];
  const code = pillar.code.toLowerCase();
  if (!form || !form.pillars.includes(code)) return envelope(422);
  if (!hasPermission(grants, form.permission, { pillarId: pillar.id })) return envelope(403);
  const isActive = (row: { status: string; is_deleted: boolean }) =>
    row.status === "ACTIVE" && !row.is_deleted;
  const name = query.get("form");
  if (name === "session") {
    const types = store.activity_type_definition.filter((row) => row.pillar_id === pillar.id);
    const typeIds = new Set(types.map((row) => row.id));
    return envelope(200, {
      activity_types: types.map((row) => ({ id: row.id, name: row.name, active: isActive(row) })),
      topics: store.activity_topic
        .filter((row) => typeIds.has(row.activity_type_id))
        .map((row) => ({
          id: row.id,
          activity_type_id: row.activity_type_id,
          name: row.name,
          sequence_no: row.sequence_no,
          active: isActive(row),
        })),
      facilitators: peopleOptions(store, "facilitator_option"),
    });
  }
  if (name === "trainee")
    return envelope(200, {
      enrollments: enrollmentOptions(store, pillar.id, true),
      institutions: store.partner_institution
        .filter(isActive)
        .map((row) => ({ id: row.id, label: row.name })),
      trainers: peopleOptions(store, "trainer_option").map((row) => ({
        id: row.id,
        label: `${row.name} · ${row.detail}`,
      })),
    });
  if (name === "counselling")
    return envelope(200, {
      survivors: enrollmentOptions(store, pillar.id, false),
      counsellors: peopleOptions(store, "counsellor_option"),
    });
  return envelope(200, {
    survivors: enrollmentOptions(store, pillar.id, false),
    case_types: store.case_type
      .filter((row) => isActive(row) && row.pillar_id === pillar.id)
      .map((row) => ({ id: row.id, name: row.name })),
  });
}

/**
 * `GET /dashboard?view=overview&year=&pillar=`: every dashboard panel computed on the
 * server: reach per pillar, quarter counts, the monthly chart (optionally for one
 * pillar), pending submissions, reporting alerts and recent activity. Each panel is
 * scoped to what the caller may see, and null when they may see none of it.
 */
export function handleDashboardOverview(ctx: MockContext) {
  const { request, store, url, query, grants } = ctx;
  if (url.pathname !== "/dashboard" || query.get("view") !== "overview") return undefined;
  if (
    request.method !== "GET" ||
    [...query.keys()].some((key) => !["view", "year", "pillar"].includes(key))
  )
    return envelope(422);
  const pillars = store.pillar.filter(
    (pillar) =>
      !pillar.is_deleted && hasPermission(grants, "DASHBOARD_VIEW", { pillarId: pillar.id })
  );
  if (!pillars.length) return envelope(403);
  const year = /^20\d{2}$/.test(query.get("year") ?? "") ? query.get("year")! : "2026";
  const participants = store.participant.filter(
    (row) =>
      !row.is_deleted &&
      allowed(store, grants, "PARTICIPANT_VIEW", "participant", row as unknown as Row)
  );
  const enrollmentsOf = (pillarId: number) =>
    hasPermission(grants, "PARTICIPANT_VIEW", { pillarId })
      ? store.enrollment.filter((row) => !row.is_deleted && row.pillar_id === pillarId)
      : [];
  const canSubmissions = hasModulePermission(grants, "FIELD_SUBMISSION_VIEW");
  const submissions = canSubmissions
    ? store.participant_stage_event.filter(
        (row) =>
          !row.is_deleted &&
          allowed(
            store,
            grants,
            "FIELD_SUBMISSION_VIEW",
            "participant_stage_event",
            row as unknown as Row
          )
      )
    : [];
  // The chart's pillar filter keeps only that pillar's participants and field updates.
  const charted = pillars.find((pillar) => pillar.code.toLowerCase() === query.get("pillar"));
  const chartedEnrollments = charted ? enrollmentsOf(charted.id) : null;
  const chartedIds = chartedEnrollments && new Set(chartedEnrollments.map((row) => row.id));
  const chartedPeople =
    chartedEnrollments && new Set(chartedEnrollments.map((row) => row.participant_id));
  const registered = participants
    .filter((row) => !chartedPeople || chartedPeople.has(row.id))
    .map((row) => row.created_at);
  const verified = submissions
    .filter(
      (row) =>
        row.stage_event_status === "verified" && (!chartedIds || chartedIds.has(row.enrollment_id))
    )
    .map((row) => row.event_date);
  const between = (from: string, to: string) =>
    participants.filter((row) => row.created_at >= from && row.created_at < to).length;
  const canReports = ["NARRATIVE_REPORT_MANAGE", "GRANT_REPORT_VIEW", "GRANT_REPORT_MANAGE"].some(
    (code) => hasModulePermission(grants, code)
  );
  const reports = canReports ? calendarRows(store, grants) : null;
  const enrollmentPillar = new Map(store.enrollment.map((row) => [row.id, row]));
  return envelope(200, {
    participant_count: participants.length,
    enrollment_count: pillars.reduce((sum, pillar) => sum + enrollmentsOf(pillar.id).length, 0),
    new_this_quarter: between(`${year}-07-01`, `${year}-10-01`),
    previous_quarter: between(`${year}-04-01`, `${year}-07-01`),
    pending_submissions: canSubmissions
      ? submissions.filter((row) => row.stage_event_status !== "verified").length
      : null,
    pillars: pillars.map((pillar) => {
      const rows = enrollmentsOf(pillar.id);
      return {
        id: pillar.id,
        code: pillar.code.toLowerCase(),
        lead_name: displayName(store, "user", pillar.lead_user_id),
        reached: rows.length,
        active: rows.filter((row) => row.status === "ACTIVE").length,
      };
    }),
    monthly: Array.from({ length: 12 }, (_, index) => {
      const prefix = `${year}-${String(index + 1).padStart(2, "0")}`;
      return {
        month: index + 1,
        new_count: registered.filter((date) => date.startsWith(prefix)).length,
        completed_count: verified.filter((date) => date.startsWith(prefix)).length,
      };
    }),
    recent_submissions: canSubmissions
      ? submissions
          .filter((row) => row.stage_event_status !== "verified")
          .slice(0, 4)
          .map((row) => {
            const enrollment = enrollmentPillar.get(row.enrollment_id);
            return {
              id: row.id,
              title: row.notes?.split(" — ")[0] ?? null,
              pillar_id: enrollment?.pillar_id ?? null,
              category: enrollment?.entry_category ?? null,
              status: row.stage_event_status,
              event_date: row.event_date,
            };
          })
      : null,
    reports: reports && {
      total: reports.length,
      overdue: reports
        .filter((row) => row.status === "overdue")
        .map((row) => ({ title: row.title, project: row.project, due_date: row.dueDate })),
      upcoming: reports
        .filter((row) => row.status !== "submitted")
        .slice(0, 4)
        .map((row) => ({
          id: row.id,
          key: row.key,
          title: row.title,
          project: row.project,
          status: row.status,
          period_end: row.periodEnd,
          due_date: row.dueDate,
        })),
    },
    recent_activity: hasPermission(grants, "AUDIT_LOG_VIEW")
      ? [...store.audit_logs]
          .sort((a, b) => b.performed_at.localeCompare(a.performed_at) || b.id - a.id)
          .slice(0, 5)
          .map((row) => {
            const safe = safeAuditRow(store, row);
            return {
              id: safe.id,
              action: safe.action,
              entity_type: safe.entity_type,
              entity_id: safe.entity_id,
              source: safe.source,
              performed_at: safe.performed_at,
              performed_by_name: safe.performed_by_name,
            };
          })
      : null,
  });
}
