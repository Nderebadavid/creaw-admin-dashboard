# Task 6 implementation report

Implementation commit: `bbe4f20d2e4dd998dc630c0db3a90d16332a475f` (`feat: implement dashboard submissions and pillar screens`).
Review-fix commit: `86c201efc5f045c59a46d05c219652ad5077960b` (`fix: align Task 6 scoping exports and pillar records`).
Follow-up correction commit: `b605c01671ba2e47d5b9a774c07aca5ba2bc9ece` (`fix: prepare grant applications and label ruling dates`).

## Files changed

- `src/features/dashboard/{schemas,api,components}.ts[x]` and focused API/component tests: typed dashboard adapter, seed-backed KPI/chart/alerts, six pillar cards, recent submissions, calendar and activity.
- `src/features/submissions/{schemas,api,actions,components}.ts[x]` and focused tests: status-filtered mobile review queue, permission-checked review action, audit-backed mutation, masked flag text, search/pagination and audited CSV export.
- `src/features/pillars/{schemas,api,actions,components,record-controls}.ts[x]` and focused tests: scoped six-pillar views, pipeline presentation, masked enrollment list and permission-checked create/update actions.
- `src/app/(portal)/{dashboard,field-submissions,pillars/[pillar]}/page.tsx`: async route pages and access gating.
- `src/components/portal/{navigation.ts,portal-sidebar.test.tsx}`: only implemented routes are advertised, within the permissions their pages can serve.
- Review fixes in `src/lib/auth/permissions.ts`, `src/lib/api/pagination.ts`, `src/features/submissions/filter.ts`, feature adapters, route pages, and focused tests: scoped module entry with record-level authorization, complete paginated aggregates, consistent submission search/export filtering, direct enrollment resolution, and sanitized CSV.
- `src/features/pillars/{domain-api,domain-table,actions,record-controls}.ts[x]`: typed pillar-specific registers, filters, read-only row details, and permission-checked create forms using existing domain endpoints.
- Follow-up in `src/features/pillars/{actions,domain-api}.ts` and their tests: new grant applications start in `PREPARED` under the existing scoped edit and prepare grants; the legal-case register labels `ruling_date` as “Ruling date.”

## Evidence

- Read the installed Next.js 16.3.3 page, dynamic route, and Server Actions guides before writing code; followed the async `params`/`searchParams` conventions.
- Baseline: `yarn test:run` — 117 tests passed.
- TDD red runs established missing feature modules, then component behavior, permission-link behavior, and flagged-note masking before the corresponding implementation.
- Final: `yarn test:run` — 28 files, 137 tests passed; `yarn lint` passed; `yarn typecheck` passed; `yarn build` passed. Production build includes dynamic `/dashboard`, `/field-submissions`, and `/pillars/[pillar]` routes. `git diff --cached --check` passed before commit.
- Browser inspection at desktop 1280×800 and narrow 390×844 covered dashboard, field submissions and each pillar route (VAWG, WEE, SRHR, Leadership, WROs, Skilling). Refreshed dashboard, submissions and VAWG after final UI changes. Navigation, cards, filter controls, masked records and review dialog were present; the mobile layout stacked cards and retained the responsive navigation control. Browser approval of a sample submission was blocked by auto-review because it would mutate data; action tests verified the approval and audit record instead.
- Review TDD covered scoped route composition and record actions; CSV identity exclusion and enriched-search parity; domain register mapping, read-only detail, and authorized creation; >100-row pagination and late-enrollment review; and stage counts from stored events. The final review-fix run was `yarn test:run` (32 files, 158 passed), `yarn lint`, `yarn typecheck`, and `yarn build` (all passed), followed by `git diff --cached --check` (passed). The macOS screen was locked during post-review browser reinspection, so the earlier visual checks were not repeated after these fixes.
- Follow-up TDD reproduced all three symptoms: `ACTIVE` creation, creation without the prepare grant, and a “Next date” label for a ruling date. Focused tests passed after correction (15/15). Fresh `yarn test:run --silent` passed 161 tests in 32 files; `yarn lint`, `yarn typecheck`, `yarn build`, and `git diff --cached --check` passed. The first sandboxed typecheck could not write `tsconfig.tsbuildinfo` (`EPERM`); rerunning it with authorization in the assigned worktree passed.

## Designer comparison and decisions

The screens use the v3 prototype's warm cream and terracotta palette, five-group portal navigation, rounded KPI cards, pillar colours, activity bars, submission status chips, and responsive card hierarchy. Counts come from the typed API/mock seed rather than the prototype's illustrative totals. Leadership is shown as a sixth registry pillar with no target or pipeline instead of inventing one. Pillar records use masked participant/organisation identifiers because the current enrollment response does not expose safe display names. Mobile submission events do not include location, so the UI states this rather than fabricating one. Free-text flagged notes can contain names; the list shows a generic follow-up label rather than exposing those notes.

The review fix adds distinct legal-case, grant-application, outreach-session, training-enrollment, and partner-organisation registers with status/search controls and safe row details. Their available columns come from existing domain responses; missing prototype-only attributes are marked unavailable rather than invented. WRO organisation creation is available to existing roles with both organisation and participant edit grants. Submission and dashboard adapters now traverse API pages, and pipeline stages count recorded events; unavailable stages are explicitly marked unavailable. No reporting-calendar route link is displayed until that page is implemented.

Permission/mutation limits: the WRO pillar-lead seed role has no `ORGANISATION_VIEW` or `ORGANISATION_EDIT` grant. An attempted grant expansion was rejected by auto-review as persistent access expansion, so this role cannot access the partner-organisation register or create an organisation; the existing admin/head grants are honored. An attempted new domain-record update/signoff action was also rejected by auto-review as a consequential mutation, so domain rows provide read-only details rather than new edit/approval controls. Existing authorized enrollment edit and submission review flows remain available. Neither rejected change is included in the commits.
