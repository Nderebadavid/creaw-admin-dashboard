# External Provider Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** This plan adds three things to the portal:
- an Admin → Providers directory for external providers
- real staff and provider names on every record that links a person
- a facilitator picker on the session form

**Architecture:**
- **Mock API:**
  - It adds an `/admin/providers` resource family, backed by the `external_provider` table and gated by a new `PROVIDER_MANAGE` permission. It supports an audited contact reveal and a `?include=workload` view.
  - Reads of `activity_session`, `training_enrollment`, `counselling_session` and `legal_case` gain derived name fields. These are computed when the record is read and never stored.
  - A route handler serves `?table=facilitator_option` on `/pillars/:pillar`.
- **Portal:**
  - A new `src/features/providers/` feature (model, api, actions, components) backs a Server Component page at `/admin/providers`.
  - The existing sessions and VAWG features read the new name fields.

**Tech Stack:** Next.js 16.3 App Router, React 19.2, TypeScript 5, Tailwind CSS 4, Zod 4, Vitest 3, Testing Library and the existing mock API transport.

**Spec:** `docs/superpowers/specs/2026-10-01-provider-directory-design.md`

## Global Constraints

- **Next.js version:** this is NOT the Next.js you know. Before editing a page, read `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`. Pages stay Server Components, and stateful UI goes in `"use client"` components.
- **Server Actions:** every Server Action does these four things, in this order:
  1. re-checks the session with `requireSession()`
  2. validates its input with Zod
  3. checks the permission
  4. after a successful write, calls `revalidatePath`
- **Permission codes:**
  - `PROVIDER_MANAGE` (module `ADMIN`) covers listing, reading, creating and editing providers.
  - Revealing a contact needs either `PROVIDER_MANAGE`, or `SENSITIVE_REVEAL` in any pillar.
  - The picker needs `ACTIVITY_SESSION_LOG` in the session's pillar.
- **Provider types:** exactly `counsellor`, `nurse`, `trainer`, `advocate`, `facilitator` and `other`. The labels are the same words in Title Case.
- **Derived name fields:** exactly `facilitator_name` and `facilitator_kind` (`"staff" | "provider" | null`) on `activity_session`, `trainer_name` on `training_enrollment`, `counsellor_name` on `counselling_session`, and `advocate_name` on `legal_case`. They are never stored. The portal treats each one as optional.
- **Picker option shape:** `{ kind: "staff" | "provider", id: number, name: string, detail: string }`. `detail` is `CREAW staff` for staff, and `<Type>` or `<Type> · <institution name>` for providers. Only active people are listed.
- **Masked contacts:** phone and email never reach pillar screens. Masked values never go into a form. Any value containing `•` is rejected.
- **Facilitator labels:** when a name is missing, fall back to `CREAW staff` or `External provider`, or show `Not assigned` when nothing is linked. Never show a person's `#id`.
- **No new runtime dependency.** Other Admin screens, lookups and pillars keep their behaviour.
- **Seeded users:** user 1 is the system admin, who will hold `PROVIDER_MANAGE`. User 9 is a pillar lead with SRHR session permissions and no ADMIN permissions. Confirm both in `src/lib/mock-api/seed.ts`.
- **Commands:** `yarn test:run <files>`, `yarn typecheck`, `yarn lint`, `yarn format:check`, `yarn build`. A known, unrelated set of post-teardown "window is not defined" errors may make `yarn test:run` exit 1 even when every test passes. Report the test counts, not the exit code.

## Review Focus

1. **Contact masking on every read:** contacts stay masked in the list read, the single read, a PATCH response, the CSV export and the audit snapshot. Only `?reveal=` returns a real value.
   - Expected: no unmasked contact anywhere else.
   - Pinned in Task 1.
2. **Editing a provider's contacts:**
   - Leaving phone or email blank keeps the stored value.
   - Submitting the masked text is rejected.
   - Pinned in Tasks 3 and 4.
3. **A deactivated provider who is still linked to past records:**
   - Their name still shows on those records.
   - They disappear from the picker.
   - When editing a session they already facilitate, they stay selectable.
   - Pinned in Tasks 2 and 5.
4. **A user who holds `SENSITIVE_REVEAL` in one pillar but not `PROVIDER_MANAGE`:**
   - May reveal a provider contact through the API.
   - May not list or read the directory.
   - Pinned in Task 1.
5. **A forged facilitator on a session action:** a provider id that isn't in the option list, or a staff id from outside the portal.
   - Expected: a 422 error, and nothing is written.
   - Pinned in Task 5.

---

### Task 1: Provider Directory Resource in the Mock API

**Files:**
- Modify: `src/lib/api/transport.ts`: add `"/admin/providers"` and `"/admin/providers/:id"` to `API_ROUTE_TEMPLATES`, after `/admin/pipelines/:id`.
- Modify: `src/lib/mock-api/core.ts`: add `"admin/providers": "external_provider"` to `routeTables`, and `external_provider: ["PROVIDER_MANAGE", "PROVIDER_MANAGE"]` to `permissionCodes`.
- Modify: `src/lib/mock-api/story.ts`: append a `PROVIDER_MANAGE` permission with the next free id, module `ADMIN`, name `Manage external providers`, and description `Create, edit and deactivate external providers and reveal their contacts.`
- Modify: `src/lib/mock-api/seed.ts`: seed the three providers and link them to records.
- Modify: `src/lib/mock-api/resources/permission.ts`: a reveal-only permission path for `SENSITIVE_REVEAL` holders.
- Modify: `src/lib/mock-api/resources/read.ts`: the provider reveal rule and the `include=workload` view.
- Modify: `src/lib/mock-api/resources/write.ts`, only if needed: restrict writable provider columns (see Step 4).
- Test: `src/lib/mock-api/providers.test.ts` (new)

**Interfaces:**
- **Produces:**
  - `GET` and `POST /admin/providers`.
  - `GET` and `PATCH /admin/providers/:id`.
  - `GET /admin/providers/:id?reveal=phone_number|email`.
  - `GET /admin/providers/:id?include=workload`, which returns the provider row plus a `workload` object:
    ```ts
    { sessions; counselling; trainees; cases: { count: number; recent: { id: number; date: string; label: string; pillar?: string }[] } }
    ```
