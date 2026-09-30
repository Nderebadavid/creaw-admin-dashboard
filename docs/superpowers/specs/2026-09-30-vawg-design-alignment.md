# VAWG Page and Case Drawer Design Alignment

## Goal

Make **Home / Pillars / Violence Against Women & Girls** and its legal-case record drawer mirror the supplied Claude Design reference while preserving the portal's permissions, privacy controls, audit behavior, and functional data flows.

## Scope

This change is limited to the VAWG pillar page and the legal-case records opened from its register. It includes the typed data required by the reference, VAWG-specific page composition, the register, and the right-side record drawer. It does not restyle unrelated pillar pages or replace shared portal navigation.

## Data Model

Extend each legal-case record with the reference fields that are not represented today:

- court
- assigned officer
- next court date
- court-file number
- OB number
- counsellor

These are nullable string fields except for the next court date, which is a nullable ISO date. The fields must be carried end to end through the database types, mock schema, seed records, API validation, and the VAWG view model. Optional fields render a consistent fallback such as `—`, `Pending`, or `Not assigned`; the UI must not invent values at render time.

Existing fields and behavior remain authoritative for survivor identity, case type, mediation, court status, opened/ruling/closed dates, counselling sessions, and attached documents.

## Page Composition

The dynamic pillar route detects `vawg` and loads the VAWG workspace alongside the common pillar data and field submissions. Other pillar routes continue to use their current behavior.

The VAWG page follows the reference hierarchy:

1. Breadcrumb and page heading with the VAWG lead description.
2. `Export CSV` and `Open legal case` actions, permission-gated as they are today.
3. Pillar-navigation chips.
4. VAWG hero card containing the pillar identity, lead/counties, annual target count, and progress bar.
5. Four VAWG KPI cards: survivors supported, open legal cases, counselling sessions, and cases concluded.
6. Two-column overview containing the VAWG pipeline and recent field submissions.
7. Legal-case register.

Shared components remain in use where they already express the reference accurately. VAWG-specific components supply the data and layout needed to avoid changing other pillars.

## Legal-Case Register

The register matches the reference labels and ordering:

- Case, with case number and abbreviated survivor name
- Case type
- Court
- Officer
- Next date
- Status

Status chips filter by the statuses present in the workspace. Search covers case number, survivor, case type, court, officer, and status. Sorting, paging, empty states, audited CSV export, and keyboard-accessible row opening continue to use the shared table infrastructure.

Selecting a row opens that record in the right-side drawer.

## Record Drawer

The drawer is a full-height panel approximately 600px wide on desktop and full-width on narrow screens. The background page is dimmed while it is open.

Its header contains:

- VAWG case avatar
- `Legal case · VAWG` caption
- case number and abbreviated survivor name
- case type and court
- close control
- current status badge
- permission-gated Edit, Status, and Attach actions

The drawer provides three tabs:

- **Overview:** case number, survivor, case type, court, court-file number, masked OB number with audited reveal where supported, assigned officer, counsellor, next court date, and court status; followed by the linked participant record.
- **Documents & photos:** attached files with audited view/download controls, required-file warnings, and attach actions.
- **Activity:** a newest-first timeline derived from case status dates, counselling sessions, and the case-opened event.

The existing status-change, attachment, document-viewing, and survivor-reveal flows remain functional. The Edit action opens a focused VAWG case dialog for case type, court, court-file number, OB number, assigned officer, counsellor, and next court date. Its server action validates the values, checks `CASE_EDIT`, updates the legal-case resource, and revalidates the page.

## Privacy and Permissions

Survivor names remain abbreviated or masked in list contexts. Full values and protected identifiers are revealed only through audited server actions and only when the active grants allow it. OB numbers use a VAWG legal-case reveal action backed by the resource API's audited sensitive-field read; the masked value remains visible when reveal is unavailable or fails.

Buttons remain visible or enabled according to the current permission model:

- case editing
- document upload
- document download
- sensitive-field reveal
- export

Server actions revalidate `/pillars/vawg` after successful mutations.

## Error Handling

- API reads validate all new fields with Zod.
- Missing optional data uses explicit UI fallbacks.
- Failed mutations and audited reads surface the existing form-banner or dialog error treatment.
- Failure to load optional supporting data must not hide the legal-case register when core case data is available.

## Testing and Verification

Implementation follows test-driven development. Regression coverage must first demonstrate failures for:

- mapping the new legal-case fields into the VAWG workspace
- selecting the dedicated VAWG page composition
- the reference table columns and searchable values
- opening a case row and rendering the expected drawer header and overview fields
- preserving permission-gated actions and privacy behavior

After implementation, run the focused tests, full test suite, TypeScript checking, linting, and production build. Finally, compare the local VAWG page and an opened case drawer against the supplied reference at desktop width and confirm the narrow-screen drawer remains usable.

## Acceptance Criteria

- The VAWG page visually follows the reference hierarchy and component proportions.
- The legal-case table uses the reference columns, filters, search behavior, and row interaction.
- Clicking a case opens a right-side drawer matching the reference structure and populated from typed data.
- All displayed reference fields are backed by the API/view model or an explicit empty-state fallback.
- Existing permissions, masking, audit logging, exports, status changes, attachments, and document viewing continue to work.
- Other pillar pages are unchanged except for shared extensions required to support VAWG composition.
- Automated checks and the production build pass, and visual browser verification shows no material layout mismatch in the requested surfaces.
