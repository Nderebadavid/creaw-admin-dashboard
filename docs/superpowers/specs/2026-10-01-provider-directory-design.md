# External Provider Directory Design

## Goal

Give the portal an **external provider directory**. External providers are counsellors, nurses, trainers, advocates and facilitators who work with CREAW but are not CREAW staff and cannot sign in. The work has three parts:

- An Admin screen for managing providers.
- Real names wherever a provider or a staff member is linked to a record, instead of `#id` or generic labels.
- A facilitator picker on the session form.

This is sub-project 3 of the schema-gap work. It builds on sub-project 1, curriculum and sessions (`docs/superpowers/specs/2026-09-30-curriculum-sessions-design.md`).

## Decisions

- **Directory location:** Admin → Providers, gated by a new `PROVIDER_MANAGE` permission. Pillar staff never edit providers.
- **Scope:** the directory, names on linked records, a facilitator picker, and each provider's workload. VAWG's free-text `counsellor` field stays unchanged. Replacing it with pickers is out of scope.
- **Contacts:** phone and email are masked everywhere. Holders of `PROVIDER_MANAGE`, or of `SENSITIVE_REVEAL` in any pillar, can reveal them, and each reveal is audited.
- **How names reach pillar screens:** the API adds read-only display names to each record that links a person. Pillar staff never read the `user` or `external_provider` tables directly.

## Data and API Contract

### Names added to records on read

These fields are derived. They are never stored, and a write that includes one is rejected with 422.

| Record | Added field | Source |
|---|---|---|
| `activity_session` | `facilitator_name` | `user` first and last name for `facilitator_user_id`, or `external_provider` first and last name for `facilitator_provider_id` |
| `activity_session` | `facilitator_kind` | `"staff"`, `"provider"` or `null` |
| `training_enrollment` | `trainer_name` | `trainer_provider_id` |
| `counselling_session` | `counsellor_name` | `counsellor_provider_id` |
| `legal_case` | `advocate_name` | `advocate_provider_id` |

- Names come from the linked row even when that row is deactivated or soft-deleted, so history stays readable.
- The value is `null` when nothing is linked.
- No contact field is ever added to a record.

### Facilitator picker options

`GET /pillars/:pillar?table=facilitator_option` is a read-only derived resource. It requires `ACTIVITY_SESSION_LOG` in that pillar and returns:

```json
{ "kind": "staff" | "provider", "id": 9, "name": "Faith Kimani", "detail": "CREAW staff" | "Counsellor · Nairobi Women's Hospital" }
```

- It lists active staff (`user` with status `ACTIVE`, not deleted) and active providers.
- It returns names only.
- It is paginated like other pillar reads.
- The `detail` text for a provider is `<Type>`, or `<Type> · <institution name>` when the provider has an institution.

### Provider directory (Admin)

- `GET /admin/providers` lists providers. `GET /admin/providers/:id` reads one.
- `POST /admin/providers` creates a provider. `PATCH /admin/providers/:id` updates one.
- All four require `PROVIDER_MANAGE`.
- `phone_number` and `email` are returned masked. They are already sensitive fields.
- Writable columns are `first_name`, `middle_name`, `last_name`, `provider_type`, `service_description`, `affiliated_institution_id`, `phone_number`, `email`, `notes` and `status`. Deactivating sets `status` to `INACTIVE` and reactivating sets it to `ACTIVE`. `is_deleted` is not used for providers, so a deactivated provider stays readable and can be reactivated.
- `provider_type` is one of `counsellor`, `nurse`, `trainer`, `advocate`, `facilitator` or `other`.
- `GET /admin/providers/:id?reveal=phone_number|email` returns the unmasked value. It is allowed for holders of `PROVIDER_MANAGE` or of `SENSITIVE_REVEAL` in any pillar, and it writes a `SENSITIVE_REVEAL` audit entry.
- `GET /admin/providers/:id?include=workload` adds `workload` to the response:

```json
{
  "sessions": { "count": 3, "recent": [{ "id": 4, "date": "2026-09-10", "label": "Menstrual health", "pillar": "SRHR" }] },
  "counselling": { "count": 2, "recent": [{ "id": 1, "date": "2026-02-14", "label": "Session 1" }] },
  "trainees": { "count": 1, "recent": [{ "id": 2, "date": "2026-07-15", "label": "Electrical installation · ongoing" }] },
  "cases": { "count": 1, "recent": [{ "id": 1, "date": "2026-02-14", "label": "CRW-VAWG-0001 · in hearing" }] }
}
```

- `recent` holds up to 5 items per group, newest first.
- Labels never contain participant or survivor names.

### Permission

- A new permission `PROVIDER_MANAGE` is added in module `ADMIN`, with the name "Manage external providers".
- The seed grants it to the system admin role.

## Admin → Providers Screen

**Route and navigation**
- The screen is at `/admin/providers`, a Server Component page with client components below it.
- It appears in the sidebar's Admin group only for holders of `PROVIDER_MANAGE`. For anyone else the route returns not-found.
- It follows the Admin → Users pattern.

**Register**
- **Columns:** Name, Type, Service, Institution, Linked work (total count), Status.
- **Chips:** type (All, Counsellor, Nurse, Trainer, Advocate, Facilitator, Other) and status (All, Active, Inactive).
- **Search:** name, service and institution.
- **Export:** an audited CSV export when the user holds `REPORT_EXPORT_CSV`. Contacts stay masked in the export.
- Sorting, paging, empty states and keyboard row opening use the shared table.

