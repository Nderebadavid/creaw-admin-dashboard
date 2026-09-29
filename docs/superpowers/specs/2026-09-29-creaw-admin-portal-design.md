# CREAW Admin Portal Implementation Design

**Date:** 2026-09-29  
**Status:** Approved architecture; ready for implementation planning

## 1. Goal and sources of truth

Build the complete CREAW MERL back-office portal represented by the designer's `CREAW Admin Dashboard v3.dc.html` prototype and companion login designs. The authenticated portal contains 13 screen types, with one shared shell and reusable interaction patterns. The login screen is an additional unauthenticated entry point.

Sources of truth, in priority order:

1. The designer's final `v3` prototype and login prototype define visual design, page content, labels, interactions, states, and navigation.
2. `merl-database-schema-mysql.sql` defines data names, types, nullability, relationships, soft deletion, and sensitive fields.
3. `merl-database-flow.md` defines the intended relationship and RBAC flows.
4. This design defines the implementation boundaries and mock/live API transition.

The user explicitly waived the missing `merl-portal-feature-spec.md` and `merl-backoffice-architecture.md` documents. No extra modules will be invented to compensate for them.

## 2. Screen and route map

The portal will implement the designer's 13 authenticated page types as real App Router routes:

| Designer page | Route | Primary content |
|---|---|---|
| Dashboard | `/dashboard` | KPI cards, alerts, pillar summaries, charts, reporting and referral oversight |
| Field submissions | `/field-submissions` | Mobile submission review queue and approval states |
| Pillar | `/pillars/[pillar]` | Pillar-specific summary, pipeline progress, records, and actions |
| Participants | `/participants` | Cross-pillar participant registry, filters, pagination, and record details |
| Referral queue | `/referrals` | Cross-pillar/external referrals and permission-aware decisions |
| Grants | `/grants` and `/grants/[id]` | Applications queue and sign-off/application detail workflow |
| Organisation assessments | `/assessments` | WRO capacity scoring, due diligence, and document checks |
| Reporting calendar | `/reporting` | Donor and grant deadlines, submission/upload state, and exports |
| Audit log | `/audit` | Filtered trace of create, edit, reveal, upload, download, and export events |
| Users and roles | `/admin/users` | Staff accounts and scoped role assignments |
| Roles and permissions | `/admin/permissions` | Role catalogue and role-permission matrix |
| Pipeline configuration | `/admin/pipelines` | Per-pillar stage creation, rename, reorder, and soft removal |
| Lookup tables | `/admin/lookups/[table]` | Generic lookup management, including geographic drill-down |

`/login` implements the designer's login experience using stub authentication. The six pillars are variations of the same dynamic pillar route, not six duplicated screens.

## 3. UI architecture and visual fidelity

The portal shell will reproduce the designer's warm CREAW palette, Barlow typography, compact side navigation, global search, reporting-period selector, notifications, user menu, responsive collapse behavior, cards, tables, charts, badges, dialogs, drawers, and action menus. Existing generic UI primitives will be retained where they fit and restyled; feature-specific components will stay in their feature folders.

Shared components will cover patterns repeated throughout the prototype:

- application shell, role-aware navigation, header, and global search;
- page header, filter bar, status/pillar chips, pagination, data table, and row actions;
- KPI card, alert banner, pillar card, progress/score display, and simple CSS/SVG charts;
- modal/drawer forms, confirmation dialog, toast feedback, document panel, masked field, export button, and empty/loading/error/no-results states;
- permission-aware actions that remain visible but disabled with an explanation when access is missing.

The implementation will not copy the prototype as one monolithic component. Its look and behavior will be preserved through reusable React components and route-level composition.

## 4. API boundary designed for zero-rewrite migration

Pages and components never import mock data or call `fetch` directly. Each feature exposes typed functions such as:

```ts
participantsApi.list(query)
participantsApi.get(id)
referralsApi.respond(id, input)
grantsApi.approve(id, input)
authApi.login(credentials)
```

These functions use one `ApiTransport` interface:

```ts
interface ApiTransport {
  request<TResponse, TBody = undefined>(
    request: ApiRequest<TBody>,
    schema: z.ZodType<TResponse>,
  ): Promise<TResponse>;
}
```

Two implementations exist from the start:

- `MockApiTransport` dispatches requests to an in-process stub repository without network access. It simulates latency, authorization, pagination, validation failures, and not-found responses.
- `LiveApiTransport` uses server-side `fetch` with `PORTAL_API_BASE_URL`, authentication headers, request timeouts, correlation IDs, cache policy, and normalized errors. It is complete but inactive while `PORTAL_API_MODE=mock`.

Transport selection occurs in one server-only composition module. Switching to the backend changes environment configuration, not components or feature APIs. If live paths or DTOs differ, only the feature adapter changes.

