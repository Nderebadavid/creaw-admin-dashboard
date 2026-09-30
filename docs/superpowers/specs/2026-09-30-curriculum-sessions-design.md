# Curriculum and Group Sessions (SRHR & Skilling) Design

## Goal

Make the curriculum for group activities visible and usable in the portal. M&E staff can see which planned topics each activity type has covered, how many sessions were held and how many people they reached. Pillar officers can log sessions and correct attendance.

This is sub-project 1 of the schema-gap work. Sub-projects 2–5 each get their own spec later:

2. per-participant curriculum progress
3. an external provider directory
4. Skilling outcomes and the grant handoff
5. logging VAWG counselling sessions

## Users and Success

- **M&E and programme staff** open the SRHR or Skilling page and, for a chosen period, see each activity type's planned topics marked covered or not yet covered, with session counts, reach and last-delivered dates.
- **Pillar officers** log a session with a structured activity type and topic, and review and correct the attendance list captured on mobile.
- Attendance is captured mainly in the mobile app, which writes `activity_attendance` rows. In the portal, officers display and correct it.

## Data Model

### New table `activity_topic` (proposed schema addition)

It follows the SQL schema's standard-column rules:

```sql
CREATE TABLE activity_topic (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status             VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  status_description VARCHAR(255) NULL,
  is_deleted         BOOLEAN NOT NULL DEFAULT FALSE,
  activity_type_id   INT UNSIGNED NOT NULL,
  name               VARCHAR(160) NOT NULL,
  description        TEXT,
  sequence_no        INT NOT NULL COMMENT 'position in the planned curriculum order',
  CONSTRAINT fk_activity_topic_type FOREIGN KEY (activity_type_id) REFERENCES activity_type_definition(id) ON DELETE CASCADE,
  UNIQUE KEY ux_activity_topic_type_name (activity_type_id, name),
  KEY ix_activity_topic_type (activity_type_id)
) ENGINE=InnoDB COMMENT='Planned curriculum topics for one activity type.';
```

### New column on `activity_session`

```sql
ALTER TABLE activity_session
  ADD COLUMN activity_topic_id INT UNSIGNED NULL AFTER activity_type_id,
  ADD CONSTRAINT fk_group_session_topic FOREIGN KEY (activity_topic_id) REFERENCES activity_topic(id) ON DELETE CASCADE,
  ADD KEY ix_group_session_topic (activity_topic_id);
```

- The free-text `topic` column stays for older rows and for sessions that don't fit the plan ("Other").
- A session counts toward coverage only when `activity_topic_id` is set.
- The displayed topic is the planned topic's name, falling back to the free-text `topic`, then to `Session #<id>`.
- The application makes sure that `activity_topic.activity_type_id` equals the session's `activity_type_id`.

### Portal changes

- `src/types/db.ts`, `src/lib/mock-api/schema.ts` and `src/lib/mock-api/seed.ts` gain the table and the column.
- The seed adds planned topics for the four SRHR activity types (YSLA, Mentorship, Male Engagement, Health Talk) and for Skilling's Life Skills Session. It also links some seeded sessions to them, and leaves at least one on a free-text topic.
- The mock API treats `activity_topic` like the other lookup tables for reads and permissions.

## Topic Management (Admin)

- Admin → Lookups gets a new **Activity topics** lookup in `src/features/admin/lookups/config.ts`.
- Its columns are Activity type, Order (`sequence_no`), Name and Description. The form has an Activity type select (required), Order (required integer ≥ 1), Name (required) and Description.
- It uses the existing lookup actions, lookup permissions, status handling and soft-delete. Retiring a topic keeps its history: past sessions still show its name.
- Order is changed by editing `sequence_no`; there is no drag-and-drop.

## Pillar Page Composition (SRHR and Skilling)

When the pillar code is `srhr` or `skilling`, `src/app/(portal)/pillars/[pillar]/page.tsx` (still a Server Component) loads a **sessions workspace** in the same `Promise.all` as the pillar data:

- It loads only when the user holds `ACTIVITY_SESSION_VIEW` for that pillar. Without it, the generic page renders.
- A failed load is caught. The register slot shows an `AlertBanner`, and the hero, pipeline and submissions still render.
- Only sessions whose `pillar_id` equals the page's pillar are included.
- A `period` search parameter (`quarter` by default, or `year` or `all`) sets the coverage period. It is validated, and anything invalid falls back to `quarter`.

The workspace holds the sessions, the pillar's activity types and their topics, attendance counts, and the summary.

### Summary cards

| Card | Value |
|---|---|
| Sessions held | sessions in the period |
| People reached | distinct `participant_id` across attendance for those sessions |
| Topics covered | covered planned topics / active planned topics, e.g. "9 of 16" |
| Active activity types | the pillar's active types |

### Curriculum coverage panel

- There is one collapsible block per active activity type, and each lists its active planned topics in `sequence_no` order.
- A topic is **covered** when at least one session in the period is linked to it. Covered topics show ✓, the last-delivered date and the session count. Uncovered topics show ○ "Not yet covered".
- Sessions with only a free-text topic are listed under **Other topics** in their type's block.
- Clicking a topic filters the register to that topic.
- A period selector (This quarter, This year, All time) updates `?period=`.

### Session register

