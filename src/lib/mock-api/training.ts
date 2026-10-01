import { rowsFor, visible, type Row } from "./core";
import type { MockStore } from "@/types/db";

// Skilling trainee derivations shared by reads, writes and the WEE prefill view:
// the referral a grant recommendation created, how far the hand-off has got, and
// the read-only display fields a trainee row carries.

export const PATHWAY_LABELS: Record<string, string> = {
  tvet: "TVET",
  apprenticeship: "Apprenticeship",
  community_center: "Community centre",
  life_skills: "Life skills",
};
export const WORK_STATUS_LABELS: Record<string, string> = {
  employed: "Employed",
  self_employed: "Self-employed",
  further_training: "In further training",
  seeking_work: "Seeking work",
  not_seeking_work: "Not seeking work",
};
/** Work statuses that earn an income, so a salary may be recorded. */
export const EARNING_STATUSES = ["employed", "self_employed"];

/** Derived trainee columns; never stored, so a write naming one is rejected. */
export const TRAINING_DERIVED_COLUMNS = [
  "participant_name",
  "institution_name",
  "life_skills_sessions",
  "grant_handoff",
  "grant_referral_id",
  "grant_recommended_on",
  "grant_decided_on",
  "grant_application_on",
  "grant_awarded_on",
];

export const pillarIdOf = (store: MockStore, code: string) =>
  store.pillar.find((row) => !row.is_deleted && row.code.toLowerCase() === code)?.id;

/** The newest referral a trainee's grant recommendation created, if any. */
export function linkedReferral(store: MockStore, trainingId: number | undefined) {
  if (trainingId === undefined) return undefined;
  return store.referral
    .filter((row) => !row.is_deleted && row.source_training_enrollment_id === trainingId)
    .sort((a, b) => b.id - a.id)[0];
}

export const participantIdOf = (store: MockStore, enrollmentId: unknown) =>
  store.enrollment.find((row) => row.id === enrollmentId)?.participant_id ?? null;

/** The WEE application filed for the referred participant since the referral, and its award. */
function applicationAfter(store: MockStore, participantId: number | null, since: string) {
  const wee = pillarIdOf(store, "wee");
  const weeProjects = new Set(
    store.project.filter((row) => row.pillar_id === wee).map((row) => row.id)
  );
  const application = store.grant_application
    .filter(
      (row) =>
        !row.is_deleted &&
        row.participant_id === participantId &&
        weeProjects.has(row.project_id) &&
        row.status !== "DECLINED" &&
        row.created_at >= since
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  const award =
    application &&
    store.grant_award.find((row) => !row.is_deleted && row.application_id === application.id);
  return { application, award };
}

/** How far a trainee's grant recommendation has got, with the date of each step. */
export function grantHandoff(store: MockStore, row: Row) {
  const link = linkedReferral(store, row.id);
  const none = {
    grant_handoff: "none",
    grant_referral_id: null,
    grant_recommended_on: null,
    grant_decided_on: null,
    grant_application_on: null,
    grant_awarded_on: null,
  };
  if (!link || link.status === "WITHDRAWN") return none;
  const decided = link.status === "ACCEPTED" || link.status === "DECLINED";
  const base = {
    ...none,
    grant_referral_id: link.id,
    grant_recommended_on: link.created_at.slice(0, 10),
    grant_decided_on: decided ? link.updated_at.slice(0, 10) : null,
  };
  if (link.status === "NEW") return { ...base, grant_handoff: "referred" };
  if (link.status === "DECLINED") return { ...base, grant_handoff: "declined" };
  const { application, award } = applicationAfter(
    store,
    participantIdOf(store, row.enrollment_id),
    link.created_at
  );
  if (!application) return { ...base, grant_handoff: "accepted" };
  return {
    ...base,
    grant_handoff: award ? "awarded" : "application_filed",
    grant_application_on: application.created_at.slice(0, 10),
    grant_awarded_on: award ? award.created_at.slice(0, 10) : null,
  };
}

/** Skilling group sessions this participant attended. */
function lifeSkillsSessions(store: MockStore, participantId: number | null) {
  const skilling = pillarIdOf(store, "skilling");
  const sessions = new Set(
    store.activity_session
      .filter((row) => !row.is_deleted && row.pillar_id === skilling)
      .map((row) => row.id)
  );
  return store.activity_attendance.filter(
    (row) => !row.is_deleted && row.participant_id === participantId && sessions.has(row.session_id)
  ).length;
}

/** A trainee row with its read-only display fields: names, session count and hand-off. */
export function trainingRead(store: MockStore, row: Row): Row {
  const participantId = participantIdOf(store, row.enrollment_id);
  const person = rowsFor(store, "participant").find((item) => item.id === participantId);
  const institution = rowsFor(store, "partner_institution").find(
    (item) => item.id === row.partner_institution_id
  );
  return {
    ...row,
    participant_name: person
      ? [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(" ")
      : null,
    institution_name: institution ? String(institution.name) : null,
    life_skills_sessions: lifeSkillsSessions(store, participantId),
    ...grantHandoff(store, row),
  };
}

/** The referral reason a recommendation writes, from the trainee's course and outcome. */
export function recommendationReason(row: Row) {
  const course = row.course_name ? String(row.course_name) : "Course not recorded";
  const pathway = PATHWAY_LABELS[String(row.pathway)] ?? String(row.pathway);
  const work = WORK_STATUS_LABELS[String(row.current_work_status)] ?? "Work status not recorded";
  return `Recommended for a business grant · ${course} (${pathway}) · ${work}`;
}

/** Suggested application notes for a recommended graduate; never includes salary. */
export function suggestedNotes(row: Row) {
  const course = row.course_name ? String(row.course_name) : "Course not recorded";
  const work = WORK_STATUS_LABELS[String(row.current_work_status)];
  const outcome = work
    ? row.workstation
      ? `${work}, ${String(row.workstation)}`
      : work
    : "Work status not recorded";
  return `Skilling graduate · ${course} · ${outcome}`;
}

/**
 * Accepted recommendations with no WEE application yet: the "Recommended by Skilling"
 * shortlist on the application form.
 */
export function pendingRecommendations(store: MockStore) {
  return rowsFor(store, "training_enrollment")
    .filter(visible)
    .flatMap((row) => {
      const handoff = grantHandoff(store, row);
      if (handoff.grant_handoff !== "accepted") return [];
      const participantId = participantIdOf(store, row.enrollment_id);
      const person = store.participant.find((item) => item.id === participantId);
      if (!participantId || !person || person.is_deleted) return [];
      return [
        {
          participant_id: participantId,
          participant_name: [person.first_name, person.middle_name, person.last_name]
            .filter(Boolean)
            .join(" "),
          training_enrollment_id: row.id,
          referral_id: handoff.grant_referral_id,
          course_name: row.course_name ?? null,
          pathway: row.pathway,
          current_work_status: row.current_work_status ?? null,
          accepted_on: handoff.grant_decided_on,
          suggested_notes: suggestedNotes(row),
        },
      ];
    });
}
