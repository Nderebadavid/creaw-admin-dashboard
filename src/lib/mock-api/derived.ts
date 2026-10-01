import { hasPermission, type EffectiveGrant } from "../auth/permissions";
import { displayName } from "./references";
import { enrollmentRead, type Row } from "./core";
import {
  SRHR_PILLAR_ID,
  curriculumMilestones,
  curriculumProgress,
  isBehind,
  srhrEnrollment,
} from "./curriculum";
import type { MockStore, TableName } from "@/types/db";

// Per-table derived fields beyond reference names, so registers can show, sort and
// filter on them without downloading the tables they come from. Fields drawn from
// data the caller may not see (counselling) are null unless their grants allow it.

/** Derived columns per table; never stored, so a write naming one is rejected. */
export const DERIVED_COLUMNS: Partial<Record<TableName, string[]>> = {
  enrollment: [
    "record_name",
    "counselling_count",
    "counselling_last_date",
    "counselling_last_type",
    "counselling_last_counsellor",
    "counselling_last_counsellor_kind",
    "legal_case_number",
    "has_legal_case",
  ],
  participant_stage_event: [
    "pillar_id",
    "pillar_name",
    "entry_category",
    "stage_name",
    "place",
    "review_status",
  ],
  legal_case: ["case_number", "case_type_route", "case_type_requires_forms"],
  activity_session: ["attendee_count"],
  activity_attendance: ["participant_ward_name"],
  participant: [
    "full_name",
    "county_id",
    "county_name",
    "pillar_codes",
    "enrollment_count",
    "current_stage_name",
    "curriculum_done",
    "curriculum_total",
    "curriculum_last_attended",
    "curriculum_behind",
  ],
  ward: ["county_id", "county_name"],
  referral: ["destination_label"],
  external_provider: ["sessions_count", "counselling_count", "trainees_count", "cases_count"],
  user: ["role_names", "scope_names", "active_role_count"],
  organisation_assessment: ["organisation_due_diligence"],
  organisation_assessment_score: ["criterion_label", "criterion_max"],
  grant_application: ["project_pillar_id", "stage_index", "reporting_award_id"],
  organisation: [
    "county_name",
    "enrollment_id",
    "entry_category",
    "current_stage_index",
    "current_stage_name",
    "stage_count",
    "is_contracted",
    "in_due_diligence",
  ],
};

const WRO_PILLAR_ID = 5;

const pad = (id: unknown) => String(id).padStart(4, "0");
const caseNumberOf = (id: unknown) => `CRW-VAWG-${pad(id)}`;

/** "Ward · County" for a participant, or just the ward, or null. */
function placeOf(store: MockStore, participantId: unknown) {
  const participant = store.participant.find((row) => row.id === participantId);
  const ward = store.ward.find((row) => row.id === participant?.ward_id);
  if (!ward) return null;
  const subCounty = store.sub_county.find((row) => row.id === ward.sub_county_id);
  const county = store.county.find((row) => row.id === subCounty?.county_id);
  return county ? `${ward.name} · ${county.name}` : ward.name;
}

const reviewStatus = (status: unknown) =>
  status === "verified" ? "Approved" : status === "disputed" ? "Flagged" : "Pending review";