Every response follows one of these schemas:

```ts
type ApiEnvelope<T> = {
  resultCode: number;
  success: boolean;
  message: string;
  data: T;
};

type PaginatedData<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};
```

Zod validates responses at the boundary. Feature adapters map backend DTOs to stable view models when the UI needs combined or formatted data. Components only receive view models.

## 5. Stub behavior and state

The stub repository uses realistic records derived from the designer prototype and schema seed story. Mutations flow through the same feature APIs as future live requests. Stub state persists across page reloads for the life of the development server and resets on server restart.

The stubs support:

- login, logout, session lookup, and effective grants;
- list pagination, sorting, filters, search, and CSV export inputs;
- participant, referral, grant, assessment, report, user/role, permission, pipeline, and lookup operations shown in the prototype;
- soft deletion through `is_deleted`, never HTTP `DELETE` for domain records;
- document metadata/upload simulation without pretending a remote file was stored;
- audit entries for mutations, sensitive-field reveals, downloads, and exports.

Mock and live transports share contract tests so stub drift is caught before backend integration.

## 6. Authentication, permissions, and sensitive data

Stub login returns the standard API envelope and creates an HTTP-only session cookie. The existing live identity-service dependency is removed from the active flow but represented by the inactive live transport.

Permissions are calculated from `user_role -> role -> role_permission -> permission`, including `pillar_id` scope. Navigation is the union of modules available through the user's effective grants. Buttons use permission codes, never role-name checks. A pillar permission and pillar scope are evaluated separately for traceability.

Sensitive schema fields are masked by default. Reveals are explicit, permission-gated, and audited. Audit before/after JSON also passes through sensitive-field masking. No raw access tokens, passwords, identity numbers, contact details, salaries, award amounts, or case notes appear in application logs.

## 7. Logging and error handling

The API boundary generates or forwards a correlation ID for each operation. Structured server logs include:

- timestamp, log level, correlation ID, transport mode, feature, operation, method/path, result code, duration, and actor ID where available;
- concise validation and authorization reasons;
- stack traces for unexpected server failures in development.

Logs avoid request bodies and sensitive values by default. User-facing errors use the API message when safe and offer retry paths for recoverable failures. Expected error, empty, loading, and filtered-no-results states are represented independently on list screens.

## 8. Next.js implementation standards

- Use the App Router and Server Components for initial data loading.
- Use focused Client Components only for interactive filters, menus, dialogs, forms, and charts.
- Use Server Actions for same-origin mutations while keeping feature API calls behind the shared client.
- Keep transport selection, cookies, tokens, and backend base URLs server-only.
- Follow the installed Next.js 16.3.3 documentation in `node_modules/next/dist/docs/` before implementing framework APIs.
- Preserve accessible focus order, keyboard interaction, semantic table/form markup, reduced-motion preferences, and responsive layouts.
- Prefer simple CSS/SVG visualizations rather than adding a chart dependency unless the designer's behavior cannot otherwise be reproduced.

## 9. Testing strategy

Implementation follows test-driven development:

- unit tests for envelope parsing, query serialization, permission calculation, sensitive masking, mock handlers, and DTO-to-view-model mapping;
- contract tests asserting mock responses satisfy the exact schemas expected from live responses;
- component tests for navigation gating, table states, disabled actions, dialogs, forms, and masked fields;
- integration tests for stub login/session, pagination/filtering, representative mutations, audit creation, and logout;
- build, lint, type-check, and visual browser checks at desktop and narrow widths.

The representative end-to-end flows are login, participant registration, referral response, grant approval progression, assessment document completion, report submission, permission editing, pipeline reordering, and lookup creation.

## 10. Scope controls

- Build the interactions demonstrated by the final designer prototype; do not add speculative modules.
- Mirror schema fields and relationships. When the UI implies a field absent from the schema, use the existing schema representation and document the gap with `TODO(schema)` rather than inventing storage.
- Do not introduce a client state framework, full charting suite, ORM, or external mock server unless implementation proves one necessary.
- Do not connect to any live API while mock mode is active.

## 11. Acceptance criteria

- All 13 authenticated screen types and the login screen resolve and visually match the designer's final prototype.
- Navigation, search, filters, pagination, dialogs, primary actions, and representative workflows are functional against stub data.
- All API results use the required standard envelope and paginated lists use the required pagination shape.
- No page or component imports mock data or calls the backend directly.
- Switching transport mode requires configuration rather than UI rewrites.
- Permission and sensitive-data behaviors follow the schema and database flow.
- Logs are readable, correlated, useful for troubleshooting, and redact sensitive values.
- Automated checks pass and visual verification covers the principal routes and responsive shell.
