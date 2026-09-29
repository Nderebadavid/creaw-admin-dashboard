# CREAW Admin Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the VSLA starter UI with the designer-approved CREAW MERL portal, including 13 authenticated screen types, stubbed authentication, and a contract-first mock/live API transport switch.

**Architecture:** App Router Server Components load data through feature APIs backed by a single server-only `ApiTransport`. Mock mode dispatches to an in-process schema-faithful repository without network calls; live mode uses authenticated `fetch`. Client Components own only interaction, while every mutation enters through an authenticated, authorized, Zod-validated Server Action.

**Tech Stack:** Next.js 16.3.3 App Router, React 19.2.8, TypeScript 5, Tailwind CSS 4, Zod 4, Lucide React, Vitest, Testing Library, jsdom.

## Global Constraints

- The designer's `CREAW Admin Dashboard v3.dc.html` and login prototype are the visual and interaction source of truth.
- `merl-database-schema-mysql.sql` and `merl-database-flow.md` are the data and relationship source of truth; do not invent persisted columns.
- Every API response is `{ resultCode, success, message, data }`; list data is `{ items, page, pageSize, totalItems, totalPages }`.
- `PORTAL_API_MODE=mock` performs no live network call; `PORTAL_API_MODE=live` changes transport without changing pages or components.
- Every domain delete is a soft update to `is_deleted`; no hard-delete UI or transport method is exposed.
- Permissions are computed through `user_role -> role -> role_permission -> permission` with a separate pillar-scope check.
- Sensitive fields are masked by default, and reveal/download/export/mutation operations create audit entries.
- Server logs are structured and correlated but never contain passwords, tokens, IDs, phone numbers, salaries, grant amounts, or case notes.
- Read the relevant installed Next.js 16.3.3 guides before framework changes; the implementation relies on async `cookies()`, async route props, authenticated Server Actions, and an optimistic-only Proxy.
- Follow red-green-refactor: each behavioral production change begins with a failing test that is observed failing for the expected reason.

---

## File Structure

### Foundation

- `src/types/db.ts`: schema-mirrored table row types used by the portal.
- `src/types/api.ts`: API envelopes, pagination, query, action-result, and error types.
- `src/lib/api/contracts.ts`: Zod envelope helpers.
- `src/lib/api/transport.ts`: `ApiTransport` and `ApiRequest` interfaces.
- `src/lib/api/live-transport.ts`: timeout-aware, authenticated server `fetch` implementation.
- `src/lib/api/mock-transport.ts`: no-network dispatch to mock handlers.
- `src/lib/api/client.ts`: mode selection and validated request facade.
- `src/lib/api/logger.ts`: redacted structured operation logging.
- `src/lib/mock-api/{seed,store,handlers}.ts`: deterministic data, server-lifetime state, and request handlers.
- `src/lib/auth/{session,permissions,actions}.ts`: session DTOs, effective grants, login/logout actions.
- `src/lib/sensitive-fields.ts`: schema-derived sensitivity catalogue and masking helpers.

### Shared UI

- `src/components/portal/{portal-shell,portal-sidebar,portal-header,page-heading,global-search}.tsx`
- `src/components/data-table/{data-table,filter-bar,pagination,row-actions,table-state}.tsx`
- `src/components/ui/{status-badge,metric-card,alert-banner,pillar-card,masked-field,modal-form,document-panel,export-button,progress-chart}.tsx`

### Feature slices

Each folder owns `api.ts`, `schemas.ts`, optional `actions.ts`, and route-specific components:

- `src/features/dashboard`
- `src/features/submissions`
- `src/features/pillars`
- `src/features/participants`
- `src/features/referrals`
- `src/features/grants`
- `src/features/assessments`
- `src/features/reporting`
- `src/features/audit`
- `src/features/admin`

### Routes