/** The derived fields for one row, to be merged over the row's other fields. */
export function derivedFields(
  store: MockStore,
  table: TableName,
  row: Row,
  grants?: EffectiveGrant[]
): Record<string, unknown> | null {
  if (table === "enrollment") {
    const sessions = store.counselling_session
      .filter((item) => !item.is_deleted && item.enrollment_id === row.id)
      .sort((a, b) => a.session_no - b.session_no);
    const mayCounsel =
      !!grants && hasPermission(grants, "COUNSELLING_VIEW", { pillarId: Number(row.pillar_id) });
    const last = mayCounsel ? sessions.at(-1) : undefined;
    const legalCase = store.legal_case.find(
      (item) => !item.is_deleted && item.enrollment_id === row.id
    );
    const mayCase =
      !!grants && hasPermission(grants, "CASE_VIEW", { pillarId: Number(row.pillar_id) });
    const counsellor = last?.counsellor_user_id
      ? displayName(store, "user", last.counsellor_user_id)
      : displayName(store, "external_provider", last?.counsellor_provider_id);
    return {
      record_name: displayName(store, "enrollment", row.id),
      counselling_count: mayCounsel ? sessions.length : null,
      counselling_last_date: last?.session_date ?? null,
      counselling_last_type: last?.session_type ?? null,
      counselling_last_counsellor: counsellor,
      counselling_last_counsellor_kind: last
        ? last.counsellor_user_id
          ? "staff"
          : last.counsellor_provider_id
            ? "provider"
            : null
        : null,
      legal_case_number: mayCase && legalCase ? caseNumberOf(legalCase.id) : null,
      has_legal_case: mayCase ? !!legalCase : null,
    };
  }
  if (table === "participant_stage_event") {
    const enrollment = store.enrollment.find((item) => item.id === row.enrollment_id);
    return {
      pillar_id: enrollment?.pillar_id ?? null,
      pillar_name: displayName(store, "pillar", enrollment?.pillar_id),
      entry_category: enrollment?.entry_category ?? null,
      stage_name: displayName(store, "stage_definition", row.stage_definition_id),
      place: enrollment?.participant_id ? placeOf(store, enrollment.participant_id) : null,
      review_status: reviewStatus(row.stage_event_status),
    };
  }
  if (table === "legal_case") {
    const type = store.case_type.find((item) => item.id === row.case_type_id);
    return {
      case_number: caseNumberOf(row.id),
      case_type_route: type?.default_route ?? null,
      case_type_requires_forms: type?.requires_p3_prc_forms ?? false,
    };
  }
  if (table === "activity_session")
    return {
      attendee_count: store.activity_attendance.filter(
        (item) => !item.is_deleted && item.session_id === row.id
      ).length,
    };
  if (table === "activity_attendance") {
    const participant = store.participant.find((item) => item.id === row.participant_id);
    return {
      participant_ward_name: displayName(store, "ward", participant?.ward_id),
    };
  }
  if (table === "organisation") {
    const enrollment = store.enrollment.find(
      (item) =>
        !item.is_deleted && item.organisation_id === row.id && item.pillar_id === WRO_PILLAR_ID
    );
    const pipeline = store.pipeline_definition.find(
      (item) => !item.is_deleted && item.pillar_id === WRO_PILLAR_ID
    );
    const stages = pipeline
      ? store.stage_definition
          .filter((item) => !item.is_deleted && item.pipeline_id === pipeline.id)
          .sort((a, b) => a.step_no - b.step_no)
      : [];
    // Stage events are field-submission data: without that grant, progress is unknown.
    const mayProgress =
      !!grants && hasPermission(grants, "FIELD_SUBMISSION_VIEW", { pillarId: WRO_PILLAR_ID });
    const reached = new Set(
      mayProgress && enrollment
        ? store.participant_stage_event
            .filter(
              (item) =>
                !item.is_deleted &&
                item.enrollment_id === enrollment.id &&
                item.stage_event_status !== "disputed"
            )
            .map((item) => item.stage_definition_id)
        : []
    );
    const current = stages.reduce(
      (furthest, stage, index) => (reached.has(stage.id) ? index : furthest),
      -1
    );
    const contractIndex = stages.findIndex((stage) => /contract/i.test(stage.name));
    const contracted = contractIndex >= 0 && current >= contractIndex;
    const subCounty = store.sub_county.find(
      (item) => item.id === store.ward.find((ward) => ward.id === row.ward_id)?.sub_county_id
    );
    return {
      county_name: displayName(store, "county", subCounty?.county_id),
      enrollment_id: enrollment?.id ?? null,
      entry_category: enrollment?.entry_category ?? null,
      current_stage_index: mayProgress ? current : null,
      current_stage_name: mayProgress ? (stages[current]?.name ?? null) : null,
      stage_count: stages.length,
      is_contracted: mayProgress ? contracted : null,
      in_due_diligence: mayProgress ? !contracted && row.due_diligence_status !== "passed" : null,
    };
  }
  if (table === "grant_application") {
    const chain = ["ACTIVE", "PREPARED", "REVIEWED", "APPROVED"];
    const project = store.project.find((item) => item.id === row.project_id);
    return {
      project_pillar_id: project?.pillar_id ?? null,
      // The award reporting periods hang off, for report managers who may not see its amounts.
      reporting_award_id:
        !!grants &&
        project &&
        hasPermission(grants, "GRANT_REPORT_MANAGE", { pillarId: project.pillar_id })
          ? (store.grant_award.find((item) => !item.is_deleted && item.application_id === row.id)
              ?.id ?? null)
          : null,
      // Position in the sign-off chain; declined and other statuses come after the last step.
      stage_index: chain.includes(String(row.status))
        ? chain.indexOf(String(row.status))
        : chain.length,
    };
  }
  if (table === "external_provider") {
    // The linked-work counts are directory management data, like the workload view.
    const may = !!grants && hasPermission(grants, "PROVIDER_MANAGE");
    const live = <T extends { is_deleted: boolean }>(rows: T[]) =>
      rows.filter((item) => !item.is_deleted);
    return {
      sessions_count: may
        ? live(store.activity_session).filter((item) => item.facilitator_provider_id === row.id)
            .length
        : null,
      counselling_count: may
        ? live(store.counselling_session).filter((item) => item.counsellor_provider_id === row.id)
            .length
        : null,
      trainees_count: may
        ? live(store.training_enrollment).filter((item) => item.trainer_provider_id === row.id)
            .length
        : null,
      cases_count: may
        ? live(store.legal_case).filter((item) => item.advocate_provider_id === row.id).length
        : null,
    };
  }
  if (table === "user") {
    // Roles and scope are shown only to role managers.
    const mayRoles = !!grants && hasPermission(grants, "ROLE_MANAGE");
    const links = mayRoles
      ? store.user_role.filter(
          (item) => !item.is_deleted && item.status === "ACTIVE" && item.user_id === row.id
        )
      : [];
    const unique = (values: (string | null)[]) => [...new Set(values.filter(Boolean))].join(", ");
    return {
      role_names: mayRoles
        ? unique(links.map((item) => displayName(store, "role", item.role_id)))
        : null,
      scope_names: mayRoles
        ? unique(
            links.map((item) =>
              item.pillar_id === null ? "System-wide" : displayName(store, "pillar", item.pillar_id)
            )
          ) || "No role"
        : null,
      active_role_count: mayRoles ? links.length : null,
    };
  }
  if (table === "organisation_assessment")
    return {
      organisation_due_diligence:
        store.organisation.find((item) => item.id === row.organisation_id)?.due_diligence_status ??
        null,
    };
  if (table === "organisation_assessment_score") {
    const criterion = store.assessment_criterion.find((item) => item.id === row.criterion_id);
    return {
      criterion_label: criterion?.label ?? null,
      criterion_max: criterion?.max_score ?? null,
    };
  }
  if (table === "referral") {
    const partner = store.partner_institution.find(
      (item) => item.id === row.to_partner_institution_id
    );
    return { destination_label: partner?.name ?? displayName(store, "pillar", row.to_pillar_id) };
  }
  if (table === "ward") {
    const subCounty = store.sub_county.find((item) => item.id === row.sub_county_id);
    return {
      county_id: subCounty?.county_id ?? null,
      county_name: displayName(store, "county", subCounty?.county_id),
    };
  }
  if (table === "participant") {
    const ward = store.ward.find((item) => item.id === row.ward_id);
    const subCounty = store.sub_county.find((item) => item.id === ward?.sub_county_id);
    // Only enrollments in pillars the caller may view count towards what the row shows.
    const enrollments = grants
      ? store.enrollment
          .filter(
            (item) =>
              !item.is_deleted &&
              item.participant_id === row.id &&
              hasPermission(grants, "PARTICIPANT_VIEW", { pillarId: item.pillar_id })
          )
          .sort((a, b) => a.id - b.id)
      : [];
    const latest = enrollments
      .map((item) => enrollmentRead(store, item as unknown as Row))
      .filter((item) => item.current_stage_date !== null && item.current_stage !== null)
      .sort(
        (a, b) =>
          String(a.current_stage_date).localeCompare(String(b.current_stage_date)) || a.id - b.id
      )
      .at(-1);
    // Curriculum progress needs attendance, which the SRHR participant grant covers; whether
    // someone has graduated is stage-event data, so "behind" also needs that grant.
    const enrolment = srhrEnrollment(store, row.id);
    const mayCurriculum =
      !!grants &&
      !!enrolment &&
      hasPermission(grants, "PARTICIPANT_VIEW", { pillarId: SRHR_PILLAR_ID });
    const progress = mayCurriculum ? curriculumProgress(store, row.id) : null;
    const mayGraduation =
      !!grants && hasPermission(grants, "FIELD_SUBMISSION_VIEW", { pillarId: SRHR_PILLAR_ID });
    const graduated =
      mayCurriculum && mayGraduation
        ? curriculumMilestones(store, enrolment!.id).some(
            (item) => /^graduation/i.test(item.name) && item.reached_at !== null
          )
        : null;
    return {
      curriculum_done: progress?.done ?? null,
      curriculum_total: progress?.total ?? null,
      curriculum_last_attended: progress?.lastAttended ?? null,
      curriculum_behind:
        progress && graduated !== null ? !graduated && isBehind(progress.lastAttended) : null,
      full_name: displayName(store, "participant", row.id),
      county_id: subCounty?.county_id ?? null,
      county_name: displayName(store, "county", subCounty?.county_id),
      pillar_codes: enrollments
        .map((item) => store.pillar.find((pillar) => pillar.id === item.pillar_id)?.code)
        .filter(Boolean)
        .join(", "),
      enrollment_count: enrollments.length,
      current_stage_name: (latest?.current_stage as string | undefined) ?? null,
    };
  }
  return null;
}