- Columns: Activity type, Topic, Date, Venue, Facilitator, Attendees.
- Activity-type filter chips come from the types present. Search covers activity type, topic, venue and facilitator.
- Sorting, paging, empty states, audited CSV export and keyboard-accessible row opening use the shared table infrastructure.
- Facilitator shows "CREAW staff" or "External provider" until sub-project 3 adds names, and "Not assigned" when neither is set.
- On Skilling, the register appears alongside the existing trainee-enrollment table and does not replace it.

### Heading action

**Log session** requires `ACTIVITY_SESSION_LOG` for the pillar. The form fields are:
- activity type (select, this pillar's active types)
- topic (select, filtered by type, plus "Other")
- free-text topic (required when "Other" is chosen)
- date, venue and notes

The facilitator defaults to the signed-in staff user. This replaces the current create form for SRHR, which asks for a raw "Activity type ID".

## Session Drawer

The drawer uses the shared `RecordDrawer`.

**Header:**
- activity-type avatar
- the caption `Group session · SRHR` (or `· Skilling`)
- the topic and date
- the venue and facilitator
- the status badge
- **Edit** and **Attach** buttons, both requiring `ACTIVITY_SESSION_LOG`

**Tabs:**
- **Overview:** activity type, planned topic (or the free-text topic marked "Other"), date, venue, facilitator, notes, and whether the session is linked to one participant or is community-wide.
- **Attendance:**
  - Attendees are listed with abbreviated names, their ward, and a link to their participant record. The count matches the register.
  - **Add attendee** searches registered participants, and a person already on the list can't be added twice.
  - **Remove** asks for confirmation.
  - Both actions require `ACTIVITY_SESSION_LOG` and are written to the audit log.
  - A note explains that attendance normally arrives from the mobile app.
- **Documents & photos:** documents with `owner_type = 'activity_session'` (attendance sheet, group photo), with audited view and download.
- **Activity:** a newest-first timeline built from the records' own timestamps: session logged (`created_at`), last edited (`updated_at`, when different), each attendee added (the attendance row's `created_at`), and each file attached (the document's `created_at`). It does not read the audit log, because pillar officers usually lack `AUDIT_LOG_VIEW`. The audit log still records every write.

## Server Actions

All of them live in a new `src/features/sessions/` feature, and each one:

- re-checks the session
- re-checks the pillar-scoped permission
- validates its input with Zod
- revalidates `/pillars/<code>` on success

| Action | Permission | Rules |
|---|---|---|
| `logSessionAction` | `ACTIVITY_SESSION_LOG` | the type belongs to the pillar, the topic belongs to the type, a free-text topic is required when no planned topic is chosen, and the date is ISO |
| `updateSessionAction` | `ACTIVITY_SESSION_LOG` | same as `logSessionAction` |
| `addAttendeeAction` | `ACTIVITY_SESSION_LOG` | the participant exists, and duplicates are rejected with a clear message |
| `removeAttendeeAction` | `ACTIVITY_SESSION_LOG` | the attendance row belongs to the session; removal is a soft delete (`is_deleted = true`, `status = 'INACTIVE'`) |

The unique key `(session_id, participant_id)` also covers soft-deleted rows. `addAttendeeAction` therefore restores a person's earlier soft-deleted row instead of inserting a duplicate. To find that row, it reads attendance with `includeDeleted=true`, which the API allows for `activity_attendance` when the caller holds `ACTIVITY_SESSION_LOG`.
| attach document | existing `DOCUMENT_UPLOAD` flow | owner is `activity_session` |

## Privacy and Permissions

- Attendee names are always abbreviated in lists and drawers. Full identity stays behind the participant record's existing masking and audited reveal.
- A user without `ACTIVITY_SESSION_VIEW` on the pillar never receives session data.
- Other pillars' pages and drawers are unchanged.

## Backend Hand-off

The live API must provide:
- the `activity_topic` table and the `activity_session.activity_topic_id` column, as shown above
- `activity_topic` reads through the lookup endpoints
- pillar-scoped `activity_session` reads, where `?table=activity_session` on `/pillars/:pillar` returns only that pillar's sessions
- attendance create, soft delete and restore written to the audit log
- `includeDeleted=true` on `activity_attendance` reads, for callers holding `ACTIVITY_SESSION_LOG`
- a write rule that a session's `activity_topic_id` belongs to its `activity_type_id`, and that the type belongs to the session's `pillar_id`

The mock API already limits `/pillars/:pillar` reads to rows scoped to that pillar, so SRHR never receives Skilling sessions. A page test pins this.

The portal's schemas treat `activity_topic_id` as optional, so they keep working until the backend ships it.

## Testing

- **API:** topic linking and the display fallback, filtering by pillar, coverage per period, reach as distinct attendees, and the `period` fallback.
- **Actions:** permission denied, a topic that doesn't match its type, a type from another pillar, a duplicate attendee, a missing free-text topic for "Other", and a successful log that writes an audit row.
- **Components:** register columns and chips, coverage ticks and "Other topics", clicking a topic to filter, drawer tabs, and permission-gated controls.
- **Page:** SRHR and Skilling render the workspace, other pillars are unchanged, a user without view permission gets the generic page, and a failed load shows the banner.
- **Final:** the full test suite, typecheck, lint and build.

## Acceptance Criteria

- Admins can manage planned topics per activity type.
- SRHR and Skilling pages show the summary cards, the coverage panel with a working period selector, and the session register.
- Logging a session uses structured type and topic selects. No raw IDs appear anywhere.
- The session drawer shows the overview, the editable attendance list, the documents and the activity timeline, all permission-gated and audited.
- Sessions never appear on another pillar's page.
