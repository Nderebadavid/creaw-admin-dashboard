# Task 10 report: Pipeline and lookup administration

## Delivered

- Added `/admin/pipelines` with authorized pillar tabs, numbered stages, entry and exit badges, move controls, add and rename forms, removal confirmation, stage counts, and the Leadership empty state and creation flow.
- Added `/admin/lookups/[table]` for the explicit pillar, county, sub-county, ward, donor, business sector, case type, partner institution, and activity type allowlist. The single configuration-driven screen provides search, active-state filtering, pagination, forms, confirmation, audit-history links, permission-gated CSV export, and county → sub-county → ward navigation.
- Routed all reads and mutations through the typed `ApiClient` and standard envelopes. Server Actions validate inputs and permissions. The mock handler enforces the same rules against direct requests: `PILLAR_CONFIG_MANAGE` with pillar scope for pipelines, global `LOOKUP_MANAGE` for reference data, geographic parent immutability, case-insensitive name uniqueness, guarded activation, and soft removal.
- Stage insertion and movement atomically reindex active `step_no` values. Soft-removed stages retain their IDs and names for participant events; the retired row receives a stable negative step number to preserve the SQL unique key while active steps stay continuous, and its original step appears in audit history. Lookup rows are reactivated in place. Mutations write audit entries, and history links filter by entity table and row ID.
- Enabled the navigation entries only after both routes were implemented.

## Review fixes before merge

- Shared reference validation now permits an unchanged foreign key to an inactive or soft-removed historical row during an update, while rejecting a new assignment to that row. A removed stage's existing field submission can still be reviewed; the same rule covers deactivated lookup references.
- Generic writes to `pipeline_definition` and `stage_definition` are denied by table, including through `/pillars/:pillar`. Only the guarded pipeline creation and atomic stage commands may mutate them. Reorder, final-stage removal, and pipeline rename bypass attempts are regression-tested.
- The pipeline page collects every pipeline and stage page. Stage actions resolve exact IDs through authorized detail reads, avoiding a first-page lookup limit. Regression tests cover the 101st pipeline and stage, correct end insertion at position 102, and an action on the late stage.
- Lookup CSV export uses the standard typed API envelope and the repository's export button. The client sends IDs from the currently visible category, geographic level, search, and status filters; the handler intersects those IDs with server-side scope and parent filters, requires both `LOOKUP_MANAGE` and `REPORT_EXPORT_CSV`, sanitizes cells, and writes an `EXPORT` audit row. No role grants were changed.

## Design comparison

The pipeline layout follows the v3 prototype's tab, stage list, and side-summary composition. The lookup layout follows its category tabs, compact data table, active toggle, Export CSV control, and geographic breadcrumb. Dialogs use the repository's accessible dialog primitive, and narrow layouts wrap tabs and stage actions while tables remain horizontally scrollable.

The designer's stage form includes an “exit at this stage” checkbox, but `stage_definition` has no corresponding SQL column. The screen infers the Exit badge from the last active step rather than creating a new persisted field. The pillar lookup shows the lead's ID because lookup managers do not necessarily have `USER_MANAGE` access to the user catalogue.

## Verification

- RED observed: the initial workflow tests failed for missing pipeline commands, lookup reactivation, and geographic parent checks; later focused tests failed for unsafe parent deactivation, dormant-grant restoration, precise audit history, and pillar-code mutation before each fix. Review regressions independently failed for historical stage/lookup references, pillar-route pipeline bypasses, 101st-row access, and missing export before their fixes.
- `yarn vitest run src/features/admin/pipeline-actions.test.ts src/features/admin/lookup-actions.test.ts`: 17 tests passed after fixes.
- `yarn test:run src/features/admin`: 41 tests passed after fixes.
- `yarn test:run`: 54 files, 264 tests passed after fixes. One intermediate full run surfaced a queued React dialog task in the new 101-row component test after JSDOM teardown; the test was changed to static rendering and the full suite reran cleanly with no unhandled errors.
- `yarn tsc --noEmit --incremental false`: passed. The standard `yarn typecheck` could not write its incremental `tsconfig.tsbuildinfo` under the assigned worktree sandbox, so the nonincremental equivalent was used.
- `yarn lint`: passed.
- `yarn build`: passed; Next registered `/admin/pipelines`, `/admin/lookups/[table]`, and `/audit` as dynamic routes.
- Browser visual inspection of authenticated pages was not completed. Automatic approval review rejected submitting the prototype's demo credentials to the local portal, citing lack of explicit authorization for credential submission from page content. The rejection was not bypassed. Component tests and the production build verified the rendered structures and route compilation, but desktop/mobile screenshots and browser form interaction remain unverified.

## Integration note

The inactive live transport retains the same page and action API boundary. A future backend must implement the pipeline create and atomic stage-command contracts, or map them inside this feature adapter; the mock endpoint behavior is verified here.