**Drawer**
- **Header:** initials avatar; the caption `External provider`; the full name; `<Type> · <institution or "Independent">`; a status badge; and **Edit** and **Deactivate**/**Reactivate** buttons.
- **Overview tab:** type, service description, institution, phone and email as `MaskedField`s with audited reveal, and notes.
- **Linked work tab:** for each of the four groups, the count and up to 5 recent items with date and label. When a group has nothing, it shows "None yet".

**Add/edit dialog**
- **Fields:** first name (required, ≤80), middle name (≤80), last name (required, ≤80), type (required select), service description (≤255), affiliated institution (select of active partner institutions, or "None"), phone (≤30, digits, spaces, `+`, `-`, `(`, `)`), email (valid, ≤160), notes.
- **Contacts on edit:** masked phone and email are never pre-filled. Both fields start blank with the hint "Leave blank to keep the current value". Values containing `•` are rejected.

**Deactivate and reactivate**
- Deactivating needs confirmation: "<Name> will no longer appear in pickers. Records already linked to them keep their name."
- Reactivating needs no confirmation.

**Server Actions**
- `createProviderAction`, `updateProviderAction`, `setProviderActiveAction` and `revealProviderContactAction`.
- Each re-checks the session, validates its input with Zod, checks permission, and revalidates `/admin/providers`.

## Names on Pillar Screens

**SRHR and Skilling sessions**
- `SessionView.facilitator` becomes `{ name: string; kind: "staff" | "provider" | null }`.
- The register's Facilitator column and the drawer subtitle show the name with a small `Staff` or `Provider` tag. With nothing linked, they show `Not assigned`.
- If `facilitator_name` is missing (an older backend), the label falls back to `CREAW staff` or `External provider` according to the id column. It never shows an id.
- Search covers the facilitator name.

**VAWG**
- The case drawer's overview gains an **Advocate** field showing `advocate_name`, or `Not assigned`.
- Timeline counselling entries read `Counselling session <n> · <counsellor_name>` when a counsellor is linked.

**Skilling trainee table**
- No layout change in this sub-project. Sub-project 4 reworks it to use `trainer_name`.

## Facilitator Picker

- Log session and Edit session get a required **Facilitator** select with two option groups, `CREAW staff` and `External providers`, filled from `facilitator_option`.
- In log mode it defaults to the signed-in user. In edit mode it defaults to the session's current facilitator. If the current facilitator is not among the options (for example, deactivated), they are added at the top, labelled by `facilitator_name`.
- The form value is `staff:<id>` or `provider:<id>`. `SessionFormInput` gains `facilitator: { kind: "staff" | "provider"; id: number }`.
- `logSessionAction` and `updateSessionAction` accept a facilitator only if it is in the pillar's option list or equals the session's current facilitator. They send exactly one of `facilitator_user_id` and `facilitator_provider_id`, with the other set to `null`.
- If `facilitator_option` fails to load, the picker offers only "Me (signed-in user)" plus the current facilitator, and logging still works.
- The sessions workspace loads the options only when the user holds `ACTIVITY_SESSION_LOG`.

## Privacy and Permissions

- No pillar screen receives a provider's or staff member's contacts, roles or status. It gets only the derived name.
- Contacts are revealed only through the audited reveal, as described above.
- Workload labels never contain participant names.
- Other Admin screens, lookups and pillars keep their current behaviour.

## Backend Hand-off

The live API must provide:

- the derived name fields on the four record types, rejected on write
- `facilitator_option` with the permission and shape above
- `/admin/providers` CRUD with masking, audited reveal and `include=workload`
- the `PROVIDER_MANAGE` permission

The portal treats every derived name field as optional and falls back as described.

## Testing

- **Mock API:**
  - Names are derived on all four record types, including deactivated providers.
  - Writes that include a derived field are rejected.
  - `facilitator_option` permission, contents (active people only) and detail text.
  - `/admin/providers` requires `PROVIDER_MANAGE`.
  - Reveal is allowed for `PROVIDER_MANAGE` and for `SENSITIVE_REVEAL`, denied otherwise, and writes an audit entry.
  - Workload counts are correct and contain no participant names.
- **Admin:**
  - Register columns, chips and search.
  - Drawer tabs.
  - Masked reveal.
  - The edit dialog does not pre-fill masked contacts and rejects `•`.
  - Deactivate asks for confirmation.
  - Actions deny users without the permission.
- **Sessions:**
  - Names in the register and drawer, with the `Staff`/`Provider` tag.
  - The fallback when the name is missing.
  - Picker grouping and defaults.
  - Edit keeps an inactive facilitator.
  - The actions reject a facilitator outside the options.
  - The picker fallback when options fail to load.
- **VAWG:** the Advocate field and named counselling entries.
- **Final:** the full suite, typecheck, lint, format and build.

## Acceptance Criteria

- Admins with `PROVIDER_MANAGE` can list, add, edit, deactivate and reactivate providers, reveal contacts (audited), and see each provider's linked work.
- No screen shows a provider or staff `#id` where a name is known.
- The session form lets a logger choose any active staff member or provider as facilitator.
- Contacts never reach pillar screens.