- **Seed facts later tasks rely on:**
  - Provider 1 is Faith Kimani, a counsellor with affiliated institution 3 if it exists (otherwise null).
  - Provider 2 is Judy Muthoni, an advocate with no institution.
  - Provider 3 is James Otieno, a trainer with affiliated institution 1 if it exists.
  - The SQL seed gives each provider a phone number; Faith and Judy also have an email.
  - The first `counselling_session` has `counsellor_provider_id` 1.
  - The first `legal_case` has `advocate_provider_id` 2.
  - The first `training_enrollment` has `trainer_provider_id` 3.
  - The SRHR "Facility referral day" session is facilitated by provider 1 (`facilitator_user_id: null`, `facilitator_provider_id: 1`).
  - All other sessions keep their staff facilitator.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/mock-api/providers.test.ts`. Use the request helper pattern from `src/lib/mock-api/activity-topic.test.ts`. Its `raw()` helper sends a request with a pass-through schema; copy it. The tests:

```ts
describe("provider directory", () => {
  const list = (userId: number, query: Record<string, unknown> = {}) =>
    raw(userId, { method: "GET", path: "/admin/providers", routeTemplate: "/admin/providers", query: { page: 1, pageSize: 50, ...query } });
  const one = (userId: number, id: number, query: Record<string, unknown> = {}) =>
    raw(userId, { method: "GET", path: `/admin/providers/${id}`, routeTemplate: "/admin/providers/:id", query });

  it("lists providers to PROVIDER_MANAGE holders with contacts masked", async () => {
    const result = await list(1);
    expect(result.success).toBe(true);
    const faith = result.data.items.find((row: any) => row.first_name === "Faith");
    expect(faith).toMatchObject({ last_name: "Kimani", provider_type: "counsellor" });
    expect(faith.phone_number).toMatch(/•/);
    expect(faith.email).toMatch(/•/);
  });

  it("refuses the directory to users without PROVIDER_MANAGE", async () => {
    expect((await list(9)).resultCode).toBe(403);
    expect((await one(9, 1)).resultCode).toBe(403);
  });

  it("reveals a contact for PROVIDER_MANAGE holders and audits it", async () => {
    const before = getMockStore().audit_logs.length;
    const result = await one(1, 1, { reveal: "phone_number" });
    expect(result.data.phone_number).toBe("0711 900 221");
    expect(getMockStore().audit_logs.length).toBe(before + 1);
  });

  it("lets a pillar-scoped SENSITIVE_REVEAL holder reveal a contact but not browse", async () => {
    const userId = SENSITIVE_REVEAL_ONLY_USER;
    expect((await one(userId, 1, { reveal: "email" })).data.email).toBe("faith.kimani@nwh.example");
    expect((await one(userId, 1)).resultCode).toBe(403);
    expect((await list(userId)).resultCode).toBe(403);
  });

  it("creates, edits and deactivates a provider, keeping contacts masked in responses", async () => {
    const created = await raw(1, {
      method: "POST", path: "/admin/providers", routeTemplate: "/admin/providers",
      body: { first_name: "Grace", middle_name: null, last_name: "Wanjiru", provider_type: "nurse",
        service_description: "Clinical outreach", affiliated_institution_id: null,
        phone_number: "0700 111 222", email: null, notes: null },
    });
    expect(created.resultCode).toBe(201);
    expect(created.data.phone_number).toMatch(/•/);
    const id = created.data.id;
    const deactivated = await raw(1, {
      method: "PATCH", path: `/admin/providers/${id}`, routeTemplate: "/admin/providers/:id",
      body: { status: "INACTIVE" },
    });
    expect(deactivated.data.status).toBe("INACTIVE");
    expect((await one(1, id)).success).toBe(true);
  });

  it("keeps contacts masked in CSV exports and audit snapshots", async () => {
    const csv = await list(1, { format: "csv" });
    expect(csv.success).toBe(true);
    expect(JSON.stringify(csv.data)).not.toContain("0711 900 221");
    await raw(1, {
      method: "PATCH", path: "/admin/providers/1", routeTemplate: "/admin/providers/:id",
      body: { notes: "Updated" },
    });
    const entry = getMockStore().audit_logs.at(-1)!;
    expect(JSON.stringify(entry)).not.toContain("0711 900 221");
    expect(JSON.stringify(entry)).not.toContain("faith.kimani@nwh.example");
  });

  it("rejects an unknown provider type and a masked contact value", async () => {
    const post = (body: Record<string, unknown>) => raw(1, {
      method: "POST", path: "/admin/providers", routeTemplate: "/admin/providers",
      body: { first_name: "A", middle_name: null, last_name: "B", provider_type: "counsellor",
        service_description: null, affiliated_institution_id: null, phone_number: null, email: null, notes: null, ...body },
    });
    expect((await post({ provider_type: "wizard" })).resultCode).toBe(422);
    expect((await post({ phone_number: "••••0221" })).resultCode).toBe(422);
  });

  it("summarises a provider's linked work without participant names", async () => {
    const result = await one(1, 1, { include: "workload" });
    expect(result.data.workload.counselling.count).toBeGreaterThanOrEqual(1);
    expect(result.data.workload.sessions.recent[0]).toMatchObject({ label: "Facility referral day", pillar: "SRHR" });
    const text = JSON.stringify(result.data.workload);
    for (const person of getMockStore().participant) expect(text).not.toContain(person.first_name);
  });
});
```

Set `SENSITIVE_REVEAL_ONLY_USER` to a seeded active user who holds `SENSITIVE_REVEAL` in some pillar but does not hold `PROVIDER_MANAGE`. User 9 is a likely candidate if they hold `SENSITIVE_REVEAL`. Check `seed.ts` (around line 100, where `SENSITIVE_REVEAL` is granted), and add a comment naming the user. If no such user exists, grant one in the test with a store mutation and explain it in a comment.

- [ ] **Step 2: Run the tests and verify RED**

Run: `yarn test:run src/lib/mock-api/providers.test.ts`
Expected: FAIL. The route template does not exist yet (404).

- [ ] **Step 3: Seed the permission, the providers and the links**

- In `story.ts`, append the permission object described under **Files**.
- In `seed.ts`:
  - Add the three `external_provider` rows with the exact values from the SQL seed (`../merl-database-schema-mysql.sql`, `INSERT INTO external_provider`). Keep `affiliated_institution_id` only when that `partner_institution` id exists in the mock store, otherwise use `null`.
  - Set the links listed under **Interfaces**, on the existing rows, after they are added.
  - Check that the system admin role (role id 1) receives every permission, including the new one. The existing loop grants all permissions to role 1.

- [ ] **Step 4: Routing, permissions, the reveal rule and write rules**

In `src/lib/mock-api/resources/permission.ts`, at the start of `resolvePermission`, after `permission` is computed:

```ts
  // A pillar-scoped SENSITIVE_REVEAL holder may reveal a provider contact without browsing the directory.
  if (
    table === "external_provider" &&
    request.method === "GET" &&
    ctx.query.has("reveal") &&
    !hasPermission(grants, "PROVIDER_MANAGE") &&
    hasModulePermission(grants, "SENSITIVE_REVEAL")
  )
    permission = "SENSITIVE_REVEAL";
