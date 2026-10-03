# CREAW Admin Dashboard — API Contract

> **Status:** current as of 3 Oct 2026 · **Owner:** Gitau Mwangi
>
> Every endpoint the CREAW MERL portal calls, with its request and response payloads and the rules the backend must enforce.

**Source of truth.** The portal runs against an in-process mock API (`src/lib/mock-api`) that implements this contract, and the portal's client (`src/lib/api`) only calls the 42 routes listed here. If this document and the mock ever disagree, the mock's behaviour is what the portal relies on. Please raise the difference rather than guess.

**Reading the payloads.**

- `?` after a field means optional. `A | B` inside a code block means one of the values.
- `…` means fields left out for brevity; the full column list is in [Data models](#data-models).
- Anything the mock does only for testing is called out in [Open questions](#open-questions-for-the-backend-team). Do not build it as-is.

## Contents

1. [Conventions](#conventions)
2. [Authentication](#authentication)
3. [Dashboard and pillar views](#dashboard-and-pillar-views)
4. [Participants, referrals and field submissions](#participants-referrals-and-field-submissions)
5. [Pillar programme records](#pillar-programme-records)
6. [Grants, projects, donors, assessments and reports](#grants-projects-donors-assessments-and-reports)
7. [Admin](#admin)
8. [Audit log](#audit-log)
9. [Data models](#data-models)
10. [Open questions for the backend team](#open-questions-for-the-backend-team)

---

## Conventions

The portal calls one JSON REST API through a closed list of 42 route templates. Every response, success or failure, uses the same envelope.

### Transport

- **Base URL** comes from config; every path below is relative to it.
- **Methods:** `GET`, `POST` and `PATCH` only. There is no `PUT` or `DELETE`; deletes are soft (see Records).
- **Headers:** `Authorization: Bearer <token>`, `x-correlation-id: <uuid>` (log it end to end), and `Content-Type: application/json` when there is a body.
- **Timeout:** the client waits 10 s. Responses must be JSON, errors included.

### Response envelope

```json
{ "resultCode": 200, "success": true, "message": "OK", "data": { } }
```

`success` is `resultCode < 400`. `data` is `null` on errors, and `message` carries the reason the portal shows the user.

| Code | Meaning |
| --- | --- |
| `200` | OK |
| `201` | Created: a `POST` that inserted a row |
| `401` | Missing, expired or revoked access token; the portal refreshes once, then signs the user out |
| `403` | Permission denied, or wrong credentials at sign-in |
| `404` | Record or route not found, including a row outside the caller's pillar |
| `410` | Expired sign-in code or password-reset link |
| `422` | Malformed query or body, unknown field, duplicate unique key, or a broken business rule |
| `423` | Account locked after repeated failed sign-ins |

### Paged lists

Every list `GET` returns this `data`:

```json
{
  "items": [ ],
  "page": 1,
  "pageSize": 25,
  "totalItems": 132,
  "totalPages": 6,
  "facets": { "status": { "NEW": 12, "ACCEPTED": 40 } }
}
```

`facets` is present only when the request sends `facet=`. Each facet maps a field's values, as strings, to row counts (booleans come back as `"true"` and `"false"`).

### List query parameters

These work on every list endpoint unless a section says otherwise.

| Param | Example | Rule |
| --- | --- | --- |
| `page` | `1` | Integer ≥ 1. Default 1. |
| `pageSize` | `25` | 1–100, else 422. Default 20; the portal sends 25. |
| `search` (alias `q`) | `wanjiru` | Case-insensitive match on the row's text fields, including derived names. |
| `sort` | `last_name:asc,id:desc` | Comma list of `field:asc` or `field:desc` on returned fields. Empty values sort last; `id` breaks ties. |
| any returned field | `status=pending` | Exact-match filter. An unknown field → 422. |
| `pillarId` | `2` | Rows scoped to that pillar. |
| `countyId`, `subCountyId`, `wardId` | `47` | Location filter (next section). |
| `ids` | `4,9,12` | Batch read, max 100 (5,000 for a lookup CSV export). |
| `include` | `attendees:count` | Embed child collections, listed per resource. Unknown → 422. |
| `facet` | `status,pillar_id` | Up to 3 fields. Each counts values over rows matching every filter except its own. |
| `table` | `grant_award` | Read a related child table through the parent route. |
| `includeDeleted` | `true` | Lookup managers and a few link tables only. |
| `format` | `csv` | Export the filtered list as CSV instead of a page. |

### Location filter

`countyId`, `subCountyId` and `wardId` (positive integers, any combination) keep records whose participant or organisation lives in that area. The place is the `ward_id` of that participant or organisation, reached through the record's links:

| Records | Place comes from |
| --- | --- |
| `participant`, `organisation` | their own `ward_id` |
| `enrollment` | its participant, else its organisation |
| `referral`, `participant_stage_event`, `legal_case`, `counselling_session`, `training_enrollment` | their enrollment |
| `grant_application` | its participant, else its organisation |
| `organisation_assessment` | its organisation |

- Records with no ward never match a location.
- A location key on any other list (e.g. `/donors?countyId=1`), or a malformed id → 422.
- CSV exports apply the same keys.

### Records

- IDs are positive integers. Dates are `YYYY-MM-DD`; timestamps are ISO-8601 UTC, except the token timestamps (see [Open questions](#open-questions-for-the-backend-team)).
- Table rows use `snake_case` names that match the DB columns. A few computed payloads use `camelCase`, and the portal reads them exactly as written here: the `/auth/*` bodies and `TokenPair`, the `GET /dashboard` header counts, report calendar rows, the `sessions` card, grant `signoffs`, and the `catalog=` responses for referrals and reports.
- Every row has `created_at`, `updated_at` and `is_deleted`. Delete = `PATCH { "is_deleted": true }`; deleted rows stay out of lists unless `includeDeleted=true` is allowed.
- Reads add read-only display fields (e.g. `pillar_name`, `participant_name`). A write that names one → 422.
- Writes may not set `id`, `created_at`, `updated_at` or `password_hash` (422). `password_hash` never leaves the API.
- Every write is audited (see Audit log).

### Authorization

- Permissions are codes such as `PARTICIPANT_VIEW`, granted through roles, either for all pillars or for one.
- A row is visible when the caller holds the code for all pillars or for any pillar the row belongs to. Other rows are left out of lists and return 403 or 404 when asked for directly.
- A signed-in user with no grants gets 403 everywhere except sign-in and logout.

### CSV exports

`GET <list route>?format=csv&…filters` returns `{ "filename": "participant.csv", "content": "<csv text>", "totalItems": 132 }`.

- Needs `REPORT_EXPORT_CSV` (plus `LOOKUP_MANAGE` for lookups).
- Cells starting with `=`, `+`, `-` or `@` get a leading `'`.
- Each export writes an `EXPORT` audit entry.

---

## Authentication

Sign-in has two steps: a password, then a one-time code sent by SMS or email. Only `/auth/otp/verify` issues tokens. Every `/auth/*` route except `/auth/me` is a `POST` that needs no token; any other method → 422.

### Sign-in, step by step

**1. Password — `POST /auth/login`.** A correct password does not sign the user in and returns no tokens. It opens a sign-in challenge and says where the code was sent:

```json
{
  "resultCode": 200,
  "success": true,
  "message": "OK",
  "data": {
    "challengeId": "3f6c2a9e-8b1d-4c7a-9e2f-5d4b1a0c7e33",
    "maskedPhone": "07•• ••• 344",
    "maskedEmail": "ju•••••@creaw.org"
  }
}
```

- `challengeId` is a UUID that the next two calls send back.
- `maskedPhone` and `maskedEmail` are what the code screen shows the user. Never return them unmasked here.

**2. Code — `POST /auth/otp/verify`.** Send `{ "challengeId", "code" }`. The right code ends the challenge and returns the session's `TokenPair` (see Tokens). `POST /auth/otp/resend` sends a new code for the same challenge.

**3. Profile — `GET /auth/me`.** Called with the new access token, it returns the user, grants and roles. Only after this succeeds is the user signed in.

### Endpoints

| Method | Path | Request body | `data` on success | Errors |
| --- | --- | --- | --- | --- |
| POST | `/auth/login` | `{ "username", "password" }` (username or email, any case) | `{ "challengeId", "maskedPhone": "07•• ••• 344", "maskedEmail": "ju•••••@creaw.org" }` | 403 wrong credentials (message says attempts left) · 423 locked |
| POST | `/auth/otp/verify` | `{ "challengeId", "code": "123456" }` | `TokenPair` | 403 wrong code · 410 expired, or 5 wrong codes |
| POST | `/auth/otp/resend` | `{ "challengeId" }` | `null` | 410 expired |
| POST | `/auth/refresh` | `{ "refreshToken" }` (no `Authorization` header) | a new `TokenPair` | 401 refresh token expired, revoked or reused |
| POST | `/auth/password/forgot` | `{ "email" }` | `null` (emails a reset link). The mock returns `{ previewToken }` for testing only; see Open questions | Always 200, so it never reveals whether an account exists |
| POST | `/auth/password/reset` | `{ "token", "password" }` | `null` | 410 link expired or used · 422 weak password |
| POST | `/auth/logout` | `{ "refreshToken" }` + access token in the header | `null` | Always 200; revokes both tokens when valid |
| GET | `/auth/me` | — | `{ "user", "grants": Grant[], "roles": string[] }` (own email unmasked) | 401 |

`Grant` = `{ "permissionCode": "PARTICIPANT_VIEW", "pillarId": 2 }`, where `pillarId: null` means all pillars. Grants come from the user's active role assignments on active roles and pillars.

### Tokens

Only two calls return a `TokenPair` as their `data`: `POST /auth/otp/verify` (step 2 of sign-in) and `POST /auth/refresh`. `/auth/login` never does.

```json
{
  "token": "1DZ0bhqd6An9XTlUWj4FouNIxXn2eTQUPZ8ja49m-QQ",
  "expireAt": "2026-09-26 17:37:27",
  "refreshToken": "d38rpKxC6YUhfX7spl1eTzYZJCmc3QczezpQJwnJ7q8",
  "refreshExpireAt": "2026-10-03 17:07:27"
}
```

- The access token (`token`) is short-lived: 30 min in the sample. The refresh token lasts 7 days.
- `TokenPair` carries no user data. The portal gets the user, grants and roles from `GET /auth/me`.

### Refresh flow

1. Every request sends `Authorization: Bearer <token>`.
2. A missing, expired or revoked access token → **401**. Never 403, which means a missing permission.
3. The portal refreshes before a request, not after a failure: when the access token is gone or `expireAt` is under 60 s away, it calls `POST /auth/refresh` once and sends the request with the new token. It does not retry a request that got 401.
4. Only a **401** from `/auth/refresh` signs the user out.
5. Any other refresh failure is treated as temporary (408, 429, 5xx, a network error, or a reply without a readable `TokenPair`). The portal keeps the refresh token and tries again on the next request.

### Rules the backend must enforce

**Sign-in**

- Only active, non-deleted users can sign in.
- 5 wrong passwords lock the account for 15 min (423). Unknown usernames are counted too, so replies never reveal which accounts exist. A password reset clears the lock.
- A sign-in code lives 10 min; 5 wrong codes end the challenge. Resend restarts the 10 min and the wrong-code count.
- A reset link lives 30 min and works once. A reset revokes all of the user's tokens and open challenges.
- Passwords need at least 10 characters, upper and lower case, a digit and a symbol.
- `GET /auth/me` must succeed straight after `/auth/otp/verify`. If it fails (e.g. 403 for a user with no active role), the portal logs out the new tokens and returns to the password step, so logout must accept tokens never used for anything else.

**Tokens**

- Rotate on every refresh: the old refresh token stops working once a new pair is issued.
- For 10 s after rotation, the old refresh token returns the same new pair (the portal may refresh twice at once). Reuse after that revokes every session of the user.
- A rotated pair keeps the original `refreshExpireAt`, so a session ends 7 days after sign-in unless decided otherwise.
- Return 401 from `/auth/refresh` only when the refresh token itself is invalid. Use 429 for rate limits and 5xx for outages.
- Store refresh tokens hashed. Revoke them on password reset, account disable and logout.
- Grants are checked on every request, so a role change applies at once, not at the next refresh.

---

## Dashboard and pillar views

These reads are computed on the server, so screens never download whole tables to count. Any block the caller lacks permission for comes back `null`. Unknown query keys → 422.

### GET `/dashboard`

Light header counts. Needs `DASHBOARD_VIEW` on at least one pillar.

```json
{ "pillars": [Pillar], "participantCount": 812, "enrollmentCount": 1040 }
```

### GET `/dashboard?view=overview`

Every home-page panel in one call.

| Param | Example | Rule |
| --- | --- | --- |
| `from`, `to` | `2026-07-01`, `2026-10-02` | The period, inclusive. Both or neither; default is the current quarter so far. Reversed, impossible dates or more than 36 months → 422. |
| `pillar` | `srhr` | Narrows the monthly chart only. |
| `funnel` | `srhr` | Which pillar's pipeline funnel to return. |
| `countyId`, `subCountyId`, `wardId` | `47` | Narrow every figure about people to that area. Projects, reports and activity ignore it. |

No other keys are accepted; the old `year` → 422.

**Period figures** count what happened in the period: `new_in_period` (with `previous_period` for the same number of days just before), the `monthly` chart, and referral decisions. **Everything else is a snapshot as of today:** participant, PWD and enrollment totals, pillar reach, the submissions backlog, open referrals, the funnel, projects, reports and activity.

**Response**

```json
{
  "period": { "from": "2026-07-01", "to": "2026-10-02" },
  "participant_count": 812,
  "pwd_count": 37,                 // participants living with a disability
  "enrollment_count": 1040,
  "new_in_period": 64,
  "previous_period": 51,
  "pending_submissions": 9,        // stage events not yet verified; null without FIELD_SUBMISSION_VIEW
  "pillars": [{ "id": 1, "code": "srhr", "lead_name": "Judy Mwangi", "reached": 320, "active": 290 }],
  "monthly": [{ "month": "2026-07", "new_count": 22, "completed_count": 14 }],
  "recent_submissions": [{ "id": 5, "title": "Home visit", "pillar_id": 1, "category": "Intake", "status": "recorded", "event_date": "2026-09-28" }],   // null without FIELD_SUBMISSION_VIEW
  "projects": [ProjectCard],
  "reports": {                     // null without a reporting permission
    "total": 18,
    "overdue": [{ "title": "Q2 narrative", "project": "SRHR Youth", "due_date": "2026-07-31" }],
    "upcoming": [{ "id": 3, "key": "narrative-3", "title": "…", "project": "…", "status": "pending", "period_end": "2026-09-30", "due_date": "2026-10-31" }]
  },
  "referrals": { … },              // below
  "funnel": { … },                 // below
  "recent_activity": [{ "id": 90, "action": "UPDATE", "entity_type": "referral", "entity_id": 12, "source": "HTTP", "performed_at": "…", "performed_by_name": "Judy Mwangi" }]   // null without AUDIT_LOG_VIEW
}
```

- `monthly` has one entry per month the period touches, counting only days inside the period. `new_count` counts registrations (`participant.created_at`); `completed_count` counts verified stage events (`event_date`).
- `recent_submissions`: up to 4 unverified stage events. `status` is the event's `stage_event_status` (`recorded` or `disputed`), and `title` may be `null`.
- `reports.upcoming`: up to 4 reports not yet submitted, with `status` `pending` or `overdue`. `recent_activity`: the 5 newest audit entries.
- `ProjectCard` = `{ id, name, pillar_id, donor_name, end_date, applications_count, awarded_total, reports_overdue }`: active projects, soonest `end_date` first, at most 8.

#### `referrals` — referral oversight

`null` without `REFERRAL_VIEW`. Counts only referrals whose from- or to-pillar is in the caller's scope.

```json
{
  "open": 5,                       // status NEW
  "overdue": 1,                    // open longer than overdue_after_days
  "overdue_after_days": 7,
  "decided_in_period": 4,          // became ACCEPTED or DECLINED in the period
  "accepted_rate": 75,             // % accepted, rounded; null when none decided
  "by_destination": [{ "pillar_id": 2, "open": 3, "oldest_days": 9 }],
  "oldest": [{ "id": 31, "participant_name": "Faith Njeri", "from_pillar_id": 1, "to_pillar_id": 2, "destination_name": null, "raised_on": "2026-09-23", "age_days": 9 }]
}
```

`by_destination` lists the most open first; `oldest` holds up to 5 open referrals, longest waiting first. `destination_name` is the partner institution for external referrals. Date a decision by the status change itself (its audit entry).

#### `funnel` — pipeline funnel

One pillar's pipeline. `null` when the caller has `FIELD_SUBMISSION_VIEW` on no pillar with a pipeline. A missing or unavailable `funnel=` falls back to the first available pillar.

```json
{
  "pillar_id": 3,
  "code": "srhr",
  "pipeline_name": "SRHR pathway",
  "enrollments": 40,
  "stages": [{ "id": 7, "step_no": 1, "name": "Mobilisation", "reached": 40 }],
  "available": ["vawg", "srhr"]
}
```

`reached` counts enrollments whose furthest stage is this step or later, so it never rises from one stage to the next. Deleted and `disputed` stage events don't count. This differs on purpose from the pillar summary's `count`, which is enrollments at that exact stage.

### GET `/pillars/:pillar/summary?period=quarter`

The header, pipeline and headline cards of one pillar page. `:pillar` is a pillar code (`vawg`, `wee`, `srhr`, `leadership`, `wros`, `skilling`) or an id. Needs `DASHBOARD_VIEW` for that pillar. `period` is `quarter` (default), `year` or `all`; any other value means `quarter`.

```json
{
  "pillar": { "id": 1, "code": "srhr", "name": "SRHR", "lead_user_id": 4, "lead_name": "…", "status": "ACTIVE" },
  "pipeline": { "id": 2, "name": "SRHR journey", "stages": [{ "id": 7, "step_no": 1, "name": "Registered", "count": 120 }] },
  "enrollments": { "total": 320, "active": 290, "counties": ["Nairobi", "Kiambu"] },
  "projects": [ProjectCard],
  "cards": {
    "vawg": { "survivors": 80, "open_cases": 22, "concluded": 9, "counselling_sessions": 140, "counselling_this_quarter": 31 },
    "sessions": { "period": "quarter", "summary": { "sessionsHeld": 42, "peopleReached": 310, "topicsCovered": 9, "topicsPlanned": 12, "activeTypes": 3 }, "coverage": [ … ] },
    "curriculum": { "participants": 320, "buckets": [{ "label": "Not started", "count": 40 }], "behind": 12 },
    "trainees": { "enrolled": 60, "completed": 41, "dropped_out": 5, "completion_rate": 89, "in_work": 30, "in_work_rate": 73, "recommended": 12, "accepted_by_wee": 7 }
  }
}
```

| Block | Present for | Notes |
| --- | --- | --- |
| `pipeline.stages[].count` | all pillars with a pipeline | Distinct enrollments with an event at that stage; `null` without `FIELD_SUBMISSION_VIEW` |
| `cards.vawg` | VAWG | Counselling figures `null` without `COUNSELLING_VIEW` |
| `cards.sessions` | SRHR, Skilling | Session coverage by activity type and topic: `coverage[] = { activityTypeId, name, topics: [{ topicId, name, sequenceNo, sessions, lastDelivered }], otherTopics: [{ name, sessions, lastDelivered }] }` |
| `cards.curriculum` | SRHR | `behind` is `null` without `FIELD_SUBMISSION_VIEW` |
| `cards.trainees` | Skilling | Needs `TRAINING_ENROLLMENT_VIEW` |

### GET `/pillars/:pillar/form-options?form=<form>`

Every option list a create form needs, in one call. People come back as names only.

| `form` | Pillars | Permission | `data` |
| --- | --- | --- | --- |
| `session` | srhr, skilling | `ACTIVITY_SESSION_LOG` | `{ activity_types: [{id, name, active}], topics: [{id, activity_type_id, name, sequence_no, active}], facilitators: [PersonOption] }` |
| `trainee` | skilling | `TRAINING_ENROLLMENT_EDIT` | `{ enrollments: [{id, label}], institutions: [{id, label}], trainers: [{id, label}] }` |
| `counselling` | vawg | `COUNSELLING_LOG` | `{ survivors: [{id, label, sessions}], counsellors: [PersonOption] }` |
| `case` | vawg | `CASE_EDIT` | `{ survivors: [{id, label}], case_types: [{id, name}] }` |
| `organisation` | wros | `ORGANISATION_EDIT` | `{ wards: [{id, name: "Ward · County"}] }` |
| `assessment` | wros | `ORG_ASSESSMENT_EDIT` | `{ organisations: [{id, name}], instruments: [{id, name, criteria: [{id, label, max}]}] }` |

`PersonOption` = `{ kind, id, name, detail }`, where `kind` is `"staff"` or `"provider"`.

### GET `/lookups?tables=county,sub_county,ward`

Up to 12 lookup tables in one call. Tables the caller can't read are listed in `denied` instead of failing the request.

```json
{ "tables": { "county": [County], "ward": [Ward] }, "denied": ["donor"], "version": "412-2026-09-30T10:00:00Z" }
```

`version` changes whenever a returned row changes, for client caching. `includeDeleted=true` is allowed for lookup managers.

---

## Participants, referrals and field submissions

Resource routes share one pattern: `GET /x` lists (paged), `GET /x/:id` reads one, `POST /x` creates (201 + the row), and `PATCH /x/:id` updates part of a row (200 + the row). Full field lists are in Data models.

### Participants — `/participants`

| Call | Query or body | Notes |
| --- | --- | --- |
| GET `/participants` | list params, `include=enrollments`, `curriculum_behind=true`, `is_person_with_disability=true`, `facet=status,is_person_with_disability,is_refugee` | Needs `PARTICIPANT_VIEW`. The facets feed the registry's metric cards (below) |
| GET `/participants/:id?include=enrollments` | — | Record drawer |
| GET `/participants/:id?include=curriculum,curriculum_milestones` | — | SRHR curriculum: topics in order with the date attended; milestones (baseline, endline, graduation) need `FIELD_SUBMISSION_VIEW` |
| GET `/participants/:enrollmentId?table=enrollment` | — | An enrollment through this route (`enrollment` and `document` allowed) |
| POST `/participants?pillarId=2&enroll=true` | body below | Registers and enrolls in one step (`entry_category: "Intake"`). Needs `PARTICIPANT_EDIT` on that pillar |
| PATCH `/participants/:id` | everyday fields | `first_name, last_name, phone_number, remarks, is_consent_given`; needs `PARTICIPANT_EDIT` |
| PATCH `/participants/:id` | identity fields | `middle_name, id_number, id_number_type, date_of_birth, gender, ward_id, is_person_with_disability, is_refugee`; needs `PARTICIPANT_RECORD_MANAGE` (403 without) |

```json
// POST /participants?pillarId=2&enroll=true
{
  "first_name": "Achieng", "middle_name": null, "last_name": "Otieno",
  "id_number": "30123456", "id_number_type": "national_id",   // "none" when no ID
  "phone_number": "0712345678", "date_of_birth": "1998-04-12", "gender": "female",
  "ward_id": 311, "is_consent_given": true, "remarks": null,
  "is_person_with_disability": false, "is_refugee": false        // default false
}
```

- `id_number` is unique, ignoring case, on create and on correction → 422 "A participant with this ID number is already registered". Re-saving a participant's own number is fine.
- `sync_ref` is unique and set by the mobile app.
- **Registry metric cards** come from the list's facets, never from a second call: total = sum of `facets.status`, active = `status.ACTIVE`, persons with disability = `is_person_with_disability["true"]`, refugees = `is_refugee["true"]`. Each facet ignores only its own filter, so with `is_person_with_disability=true` applied the disability count still shows the full figure.
- `PARTICIPANT_RECORD_MANAGE` is granted to System Administrator by default and can be added to other roles in the permission matrix.
- Derived on read: `full_name, ward_name, county_id, county_name, pillar_codes, enrollment_count, current_stage_name, curriculum_done, curriculum_total, curriculum_last_attended, curriculum_behind`.

### Referrals — `/referrals`

| Call | Query or body | Notes |
| --- | --- | --- |
| GET `/referrals` | list params, `status`, `facet=status` | Needs `REFERRAL_VIEW` on the from- or to-pillar |
| GET `/referrals/:id` | — |  |
| GET `/referrals?catalog=origins&search=` | — | `{ items: [{ enrollment_id, pillar_id, participant, category }] }`, at most 100: enrollments the caller may refer from (`REFERRAL_CREATE` + `PARTICIPANT_VIEW` on that pillar) |
| GET `/referrals?catalog=destinations` | — | `{ internalPillarIds: [1, 3], partnerInstitutions: [{ id, name }] }` |
| POST `/referrals` | body below | Needs `REFERRAL_CREATE` on `from_pillar_id` |
| PATCH `/referrals/:id` | `{ "status": "ACCEPTED" or "DECLINED", "notes"? }` | Respond; needs `REFERRAL_ACCEPT` on `to_pillar_id` |
| PATCH `/referrals/:id` | `{ "trigger_reason" }` | Edit the reason; needs `REFERRAL_CREATE` |
| PATCH `/referrals/:id` | `{ "status": "WITHDRAWN" }` alone | Withdraw; needs `REFERRAL_CREATE` |

```json
// POST /referrals
{ "enrollment_id": 41, "from_pillar_id": 3, "to_pillar_id": 4, "to_partner_institution_id": null, "trigger_reason": "Completed TVET, needs start-up grant", "notes": null }
```

- Statuses: `NEW` → `ACCEPTED`, `DECLINED` or `WITHDRAWN`. Only a `NEW` referral can change; any other key → 422.
- The server sets `status: "NEW"` and, for internal referrals, defaults `to_project_id` to the destination pillar's project.
- A referral has exactly one destination: `to_project_id` (internal, and that project must belong to `to_pillar_id`) or `to_partner_institution_id` (external). Both or neither → 422.
- The enrollment must belong to `from_pillar_id` (422 otherwise).
- Accepting an internal referral enrolls the participant in `to_pillar_id` (`entry_category: "Referral intake"`) unless already enrolled.
- Clients never set `source_training_enrollment_id`; only the grant-recommendation flow does.
- Derived on read: `participant_summary { id, name }`, `destination_name`, `destination_label`, `referred_by_name` (from the CREATE audit entry; "System (background job)" for KAFKA), plus `*_name` for every linked id.

### Field submissions — `/field-submissions`

Stage events captured by the mobile app (`source_channel` is not `portal`), stored in `participant_stage_event`.

| Call | Query or body | Notes |
| --- | --- | --- |
| GET `/field-submissions` | list params, `include=documents`, `review_status`, `facet=review_status` | Needs `FIELD_SUBMISSION_VIEW` |
| GET `/field-submissions/:id?include=documents` | — |  |
| GET `/field-submissions/:docId?table=document&download=true` | — | The document row + `file_url`; audited as `DOWNLOAD`; needs `DOCUMENT_DOWNLOAD` |
| PATCH `/field-submissions/:id` | `{ "stage_event_status": "verified" or "disputed" }` | Approve or flag; needs `FIELD_SUBMISSION_REVIEW` |

- `stage_event_status`: `recorded` (default) → `verified` or `disputed`. Derived `review_status`: Pending review, Approved or Flagged.
- Other derived fields: `pillar_id, pillar_name, entry_category, stage_name, place`.
- CSV export columns: `id, pillar, captured, status, source`.

---

## Pillar programme records

One route family carries every pillar-scoped table: `/pillars/:pillar`, where `:pillar` is a pillar code or id. `?table=` picks the table (default `enrollment`) and `?id=` a single row. Permission is checked for that pillar, and rows outside it → 404.

### Routes

| Call | Meaning |
| --- | --- |
| GET `/pillars/:pillar?table=<t>` + list params | List rows of `<t>` in the pillar |
| GET `/pillars/:pillar?table=<t>&id=<id>&include=…` | One row |
| POST `/pillars/:pillar?table=<t>` | Create (some creates also send `pillarId=`) |
| PATCH `/pillars/:pillar?table=<t>&id=<id>` | Update |
| GET `/pillars/:pillar?table=document&id=<id>&download=true` | Document metadata + `file_url`, audited |
| GET `/pillars/:pillar?table=facilitator_option`, `trainer_option` or `counsellor_option` | People pickers: one page of `{ kind: "staff" or "provider", id, name, detail }` |

### Tables

| Table | Used by | View / edit permission | Includes |
| --- | --- | --- | --- |
| `enrollment` | every pillar register | `PARTICIPANT_VIEW` / `PARTICIPANT_EDIT` | `counselling, legal_cases, training` |
| `activity_session` | SRHR and Skilling sessions | `ACTIVITY_SESSION_VIEW` / `ACTIVITY_SESSION_LOG` | `attendees, attendees:count, documents` |
| `activity_attendance` | session attendee lists | same as sessions | — |
| `counselling_session` | VAWG counselling | `COUNSELLING_VIEW` / `COUNSELLING_LOG` | — |
| `legal_case` | VAWG cases | `CASE_VIEW` / `CASE_EDIT` | `documents, counselling` |
| `training_enrollment` | Skilling trainees | `TRAINING_ENROLLMENT_VIEW` / `TRAINING_ENROLLMENT_EDIT` | — |
| `organisation` | WRO register | `ORGANISATION_VIEW` / `ORGANISATION_EDIT` | `stage_events` |
| `participant_stage_event` | WRO stage moves | `FIELD_SUBMISSION_VIEW` / `FIELD_SUBMISSION_REVIEW` | `documents` |
| `grant_application` | WEE grants tab | see Grants | see Grants |

Also readable through this route: `pipeline_definition`, `stage_definition`, `document`.

### Create payloads

`?` marks an optional field.

```text
enrollment            { pillar_id, participant_id | organisation_id, entry_category }
                      PATCH { entry_category }
activity_session      { pillar_id, activity_type_id, activity_topic_id?, topic?, session_date, venue?,
                        enrollment_id? (null = community-wide),
                        facilitator_user_id? | facilitator_provider_id?, notes? }
activity_attendance   { session_id, participant_id }
                      remove/restore: PATCH { is_deleted, status: "INACTIVE" | "ACTIVE" }
                      list with session_id=<id>&includeDeleted=true
counselling_session   { enrollment_id, session_date, session_type: "psychological_first_aid" | "follow_up",
                        counsellor_user_id? | counsellor_provider_id?, notes? }
legal_case            { enrollment_id, case_type_id, opened_date, court_name?, assigned_officer?,
                        next_court_date?, court_file_number?, ob_number?, counsellor?, mediation_attempted,
                        mediation_outcome?, court_status?, ruling_date?, outcome_notes?,
                        advocate_provider_id?, closed_date? }
training_enrollment   { enrollment_id, pathway, partner_institution_id?, trainer_provider_id?, course_name?,
                        start_date?, completion_date?, training_status, current_work_status?,
                        workstation?, monthly_salary?, recommended_for_grant }
organisation          { name, legal_form, registration_number?, ward_id?, address?, has_bank_account }
                      sent with pillarId=<WRO pillar>
participant_stage_event  { enrollment_id, stage_definition_id, stage_event_status: "verified",
                           source_channel: "portal", event_date, notes? }
```

### Business rules

- **Counselling:** the server numbers sessions (`session_no`, next per enrollment, counting removed ones); clients can't set it or move a session to another survivor. At most one counsellor, and a newly linked one must be active staff with the Counsellor role or an active `counsellor` provider.
- **Sessions:** one facilitator, staff or provider. Retired activity types and topics stay readable for history.
- **Training:** an `ongoing` trainee has no completion date, work status, workstation or salary. `completed` and `dropped_out` need `completion_date` ≥ `start_date`. A salary (> 0) needs `current_work_status` `employed` or `self_employed`.
- **Grant recommendation:** `recommended_for_grant: true` needs `training_status: completed` and `REFERRAL_CREATE` on Skilling. It creates a `NEW` Skilling → WEE referral; unsetting it withdraws that referral while still `NEW`, and it locks once WEE accepts. A declined or withdrawn referral clears the flag.
- **WRO registration** takes two calls: POST `organisation` (with `pillarId`), then POST `enrollment` with the new `organisation_id`.

### Derived fields on read

| Table | Fields |
| --- | --- |
| `enrollment` | `record_name, current_stage, current_stage_date, counselling_count, counselling_last_date, counselling_last_type, counselling_last_counsellor, counselling_last_counsellor_kind, legal_case_number, has_legal_case` |
| `activity_session` | `attendee_count, facilitator_name, facilitator_kind, activity_type_name, activity_topic_name` |
| `counselling_session` | `counsellor_name, counsellor_kind` |
| `legal_case` | `case_number` (e.g. `CRW-VAWG-0001`), `case_type_route`, `case_type_requires_forms`, `advocate_name` |
| `training_enrollment` | `participant_name, institution_name, trainer_name, life_skills_sessions, grant_handoff` (`none`, `referred`, `declined`, `accepted`, `application_filed`, `awarded`), `grant_referral_id, grant_recommended_on, grant_decided_on, grant_application_on, grant_awarded_on` |
| `organisation` | `county_name, enrollment_id, entry_category, current_stage_index, current_stage_name, stage_count, is_contracted, in_due_diligence` |

Every row linked to an enrollment also gets `participant_id, participant_name, organisation_id, organisation_name`.

---

## Grants, projects, donors, assessments and reports

### Grants — `/grants`

Table `grant_application`. Related tables through `?table=`: `grant_award`, `grant_disbursement`, `grant_report`, `document`.

| Call | Query or body | Permission |
| --- | --- | --- |
| GET `/grants` | list params, `status`, `facet=status` | `GRANT_APPLICATION_VIEW` |
| GET `/grants/:id?include=awards,disbursements,reports,documents` | — | view (+ `GRANT_REPORT_VIEW` or `_MANAGE` for `reports`) |
| GET `/grants/:id?signoffs=true` | — | view. Returns `{ preparedBy, reviewedBy, approvedBy, history: [{ event, byName, at }] }` from the audit log |
| GET `/grants/:id?pack=true` | — | `DOCUMENT_DOWNLOAD`. Application pack; audited as `DOWNLOAD` |
| GET `/grants?view=recommended` | — | `GRANT_APPLICATION_PREPARE` on WEE. Skilling graduates WEE accepted and hasn't filed for yet (below); never includes salary |
| POST `/grants` | `{ project_id, participant_id or organisation_id, requested_amount, grant_type, notes?, status? }`; `status` is `"ACTIVE"` (default) or `"PREPARED"` | `GRANT_APPLICATION_EDIT` |
| PATCH `/grants/:id` | `{ status }`: `"PREPARED"`, `"REVIEWED"` or `"APPROVED"` | the step's permission (below) |
| PATCH `/grants/:id` | `{ status: "DECLINED", status_description: "<reason>" }` | the next step's permission |
| PATCH `/grants/:id` | `{ status: <previous step>, status_description: "<reason>" }` | send back; the current step's permission |
| PATCH `/grants/:awardId?table=grant_award` | `{ amount_awarded }` | `GRANT_APPLICATION_APPROVE` |
| POST `/grants?table=grant_disbursement` | `{ grant_id, amount, disbursement_date, notes? }` | `GRANT_DISBURSEMENT_RECORD` |
| PATCH `/grants/:id?table=grant_disbursement` | `{ amount, disbursement_date, notes }` | `GRANT_DISBURSEMENT_RECORD` |
| POST `/grants?table=grant_report` | `{ grant_award_id, reporting_period_start, reporting_period_end, due_date }` | `GRANT_REPORT_MANAGE` |

`view=recommended` items: `{ participant_id, participant_name, training_enrollment_id, referral_id, course_name, pathway, current_work_status, accepted_on, suggested_notes }`.

**Sign-off workflow.** `status` moves `ACTIVE` → `PREPARED` → `REVIEWED` → `APPROVED`. `DECLINED` is final and possible at any step before `APPROVED`.

| Step | Permission |
| --- | --- |
| `PREPARED` | `GRANT_APPLICATION_PREPARE` |
| `REVIEWED` | `GRANT_APPLICATION_REVIEW` |
| `APPROVED` | `GRANT_APPLICATION_APPROVE` |

- Steps go in order, one at a time, with nothing else in the body.
- Maker-checker: whoever prepared can't review, and neither the preparer nor the reviewer can approve or decline a later step (403).
- Approving creates the `grant_award` for `requested_amount`. Awards can't be created directly or moved to another application.
- Sending back needs a reason and is refused once payments or submitted reports exist; it soft-deletes the award and its report periods.
- Award amount: > 0, ≤ the requested amount, ≥ the total paid. Payments need an approved application, an amount > 0 and a total ≤ the award, and can't move to another award.
- Grant reports need an approved award and `start ≤ end ≤ due_date`; a `submitted_date` needs a `document_id`.
- Derived on application rows: `project_pillar_id, stage_index, reporting_award_id, project_name, participant_name, organisation_name`.

### Projects — `/projects`

| Call | Query or body | Permission |
| --- | --- | --- |
| GET `/projects` | list params; default `sort=start_date:desc` | `DASHBOARD_VIEW` |
| GET `/projects/:id?include=applications,awards,disbursements,reports` | — | `DASHBOARD_VIEW` |
| POST `/projects` | `{ pillar_id, name, donor_id?, start_date?, end_date?, notes? }` | `NARRATIVE_REPORT_MANAGE` |
| PATCH `/projects/:id` | the same fields, or `{ status, status_description }`, status `"ACTIVE"` or `"INACTIVE"` | `NARRATIVE_REPORT_MANAGE` |
| PATCH `/projects/:id` | `{ is_deleted: true }` alone | `PILLAR_CONFIG_MANAGE`; refused while grant applications exist |

Unique `(pillar_id, name)`. Derived: `applications_count, awards_count, awarded_total, disbursed_total, reports_overdue, donor_name, pillar_name`.

### Donors — `/donors`

| Call | Query or body | Permission |
| --- | --- | --- |
| GET `/donors` | list params; default `sort=name:asc` | `DASHBOARD_VIEW` |
| GET `/donors/:id?include=projects` | — | `DASHBOARD_VIEW` |
| POST `/donors` | `{ name, notes? }` | `LOOKUP_MANAGE` |
| PATCH `/donors/:id` | `{ name, notes }` or `{ status, status_description }` | `LOOKUP_MANAGE` |
| PATCH `/donors/:id` | `{ is_deleted: true }` alone | `LOOKUP_MANAGE`; refused while it has projects |

Unique `name`. Derived: `projects_count, active_projects_count, awarded_total`.

### Organisation assessments — `/assessments`

Table `organisation_assessment`. Related tables: `organisation`, `organisation_assessment_score`, `assessment_document_check`, `assessment_criterion`, `assessment_instrument`, `document`.

| Call | Query or body | Permission |
| --- | --- | --- |
| GET `/assessments?include=scores,checks` | list params | `ORG_ASSESSMENT_VIEW` |
| GET `/assessments/:id?include=scores,checks,documents` | — | `ORG_ASSESSMENT_VIEW` |
| POST `/assessments` | `{ organisation_id, instrument_id, section_comments?: { assessor_notes, follow_up_visit }, overall_recommendation? }` | `ORG_ASSESSMENT_EDIT`; `ORG_ASSESSMENT_APPROVE` when a recommendation is set |
| POST `/assessments?table=organisation_assessment_score` | `{ assessment_id, criterion_id, score }` | `ORG_ASSESSMENT_EDIT`; one per assessment and criterion |
| POST `/assessments?table=assessment_document_check` | `{ assessment_id, document_name, document_check_status: "not_obtained" }` | `DUE_DILIGENCE_MANAGE` |
| PATCH `/assessments/:id` | `{ status_description: "<proposed recommendation>" }` | `ORG_ASSESSMENT_EDIT` |
| PATCH `/assessments/:id` | `{ overall_recommendation }` | `ORG_ASSESSMENT_APPROVE` |
| POST `/assessments?table=document` | `{ owner_type: "organisation_assessment", owner_id, document_type, file_url }` | `DOCUMENT_UPLOAD` |
| PATCH `/assessments/:checkId?table=assessment_document_check` | `{ document_id, document_check_status: "obtained" }` | `DUE_DILIGENCE_MANAGE`; the document must belong to that assessment |

Derived: `organisation_due_diligence`; scores get `criterion_label, criterion_max`.

### Reports — `/reports`

Two stored tables, `narrative_report` and `grant_report`, shown as one reporting calendar.

| Call | Query or body | Notes |
| --- | --- | --- |
| GET `/reports?calendar=true` | `page, pageSize, pillarId, ownerId, status, search, facet=status` only | Calendar rows (below) |
| GET `/reports?calendar=true&format=csv&…` | — | CSV `type,id,title,programme,pillar_id,owner_id,due_date,status`; needs `REPORT_EXPORT_CSV` |
| GET `/reports?catalog=true` | — | `{ projects: [{id, pillar_id, name, donor_id}], pillars: [{id, name, lead_user_id}], owners: [{id, name}], awards: [{id, applicationId, projectId, pillarId}] }` |
| POST `/reports` | `{ project_id, notes: "<title>", reporting_period_start, reporting_period_end, report_status: "pending" }` | Narrative deadline; needs `NARRATIVE_REPORT_MANAGE` |
| POST `/reports?table=document` | `{ owner_type, owner_id, document_type: "report", file_url }`, owner type `"narrative_report"` or `"grant_report"` | Upload metadata |
| PATCH `/reports/:id` | `{ submitted_date, report_status: "submitted" }` | Submit a narrative report |
| PATCH `/reports/:id?table=grant_report` | `{ submitted_date, document_id }` | Submit a grant report |
| GET `/reports/:id?table=document&download=true` | — | Audited download |

```json
// calendar row
{ "key": "grant-12", "id": 12, "type": "grant", "applicationId": 33, "title": "Q3 report", "project": "WEE Grants 2026", "pillarId": 2, "pillar": "Women's Economic Empowerment", "ownerId": 3, "ownerName": "Samuel Ndegwa", "periodStart": "2026-07-01", "periodEnd": "2026-09-30", "dueDate": "2026-10-31", "status": "pending", "submittedDate": null, "documentId": null }
```

- `type` is `narrative` or `grant`; `status` is `pending`, `overdue` or `submitted`.
- Status is computed: submitted once there's a submitted date, overdue once the due date has passed, otherwise pending.
- A narrative report's `dueDate` is its period end. The owner is the pillar lead. Rows are sorted by due date.

---

## Admin

Every admin write is audited, and a caller can never grant more than they hold themselves.

### Users — `/admin/users` (`USER_MANAGE`)

| Call | Query or body | Notes |
| --- | --- | --- |
| GET `/admin/users` | list params, `include=roles` | Derived: `role_names, scope_names, active_role_count`. No password data |
| GET `/admin/users?catalog=access` | — | `{ pillars: [{id, name, code}], roles: [Role], permission_count, multi_role_users }`; needs `ROLE_MANAGE` |
| GET `/admin/users?catalog=pillars` | — | `[{ id, name, code }]` for the scope picker; needs `ROLE_MANAGE` |
| POST `/admin/users` | `{ first_name, middle_name?, last_name, username, phone_number?, email? }` | `username` and `email` unique. The server sets the password (see Open questions) |
| PATCH `/admin/users/:id` | the same fields + `status, status_description, is_deleted` | 403 for disabling yourself, or reactivating an account whose grants exceed yours |
| GET `/admin/users?table=user_role&includeDeleted=true` | — | Role assignments |
| POST `/admin/users?table=user_role` | `{ user_id, role_id, pillar_id }` | `ROLE_MANAGE`. `pillar_id: null` = all pillars. Unique per user, role and pillar, but see Unique keys about `null` |
| PATCH `/admin/users/:linkId?table=user_role` | `{ is_deleted, status }`, status `"ACTIVE"` or `"INACTIVE"` | Switch on or off; 403 for revoking your own role |

### Roles — `/admin/roles` (`ROLE_MANAGE`)

| Call | Query or body | Notes |
| --- | --- | --- |
| GET `/admin/roles`, `/admin/roles/:id?include=permissions` | list params |  |
| POST `/admin/roles` | `{ code, name, description? }` | `code` unique |
| PATCH `/admin/roles/:id` | `{ name, description, status, status_description, is_deleted }` | System roles can't be edited (403). Disabling the role that carries your only all-pillar `PERMISSION_MANAGE` → 403 |

### Permissions — `/admin/permissions` (`PERMISSION_MANAGE`)

| Call | Query or body | Notes |
| --- | --- | --- |
| GET `/admin/permissions?catalog=matrix` | — | `{ roles: [Role], permissions: [Permission], grants: [RolePermission, retired included] }`. Needs `ROLE_MANAGE` or `PERMISSION_MANAGE`; without the latter, `permissions` and `grants` are empty |
| POST `/admin/permissions` | `{ code, module, name, description? }` | `code` unique. PATCH may change `name` and `description` only |
| POST `/admin/permissions?table=role_permission` | `{ role_id, permission_id }` | Not on system roles; only permissions you hold |
| PATCH `/admin/permissions/:linkId?table=role_permission` | `{ is_deleted, status }` | Switch on or off; you can't remove your last `PERMISSION_MANAGE` |

### Pipelines — `/admin/pipelines` (`PILLAR_CONFIG_MANAGE` on the pillar)

| Call | Query or body | Notes |
| --- | --- | --- |
| GET `/admin/pipelines?include=stages` | list params | Stages ordered by `step_no` |
| GET `/admin/pipelines?catalog=pillars` | — | Pillars the caller can configure |
| GET `/admin/pipelines/:id`, `?table=stage_definition&pipeline_id=` | — |  |
| POST `/admin/pipelines` | exactly `{ pillar_id, name, first_stage, last_stage }` | Creates the pillar's only pipeline with 2 stages (201). Names 2–160 characters; first ≠ last |
| PATCH `/admin/pipelines/:id?operation=stage` | `{ action: "add", name, position }` | Insert at position 1 to n+1 (201) |
|  | `{ action: "rename", stageId, name }` | Names unique in the pipeline, ignoring case |
|  | `{ action: "move", stageId, direction }`, direction `"up"` or `"down"` |  |
|  | `{ action: "remove", stageId }` | Soft-delete; at least one stage stays |

Each stage command is atomic and renumbers the remaining stages 1 to n. Plain POST or PATCH on `pipeline_definition` or `stage_definition` → 422 "Use pipeline configuration commands".

### External providers — `/admin/providers` (`PROVIDER_MANAGE`)

| Call | Query or body | Notes |
| --- | --- | --- |
| GET `/admin/providers` | list params, `provider_type=` | Derived: `sessions_count, counselling_count, trainees_count, cases_count, affiliated_institution_name` |
| GET `/admin/providers/:id?include=workload` | — | Row + `workload: { sessions, counselling, trainees, cases }`, each `{ count, recent: [{ id, date, label, pillar? }] }` (5 newest; labels never name a participant) |
| POST `/admin/providers`, PATCH `/admin/providers/:id` | `{ first_name, middle_name?, last_name, provider_type, service_description?, affiliated_institution_id?, phone_number?, email?, notes?, status? }` | See rules below |

- `provider_type`: `counsellor`, `nurse`, `trainer`, `advocate`, `facilitator` or `other`. `status`: `ACTIVE` or `INACTIVE`.
- Phone numbers match `^[0-9+\-() ]{3,30}$`; emails must be valid; masked values (containing `•`) are rejected.

### Lookups — `/lookups/:table`

`:table` is one of `pillar`, `county`, `sub_county`, `ward`, `donor`, `business_sector`, `case_type`, `partner_institution`, `activity_type_definition`, `activity_topic`. Reading needs `DASHBOARD_VIEW`, writing `LOOKUP_MANAGE`. County, sub-county and ward are readable by any signed-in user (they back every location filter); pillars also by anyone with `PARTICIPANT_VIEW` or `REFERRAL_VIEW`.

| Call | Query or body |
| --- | --- |
| GET `/lookups/:table` | `page, pageSize, search`, the parent id (e.g. `county_id` for sub-counties), `includeDeleted=true` |
| GET `/lookups/:table?format=csv&ids=1,2,3` | CSV of the selected rows (at most 5,000) |
| POST `/lookups/:table` | the writable columns below |
| PATCH `/lookups/:table/:id` | writable columns + `status`, `is_deleted` (deleted rows can be restored) |

| Table | Writable columns | Unique |
| --- | --- | --- |
| `pillar` | `code, name, focus_description, lead_user_id` | `code` (fixed after create) |
| `county` | `name` | `name` |
| `sub_county` | `name, county_id` | `(county_id, name)` |
| `ward` | `name, sub_county_id` | `(sub_county_id, name)` |
| `donor` | `name, notes` | `name` |
| `business_sector` | `name` | `name` |
| `case_type` | `name, pillar_id, requires_p3_prc_forms, default_route` | `name` |
| `partner_institution` | `name, institution_type, county_id, contact_details` | — |
| `activity_type_definition` | `name, pillar_id, description` | `(pillar_id, name)` |
| `activity_topic` | `activity_type_id, name, description, sequence_no` | `(activity_type_id, name)` |

- Names are unique ignoring case, like every unique key (422 "Lookup name already exists").
- A parent id can't change after create, and nothing can be created under an inactive parent.
- Deactivate geographic children before their parent.
- Reactivating a pillar can't restore grants beyond the caller's own.
- Derived on `ward`: `county_id, county_name`.

---

## Audit log

Every successful write, download and export creates an audit row. The log is read-only (`POST` and `PATCH` → 422) and needs `AUDIT_LOG_VIEW`.

| Call | Query | Notes |
| --- | --- | --- |
| GET `/audit-logs` | see below | Newest first by default |
| GET `/audit-logs?id=90` | `id` alone | One entry; 404 if missing |
| GET `/audit-logs?format=csv&…filters` | — | Needs `REPORT_EXPORT_CSV`; itself audited as `EXPORT` with its filters in `input_payload` |

List keys (only these): `page`, `pageSize` (≤ 100, default 25), `search` (entity type, id, action, actor name, endpoint, event name), `source` (`HTTP` or `KAFKA`), `module` (entity type), `action`, `performed_by` (user id), `targetId` (entity id), `from` and `to` (`YYYY-MM-DD`), `sortBy` (`id` or `performed_at`), `sortOrder` (`asc` or `desc`).

```json
{
  "id": 90,
  "entity_type": "referral",
  "entity_id": 12,
  "action": "UPDATE",                // CREATE | UPDATE | DELETE | DOWNLOAD | EXPORT
  "source": "HTTP",                  // HTTP | KAFKA
  "performed_by": 4,
  "performed_by_name": "Judy Mwangi",
  "performed_at": "2026-09-30T10:12:44Z",
  "endpoint": "/referrals/:id",
  "event_name": null,
  "input_payload": "{\"status\":\"ACCEPTED\",\"notes\":\"[REDACTED]\"}",
  "previous_state": "{…}",
  "new_state": "{…}"
}
```

### Writing entries

- `action` is `DELETE` when the write sets `is_deleted`, `UPDATE` when the row existed, otherwise `CREATE`.
- `endpoint` is the route template, never the real path, so ids don't leak into logs.
- Payload and states are stored as JSON strings.
- Grant sign-off history and "referred by" are read from these rows, so keep them complete.

### Redaction

Applied when writing and when reading:

- Values under keys matching password, token, secret, credential, authorization, cookie, email, phone, contact, id\_number, first/middle/last name, salary, amount, note(s), payload, file\_url, address or date\_of\_birth become `"[REDACTED]"`.
- Any other text value is also redacted unless its key is `status`, `stage_event_status`, `code`, `module`, `action`, `source`, `entity_type`, `type`, `kind`, `role_code` or `permission_code`.
- Numbers and booleans are kept. Text that isn't valid JSON becomes `"[REDACTED]"`.

---

## Data models

The 40 tables below are copied from the SQL DDL the front end was built against (`src/lib/mock-api/schema.ts`). Unless marked, every table also has the standard columns `id` (int), `created_at`, `updated_at` (datetime), `status` (string(30), default `ACTIVE`), `status_description` (string(255)?), `is_deleted` (bool, default false).

Notation: `type(maxLength)`, `?` = nullable, `→table` = foreign key, `=x` = default. Payloads send and return these names as-is.

### Identity and access

| Table | Columns |
| --- | --- |
| `user` | `first_name: string(80), middle_name: string(80)?, last_name: string(80), username: string(60), password_hash: string(255), phone_number: string(12)?, email: string(160)?` |
| `role` | `code: string(40), name: string(120), description?, is_system_role: bool=false` |
| `user_role` | `user_id →user, role_id →role, pillar_id →pillar?` |
| `permission` | `code: string(60), module: string(40), name: string(160), description?` |
| `role_permission` | `role_id →role, permission_id →permission` |

### Reference data (lookups)

| Table | Columns |
| --- | --- |
| `pillar` | `code: string(20), name: string(120), focus_description?, lead_user_id →user?` |
| `county` | `name: string(60)` |
| `sub_county` | `county_id →county, name: string(80)` |
| `ward` | `sub_county_id →sub_county, name: string(80)` |
| `donor` | `name: string(160), notes?` |
| `business_sector` | `name: string(80)` |
| `case_type` | `pillar_id →pillar?, name: string(120), requires_p3_prc_forms: bool=false, default_route: string(30)` |
| `partner_institution` | `name: string(160), institution_type: string(30), county_id →county?, contact_details: string(255)?` |
| `activity_type_definition` | `pillar_id →pillar, name: string(120), description?` |
| `activity_topic` | `activity_type_id →activity_type_definition, name: string(160), description?, sequence_no: int` |
| `external_provider` | `first_name: string(80), middle_name?, last_name: string(80), provider_type: string(40), service_description: string(255)?, affiliated_institution_id →partner_institution?, phone_number: string(30)?, email: string(160)?, notes?` |

### People, organisations and pipelines

| Table | Columns |
| --- | --- |
| `participant` | `sync_ref: string(80)?, first_name: string(80), middle_name?, last_name: string(80), id_number: string(40)?, id_number_type: string(30)?, date_of_birth: date?, gender: string(20)?, phone_number: string(30)?, ward_id →ward?, is_person_with_disability: bool=false, is_refugee: bool=false, is_consent_given: bool=false, remarks?` |
| `organisation` | `name: string(200), legal_form: string(30), registration_number: string(80)?, ward_id →ward?, address: string(255)?, board_size: int?, board_women_count: int?, board_youth_count: int?, has_bank_account: bool?, financial_mgmt_notes?, safeguarding_policies: json?, due_diligence_status: string(20)=not_started, due_diligence_date: date?` |
| `enrollment` | `participant_id →participant?, organisation_id →organisation?, pillar_id →pillar, entry_category: string(120)` (one of participant/organisation) |
| `pipeline_definition` | `pillar_id →pillar, name: string(160), version: int=1` |
| `stage_definition` | `pipeline_id →pipeline_definition, step_no: int, name: string(160), description?, trigger_description?, key_activities?, documents_needed?, system_tool: string(120)?, typical_duration: string(80)?, completion_criteria?, leads_to_pillar_id →pillar?` |
| `participant_stage_event` | `enrollment_id →enrollment, stage_definition_id →stage_definition, local_ref: string(80)?, event_date: datetime, stage_event_status: string(20)=recorded, source_channel: string(20)=mobile, notes?` |
| `referral` | `enrollment_id →enrollment, from_pillar_id →pillar, to_pillar_id →pillar, from_stage_id →stage_definition?, to_project_id →project?, to_partner_institution_id →partner_institution?, trigger_reason?, notes?, source_training_enrollment_id →training_enrollment?` (`status`: NEW/ACCEPTED/DECLINED/WITHDRAWN) |
| `document` | `owner_type: string(40)` (a table name), `owner_id: int, document_type: string(60), file_url: string(500)` |

### Programme records

| Table | Columns |
| --- | --- |
| `activity_session` | `pillar_id →pillar, enrollment_id →enrollment?, activity_type_id →activity_type_definition, activity_topic_id →activity_topic?, session_date: date, venue: string(160)?, topic: string(200)?, facilitator_user_id →user?, facilitator_provider_id →external_provider?, notes?` |
| `activity_attendance` | `session_id →activity_session, participant_id →participant` |
| `counselling_session` | `enrollment_id →enrollment, session_no: int, session_date: date, session_type: string (psychological_first_aid or follow_up), counsellor_provider_id →external_provider?, counsellor_user_id →user?, notes?` |
| `legal_case` | `enrollment_id →enrollment, case_type_id →case_type, court_name: string(160)?, assigned_officer: string(160)?, next_court_date: date?, court_file_number: string(80)?, ob_number: string(80)?, counsellor: string(160)?, mediation_attempted: bool=false, mediation_outcome: string(20)?, court_status: string(20)?, ruling_date: date?, outcome_notes?, advocate_provider_id →external_provider?, opened_date: date, closed_date: date?` |
| `training_enrollment` | `enrollment_id →enrollment, pathway: string (tvet, apprenticeship, community_center or life_skills), partner_institution_id?, trainer_provider_id →external_provider?, course_name: string(160)?, start_date?, completion_date?, training_status: string=ongoing (ongoing, dropped_out or completed), current_work_status: string? (employed, self_employed, further_training, seeking_work or not_seeking_work), workstation: string(160)?, monthly_salary: decimal?, recommended_for_grant: bool=false` |

### Grants, projects and reporting

| Table | Columns |
| --- | --- |
| `project` | `pillar_id →pillar, name: string(200), notes?, donor_id →donor?, start_date?, end_date?` |
| `grant_application` | `project_id →project, participant_id →participant?, organisation_id →organisation?, requested_amount: decimal, grant_type: string(30), application_document_id →document?, notes?` (`status`: ACTIVE/PREPARED/REVIEWED/APPROVED/DECLINED) |
| `grant_award` | `application_id →grant_application, amount_awarded: decimal, currency: string(10)=KES, sector_id →business_sector?, contract_start?, contract_end?, grant_lifecycle_status: string(20)=active, contract_document_id →document?` |
| `grant_disbursement` | `grant_id →grant_award, amount: decimal, percentage_of_total: decimal?, disbursement_date?, notes?` |
| `grant_report` | `grant_award_id →grant_award, reporting_period_start: date, reporting_period_end: date, due_date: date, submitted_date?, document_id →document?, notes?` |
| `narrative_report` | `project_id →project, reporting_period_start, reporting_period_end, submitted_date?, report_status: string(20)=pending, notes?` |
| `assessment_instrument` | `code: string(30), name: string(160), notes: string(160), scoring_scale: string(20)?` |
| `assessment_criterion` | `instrument_id →assessment_instrument, section: string(120), label: string(200), max_score: int?, sort_order: int=0` |
| `organisation_assessment` | `organisation_id →organisation, instrument_id →assessment_instrument, donor_id →donor?, respondent_names: json?, section_comments: json?, overall_recommendation: string(60)?, recorded_by →user?` |
| `organisation_assessment_score` | `assessment_id, criterion_id, score: int?, notes?` |
| `assessment_document_check` | `assessment_id, document_name: string(160), document_check_status: string(20)=not_obtained, document_id →document?, notes?` |
| `audit_logs` (no standard columns) | `id, entity_type: string(255)?, entity_id: int?, action: string(50), source: string? (HTTP or KAFKA), performed_by: int?, performed_at: datetime, endpoint: string(255)?, event_name: string(255)?, input_payload?, previous_state?, new_state?` |

### Unique keys

A clash → 422. Three rules apply to every key:

- **Soft-deleted rows count.** A retired row still blocks its key; restore it instead of creating a new one.
- **Text compares case-insensitively** (`Nairobi` clashes with `nairobi`), not just for lookup names.
- **A key with any `null` column is not checked** (MySQL semantics). In particular, `user_role(user_id, role_id, pillar_id)` does **not** stop the same all-pillar role (`pillar_id: null`) being assigned twice. The backend should reject that duplicate in code or with a generated column; see Open questions.

| Area | Unique keys |
| --- | --- |
| Identity | `user(username)`, `user(email)`, `role(code)`, `permission(code)`, `user_role(user_id, role_id, pillar_id)`, `role_permission(role_id, permission_id)` |
| Lookups | `pillar(code)`, `county(name)`, `sub_county(county_id, name)`, `ward(sub_county_id, name)`, `donor(name)`, `business_sector(name)`, `case_type(name)`, `activity_type_definition(pillar_id, name)`, `activity_topic(activity_type_id, name)` |
| People and pipelines | `participant(sync_ref)`, `pipeline_definition(pillar_id, version)`, `stage_definition(pipeline_id, step_no)`, `participant_stage_event(local_ref)` |
| Programme records | `counselling_session(enrollment_id, session_no)`, `activity_attendance(session_id, participant_id)` |
| Grants and assessments | `grant_award(application_id)`, `project(pillar_id, name)`, `assessment_instrument(code)`, `organisation_assessment_score(assessment_id, criterion_id)` |

### Reference names on read

Every `<x>_id` that points to a named row also returns `<x>_name`: a person's first, middle and last name; an enrollment's participant or organisation; otherwise the row's `name`. Names resolve even when the linked row is retired. Contact details are never copied across.

### Permission codes

| Area | Codes |
| --- | --- |
| Dashboard and data | `DASHBOARD_VIEW`, `ANALYST_VIEW`, `REPORT_EXPORT_CSV`, `AUDIT_LOG_VIEW` |
| Participants and organisations | `PARTICIPANT_VIEW`, `PARTICIPANT_EDIT`, `PARTICIPANT_RECORD_MANAGE`, `ORGANISATION_VIEW`, `ORGANISATION_EDIT` |
| Referrals and field work | `REFERRAL_VIEW`, `REFERRAL_CREATE`, `REFERRAL_ACCEPT`, `FIELD_SUBMISSION_VIEW`, `FIELD_SUBMISSION_REVIEW` |
| Programme records | `ACTIVITY_SESSION_VIEW`, `ACTIVITY_SESSION_LOG`, `COUNSELLING_VIEW`, `COUNSELLING_LOG`, `CASE_VIEW`, `CASE_EDIT`, `TRAINING_ENROLLMENT_VIEW`, `TRAINING_ENROLLMENT_EDIT`, `BDS_VISIT_LOG` |
| Grants | `GRANT_APPLICATION_VIEW`, `GRANT_APPLICATION_EDIT`, `GRANT_APPLICATION_PREPARE`, `GRANT_APPLICATION_REVIEW`, `GRANT_APPLICATION_APPROVE`, `GRANT_AWARD_VIEW`, `GRANT_AWARD_MANAGE`, `GRANT_DISBURSEMENT_RECORD`, `GRANT_REPORT_VIEW`, `GRANT_REPORT_MANAGE` |
| Reporting and assessments | `NARRATIVE_REPORT_MANAGE`, `ORG_ASSESSMENT_VIEW`, `ORG_ASSESSMENT_EDIT`, `ORG_ASSESSMENT_APPROVE`, `DUE_DILIGENCE_MANAGE` |
| Documents | `DOCUMENT_VIEW`, `DOCUMENT_UPLOAD`, `DOCUMENT_DOWNLOAD` |
| Administration | `USER_MANAGE`, `ROLE_MANAGE`, `PERMISSION_MANAGE`, `PILLAR_CONFIG_MANAGE`, `LOOKUP_MANAGE`, `PROVIDER_MANAGE` |

---

## Open questions for the backend team

Gaps and mock-only shortcuts that need a decision before or during the build.

- [ ] **File storage.** Documents are metadata only: the client sends a `file_url`, and downloads return a URL marked `simulated: true`. We need an upload mechanism (e.g. a pre-signed upload URL endpoint) and short-lived signed download URLs.
- [ ] **Password on user creation.** `POST /admin/users` sends no password; the mock stores a placeholder. Proposal: email a set-password link that reuses the reset-token flow.
- [ ] **Forgot-password delivery.** The mock returns `previewToken` for testing. Production must email the link and return `data: null`.
- [ ] **Sign-in code delivery.** Which SMS or email provider sends codes, and how long is a code?
- [ ] **Token timestamps.** `expireAt` and `refreshExpireAt` arrive as `"2026-09-26 17:37:27"` with no timezone. Please send ISO-8601 with an offset (`2026-09-26T17:37:27+03:00`) or UTC, or add `expiresIn` in seconds. Until then the portal reads them as East Africa Time (`PORTAL_API_UTC_OFFSET`, default `+03:00`).
- [ ] **Session length.** Does a refresh extend `refreshExpireAt`, or must users sign in again 7 days after first signing in?
- [ ] **Draft assessment recommendation.** There is no column for it, so the portal stores the proposal in `status_description` until an approver sets `overall_recommendation`. Add a `proposed_recommendation` column?
- [ ] **Dashboard dates.** Confirm registrations are dated by `participant.created_at` and completions by the `event_date` of verified stage events.
- [ ] **Generic filters.** The mock accepts any returned field as a filter or sort key. If the backend prefers an allow-list per resource, share it so the portal can match.
- [ ] **Composite view limits.** `catalog=origins` stops at 100 and `form-options` is unpaged. Confirm these hold at production volumes.
- [ ] **All-pillar role duplicates.** A unique index on `user_role(user_id, role_id, pillar_id)` lets two rows with `pillar_id = NULL` through. Enforce it with a generated column (e.g. `COALESCE(pillar_id, 0)`) or a check in the service.
- [ ] **Mobile sync.** `participant.sync_ref` and `participant_stage_event.local_ref` come from the mobile app. Its sync endpoints and KAFKA-sourced audit events are outside this document.

### Decided

| Topic | Decision |
| --- | --- |
| 401 vs 403 | 401 for missing, expired or revoked tokens; 403 only for missing permissions. The mock does this. |
| Sign-in code | Kept: `/auth/login` returns a challenge, and `/auth/otp/verify` returns the `TokenPair`. |
| Dashboard period | The overview takes `from` and `to` instead of `year`. |
| Parallel refreshes | A rotated refresh token returns the same new pair for 10 s, then counts as reuse. |
