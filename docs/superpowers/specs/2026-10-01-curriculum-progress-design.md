# Per-participant curriculum progress — design

## Goal
Show how far each participant is through the SRHR curriculum, derived from session attendance, so staff can see who is behind without entering anything twice.

## Decisions (agreed)
- Progress is derived from attendance: a topic is done when the participant has an active `activity_attendance` row for a session whose `activity_topic_id` is that topic. Each topic counts once.
- Baseline, Endline and Graduation milestones are read from existing `participant_stage_event` rows (read-only here).
- SRHR only; resolved via the activity type that owns topics, so other curricula can follow.
- Out of scope: manual progress override, certificates, non-SRHR curricula.

## UI
- Participant drawer: "Curriculum" section — progress line ("6 of 12 topics · 50%"), ordered topic list (Attended + latest date / Not yet), milestones.
- Participant register: "Curriculum" column ("6/12", sortable) and a "Behind" filter.
- SRHR pillar page: one card with a distribution (0%, 1–49%, 50–99%, 100%).
- Visible to users who can view the participant's SRHR enrolment; section omitted otherwise.

## API (no new tables, fixed call count)
- Derived participant fields in `derived.ts`: `curriculum_done`, `curriculum_total`, `curriculum_last_attended`; filterable and sortable as presented fields.
- `GET /participants/:id?include=curriculum` returns ordered topics (id, name, sequence, attended date|null) and milestones; permission-gated.
- `/pillars/srhr/summary` gains the four distribution buckets.
- "Behind" = no attendance in the last 60 days and not graduated (constant in `derived.ts`).

## Tests
Derived counts (topic attended twice, deleted attendance, retired topics), permission gating, call-budget test unchanged, drawer and column behaviour.
