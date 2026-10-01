import type { MockStore } from "@/types/db";

// Per-participant progress through the SRHR curriculum, derived from attendance: a
// topic is done once the participant attended any live session held on it. Nothing
// is stored; the milestones are read from the participant's stage events.

export const SRHR_PILLAR_ID = 3;
/** A participant with no attendance for this long, and not graduated, is "behind". */
export const BEHIND_AFTER_DAYS = 60;
const MILESTONE = /^(baseline|endline|graduation)/i;

export interface CurriculumTopic {
  id: number;
  name: string;
  activity_type_name: string;
  sequence_no: number;
  attended_date: string | null;
}

export interface CurriculumProgress {
  topics: CurriculumTopic[];
  done: number;
  total: number;
  lastAttended: string | null;
}

/** The SRHR enrolment of a participant, if they have a live one. */
export const srhrEnrollment = (store: MockStore, participantId: unknown) =>
  store.enrollment.find(
    (row) =>
      !row.is_deleted && row.participant_id === participantId && row.pillar_id === SRHR_PILLAR_ID
  );

/** Active topics of the pillar's active activity types, in curriculum order, with attendance. */
export function curriculumProgress(store: MockStore, participantId: unknown): CurriculumProgress {
  const types = new Map(
    store.activity_type_definition
      .filter(
        (row) => row.pillar_id === SRHR_PILLAR_ID && row.status === "ACTIVE" && !row.is_deleted
      )
      .map((row) => [row.id, row])
  );
  const sessions = new Map(
    store.activity_session
      .filter((row) => !row.is_deleted && row.pillar_id === SRHR_PILLAR_ID)
      .map((row) => [row.id, row])
  );
  // Latest attended date per topic.
  const attended = new Map<number, string>();
  for (const item of store.activity_attendance) {
    if (item.is_deleted || item.participant_id !== participantId) continue;
    const session = sessions.get(item.session_id);
    if (!session || session.activity_topic_id === null) continue;
    const previous = attended.get(session.activity_topic_id);
    if (!previous || session.session_date > previous)
      attended.set(session.activity_topic_id, session.session_date);
  }
  const topics = store.activity_topic
    .filter((row) => !row.is_deleted && row.status === "ACTIVE" && types.has(row.activity_type_id))
    .map((row) => ({
      id: row.id,
      name: row.name,
      activity_type_name: types.get(row.activity_type_id)!.name,
      sequence_no: row.sequence_no,
      attended_date: attended.get(row.id) ?? null,
    }))
    .sort(
      (a, b) =>
        a.activity_type_name.localeCompare(b.activity_type_name) || a.sequence_no - b.sequence_no
    );
  const dates = topics.map((row) => row.attended_date).filter((date): date is string => !!date);
  return {
    topics,
    done: dates.length,
    total: topics.length,
    lastAttended: dates.sort().at(-1) ?? null,
  };
}

/** Baseline, Endline and Graduation as {name, reached_at}; reached_at is null until recorded. */
export function curriculumMilestones(store: MockStore, enrollmentId: number) {
  const pipeline = store.pipeline_definition.find(
    (row) => !row.is_deleted && row.pillar_id === SRHR_PILLAR_ID
  );
  const stages = store.stage_definition.filter(
    (row) => !row.is_deleted && row.pipeline_id === pipeline?.id && MILESTONE.test(row.name)
  );
  return stages
    .sort((a, b) => a.step_no - b.step_no)
    .map((stage) => {
      const reached = store.participant_stage_event
        .filter(
          (event) =>
            !event.is_deleted &&
            event.enrollment_id === enrollmentId &&
            event.stage_definition_id === stage.id &&
            event.stage_event_status !== "disputed"
        )
        .map((event) => event.event_date)
        .sort()
        .at(-1);
      return { id: stage.id, name: stage.name, reached_at: reached ?? null };
    });
}

const DAY_MS = 86_400_000;

/** No attendance in the last BEHIND_AFTER_DAYS days (or ever). */
export function isBehind(lastAttended: string | null, now: Date = new Date()): boolean {
  if (!lastAttended) return true;
  return now.getTime() - Date.parse(`${lastAttended}T00:00:00`) > BEHIND_AFTER_DAYS * DAY_MS;
}