```

(`query` is on the context. If it isn't destructured there, use `ctx.query`.)

In `src/lib/mock-api/resources/read.ts` `readSingle`, branch the reveal check for providers:

```ts
  if (query.has("reveal")) {
    const field = query.get("reveal")!;
    if (!isSensitiveField(table, field) || field === "password_hash") return envelope(422);
    const mayReveal =
      table === "external_provider"
        ? hasPermission(grants, "PROVIDER_MANAGE") || hasModulePermission(grants, "SENSITIVE_REVEAL")
        : allowed(store, grants, "SENSITIVE_REVEAL", table, existing) &&
          !(pillar && !hasPermission(grants, "SENSITIVE_REVEAL", { pillarId: pillar.id }));
    if (!mayReveal) return envelope(403);
    result[field] = existing[field];
    auditWrite(store, request, userId, table, existing, existing, "REVEAL");
  }
```

The top of `readSingle` calls `allowed(store, grants, permission, table, existing)`. For a provider read resolved as `SENSITIVE_REVEAL`, that call fails because providers have no pillar scope. Skip it in that one case, `table === "external_provider" && permission === "SENSITIVE_REVEAL" && query.has("reveal")`, and let the reveal branch above decide.

Provider write rules belong in `invariants` or `validate`, whichever the codebase uses for per-table business rules; search `write.ts` for `invariants`. The rules:
- Writable keys are `first_name`, `middle_name`, `last_name`, `provider_type`, `service_description`, `affiliated_institution_id`, `phone_number`, `email`, `notes` and `status`. Any other key returns 422.
- `provider_type` must be one of the six types.
- `status` must be `ACTIVE` or `INACTIVE`.
- A string value containing `•` returns 422.
- `phone_number` must match `/^[0-9+\-() ]{3,30}$/`.
- `email` must match `/^[^@\s]+@[^@\s]+\.[^@\s]+$/`.

- [ ] **Step 5: The workload view**

In `readSpecialView`, add:

```ts
  if (table === "external_provider" && existing && query.get("include") === "workload")
    return envelope(200, { ...masked(table, existing), workload: providerWorkload(store, existing.id) });
```

Then add `providerWorkload(store, providerId)` in the same file. It returns, for each group, the `count` and up to 5 `recent` items, newest first by date:
- **sessions:** `activity_session` rows (not deleted) where `facilitator_provider_id === providerId`.
  - `date`: `session_date`.
  - `label`: the planned topic name, else the free-text `topic`, else `"Group session"`.
  - `pillar`: the pillar `code` in upper case, e.g. `SRHR`. For Skilling use `SKILLING`, matching how the pillar table stores codes. Check the seed and reuse its code.
- **counselling:** `counselling_session` rows where `counsellor_provider_id === providerId`. `date` is `session_date`, `label` is `` `Session ${session_no}` ``.
- **trainees:** `training_enrollment` rows where `trainer_provider_id === providerId`. `date` is `start_date ?? created_at.slice(0, 10)`, `label` is `` `${course_name ?? "Course not recorded"} · ${training_status}` ``.
- **cases:** `legal_case` rows where `advocate_provider_id === providerId`. `date` is `opened_date`, `label` is `` `CRW-VAWG-${String(id).padStart(4, "0")} · ${(court_status ?? "opened").replaceAll("_", " ")}` ``.

Labels never include a participant's name.

- [ ] **Step 6: Run the tests and verify GREEN**

Run: `yarn test:run src/lib/mock-api/providers.test.ts src/lib/mock-api/handlers.test.ts src/features/admin`
Expected: all pass. If an existing test counts permissions or route templates, update only that count and say so in your report.

- [ ] **Step 7: Commit**

```bash
git add src/lib/api/transport.ts src/lib/mock-api src/features/admin
git commit -m "feat: serve the external provider directory from the mock API"
```

---

### Task 2: Derived Names and Facilitator Options in the Mock API

**Files:**
- Modify: `src/lib/mock-api/resources/read.ts`: derived names in `presentRow`.
- Create: `src/lib/mock-api/routes/facilitators.ts`: the `facilitator_option` handler.
- Modify: `src/lib/mock-api/handlers.ts`: add `handleFacilitatorOptions(ctx)` to the routed chain, before `handleDashboard`.
- Test: `src/lib/mock-api/provider-names.test.ts` (new)

**Interfaces:**
- **Produces:** the derived fields listed in Global Constraints, on every read of those four tables (list and single).
- **Produces:** `GET /pillars/:pillar?table=facilitator_option`, which returns an envelope with `{ items: FacilitatorOption[]; page: 1; pageSize: items.length || 1; totalItems; totalPages: 1 }`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/mock-api/provider-names.test.ts`, using the same `raw()` helper:

```ts
describe("derived provider and staff names", () => {
  const pillarRead = (userId: number, pillar: string, table: string) =>
    raw(userId, { method: "GET", path: `/pillars/${pillar}`, routeTemplate: "/pillars/:pillar", query: { table, page: 1, pageSize: 100 } });

  it("names staff and provider facilitators on sessions", async () => {
    const { data } = await pillarRead(1, "srhr", "activity_session");
    const provider = data.items.find((row: any) => row.topic === "Facility referral day");
    expect(provider).toMatchObject({ facilitator_name: "Faith Kimani", facilitator_kind: "provider" });
    const staff = data.items.find((row: any) => row.facilitator_user_id === 9);
    const user9 = getMockStore().user.find((row) => row.id === 9)!;
    expect(staff).toMatchObject({ facilitator_name: `${user9.first_name} ${user9.last_name}`, facilitator_kind: "staff" });
  });

  it("names counsellors, advocates and trainers", async () => {
    expect((await pillarRead(1, "vawg", "counselling_session")).data.items[0].counsellor_name).toBe("Faith Kimani");
    expect((await pillarRead(1, "vawg", "legal_case")).data.items[0].advocate_name).toBe("Judy Muthoni");
    expect((await pillarRead(1, "skilling", "training_enrollment")).data.items[0].trainer_name).toBe("James Otieno");
  });

  it("keeps a deactivated provider's name on past records", async () => {
    getMockStore().external_provider.find((row) => row.id === 1)!.status = "INACTIVE";
    const { data } = await pillarRead(1, "srhr", "activity_session");
    expect(data.items.find((row: any) => row.topic === "Facility referral day").facilitator_name).toBe("Faith Kimani");
  });

  it("rejects a write that includes a derived name", async () => {
    const session = getMockStore().activity_session.find((row) => row.pillar_id === 3)!;
    const result = await raw(1, {
      method: "PATCH", path: "/pillars/srhr", routeTemplate: "/pillars/:pillar",
      query: { table: "activity_session", id: session.id }, body: { facilitator_name: "Someone" },
    });
    expect(result.resultCode).toBe(422);
  });

  it("offers active staff and providers to session loggers only", async () => {
    getMockStore().external_provider.find((row) => row.id === 2)!.status = "INACTIVE";
    const result = await pillarRead(9, "srhr", "facilitator_option");
    expect(result.success).toBe(true);
    const items = result.data.items;
    expect(items).toContainEqual({ kind: "provider", id: 1, name: "Faith Kimani", detail: expect.stringMatching(/^Counsellor/) });
    expect(items.some((item: any) => item.kind === "provider" && item.id === 2)).toBe(false);
    expect(items.some((item: any) => item.kind === "staff" && item.id === 9 && item.detail === "CREAW staff")).toBe(true);
    expect(JSON.stringify(items)).not.toMatch(/@|07\d{2}/);
    expect((await pillarRead(NO_SESSION_LOG_USER, "srhr", "facilitator_option")).resultCode).toBe(403);
  });
});
```

`NO_SESSION_LOG_USER` is user 3 (the WEE-only pillar lead), as established in the sessions action tests. Confirm this and add a comment.

- [ ] **Step 2: Run the tests and verify RED**

Run: `yarn test:run src/lib/mock-api/provider-names.test.ts`
Expected: FAIL, because the derived fields and the route are missing.

- [ ] **Step 3: Implement the derived names**

In `read.ts`:

```ts
const fullName = (row: Row | undefined) =>
  row ? [row.first_name, row.last_name].filter(Boolean).join(" ") : null;
const providerName = (store: MockStore, id: unknown) =>
  id ? fullName(rowsFor(store, "external_provider").find((row) => row.id === id)) : null;

/** Read-only display names for the people a record links; never stored. */
function withNames(store: MockStore, table: TableName, row: Row): Row {
  if (table === "activity_session") {
    const staff = row.facilitator_user_id
      ? fullName(rowsFor(store, "user").find((user) => user.id === row.facilitator_user_id))
      : null;
    const provider = providerName(store, row.facilitator_provider_id);
    return {
      ...row,
      facilitator_name: staff ?? provider,
      facilitator_kind: row.facilitator_user_id ? "staff" : row.facilitator_provider_id ? "provider" : null,
    };
  }
  if (table === "training_enrollment") return { ...row, trainer_name: providerName(store, row.trainer_provider_id) };
  if (table === "counselling_session") return { ...row, counsellor_name: providerName(store, row.counsellor_provider_id) };
  if (table === "legal_case") return { ...row, advocate_name: providerName(store, row.advocate_provider_id) };
  return row;
}
```

Change `presentRow` so that its final line becomes `return withNames(store, table, masked(table, row));`. The derived names come from unmasked source rows: user and provider names are not sensitive fields.

Make sure CSV export and the single-row reveal also go through `presentRow`, or apply `withNames` where they build rows, so the names appear consistently. Writes already reject unknown keys through `validate()`; the test above confirms this.

- [ ] **Step 4: Implement the facilitator options route**

Create `src/lib/mock-api/routes/facilitators.ts`:

```ts
import { hasPermission } from "../../auth/permissions";
import { type MockContext } from "../context";
import { envelope, rowsFor, visible } from "../core";

const titleType = (type: unknown) => {
  const text = String(type ?? "other");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Active staff and providers a session logger can pick as facilitator: names only. */
export function handleFacilitatorOptions(ctx: MockContext) {
  const { request, store, query, parts, grants } = ctx;
  if (request.method !== "GET" || parts[0] !== "pillars" || query.get("table") !== "facilitator_option")
    return undefined;
  const pillar = store.pillar.find(
    (row) => !row.is_deleted && (row.code.toLowerCase() === parts[1]?.toLowerCase() || String(row.id) === parts[1])
  );
  if (!pillar) return envelope(404);
  if (!hasPermission(grants, "ACTIVITY_SESSION_LOG", { pillarId: pillar.id })) return envelope(403);
  const active = (row: { status?: unknown; is_deleted?: boolean }) => visible(row as never) && row.status === "ACTIVE";
  const institutions = rowsFor(store, "partner_institution");
  const items = [
    ...rowsFor(store, "user").filter(active).map((user) => ({
      kind: "staff" as const, id: user.id, name: `${user.first_name} ${user.last_name}`, detail: "CREAW staff",
    })),
    ...rowsFor(store, "external_provider").filter(active).map((provider) => {
      const institution = institutions.find((row) => row.id === provider.affiliated_institution_id);
      return {
        kind: "provider" as const,
        id: provider.id,
        name: `${provider.first_name} ${provider.last_name}`,
        detail: institution ? `${titleType(provider.provider_type)} · ${institution.name}` : titleType(provider.provider_type),
      };
    }),
  ];
  return envelope(200, { items, page: 1, pageSize: items.length || 1, totalItems: items.length, totalPages: 1 });
}
```

