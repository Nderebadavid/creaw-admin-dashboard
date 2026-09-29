# Task 7 implementation report

Implementation commit: `c119f10` (`feat: implement participants and referrals`).
Review-fix commit: `a00e4d1` (`fix: preserve referral context and participant stages`).

## Scope and behavior

- Added `/participants` and `/referrals` to the permission-aware navigation and created both server-rendered routes with interactive tables, filters, pagination, dialogs, exports, and empty/no-results states.
- Participant API adapters return paginated view models with geographic labels and the visible cross-pillar enrollments. Registration validates duplicate identity numbers, records the requested pillar enrollment on the same participant, and audits both writes. Identity and contact values stay masked until an authorized, audited reveal.
- Referral API adapters return paginated view models with origin/destination, reason, age, status, and permission-aware actions. A destination-scoped `REFERRAL_ACCEPT` grant is checked for decisions; the origin-scoped `REFERRAL_CREATE` grant controls creation, editing, and withdrawal. Accepted internal referrals create a destination enrollment for the origin participant if one does not already exist. Withdrawal retains the referral with `WITHDRAWN` status.
- The seeded schema has no referral source column; the list states “Not recorded” instead of inventing a source. The creation form supports an internal destination with an existing project or an external partner institution. External acceptance does not create an internal enrollment.

## Verification

- Resumed and reviewed the pre-existing uncommitted implementation against the Task 7 brief, full design/plan, repository agent rules, and installed Next.js 16.3.3 page and form guidance. No Task 6 files or grants were changed.
- Focused test run: 15 tests passed across participant, referral, and sidebar behavior.
- Full run: `yarn test:run --silent` passed 171 tests in 34 files. `yarn lint`, `yarn typecheck`, and `yarn build` all exited 0. The production build lists dynamic `/participants` and `/referrals` routes. `git diff --cached --check` passed before the implementation commit.
- The first sandboxed typecheck and build could not write generated files in this managed worktree (`EPERM`); rerunning each with filesystem authorization passed.
- Started the local dev server and reached the designer login page. Browser sign-in with the displayed demo credentials was rejected by automatic approval review as an account-access action, so authenticated route, modal, no-results, and responsive visual checks could not be completed through the browser. The build and component/workflow tests provide automated coverage; visual behavior remains unverified.

## Review follow-up

- Referral read responses now include a masked participant summary after referral authorization, so a receiving lead can see context without receiving source-pillar participant or enrollment access. The adapter no longer requests the source participant separately. External partner names are resolved in the authorized referral response and shown in the queue and decision dialog; historical names remain visible after a partner is soft retired.
- External creation stores a partner institution with `to_project_id: null`. Internal creation defaults to a matching destination project. A referral-scoped destination catalogue supplies safe partner labels and pillars with projects to the form. Grants and role assignments were not changed.
- Registration, edit, referral creation, decision, edit, and withdrawal errors are announced inside their active dialogs. Participant “Current stage” now comes from the latest stage event and stage definition across the participant’s visible enrollments; entry category remains a separate field.
- Regression tests reproduced the original missing receiving-lead context, external destination conflict and missing label, hidden modal errors, and incorrect stage display before the fixes. Added coverage for existing destination enrollment, repeated acceptance, external hand-off without enrollment, denied reveal, filtered masked export, and joins after 100 enrollment rows.
- Final follow-up verification: `yarn test:run --silent` passed 186 tests in 36 files; `yarn lint`, `yarn typecheck`, `yarn build`, and `git diff --cached --check` passed. The production build lists both Task 7 routes. Browser visual verification remains limited by the earlier automatic approval rejection; no sign-in was retried.