- `src/app/(auth)/login/page.tsx`
- `src/app/(portal)/layout.tsx`
- `src/app/(portal)/dashboard/page.tsx`
- `src/app/(portal)/field-submissions/page.tsx`
- `src/app/(portal)/pillars/[pillar]/page.tsx`
- `src/app/(portal)/participants/page.tsx`
- `src/app/(portal)/referrals/page.tsx`
- `src/app/(portal)/grants/page.tsx`
- `src/app/(portal)/grants/[id]/page.tsx`
- `src/app/(portal)/assessments/page.tsx`
- `src/app/(portal)/reporting/page.tsx`
- `src/app/(portal)/audit/page.tsx`
- `src/app/(portal)/admin/users/page.tsx`
- `src/app/(portal)/admin/permissions/page.tsx`
- `src/app/(portal)/admin/pipelines/page.tsx`
- `src/app/(portal)/admin/lookups/[table]/page.tsx`

---

### Task 1: Test Harness and Project Identity

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `.env.example`
- Test: `src/app/layout.test.tsx`

**Interfaces:**
- Produces: `yarn test`, `yarn test:run`, and `yarn typecheck` commands used by every later task.
- Produces: CREAW metadata and design tokens (`--creaw-orange`, `--creaw-ink`, `--creaw-canvas`, pillar colors).

- [ ] **Step 1: Add the failing metadata test**