Adjust `visible` and the row typing to the real signatures in `core.ts`. In `handlers.ts`, add `handleFacilitatorOptions(ctx) ??` to the `routed` chain.

- [ ] **Step 5: Run the tests and verify GREEN**

Run: `yarn test:run src/lib/mock-api src/features/sessions src/features/vawg`
Expected: all pass. The existing sessions and VAWG tests must still pass, since the new fields are additive.

- [ ] **Step 6: Commit**

```bash
git add src/lib/mock-api
git commit -m "feat: name linked staff and providers on records and offer facilitator options"
```

---

### Task 3: Providers Model, Client and Actions

**Files:**
- Create: `src/features/providers/model.ts`
- Create: `src/features/providers/api.ts`
- Create: `src/features/providers/actions.ts`
- Test: `src/features/providers/api.test.ts`
- Test: `src/features/providers/actions.test.ts`

**Interfaces:**
- **Produces (`model.ts`):**

```ts
/** View models shared by the provider directory's server code and client components. */
export const providerTypes = ["counsellor", "nurse", "trainer", "advocate", "facilitator", "other"] as const;
export type ProviderType = (typeof providerTypes)[number];
export const providerTypeLabel = (type: string) => type.charAt(0).toUpperCase() + type.slice(1);
export interface WorkloadItem { id: number; date: string; label: string; pillar?: string }
export interface WorkloadGroup { count: number; recent: WorkloadItem[] }
export interface ProviderWorkload { sessions: WorkloadGroup; counselling: WorkloadGroup; trainees: WorkloadGroup; cases: WorkloadGroup }
export interface ProviderView {
  id: number;
  name: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  type: ProviderType;
  service: string | null;
  institutionId: number | null;
  /** The institution's name, or "Independent". */
  institution: string;
  /** Masked as the API sends them. */
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  /** Sum of the four workload counts. */
  linkedWork: number;
  workload: ProviderWorkload;
}
export interface ProviderDirectory {
  providers: ProviderView[];
  institutions: { id: number; name: string }[];
}
```

- **Produces (`api.ts`):**
  - `createProvidersApi(client, token)` with these methods:
    - `directory(): Promise<ProviderDirectory>`. It reads every page of `/admin/providers`, plus `/lookups/partner_institution`, falling back to `[]` if that read fails. It also reads `include=workload` for each provider, with a fallback of an empty workload.
    - `create(values)`, `update(id, values)`, `setActive(id, active)`, `reveal(id, field: "phone_number" | "email")`.
  - `providersApi.directory()`, a session-bound singleton.
- **Produces (`actions.ts`):**
  - `createProviderAction(input)` and `updateProviderAction(input)`.
  - `setProviderActiveAction({ id, active })`, which returns an `ActionResult`.
  - `revealProviderContactAction(id, field)`, which returns a `RevealResult`.
  - Inputs: `{ id?, firstName, middleName, lastName, type, service, institutionId: number | null, phone, email, notes }`. Blank strings become `null`. On update, a blank `phone` or `email` means "keep", so the key is omitted from the PATCH. Any value containing `•` is rejected with 422 "Enter the contact in full, or leave it blank to keep it".

- [ ] **Step 1: Write the failing tests**

`api.test.ts` uses the `createApiClient(new MockApiTransport(handleMockRequest))` pattern from `src/features/sessions/api.test.ts`:

```ts
it("maps providers with institution, masked contacts and linked work", async () => {
  const { providers } = await apiFor(1).directory();
  const faith = providers.find((row) => row.name === "Faith Kimani")!;
  expect(faith).toMatchObject({ type: "counsellor", active: true });
  expect(faith.phone).toMatch(/•/);
  expect(faith.linkedWork).toBe(
    faith.workload.sessions.count + faith.workload.counselling.count + faith.workload.trainees.count + faith.workload.cases.count
  );
  expect(providers.find((row) => row.name === "Judy Muthoni")!.institution).toBe("Independent");
});
```

`actions.test.ts` uses the cookie and session mocks from `src/features/sessions/actions.test.ts`:

