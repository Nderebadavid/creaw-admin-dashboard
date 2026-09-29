# Task 7 implementation report

Implementation commit: `c119f10` (`feat: implement participants and referrals`).

## Scope and behavior

- Added `/participants` and `/referrals` to the permission-aware navigation and created both server-rendered routes with interactive tables, filters, pagination, dialogs, exports, and empty/no-results states.
- Participant API adapters return paginated view models with geographic labels and the visible cross-pillar enrollments. Registration validates duplicate identity numbers, records the requested pillar enrollment on the same participant, and audits both writes. Identity and contact values stay masked until an authorized, audited reveal.
- Referral API adapters return paginated view models with origin/destination, reason, age, status, and permission-aware actions. A destination-scoped `REFERRAL_ACCEPT` grant is checked for decisions; the origin-scoped `REFERRAL_CREATE` grant controls creation, editing, and withdrawal. Accepted internal referrals create a destination enrollment for the origin participant if one does not already exist. Withdrawal retains the referral with `WITHDRAWN` status.
- The seeded schema has no referral source column; the list states “Not recorded” instead of inventing a source. The current creation form sends internal referrals to an existing destination project; seeded external referrals remain visible and their acceptance does not create an internal enrollment.

## Verification

- Resumed and reviewed the pre-existing uncommitted implementation against the Task 7 brief, full design/plan, repository agent rules, and installed Next.js 16.3.3 page and form guidance. No Task 6 files or grants were changed.
- Focused test run: 15 tests passed across participant, referral, and sidebar behavior.
- Full run: `yarn test:run --silent` passed 171 tests in 34 files. `yarn lint`, `yarn typecheck`, and `yarn build` all exited 0. The production build lists dynamic `/participants` and `/referrals` routes. `git diff --cached --check` passed before the implementation commit.
- The first sandboxed typecheck and build could not write generated files in this managed worktree (`EPERM`); rerunning each with filesystem authorization passed.
- Started the local dev server and reached the designer login page. Browser sign-in with the displayed demo credentials was rejected by automatic approval review as an account-access action, so authenticated route, modal, no-results, and responsive visual checks could not be completed through the browser. The build and component/workflow tests provide automated coverage; visual behavior remains unverified.