```tsx
import { describe, expect, it } from "vitest";
import { metadata } from "./layout";

describe("root metadata", () => {
  it("identifies the CREAW MERL portal", () => {
    expect(metadata.title).toBe("CREAW MERL Portal");
    expect(metadata.description).toContain("Monitoring, Evaluation");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `yarn vitest run src/app/layout.test.tsx`  
Expected: FAIL because the current title is `VSLA App`.

- [ ] **Step 3: Add test dependencies and scripts**

Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, and `jsdom` as dev dependencies, configure the `@` alias and jsdom setup, and add:

```json
{
  "test": "vitest",
  "test:run": "vitest run",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 4: Apply CREAW metadata, fonts, and tokens**

Use `Barlow` and `Barlow_Condensed` from `next/font/google`, set metadata to the tested values, and define the prototype palette in `globals.css`. Add:

```env
PORTAL_API_MODE=mock
PORTAL_API_BASE_URL=
PORTAL_API_TIMEOUT_MS=10000
```

- [ ] **Step 5: Verify GREEN**

Run: `yarn test:run src/app/layout.test.tsx && yarn typecheck`  
Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add package.json yarn.lock vitest.config.ts src/test/setup.ts src/app/layout.tsx src/app/globals.css .env.example src/app/layout.test.tsx
git commit -m "chore: configure CREAW portal test foundation"
```

---

### Task 2: API Contracts, Transports, and Traceable Logging

**Files:**
- Create: `src/types/api.ts`
- Create: `src/lib/api/contracts.ts`
- Create: `src/lib/api/transport.ts`
- Create: `src/lib/api/logger.ts`
- Create: `src/lib/api/live-transport.ts`
- Create: `src/lib/api/mock-transport.ts`
- Create: `src/lib/api/client.ts`
- Test: `src/lib/api/contracts.test.ts`
- Test: `src/lib/api/live-transport.test.ts`
- Test: `src/lib/api/logger.test.ts`

**Interfaces:**
- Produces: `ApiEnvelope<T>`, `PaginatedData<T>`, `ApiRequest<TBody>`, `ApiTransport`, `ApiClient.request()`.
- Produces: `createEnvelopeSchema(dataSchema)` and `createPaginatedSchema(itemSchema)`.
- Produces: `logApiOperation(event)` with sensitive-key redaction.

- [ ] **Step 1: Write failing contract tests**

```ts
const schema = createEnvelopeSchema(z.object({ id: z.number() }));
expect(schema.parse({ resultCode: 200, success: true, message: "OK", data: { id: 1 } }).data.id).toBe(1);
expect(() => schema.parse({ success: true, data: { id: 1 } })).toThrow();
```

Add pagination assertions for page `1`, pageSize `25`, totalItems `142`, and totalPages `6`.

- [ ] **Step 2: Verify RED**

Run: `yarn test:run src/lib/api/contracts.test.ts`  
Expected: FAIL because contract helpers do not exist.

- [ ] **Step 3: Implement the transport boundary**

```ts
export interface ApiRequest<TBody = undefined> {
  method: "GET" | "POST" | "PATCH";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: TBody;
  token?: string;
  correlationId?: string;
}

export interface ApiTransport {
  request<T>(request: ApiRequest, schema: z.ZodType<T>): Promise<T>;
}
```

`LiveApiTransport` must use `AbortSignal.timeout`, `cache: "no-store"`, bearer authentication, `x-correlation-id`, and Zod parsing. `MockApiTransport` must call an injected handler and must never call global `fetch`.

- [ ] **Step 4: Add failing transport/logging tests**

Test timeout/error normalization, query serialization, correlation-header forwarding, and that keys matching `password|token|id_number|phone|salary|amount|notes` are emitted as `[REDACTED]`.

- [ ] **Step 5: Implement mode selection**

```ts
export function createApiClient(mode = process.env.PORTAL_API_MODE): ApiClient {
  if (mode === "live") return new ApiClient(new LiveApiTransport(requiredBaseUrl()));
  return new ApiClient(new MockApiTransport(handleMockRequest));
}
```

Reject unknown modes at startup rather than silently making a live call.

- [ ] **Step 6: Verify GREEN**

Run: `yarn test:run src/lib/api && yarn typecheck`  
Expected: all API foundation tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types/api.ts src/lib/api
git commit -m "feat: add swappable typed API transport"
```

---

### Task 3: Schema Types, Mock Store, Permissions, and Masking

**Files:**
- Create: `src/types/db.ts`
- Create: `src/lib/mock-api/seed.ts`
- Create: `src/lib/mock-api/store.ts`
- Create: `src/lib/mock-api/handlers.ts`
- Create: `src/lib/auth/permissions.ts`
- Create: `src/lib/sensitive-fields.ts`
- Test: `src/lib/mock-api/handlers.test.ts`
- Test: `src/lib/auth/permissions.test.ts`
- Test: `src/lib/sensitive-fields.test.ts`

**Interfaces:**
- Produces: schema-shaped row types for every table rendered by the 13 screens.
- Produces: `getMockStore()`, `resetMockStore()`, and `handleMockRequest(request)`.
- Produces: `getEffectiveGrants(userId)` and `hasPermission(grants, code, { pillarId })`.
- Produces: `isSensitiveField(table, column)` and `maskSensitiveValue(value)`.

- [ ] **Step 1: Write failing permission and masking tests**

```ts
expect(hasPermission([{ permissionCode: "REFERRAL_ACCEPT", pillarId: 2 }], "REFERRAL_ACCEPT", { pillarId: 2 })).toBe(true);
expect(hasPermission([{ permissionCode: "REFERRAL_ACCEPT", pillarId: 2 }], "REFERRAL_ACCEPT", { pillarId: 3 })).toBe(false);
expect(hasPermission([{ permissionCode: "REFERRAL_ACCEPT", pillarId: null }], "REFERRAL_ACCEPT", { pillarId: 3 })).toBe(true);
expect(maskSensitiveValue("0712345678")).toBe("••••••5678");
```

- [ ] **Step 2: Verify RED**

Run: `yarn test:run src/lib/auth/permissions.test.ts src/lib/sensitive-fields.test.ts`  
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Mirror the schema and seed the designer's story**

Define the standard six columns once and extend them for `pillar`, `user`, `role`, `permission`, `user_role`, `role_permission`, `participant`, `organisation`, `enrollment`, `document`, `pipeline_definition`, `stage_definition`, `participant_stage_event`, `referral`, `legal_case`, `counselling_session`, `training_enrollment`, `activity_session`, `organisation_assessment`, `organisation_assessment_score`, `assessment_document_check`, `project`, `grant_application`, `grant_record`, `disbursement`, `narrative_report`, and `audit_logs`. Field names must match SQL exactly.

Seed the named records shown by the prototype, including Faith Njeri, Faith Atieno, Peter Otieno, Rehema Karisa, the six pillars, roles, permissions, reports, submissions, referrals, pipelines, and lookups.

- [ ] **Step 4: Implement server-lifetime storage and handlers**

Use a typed `globalThis` slot in development so state survives reload/HMR but resets on process restart. Implement handler matching for the paths in the design spec, list query parsing, pagination metadata, 404/403/422 envelopes, soft-delete updates, and audit creation.

- [ ] **Step 5: Add failing handler contract tests**

Assert `/participants?page=1&pageSize=2` returns exactly two items with correct totals; invalid page size returns resultCode `422`; unknown paths return `404`; a soft deletion keeps the row with `is_deleted=true`; mock dispatch does not call `fetch`.

- [ ] **Step 6: Implement permission and sensitive helpers**

Use the schema-comment-derived list and compute grants by walking store rows. Never check role names.

- [ ] **Step 7: Verify GREEN**

Run: `yarn test:run src/lib/mock-api src/lib/auth/permissions.test.ts src/lib/sensitive-fields.test.ts && yarn typecheck`  
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/types/db.ts src/lib/mock-api src/lib/auth/permissions.ts src/lib/sensitive-fields.ts
git commit -m "feat: add schema-faithful CREAW mock data layer"
```

---

### Task 4: Stub Authentication and Session Security

**Files:**
- Rewrite: `src/lib/auth/session.ts`
- Rewrite: `src/lib/auth/session-server.ts`
- Delete: `src/lib/auth/auth-client.ts`
- Create: `src/lib/auth/actions.ts`
- Rewrite: `src/proxy.ts`
- Rewrite: `src/components/features/auth/auth-shell.tsx`
- Rewrite: `src/components/features/auth/login-form.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Delete: `src/app/api/auth/login/route.ts`
- Delete: `src/app/api/auth/logout/route.ts`
- Test: `src/lib/auth/session.test.ts`
- Test: `src/lib/auth/actions.test.ts`
- Test: `src/components/features/auth/login-form.test.tsx`

**Interfaces:**
- Produces: `getSession()`, `requireSession()`, `loginAction()`, `logoutAction()`.
- Produces: an HTTP-only `creaw_session` cookie containing only an opaque mock/live token.

- [ ] **Step 1: Write failing session/login tests**

Test valid designer credentials, invalid credentials returning the standard envelope, safe same-origin redirects, cookie options, and session resolution through `authApi.me()`.

- [ ] **Step 2: Verify RED**

Run: `yarn test:run src/lib/auth src/components/features/auth/login-form.test.tsx`  
Expected: FAIL against the VSLA identity-service implementation.

- [ ] **Step 3: Implement auth feature API and actions**

Login must call the shared client with `/auth/login`, set the cookie via awaited `cookies()`, and never expose the token in the action result. Logout revokes the mock session through the API and deletes the cookie. `requireSession()` resolves `/auth/me` and redirects to `/login` when invalid. Remove the starter Route Handlers and invoke these Server Actions directly so there is no temporary same-origin API layer to remove later.

- [ ] **Step 4: Make Proxy optimistic only**

`src/proxy.ts` checks only cookie presence and redirects unauthenticated page requests. It performs no fetch, matching the Next.js 16 Proxy guidance. Every layout/action still performs authoritative session and permission checks.

- [ ] **Step 5: Recreate the designer login**

Use the CREAW logo and `login-wvl.png`, designer copy, visible labels, password reveal, loading/error states, and the supplied demo persona. Remove VSLA branding and the dead forgot-password link.

- [ ] **Step 6: Verify GREEN**

Run: `yarn test:run src/lib/auth src/components/features/auth/login-form.test.tsx && yarn typecheck`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/auth src/proxy.ts src/components/features/auth src/app/'(auth)' src/app/api/auth public
git commit -m "feat: add stubbed CREAW authentication flow"
```

---

### Task 5: Portal Shell and Shared Interaction Components

**Files:**
- Create: `src/app/(portal)/layout.tsx`
- Create: `src/app/(portal)/loading.tsx`
- Create: `src/app/(portal)/error.tsx`
- Create: `src/components/portal/portal-shell.tsx`
- Create: `src/components/portal/portal-sidebar.tsx`
- Create: `src/components/portal/portal-header.tsx`
- Create: `src/components/portal/page-heading.tsx`
- Create: `src/components/portal/global-search.tsx`
- Create: `src/components/data-table/data-table.tsx`
- Create: `src/components/data-table/filter-bar.tsx`
- Create: `src/components/data-table/pagination.tsx`
- Create: `src/components/data-table/row-actions.tsx`
- Create: `src/components/data-table/table-state.tsx`
- Create: `src/components/ui/status-badge.tsx`
- Create: `src/components/ui/metric-card.tsx`
- Create: `src/components/ui/alert-banner.tsx`
- Create: `src/components/ui/pillar-card.tsx`
- Create: `src/components/ui/masked-field.tsx`
- Create: `src/components/ui/modal-form.tsx`
- Create: `src/components/ui/document-panel.tsx`
- Create: `src/components/ui/export-button.tsx`
- Create: `src/components/ui/progress-chart.tsx`
- Test: `src/components/portal/portal-sidebar.test.tsx`
- Test: `src/components/data-table/data-table.test.tsx`
- Test: `src/components/ui/masked-field.test.tsx`

**Interfaces:**
- Consumes: `requireSession()`, `EffectiveGrant[]`, shared view models.
- Produces: reusable shell/table/action/state components for every route.

- [ ] **Step 1: Write failing shared-component tests**

Test permission-derived navigation, active-route state, collapsed labels, keyboard-accessible row menus, empty versus filtered-no-results copy, pagination callbacks, masked-by-default output, and audited reveal action invocation.

- [ ] **Step 2: Verify RED**

Run: `yarn test:run src/components/portal src/components/data-table src/components/ui/masked-field.test.tsx`  
Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement the designer shell**

Build the exact five nav groups, CREAW logo, global search, quarter selector, notification bell, user identity, responsive drawer, and compact collapsed mode. Navigation entries must be generated from permissions; no dead route is rendered.

- [ ] **Step 4: Implement reusable table and state patterns**

Support typed columns, row actions, filter chips, page sizes `10|25|50|100`, skeletons, errors, empty collections, no filtered results, and mobile overflow. Row action triggers require an accessible name.

- [ ] **Step 5: Implement sensitive/document/export patterns**

`MaskedField` never stores a revealed value in local storage. `DocumentPanel` distinguishes existing and missing requirements. `ExportButton` exports the current filtered rows and invokes an audit Server Action before download.

- [ ] **Step 6: Verify GREEN**

Run: `yarn test:run src/components && yarn typecheck`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/'(portal)' src/components/portal src/components/data-table src/components/ui
git commit -m "feat: build CREAW portal shell and shared UI"
```

---

### Task 6: Dashboard, Field Submissions, and Pillar Screens

**Files:**
- Create: `src/features/dashboard/schemas.ts`
- Create: `src/features/dashboard/api.ts`
- Create: `src/features/dashboard/components.tsx`
- Create: `src/features/submissions/schemas.ts`
- Create: `src/features/submissions/api.ts`
- Create: `src/features/submissions/actions.ts`
- Create: `src/features/submissions/components.tsx`
- Create: `src/features/pillars/schemas.ts`
- Create: `src/features/pillars/api.ts`
- Create: `src/features/pillars/actions.ts`
- Create: `src/features/pillars/components.tsx`
- Create: `src/app/(portal)/dashboard/page.tsx`
- Create: `src/app/(portal)/field-submissions/page.tsx`
- Create: `src/app/(portal)/pillars/[pillar]/page.tsx`
- Test: `src/features/dashboard/api.test.ts`
- Test: `src/features/submissions/actions.test.ts`
- Test: `src/features/pillars/api.test.ts`

**Interfaces:**
- Produces: `dashboardApi.getOverview(period)`, `submissionsApi.list(query)`, `pillarsApi.get(code)`.
- Produces: `reviewSubmissionAction(id, decision)` and pillar create/update actions.

- [ ] **Step 1: Write failing feature API/action tests**

Assert dashboard totals match seed records; submission approval changes status and writes an audit row; an invalid pillar returns not-found; pillar results respect session scope.

- [ ] **Step 2: Verify RED**

Run: `yarn test:run src/features/dashboard src/features/submissions src/features/pillars`  
Expected: FAIL.

- [ ] **Step 3: Implement typed adapters and secured actions**

Use Zod DTO schemas and map them to dashboard cards, alert, six pillar cards, monthly bar data, participant distribution, submission rows, and pillar record tables. Every action calls `requireSession()`, validates input, checks a permission code, then invokes the feature API.

- [ ] **Step 4: Implement the three designer screens**

Match the prototype hierarchy, values, labels, color vocabulary, tables, filters, actions, and responsive layout. Use async `params` in the pillar route and `notFound()` for unsupported codes.

- [ ] **Step 5: Verify GREEN and visual states**

Run: `yarn test:run src/features/dashboard src/features/submissions src/features/pillars && yarn typecheck`  
Then verify `/dashboard`, `/field-submissions`, and each `/pillars/{vawg,wee,srhr,leadership,wros,skilling}` at desktop and narrow width.

- [ ] **Step 6: Commit**

```bash
git add src/features/dashboard src/features/submissions src/features/pillars src/app/'(portal)'/dashboard src/app/'(portal)'/field-submissions src/app/'(portal)'/pillars
git commit -m "feat: implement dashboard submissions and pillars"
```

---

### Task 7: Participants and Referral Queue

**Files:**
- Create: `src/features/participants/schemas.ts`
- Create: `src/features/participants/api.ts`
- Create: `src/features/participants/actions.ts`
- Create: `src/features/participants/components.tsx`
- Create: `src/features/referrals/schemas.ts`
- Create: `src/features/referrals/api.ts`
- Create: `src/features/referrals/actions.ts`
- Create: `src/features/referrals/components.tsx`
- Create: `src/app/(portal)/participants/page.tsx`
- Create: `src/app/(portal)/referrals/page.tsx`
- Test: `src/features/participants/actions.test.ts`
- Test: `src/features/referrals/actions.test.ts`

**Interfaces:**
- Produces: participant list/detail/register/update/reveal contracts.
- Produces: referral list/create/respond/edit/withdraw contracts.

- [ ] **Step 1: Write failing workflow tests**

Test paginated participant filtering by pillar/county/search, duplicate registration validation, sensitive reveal auditing, referral acceptance creating a destination enrollment on the same participant, and a mismatched pillar scope returning `403` while leaving the action disabled in view data.

- [ ] **Step 2: Verify RED**

Run: `yarn test:run src/features/participants src/features/referrals`  
Expected: FAIL.

- [ ] **Step 3: Implement adapters and actions**

Return stable list/detail view models rather than passing raw joined rows to components. Referral response checks `REFERRAL_ACCEPT` and destination `pillarId` separately. Withdraw updates status instead of deleting.

- [ ] **Step 4: Implement both designer screens**

Participants includes filters, chips, registration modal, cross-pillar enrollments, masked identity data, history, export, and row actions. Referrals includes origin/destination, reason, source, age/date, status, decision modal, disabled explanation, edit, withdraw, and export.

- [ ] **Step 5: Verify GREEN**

Run: `yarn test:run src/features/participants src/features/referrals && yarn typecheck`  
Visually verify `/participants` and `/referrals` including modal and no-results states.

- [ ] **Step 6: Commit**

```bash
git add src/features/participants src/features/referrals src/app/'(portal)'/participants src/app/'(portal)'/referrals
git commit -m "feat: implement participants and referrals"
```

---

### Task 8: Grants, Assessments, and Reporting

**Files:**
- Create: `src/features/grants/schemas.ts`
- Create: `src/features/grants/api.ts`
- Create: `src/features/grants/actions.ts`
- Create: `src/features/grants/components.tsx`
- Create: `src/features/assessments/schemas.ts`
- Create: `src/features/assessments/api.ts`
- Create: `src/features/assessments/actions.ts`
- Create: `src/features/assessments/components.tsx`
- Create: `src/features/reporting/schemas.ts`
- Create: `src/features/reporting/api.ts`
- Create: `src/features/reporting/actions.ts`
- Create: `src/features/reporting/components.tsx`
- Create: `src/app/(portal)/grants/page.tsx`
- Create: `src/app/(portal)/grants/[id]/page.tsx`
- Create: `src/app/(portal)/assessments/page.tsx`
- Create: `src/app/(portal)/reporting/page.tsx`
- Test: `src/features/grants/actions.test.ts`
- Test: `src/features/assessments/actions.test.ts`
- Test: `src/features/reporting/actions.test.ts`

**Interfaces:**
- Produces: grant queue/detail/sign-off/disbursement/document contracts.
- Produces: assessment scoring/document-check/recommendation contracts.
- Produces: reporting deadline/submission/download contracts.

- [ ] **Step 1: Write failing workflow tests**

Test sign-off order, permission denial, award relationship through application IDs, sensitive amount masking, missing assessment document attachment, report status transition from overdue to submitted, and audit rows for application-pack download/export.

- [ ] **Step 2: Verify RED**

Run: `yarn test:run src/features/grants src/features/assessments src/features/reporting`  
Expected: FAIL.

- [ ] **Step 3: Implement feature APIs and secured actions**

Use only schema fields. Where the prototype's sign-off presentation exceeds current schema support, derive display stages from the application status/status_description and add `TODO(schema)` at the adapter boundary without adding fake persisted fields.

- [ ] **Step 4: Implement the designer screens**

Build grant queue and detail with sign-off stepper, document panel, application pack action, and disbursement schedule. Build assessment list/detail modal with score bars and missing-document rows. Build reporting list/calendar with overdue alert, deadline form, document upload/view, owner and pillar filters, and export.

- [ ] **Step 5: Verify GREEN**

Run: `yarn test:run src/features/grants src/features/assessments src/features/reporting && yarn typecheck`  
Visually verify queue, detail, modal, document, and reporting states.

- [ ] **Step 6: Commit**

```bash
git add src/features/grants src/features/assessments src/features/reporting src/app/'(portal)'/grants src/app/'(portal)'/assessments src/app/'(portal)'/reporting
git commit -m "feat: implement grants assessments and reporting"
```

---

### Task 9: Audit, Users, Roles, and Permissions

**Files:**
- Create: `src/features/audit/schemas.ts`
- Create: `src/features/audit/api.ts`
- Create: `src/features/audit/components.tsx`
- Create: `src/features/admin/schemas.ts`
- Create: `src/features/admin/api.ts`
- Create: `src/features/admin/actions.ts`
- Create: `src/features/admin/users-components.tsx`
- Create: `src/features/admin/permissions-components.tsx`
- Create: `src/app/(portal)/audit/page.tsx`
- Create: `src/app/(portal)/admin/users/page.tsx`
- Create: `src/app/(portal)/admin/permissions/page.tsx`
- Test: `src/features/audit/api.test.ts`
- Test: `src/features/admin/users-actions.test.ts`
- Test: `src/features/admin/permissions-actions.test.ts`

**Interfaces:**
- Produces: masked audit filtering/detail/export contracts.
- Produces: user, scoped role grant, role, permission, and role-permission mutation contracts.

- [ ] **Step 1: Write failing security tests**

Test masked nested audit JSON, user soft disable, role assignment with pillar scope, system-role edit rejection, permission-matrix update, and `PERMISSION_MANAGE` denial.

- [ ] **Step 2: Verify RED**

Run: `yarn test:run src/features/audit src/features/admin/users-actions.test.ts src/features/admin/permissions-actions.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement feature APIs/actions**

Recompute effective grants after permission changes. Server Actions re-check the admin permission even when the button was disabled in the client. Return only render-safe user data; phone/email stay masked until an audited reveal.

- [ ] **Step 4: Implement the three designer screens**

Audit includes source/module/action/date/user filters and a masked before/after viewer. Users includes staff table, role chips, scope, status, add/edit forms, and role grants. Permissions includes role tabs, permission modules, toggles, create role, and create permission.

- [ ] **Step 5: Verify GREEN**

Run: `yarn test:run src/features/audit src/features/admin && yarn typecheck`  
Visually verify `/audit`, `/admin/users`, and `/admin/permissions` as administrator and restricted personas.

- [ ] **Step 6: Commit**

```bash
git add src/features/audit src/features/admin src/app/'(portal)'/audit src/app/'(portal)'/admin/users src/app/'(portal)'/admin/permissions
git commit -m "feat: implement audit users and permissions"
```

---

### Task 10: Pipeline and Lookup Administration

**Files:**
- Create: `src/features/admin/pipeline-components.tsx`
- Create: `src/features/admin/lookup-components.tsx`
- Create: `src/app/(portal)/admin/pipelines/page.tsx`
- Create: `src/app/(portal)/admin/lookups/[table]/page.tsx`
- Test: `src/features/admin/pipeline-actions.test.ts`
- Test: `src/features/admin/lookup-actions.test.ts`

**Interfaces:**
- Produces: pipeline add/rename/reorder/soft-remove contracts.
- Produces: generic lookup list/create/update/soft-remove contracts and county/sub-county/ward breadcrumb navigation.

- [ ] **Step 1: Write failing admin workflow tests**

Test stage reorder produces continuous `step_no` values, first/last controls disable correctly, soft removal preserves history, unsupported lookup table returns not-found, unique lookup names return `422`, and geographic children are scoped to their parent.

- [ ] **Step 2: Verify RED**

Run: `yarn test:run src/features/admin/pipeline-actions.test.ts src/features/admin/lookup-actions.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement secured actions**

Check `PIPELINE_MANAGE` or `LOOKUP_MANAGE`, validate table names against an explicit allowlist, and update the mock repository through feature APIs. Never interpolate arbitrary table names into a live URL without allowlist validation.

- [ ] **Step 4: Implement both designer screens**

Pipeline includes pillar tabs, numbered stages, entry/exit badges, move buttons, rename/remove confirmation, add stage, and the Leadership empty state. Lookup pages use one configuration-driven table for pillars, donors, business sectors, case types, partner institutions, activity types, and the geography hierarchy.

- [ ] **Step 5: Verify GREEN**

Run: `yarn test:run src/features/admin && yarn typecheck`  
Visually verify `/admin/pipelines`, every allowed lookup route, hierarchy breadcrumbs, forms, and empty/error states.

- [ ] **Step 6: Commit**

```bash
git add src/features/admin src/app/'(portal)'/admin/pipelines src/app/'(portal)'/admin/lookups
git commit -m "feat: implement pipelines and lookup management"
```

---

### Task 11: Remove Starter Surface and Complete Verification

**Files:**
- Delete: `src/app/(dashboard)`
- Delete: `src/components/features/member`
- Delete: `src/components/layout/header`
- Delete: `src/components/layout/sidebar`
- Delete: `src/lib/mock-db`
- Delete: `src/types/member.ts`
- Replace: `src/app/page.tsx`
- Modify: `README.md`
- Test: all test files

**Interfaces:**
- Consumes: all completed routes and checks.
- Produces: a CREAW-only application with no dead VSLA navigation or placeholder routes.

- [ ] **Step 1: Write the route inventory test**

Create `src/test/route-inventory.test.ts` asserting the expected page files exist and the old members route does not. The expected authenticated routes are the 13 screen types listed in the design specification, with dynamic variants counted once.

- [ ] **Step 2: Verify RED**

Run: `yarn test:run src/test/route-inventory.test.ts`  
Expected: FAIL while the old `(dashboard)/members` route remains.

- [ ] **Step 3: Remove the starter surface and update documentation**

Delete only the listed VSLA-only files after verifying no CREAW imports depend on them. Make `/` redirect through the authenticated session to `/dashboard` or `/login`. Document demo credentials, mock/live environment settings, standard envelopes, test commands, and the fact that mock state resets with the server process.

- [ ] **Step 4: Run automated verification**

Run:

```bash
yarn test:run
yarn lint
yarn typecheck
yarn build
```

Expected: every command exits `0`, with no warnings introduced by portal code.

- [ ] **Step 5: Run full browser verification**

Start `yarn dev`, authenticate through the designer login, and exercise all 13 screen types at approximately 1440px and 390px widths. Verify keyboard navigation, focus rings, sidebar collapse, global search, filters, pagination, each representative mutation, disabled permission explanations, masking/reveal auditing, logout, and direct-route session redirects.

- [ ] **Step 6: Inspect logs**

Confirm each representative operation has a correlation ID, feature, operation, result, and duration. Search logs for seeded passwords, tokens, phone numbers, identity numbers, notes, salaries, and grant amounts; expected result is no sensitive matches.

- [ ] **Step 7: Inspect final diff and status**

Run: `git diff --check && git status --short`  
Expected: only intended CREAW implementation changes, with no generated or unrelated files.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: complete CREAW admin portal"
```