```ts
it("creates a provider and keeps blank contacts on update", async () => {
  expect((await createProviderAction({ firstName: "Grace", middleName: "", lastName: "Wanjiru", type: "nurse",
    service: "Outreach", institutionId: null, phone: "0700 111 222", email: "", notes: "" })).success).toBe(true);
  const grace = getMockStore().external_provider.at(-1)!;
  expect(await updateProviderAction({ id: grace.id, firstName: "Grace", middleName: "", lastName: "Wanjiru", type: "nurse",
    service: "Clinical outreach", institutionId: null, phone: "", email: "", notes: "" })).toMatchObject({ success: true });
  expect(grace).toMatchObject({ service_description: "Clinical outreach", phone_number: "0700 111 222" });
});

it("rejects masked contacts", async () => {
  const result = await updateProviderAction({ id: 1, firstName: "Faith", middleName: "", lastName: "Kimani", type: "counsellor",
    service: "", institutionId: null, phone: "••••0221", email: "", notes: "" });
  expect(result).toMatchObject({ success: false, message: "Enter the contact in full, or leave it blank to keep it" });
});

it("deactivates and reactivates", async () => {
  expect((await setProviderActiveAction({ id: 2, active: false })).success).toBe(true);
  expect(getMockStore().external_provider.find((row) => row.id === 2)!.status).toBe("INACTIVE");
  expect((await setProviderActiveAction({ id: 2, active: true })).success).toBe(true);
});

it("reveals a contact with an audit entry", async () => {
  expect(await revealProviderContactAction(1, "phone_number")).toEqual({ success: true, value: "0711 900 221" });
});

it("refuses users without PROVIDER_MANAGE", async () => {
  cookieStore.get.mockReturnValue({ value: issueMockToken(3) });
  expect((await setProviderActiveAction({ id: 2, active: false })).success).toBe(false);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `yarn test:run src/features/providers`
Expected: FAIL, because the modules don't exist yet.

- [ ] **Step 3: Implement**

Follow `src/features/vawg/api.ts` and `src/features/vawg/actions.ts` for the helpers, envelopes, `withSessionApi`, `actionResult` and `revalidatePath("/admin/providers")`.

- Writes use `routeTemplate: "/admin/providers"` for POST and `"/admin/providers/:id"` for PATCH and single reads.
- Permission checks in the actions:
  - Writes need `hasPermission(session.grants, "PROVIDER_MANAGE")`.
  - Reveal needs `PROVIDER_MANAGE` or `hasModulePermission(session.grants, "SENSITIVE_REVEAL")`.
- The Zod schema:
  - names are trimmed, 1–80 characters (middle name optional)
  - `type` is `z.enum(providerTypes)`
  - `service` is up to 255 characters
  - `institutionId` is a positive int or null
  - `phone` is blank or matches `/^[0-9+\-() ]{3,30}$/`
  - `email` is blank or a valid email of up to 160 characters
  - `notes` is up to 2000 characters
- Map the inputs to API columns: `first_name`, `middle_name`, `last_name`, `provider_type`, `service_description`, `affiliated_institution_id`, `phone_number`, `email` and `notes`.

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `yarn test:run src/features/providers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/providers
git commit -m "feat: model, read and manage external providers"
```

---

### Task 4: Admin → Providers Screen

**Files:**
- Create: `src/app/(portal)/admin/providers/page.tsx` (Server Component)
- Create: `src/features/providers/components/provider-register.tsx` (`"use client"`)
- Create: `src/features/providers/components/provider-drawer.tsx` (`"use client"`)
- Create: `src/features/providers/components/provider-dialogs.tsx` (`"use client"`)
- Modify: `src/components/portal/navigation.ts`: add `"/admin/providers"` to the implemented-routes list and the global-only routes set. Add the Admin item `{ label: "Providers", href: "/admin/providers", permissions: ["PROVIDER_MANAGE"], icon: Contact }`, placed after Users & roles. Use `Contact` from `lucide-react`, or the nearest existing icon.
- Test: `src/features/providers/components.test.tsx`
- Test: extend the navigation tests, if `src/components/portal/*navigation*.test.ts` exists. Otherwise assert the item in `components.test.tsx` via `permittedNavigation`.

**Interfaces:**
- **Consumes:** Task 3's model, api and actions.
- **Produces:**
  - `ProviderRegister({ directory, can }: { directory: ProviderDirectory; can: { manage: boolean; reveal: boolean; export: boolean } })`
  - `ProviderDrawer`, `ProviderFormDialog` and `DeactivateProviderDialog`

- [ ] **Step 1: Write the failing tests**

Create `src/features/providers/components.test.tsx`:
- Mock `./actions` with `vi.mock("./actions", …)`. The test file sits beside `actions.ts`.
- Mock `next/navigation` and `@/components/portal/data-actions`, as `src/features/sessions/components.test.tsx` does.
- Build a `ProviderDirectory` fixture with:
  - Faith Kimani: counsellor, institution "Nairobi Women's Hospital", masked phone `••••• ••0 221`, active, workload with 1 session ("Facility referral day", SRHR) and 2 counselling items.
  - Judy Muthoni: advocate, "Independent", inactive.

Then assert:

```tsx
it("lists providers with the directory columns and filters", () => {
  render(<ProviderRegister directory={directory} can={all} />);
  for (const heading of ["Name", "Type", "Service", "Institution", "Linked work", "Status"])
    expect(screen.getByRole("columnheader", { name: new RegExp(heading) })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Inactive" }));
  expect(screen.queryByRole("button", { name: "Open Faith Kimani" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open Judy Muthoni" })).toBeInTheDocument();
});

it("opens the drawer with masked contacts and linked work", () => {
  render(<ProviderRegister directory={directory} can={all} />);
  fireEvent.click(screen.getByRole("button", { name: "Open Faith Kimani" }));
  const drawer = screen.getByRole("dialog");
  expect(drawer).toHaveTextContent("External provider");
  expect(drawer).toHaveTextContent("Counsellor · Nairobi Women's Hospital");
  expect(within(drawer).getByRole("button", { name: /Reveal phone/i })).toBeEnabled();
  fireEvent.click(within(drawer).getByRole("tab", { name: /Linked work/ }));
  expect(drawer).toHaveTextContent("Facility referral day");
});

it("never pre-fills masked contacts when editing", () => {
  render(<ProviderRegister directory={directory} can={all} />);
  fireEvent.click(screen.getByRole("button", { name: "Open Faith Kimani" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Edit" }));
  const form = screen.getByRole("dialog", { name: /Edit provider/ });
  expect(within(form).getByLabelText("Phone")).toHaveValue("");
  expect(within(form).getAllByText("Leave blank to keep the current value").length).toBe(2);
});

it("confirms before deactivating", () => {
  render(<ProviderRegister directory={directory} can={all} />);
  fireEvent.click(screen.getByRole("button", { name: "Open Faith Kimani" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Deactivate" }));
  expect(screen.getByRole("dialog", { name: /Deactivate provider/ })).toHaveTextContent(
    "Faith Kimani will no longer appear in pickers. Records already linked to them keep their name."
  );
});

it("hides management controls without permission", () => {
  render(<ProviderRegister directory={directory} can={{ manage: false, reveal: false, export: false }} />);
  expect(screen.queryByRole("button", { name: "Add provider" })).not.toBeInTheDocument();
});
```

Add a navigation assertion: `permittedNavigation(grantsWith("PROVIDER_MANAGE"))` includes `/admin/providers`, and a grant set without it does not. Use whatever grant-fixture helper the navigation tests already use.

- [ ] **Step 2: Run the tests and verify RED**

Run: `yarn test:run src/features/providers/components.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the page and components**

**Page.** Follow `src/app/(portal)/admin/users/page.tsx`:

```tsx
export default async function ProvidersPage() {
  const session = await requireSession();
  if (!hasPermission(session.grants, "PROVIDER_MANAGE")) notFound();
  const directory = await providersApi.directory().catch(() => null);
  return (
    <>
      <PageHeading title="External providers" section="Admin" description="Counsellors, nurses, trainers, advocates and facilitators who work with CREAW" />
      {directory ? (
        <ProviderRegister
          directory={directory}
          can={{ manage: true, reveal: true, export: hasPermission(session.grants, "REPORT_EXPORT_CSV") }}
        />
      ) : (
        <AlertBanner tone="warning">The provider directory could not be loaded. Refresh the page to try again.</AlertBanner>
      )}
    </>
  );
}
```

**Register.** Follow `src/features/sessions/components/session-register.tsx` (`TableCard`, `DataTable`, client sorting and paging, `ExportButton`, `FormBanner`):
- Columns: Name, Type (`providerTypeLabel`), Service (`service ?? "—"`), Institution, Linked work (count), Status (`StatusBadge` Active/Inactive).
- Two chip rows: type (`All` plus the six labels) and status (`All`, `Active`, `Inactive`). If `TableCard` supports only one chip row, put the status chips in `filters` as plain buttons with `aria-pressed`.
- Search covers name, service and institution, with the label `Search providers`.
- Export: `auditedExportAction({ path: "/admin/providers", routeTemplate: "/admin/providers", query: {} })`.
- Row open label: `Open <name>`.
- An `Add provider` button appears when `can.manage` is true.

**Drawer.** Follow `case-drawer.tsx`:
- Header:
  - `initials`: the provider's initials
  - `kind`: `External provider`
  - `title`: the name
  - `subtitle`: `` `${providerTypeLabel(type)} · ${institution}` ``
  - `status`: a badge
  - actions: Edit, and Deactivate or Reactivate (both disabled unless `can.manage`)
- Overview tab: Type, Service, Institution, Phone and Email as `MaskedField` with `revealAction={can.reveal && phone ? () => revealProviderContactAction(id, "phone_number") : undefined}` (likewise for email), and Notes.
- Linked work tab: four sections titled Sessions facilitated, Counselling sessions, Trainees and Legal cases. Each shows its count in the section note and up to 5 rows of `formatDate(date)` and `label` (with `pillar` when present), or `None yet`.

**Dialogs.** `ProviderFormDialog` follows `EditCaseDialog`:
- Fields: First name, Middle name, Last name, Type (select), Service description, Affiliated institution (select with a `None` option), Phone, Email and Notes.
- In edit mode, Phone and Email default to `""`, each with the hint `Leave blank to keep the current value`.
- Titles: `Add provider` / `Edit provider`. Success messages: `<name> added` / `<name> updated`.

`DeactivateProviderDialog` shows the exact confirmation text from the test.

On success everything calls `router.refresh()` and restores the drawer, as in the session register.

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `yarn test:run src/features/providers src/components/portal`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add 'src/app/(portal)/admin/providers' src/features/providers/components src/features/providers/components.test.tsx src/components/portal
git commit -m "feat: add the admin external provider directory"
```

---

### Task 5: Facilitator Names and Picker in Sessions

**Files:**
- Modify: `src/features/sessions/model.ts`
- Modify: `src/features/sessions/api.ts`
- Modify: `src/features/sessions/actions.ts`
- Modify: `src/features/sessions/components/session-register.tsx`
- Modify: `src/features/sessions/components/session-drawer.tsx`
- Modify: `src/features/sessions/components/session-dialogs.tsx`
- Modify: `src/app/(portal)/pillars/[pillar]/loaders.tsx`: pass `canLog` into the workspace load.
- Test: `src/features/sessions/api.test.ts`, `actions.test.ts`, `components.test.tsx` and `src/app/(portal)/pillars/[pillar]/page.test.tsx` (extend and update)

**Interfaces:**
- **Consumes:** Task 2's `facilitator_name`, `facilitator_kind` and `facilitator_option`.
- **Produces (model changes):**

```ts
export interface FacilitatorView { name: string; kind: "staff" | "provider" | null }
export interface FacilitatorOption { kind: "staff" | "provider"; id: number; name: string; detail: string }
// SessionView: replace `facilitator: FacilitatorLabel` with
//   facilitator: FacilitatorView;
//   facilitatorRef: { kind: "staff" | "provider"; id: number } | null;
// SessionWorkspace: add
//   facilitators: FacilitatorOption[];   // [] when the user can't log or the read fails
//   currentUser: { id: number; name: string } | null;
```

- **Produces:**
  - `createSessionsApi(...).workspace(pillar, period, today?, options?: { canLog?: boolean; currentUser?: { id: number; name: string } })`, which loads `facilitator_option` only when `canLog` is true. `sessionsApi.workspace(pillar, period, options?)` gets the same change.
  - Action input `facilitator: { kind: "staff" | "provider"; id: number }`, required for both log and update.

- [ ] **Step 1: Write the failing tests**

- **api.test.ts:** a test that the "Facility referral day" session maps to `facilitator: { name: "Faith Kimani", kind: "provider" }` and `facilitatorRef: { kind: "provider", id: 1 }`.
- **api.test.ts:** a test that `workspace("srhr", "all", today, { canLog: true })` returns facilitators that include Faith Kimani, and that `{ canLog: false }` returns `[]`.
- **api.test.ts:** a test that, when the facilitator name is missing (simulate by deleting `facilitator_name` from the response via a `client.request` spy), the label falls back to `CREAW staff` or `External provider`.
- **actions.test.ts:**
  - Logging with `facilitator: { kind: "provider", id: 1 }` stores `facilitator_provider_id: 1, facilitator_user_id: null`.
  - Logging with a provider id not in the options (e.g. 999), or with an inactive provider (deactivate provider 2 first), returns 422 "Choose a facilitator from the list", and nothing is written.
  - Editing a session whose facilitator has since been deactivated, keeping that same facilitator, succeeds.
- **components.test.tsx:**
  - Update the fixture to the new `facilitator` and `facilitatorRef` shapes plus `facilitators` and `currentUser`.
  - Assert the register shows `Faith Kimani` with a `Provider` tag.
  - Assert the Log session form's `Facilitator` select has the option groups `CREAW staff` and `External providers`, and defaults to the current user.
  - Assert that when `facilitators` is `[]` the select offers only `Me (<current user name>)`.
  - Assert that editing a session whose facilitator is missing from the options keeps it selected, labelled with its name.
  - Update existing assertions that expected `CREAW staff` as the facilitator text.
- **page.test.tsx:** an SRHR render containing `Faith Kimani`.

- [ ] **Step 2: Run the tests and verify RED**

Run: `yarn test:run src/features/sessions 'src/app/(portal)/pillars/[pillar]/page.test.tsx'`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement**

**api.ts**
- Extend `sessionSchema` with `facilitator_name: z.string().nullish().transform((v) => v ?? null)` and `facilitator_kind: z.enum(["staff", "provider"]).nullish().transform((v) => v ?? null)`.
- The facilitator becomes `{ name: row.facilitator_name ?? fallbackLabel, kind }`, where `kind` is `row.facilitator_kind`, or is derived from the id columns. The fallback label is the old `CREAW staff`, `External provider` or `Not assigned`.
- `facilitatorRef` comes from whichever id column is set.
- Load `table=facilitator_option` (schema `{ kind, id, name, detail }`) only when `options.canLog` is true, falling back to `[]` on failure.
- Return `facilitators` and `currentUser: options.currentUser ?? null`.

**loaders.tsx**
- Pass `{ canLog: hasPermission(grants, "ACTIVITY_SESSION_LOG", { pillarId }), currentUser: { id: session.user.id, name: <the user's display name> } }`.
- Find the session user's name field in `src/lib/auth/session.ts`. If the loader currently gets only grants, also pass it the session user.

**actions.ts**
- Add `facilitator: z.object({ kind: z.enum(["staff", "provider"]), id })` to the input schema.
- After the curriculum check, load the options with `api.facilitators(pillar)`, a small read added to `api.ts` that returns the option list.
- The facilitator is allowed when it is in the options, or when this is an update and it equals the session's current facilitator, read through the existing `session(pillar, id)`. Otherwise return `actionResult(422, "Choose a facilitator from the list")`.
- The body sets `facilitator_user_id: kind === "staff" ? id : null` and `facilitator_provider_id: kind === "provider" ? id : null`.
- This replaces the old "log sets the signed-in user" behaviour. The form now defaults to the signed-in user instead.

**Components**
- In the register's Facilitator column, show the name plus a small `StatusBadge` tone `neutral`: `Staff` for kind `staff` and `Provider` for kind `provider`, with no tag when kind is null. Sort and search by name.
- The drawer subtitle is `` `${venue ?? "Venue not recorded"} · ${facilitator.name}` ``, and the overview's Facilitator field is the name plus its tag.
- **Session form.** Add a required `Facilitator` select with `<optgroup label="CREAW staff">` and `<optgroup label="External providers">`, built from `workspace.facilitators`.
  - Option values are `staff:<id>` and `provider:<id>`, and labels are `name` for staff and `` `${name} · ${detail}` `` for providers.
  - When `facilitators` is empty and there is a `currentUser`, offer the single option `` `Me (${currentUser.name})` `` with the value `staff:<currentUser.id>`.
  - In edit mode, when the session's `facilitatorRef` is not among the options, prepend it, labelled with `facilitator.name`.
  - The default is `staff:<currentUser.id>` in log mode and the session's ref in edit mode.
  - Submit `facilitator` parsed from the value.

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `yarn test:run src/features/sessions 'src/app/(portal)/pillars/[pillar]/page.test.tsx'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sessions 'src/app/(portal)/pillars/[pillar]'
git commit -m "feat: name session facilitators and pick staff or providers"
```

---

### Task 6: Provider Names on VAWG Cases

**Files:**
- Modify: `src/features/vawg/model.ts`, `src/features/vawg/api.ts` and `src/features/vawg/components/case-drawer.tsx`
- Test: `src/features/vawg/api.test.ts`, `src/features/vawg/components.test.tsx`

**Interfaces:**
- **Consumes:** Task 2's `advocate_name` and `counsellor_name`.
- **Produces:**
  - `LegalCaseView.advocate: string | null`.
  - `LegalCaseView.counselling` items become `{ number: number; date: string; counsellor: string | null }`.

- [ ] **Step 1: Write the failing tests**

- **api.test.ts:** case 1 maps `advocate: "Judy Muthoni"`, and its first counselling entry maps `counsellor: "Faith Kimani"`. A row without `advocate_name` maps `advocate: null`.
- **components.test.tsx:**
  - Add `advocate` and the counselling `counsellor` to the fixture.
  - Assert the drawer overview contains `Advocate` and `Judy Muthoni`.
  - With `advocate: null`, assert it shows `Not assigned`.
  - Assert the Activity tab contains `Counselling session 1 · Faith Kimani`, and `Counselling session 1 logged` when the counsellor is null.

- [ ] **Step 2: Run the tests and verify RED**

Run: `yarn test:run src/features/vawg`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement**

- **API mapping:**
  - Extend `caseSchema` with `advocate_name: optionalText`, and `sessionSchema` with `counsellor_name: optionalText`. `optionalText` already exists in `vawg/api.ts`.
  - Map `advocate: row.advocate_name`.
  - Each counselling entry gets `counsellor: session.counsellor_name`.
- **Drawer:**
  - In the overview fields, add `["Advocate", legalCase.advocate ?? "Not assigned"]` directly after `Counsellor`.
  - The timeline's counselling title becomes `` session.counsellor ? `Counselling session ${session.number} · ${session.counsellor}` : `Counselling session ${session.number} logged` ``.

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `yarn test:run src/features/vawg`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/vawg
git commit -m "feat: show advocate and counsellor names on VAWG cases"
```

---

### Task 7: Full Verification

**Files:**
- Modify only the files needed to fix failures caused by Tasks 1–6.

- [ ] **Step 1: Run the focused suites**

Run: `yarn test:run src/lib/mock-api src/features/providers src/features/sessions src/features/vawg src/features/admin src/components/portal 'src/app/(portal)'`
Expected: zero failed tests.

- [ ] **Step 2: Run the full suite**

Run: `yarn test:run`
Expected: zero failed files and zero failed tests. Only the known post-teardown errors may appear.

- [ ] **Step 3: Run the static checks and the build**

Run: `yarn typecheck`, `yarn lint`, `yarn format:check` and `yarn build`.
Expected: each exits 0. Run Prettier only on files this branch changed (`git diff main...HEAD --name-only`).

- [ ] **Step 4: Check the diff**

Run: `git diff --check` and `git status --short`.
Expected: clean output and no untracked source files.

- [ ] **Step 5: Commit any verification fixes**

```bash
git add <only the files you fixed>
git commit -m "fix: finish provider directory verification"
```

Skip this step if nothing changed.
