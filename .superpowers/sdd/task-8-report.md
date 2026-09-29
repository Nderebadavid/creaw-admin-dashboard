# Task 8 implementation report

## Scope and behavior

- Enabled only the implemented `/grants`, `/grants/[id]`, `/assessments`, and `/reporting` routes in the permission-aware navigation. Initial data is loaded in Server Components; interactive workflows use feature APIs, Server Actions, shared UI, and the typed `ApiClient`. Pages do not fetch or import mock rows.
- Grants now have a paginated, filtered queue and detail with the ordered prepared → reviewed → approved sign-off, a derived stepper, documents, an audited application-pack request, and an award/disbursement schedule. Approval creates the schema's `grant_award` by `application_id`; payment writes use its award ID, require an approved application, and cannot exceed the award. Direct award creation is closed to avoid an alternate approval path. Requested and awarded amounts remain masked in ordinary responses.
- Assessments have a paginated list and detail dialog with criterion scores, due-diligence checks, document metadata attachment/view, and distinct recommendation and approval actions. The handler permits both creation and update paths while requiring approval permission whenever `overall_recommendation` is written. A proposed recommendation remains separate from the approved value.
- Reporting combines narrative and grant deadlines across all API pages, with owner/pillar/status/search filters, overdue alert, deadline creation, submission metadata, document view, and audited CSV export. Export applies the same current filters and pillar/permission scope as the list. All document views and application-pack requests are permission-gated and audited. Stub document operations expose metadata only; they do not claim to upload or return file bytes.
- The Server Actions re-check session, module permission, resource pillar, status transition, and linked IDs. The mock handler independently enforces scope and mutation invariants; client-side button states are only affordances.

## Designer comparison and schema limits

- The designer's grant queue cards, detail stepper, document panel and payment section, assessment cards/detail modal and score bars, and reporting overdue callout/filter/table/form hierarchy are represented. Desktop and 390px-wide views were inspected in the in-app browser, including the grant queue/detail, assessment modal, and reporting list; responsive stacks and horizontal table overflow were usable. Empty, filtered-no-results, error, and loading paths are represented in the components and covered by shared table behavior.
- `TODO(schema)` in the grant adapter records that the schema has no individual sign-off actor/timestamp columns. Stages are derived from `status`/`status_description` rather than persisted as invented fields.
- `TODO(schema)` in the assessment adapter records that there is no separate draft recommendation column. `status_description` holds the proposal until an approver writes `overall_recommendation`.
- Reporting has no independent owner or narrative due-date field: the owner label/filter resolves from the project's pillar lead, and narrative due date uses `reporting_period_end`. Grant reports use `due_date`. Mock document URLs are metadata, so “view” confirms authorized audited access rather than opening a remote file.

## TDD and verification

- Workflow tests were written and observed failing before implementation. They cover sign-off order/denial, award relationship and payment bounds, masked amounts, assessment document linkage and approval, report transitions/filters/export, audit rows, and pagination beyond 100 related records. Component tests cover representative queue/dialog/list states.
- Focused run: `yarn test:run src/features/grants src/features/assessments src/features/reporting --silent` — 18 tests passed in six files.
- Full run: `yarn test:run --silent` — 204 tests passed in 42 files.
- `yarn lint`, `yarn typecheck`, `yarn tsc --noEmit --incremental false`, and `yarn build` exited 0. The Next.js 16.3.3 production build lists all four Task 8 routes as dynamic server-rendered routes. `git diff --check` passed.
- The assigned managed worktree required authorized filesystem access for the exact incremental typecheck/build scripts to write generated files; both passed with that access. No live API or remote file storage was used.
