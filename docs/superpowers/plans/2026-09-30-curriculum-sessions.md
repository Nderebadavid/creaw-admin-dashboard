# Curriculum and Group Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the SRHR and Skilling pillar pages four things:
- a planned-topic curriculum per activity type
- a coverage view by period
- a session register with a structured Log session form
- a session drawer with editable attendance

**Architecture:**
- A new `activity_topic` lookup table and an `activity_session.activity_topic_id` column are added end to end: types, mock schema, rules and seed.
- A new `src/features/sessions/` feature follows the VAWG workspace pattern:
  - `model.ts` holds the view types.
  - `coverage.ts` holds the pure coverage and summary logic.
  - `api.ts` is the typed client.
  - `actions.ts` holds the Server Actions.
  - `components/` holds the client UI.
- The dynamic pillar route stays a Server Component. For `srhr` and `skilling` it loads the workspace in the same `Promise.all` and injects it through `PillarContent` slots.

**Tech Stack:** Next.js 16.3 App Router, React 19.2, TypeScript 5, Tailwind CSS 4, Zod 4, Vitest 3, Testing Library, the existing mock API transport.

**Spec:** `docs/superpowers/specs/2026-09-30-curriculum-sessions-design.md`

## Global Constraints

- This is NOT the Next.js you know. Read `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` (searchParams) before editing `page.tsx`.
- `src/app/(portal)/pillars/[pillar]/page.tsx` stays a Server Component. Stateful UI lives in `"use client"` components.
- Every Server Action re-checks the session with `requireSession()`, validates with Zod, and checks the pillar-scoped permission with `hasPermission(session.grants, CODE, { pillarId })` before calling the API. On success it calls `revalidatePath("/pillars/<code>")`.
- Permissions:
  - `ACTIVITY_SESSION_VIEW` to read
  - `ACTIVITY_SESSION_LOG` to log, edit and change attendance
  - `DOCUMENT_UPLOAD` to attach
  - `DOCUMENT_DOWNLOAD` to view files
  - `REPORT_EXPORT_CSV` to export
  - the existing `LOOKUP_MANAGE` for topics
- Attendee names always show as the API returns them (masked) and are never revealed in lists.
- No raw database IDs appear in any form a user fills in.
- Other pillars' pages and all other drawers keep their current rendering and behavior.
- Add no new runtime dependency.
- Pillar ids are fixed: `srhr` = 3, `skilling` = 6.
- The facilitator label is exactly one of `CREAW staff`, `External provider` or `Not assigned`.
- Period values are exactly `quarter` (default), `year` and `all`. An invalid value falls back to `quarter`.
- Commands:
  - `yarn test:run <files>`
  - `yarn typecheck`
  - `yarn lint`
  - `yarn build`
- A known, unrelated set of post-teardown "window is not defined" errors from `src/features/admin/config-components.test.tsx` makes `yarn test:run` exit 1 even when every test passes. Report the test counts instead of the exit code.

## Review Focus

1. **Re-adding someone who was removed from attendance.**
   - The unique key `(session_id, participant_id)` covers soft-deleted rows, so a plain insert fails.
   - Expected: the person is restored, and there is no error.
   - Pinned in Task 4.
2. **A session whose planned topic or activity type has since been retired.**
   - Expected: the register and drawer still show the name.
   - Expected: the edit dialog keeps the current type and topic selectable, so saving does not silently change them.
   - Pinned in Tasks 3 and 6.
3. **The topic lookup fails or returns nothing.**
   - Expected: the workspace still loads, the coverage panel says "No planned topics yet", and the register works.
   - Pinned in Task 3.
4. **A session dated on the first day of the quarter**, and an invalid `?period=` value.
   - Expected: the session counts in "This quarter", and an invalid period behaves as `quarter`.
   - Pinned in Tasks 3 and 7.
5. **A tampered action input**: a topic from another activity type, or a type from the other pillar.
   - Expected: a 422 with a clear message, and nothing is written.
   - Pinned in Tasks 1 (the mock rule) and 4 (the action).

---

### Task 1: Activity Topic Data Contract in the Mock API

**Files:**
- Modify: `src/types/db.ts`: add the `ActivityTopic` interface; add `activity_topic_id: number | null` to `ActivitySession` after `activity_type_id`; add `activity_topic: ActivityTopic;` to the table map directly after `activity_type_definition: ActivityTypeDefinition;`.
- Modify: `src/lib/mock-api/schema.ts`: add an `activity_topic` definition directly after `activity_type_definition`, and add an `activity_topic_id` column to `activity_session` after `activity_type_id`.
- Modify: `src/lib/mock-api/unique-keys.ts`: `activity_topic: [["activity_type_id", "name"]]`.
- Modify: `src/lib/mock-api/core.ts`: append `"activity_topic"` to `lookups`.
- Modify: `src/lib/mock-api/resources/lookup-writes.ts`: writable columns, a fixed parent, and name uniqueness per parent.
- Modify: `src/lib/mock-api/resources/read.ts`: allow `includeDeleted=true` on `activity_attendance` for holders of `ACTIVITY_SESSION_LOG`.
- Modify: `src/lib/mock-api/validation.ts`: the topic, type and pillar consistency rule for `activity_session`.
- Modify: `src/lib/mock-api/seed.ts`: seed the planned topics and more sessions.
- Test: `src/lib/mock-api/activity-topic.test.ts` (new)

**Interfaces:**
- Produces: the table `activity_topic` with columns `activity_type_id`, `name`, `description`, `sequence_no`, plus the standard columns.
- Produces: `activity_session.activity_topic_id` (nullable).
- Produces: `GET /lookups/activity_topic`.
- Produces: `GET /pillars/:pillar?table=activity_attendance&includeDeleted=true` for `ACTIVITY_SESSION_LOG` holders.
- Produces seed data that later tasks' tests rely on:
  - SRHR (pillar 3) has at least 3 sessions: at least two linked to planned topics, including one on `2026-07-01`, and one that keeps only its free-text topic "Facility referral day".
  - Skilling (pillar 6) has 1 session of type "Life Skills Session" linked to the topic "Workplace conduct".
  - Health Talk has the planned topics `Menstrual health` (1), `Contraception` (2), `HIV & STIs` (3) and `Consent & GBV` (4).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/mock-api/activity-topic.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";

beforeEach(() => resetMockStore());
const client = createApiClient(new MockApiTransport(handleMockRequest));
const raw = (userId: number, request: Record<string, unknown>) =>
  client.request(
    { token: issueMockToken(userId), ...request } as never,
    { parse: (value: unknown) => value } as never
  ) as Promise<{ success: boolean; resultCode: number; data: any; message: string }>;
const typeId = (name: string) =>
  getMockStore().activity_type_definition.find((row) => row.name === name)!.id;

describe("activity_topic lookup", () => {
  it("serves the seeded planned topics in sequence", async () => {
    const result = await raw(1, {
      method: "GET",
      path: "/lookups/activity_topic",
      routeTemplate: "/lookups/:table",
      query: { page: 1, pageSize: 100 },
    });
    const healthTalk = result.data.items
      .filter((row: any) => row.activity_type_id === typeId("Health Talk"))
      .sort((a: any, b: any) => a.sequence_no - b.sequence_no)
      .map((row: any) => row.name);
    expect(healthTalk).toEqual(["Menstrual health", "Contraception", "HIV & STIs", "Consent & GBV"]);
  });

  it("rejects a duplicate topic name within one activity type", async () => {
    const result = await raw(1, {
      method: "POST",
      path: "/lookups/activity_topic",
      routeTemplate: "/lookups/:table",
      body: { activity_type_id: typeId("Health Talk"), name: "contraception", sequence_no: 9 },
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Lookup name already exists");
  });

  it("refuses to move a topic to another activity type", async () => {
    const topic = getMockStore().activity_topic[0];
    const result = await raw(1, {
      method: "PATCH",
      path: "/lookups/activity_topic",
      routeTemplate: "/lookups/:table",
      query: { id: topic.id },
      body: { activity_type_id: typeId("YSLA") === topic.activity_type_id ? typeId("Mentorship") : typeId("YSLA") },
    });
    expect(result.message).toBe("Parent cannot be changed");
  });
});

describe("activity_session topic rules", () => {
  const topicOf = (type: string) =>
    getMockStore().activity_topic.find((row) => row.activity_type_id === typeId(type))!.id;
  // A complete body, so a rejection can only come from the rule under test.
  const post = (overrides: Record<string, unknown>) =>
    raw(1, {
      method: "POST",
      path: "/pillars/srhr",
      routeTemplate: "/pillars/:pillar",
      query: { table: "activity_session" },
      body: {
        pillar_id: 3,
        enrollment_id: null,
        activity_type_id: typeId("Health Talk"),
        activity_topic_id: topicOf("Health Talk"),
        session_date: "2026-09-01",
        venue: null,
        topic: null,
        facilitator_user_id: 1,
        facilitator_provider_id: null,
        notes: null,
        ...overrides,
      },
    });

  it("accepts a session whose topic belongs to its activity type", async () => {
    const result = await post({});
    expect(result.resultCode).toBe(201);
  });

  it("rejects a session whose topic belongs to another activity type", async () => {
    const result = await post({ activity_type_id: typeId("YSLA") });
    expect(result.success).toBe(false);
    expect(result.resultCode).toBe(422);
  });

  it("rejects a session whose activity type belongs to another pillar", async () => {
    const result = await post({ activity_type_id: typeId("Life Skills Session"), activity_topic_id: null });
    expect(result.resultCode).toBe(422);
  });

  it("keeps Skilling sessions off the SRHR route", async () => {
    const result = await raw(1, {
      method: "GET",
      path: "/pillars/srhr",
      routeTemplate: "/pillars/:pillar",
      query: { table: "activity_session", page: 1, pageSize: 100 },
    });
    expect(result.data.items.length).toBeGreaterThanOrEqual(3);
    expect(result.data.items.every((row: any) => row.pillar_id === 3)).toBe(true);
  });

  it("lets a session logger read soft-deleted attendance to restore it", async () => {
    const row = getMockStore().activity_attendance[0];
    Object.assign(row, { is_deleted: true, status: "INACTIVE" });
    const result = await raw(1, {
      method: "GET",
      path: "/pillars/srhr",
      routeTemplate: "/pillars/:pillar",
      query: { table: "activity_attendance", includeDeleted: "true", page: 1, pageSize: 100 },
    });
    expect(result.success).toBe(true);
    expect(result.data.items.some((item: any) => item.id === row.id)).toBe(true);
  });
});
```

If `client.request` does not accept a pass-through schema object, look at how `src/lib/mock-api/handlers.test.ts` calls `handleMockRequest` directly and use that form instead. Keep the same assertions.

- [ ] **Step 2: Run the tests and verify RED**

Run: `yarn test:run src/lib/mock-api/activity-topic.test.ts`
Expected: FAIL, because `activity_topic` is not a table or lookup yet.

- [ ] **Step 3: Add the types and the mock schema**

In `src/types/db.ts`:

```ts
export interface ActivityTopic extends StandardColumns {
  activity_type_id: number;
  name: string;
  description: string | null;
  sequence_no: number;
}
```

Also:
- Add `activity_topic_id: number | null;` to `ActivitySession` after `activity_type_id`.
- Add `activity_topic: ActivityTopic;` to the table map after `activity_type_definition`.

In `src/lib/mock-api/schema.ts`, copy the six standard column definitions from `activity_type_definition`, then add:

```ts
  activity_topic: {
    // ...the same id/created_at/updated_at/status/status_description/is_deleted entries as activity_type_definition
    activity_type_id: {
      kind: "number",
      nullable: false,
      integer: true,
      unsigned: true,
      references: "activity_type_definition",
    },
    name: { kind: "string", nullable: false, maxLength: 160 },
    description: { kind: "string", nullable: true },
    sequence_no: { kind: "number", nullable: false, integer: true, unsigned: true },
  },
```

In `activity_session`, after `activity_type_id`:

```ts
    activity_topic_id: {
      kind: "number",
      nullable: true,
      integer: true,
      unsigned: true,
      references: "activity_topic",
    },
```

If the schema object gives every column a default of `null`, or if the seed `add()` helper requires every nullable key, make `activity_topic_id` default to `null` the same way `enrollment_id` does.

- [ ] **Step 4: Add the lookup, read and validation rules**

- In `src/lib/mock-api/unique-keys.ts`, add `activity_topic: [["activity_type_id", "name"]],`.
- In `src/lib/mock-api/core.ts`, append `"activity_topic"` to the `lookups` array.
- In `src/lib/mock-api/resources/lookup-writes.ts`:
  - Add `activity_topic: ["activity_type_id", "name", "description", "sequence_no"],` to `writable`.
  - In **both** parent-key ternaries (the `relation` one for "Parent cannot be changed" and the `parentKey` one for name uniqueness), add the branch `table === "activity_topic" ? "activity_type_id"` before the final fallback.
- In `src/lib/mock-api/resources/read.ts`, extend `mayIncludeDeleted`:

```ts
  const mayIncludeDeleted =
    table === "user_role" ||
    table === "role_permission" ||
    (table === "activity_attendance" &&
      hasPermission(grants, "ACTIVITY_SESSION_LOG", pillar ? { pillarId: pillar.id } : undefined)) ||
    (family === "lookups" && hasPermission(grants, "LOOKUP_MANAGE"));
```

(`pillar` is already destructured from `ctx` in that function. If it isn't, destructure it.)

- In `src/lib/mock-api/validation.ts`, next to the existing `activity_session` facilitator rule:

```ts
  if (table === "activity_session") {
    const type = rowsFor(store, "activity_type_definition").find(
      (candidate) => candidate.id === row.activity_type_id
    );
    if (!type || type.pillar_id !== row.pillar_id) return false;
    if (row.activity_topic_id !== null && row.activity_topic_id !== undefined) {
      const topic = rowsFor(store, "activity_topic").find(
        (candidate) => candidate.id === row.activity_topic_id
      );
      if (!topic || topic.activity_type_id !== row.activity_type_id) return false;
    }
  }
```

- [ ] **Step 5: Seed topics and sessions**

In `src/lib/mock-api/seed.ts`, directly after the `story.lookups["Activity types"]` loop:

```ts
  const typeIdOf = (name: string) =>
    store.activity_type_definition.find((row) => row.name === name)!.id;
  const plannedTopics: [string, string[]][] = [
    ["YSLA", ["Savings cycle", "Loan rules & repayment", "Group governance", "Share-out"]],
    ["Mentorship", ["Goal setting", "Self-esteem", "Healthy relationships"]],
    ["Male Engagement", ["Positive masculinity", "GBV prevention", "Consent"]],
    ["Health Talk", ["Menstrual health", "Contraception", "HIV & STIs", "Consent & GBV"]],
    ["Life Skills Session", ["Workplace conduct", "Budgeting", "Communication"]],
  ];
  for (const [type, names] of plannedTopics)
    names.forEach((name, index) =>
      add("activity_topic", {
        activity_type_id: typeIdOf(type),
        name,
        description: null,
        sequence_no: index + 1,
      })
    );
  const topicIdOf = (type: string, name: string) =>
    store.activity_topic.find(
      (row) => row.activity_type_id === typeIdOf(type) && row.name === name
    )!.id;
```

- Keep the existing `activity_session` add ("Facility referral day"), and give it `activity_topic_id: null`.
- Keep the existing attendance row.
- After them, add:

```ts
  add("activity_session", {
    pillar_id: 3,
    activity_type_id: typeIdOf("Health Talk"),
    activity_topic_id: topicIdOf("Health Talk", "Menstrual health"),
    session_date: "2026-07-01",
    venue: "Kibera Ward Office",
    topic: null,
    facilitator_user_id: 9,
    notes: "Quarter-opening health talk.",
  });
  add("activity_session", {
    pillar_id: 3,
    activity_type_id: typeIdOf("YSLA"),
    activity_topic_id: topicIdOf("YSLA", "Savings cycle"),
    session_date: "2026-08-20",
    venue: "Kibera Ward Office",
    topic: null,
    facilitator_user_id: 9,
    notes: "Community-wide YSLA meeting.",
  });
  add("activity_session", {
    pillar_id: 6,
    activity_type_id: typeIdOf("Life Skills Session"),
    activity_topic_id: topicIdOf("Life Skills Session", "Workplace conduct"),
    session_date: "2026-08-01",
    venue: "Rift Valley Technical",
    topic: null,
    facilitator_user_id: 9,
    notes: "Life-skills session for TVET trainees.",
  });
  add("activity_attendance", { session_id: store.activity_session.at(-3)!.id, participant_id: 5 });
```

If the seed places `add("activity_session", …)` before `activity_type_definition` rows exist, move these adds after the activity-type loop. If an attendance participant id does not exist at that point, use one that does. Check `grep -n 'add("participant"' src/lib/mock-api/seed.ts`.

- [ ] **Step 6: Run the tests and verify GREEN**

Run: `yarn test:run src/lib/mock-api/activity-topic.test.ts src/lib/mock-api/handlers.test.ts`
Expected: all pass. If an existing `handlers.test.ts` assertion counted activity sessions or lookup tables, update only that count and note it in your report.

- [ ] **Step 7: Commit**

```bash
git add src/types/db.ts src/lib/mock-api/schema.ts src/lib/mock-api/unique-keys.ts src/lib/mock-api/core.ts src/lib/mock-api/resources/lookup-writes.ts src/lib/mock-api/resources/read.ts src/lib/mock-api/validation.ts src/lib/mock-api/seed.ts src/lib/mock-api/activity-topic.test.ts src/lib/mock-api/handlers.test.ts
git commit -m "feat: add planned activity topics to the data contract"
```

---

### Task 2: Activity Topics in Admin Lookups

**Files:**
- Modify: `src/features/admin/schemas.ts`: add `"activity_topic"` to `lookupTableSchema`; add `activity_type_id: id.optional()` and `sequence_no: z.number().int().optional()` to `lookupSchema`.
- Modify: `src/features/admin/lookup-actions.ts`: add an `activity_topic` shape.
- Modify: `src/features/admin/lookups/config.ts`: add the source `"activity_type"`, the `activity_topic` config, a tab, and `labelFor` support.
- Modify: `src/features/admin/lookup-components.tsx`, `src/features/admin/lookups/lookup-table.tsx`, `src/features/admin/lookups/lookup-dialogs.tsx`: thread an `activityTypes: Option[]` prop exactly as `pillars` is threaded, and resolve `field.source === "activity_type"` to it.
- Modify: `src/app/(portal)/admin/lookups/[table]/page.tsx`: load activity types when `table === "activity_topic"`.
- Test: `src/features/admin/lookup-topics.test.tsx` (new)

**Interfaces:**
- Consumes: `/lookups/activity_topic` from Task 1.
- Produces: the Admin screen `/admin/lookups/activity_topic`.
- Produces: `labelFor(row, key, counties, subCounties, pillars, activityTypes)`. The new last parameter defaults to `[]`, so existing callers and tests keep working.

- [ ] **Step 1: Write the failing tests**

Create `src/features/admin/lookup-topics.test.tsx`. Follow the imports and mocks at the top of `src/features/admin/components.test.tsx` (the `next/navigation` mock and the action mocks):

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./lookup-actions", () => ({
  createLookupAction: vi.fn(),
  updateLookupAction: vi.fn(),
  setLookupActiveAction: vi.fn(),
  exportLookupAction: vi.fn(),
}));
import { LookupContent } from "./lookup-components";
import { labelFor, lookupConfig, lookupTabs } from "./lookups/config";

const topic = {
  id: 7,
  name: "Contraception",
  activity_type_id: 4,
  sequence_no: 2,
  description: null,
  status: "ACTIVE",
  is_deleted: false,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  status_description: null,
} as never;

describe("activity topic lookup", () => {
  it("is listed as its own lookup tab with type, order, name and description", () => {
    expect(lookupTabs.map((tab) => tab.table)).toContain("activity_topic");
    expect(lookupConfig.activity_topic.columns.map((column) => column.label)).toEqual([
      "Activity type",
      "Order",
      "Name",
      "Description",
    ]);
  });

  it("resolves the activity type id to its name", () => {
    expect(labelFor(topic, "activity_type_id", [], [], [], [{ id: 4, name: "Health Talk" }])).toBe(
      "Health Talk"
    );
  });

  it("renders topics with their activity type name", () => {
    render(
      <LookupContent
        table="activity_topic"
        rows={[topic]}
        parent={null}
        counties={[]}
        subCounties={[]}
        pillars={[]}
        activityTypes={[{ id: 4, name: "Health Talk" }]}
        canViewAudit={false}
        canExport={false}
      />
    );
    const row = screen.getByRole("row", { name: /Contraception/ });
    expect(within(row).getByText("Health Talk")).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();
  });
});
```

If `LookupContent`'s real action import path or export names differ, mock the real ones. Read the imports at the top of `lookup-components.tsx`.

- [ ] **Step 2: Run the tests and verify RED**

Run: `yarn test:run src/features/admin/lookup-topics.test.tsx`
Expected: FAIL, because `activity_topic` is not a lookup table.

- [ ] **Step 3: Implement**

In `lookup-actions.ts`, add to `shapes`:

```ts
  activity_topic: z.strictObject({
    activity_type_id: id,
    name,
    sequence_no: z.number().int().min(1).max(999),
    description: z.string().trim().max(1000).nullable().optional(),
  }),
```

In `config.ts`:
- Change `source?: "county" | "pillar"` to `source?: "county" | "pillar" | "activity_type"`.
- Add `kind?: "text" | "textarea" | "select" | "checkbox" | "number"` if there is no number kind. Where text inputs are rendered in `lookup-dialogs.tsx`, render `<input type="number" min={1}>` for `kind === "number"`. In `readLookupValues`, convert a number kind with `Number(raw)`.
- Add the config:

```ts
  activity_topic: {
    label: "Activity topics",
    singular: "activity topic",
    subtitle: "activity_topic · planned curriculum",
    columns: [
      { key: "activity_type_id", label: "Activity type" },
      { key: "sequence_no", label: "Order" },
      { key: "name", label: "Name" },
      { key: "description", label: "Description" },
    ],
    fields: [
      { key: "activity_type_id", label: "Activity type", kind: "select", source: "activity_type", required: true },
      { key: "sequence_no", label: "Order", kind: "number", required: true },
      { key: "name", label: "Name", required: true },
      { key: "description", label: "Description", kind: "textarea" },
    ],
  },
```

- Add `{ label: "Activity topics", table: "activity_topic" }` to `lookupTabs` after Activity types.
- In `labelFor`, add a trailing parameter `activityTypes: Option[] = []` and the line `if (key === "activity_type_id") return activityTypes.find((item) => item.id === value)?.name ?? "—";`.
- Thread `activityTypes` through `LookupContent`, `lookup-table.tsx` and `lookup-dialogs.tsx` beside `pillars`, defaulting to `[]`. The dialog's select options become `field.source === "county" ? counties : field.source === "pillar" ? pillars : field.source === "activity_type" ? activityTypes : []`.

In `page.tsx` (admin lookups):

```ts
  const needsActivityTypes = table === "activity_topic";
  const [rows, countyRows, subCountyRows, pillarRows, activityTypeRows] = await Promise.all([
    allRows(api, table),
    needsCounties ? allRows(api, "county") : [],
    needsSubCounties ? allRows(api, "sub_county") : [],
    needsPillars ? allRows(api, "pillar") : [],
    needsActivityTypes ? allRows(api, "activity_type_definition") : [],
  ]);
  const activityTypes = activityTypeRows
    .filter((row) => !row.is_deleted)
    .map((row) => ({ id: row.id, name: row.name }));
```

Pass `activityTypes={activityTypes}` to `LookupContent`.

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `yarn test:run src/features/admin`
Expected: all admin tests pass. The known post-teardown errors don't count.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin 'src/app/(portal)/admin/lookups/[table]/page.tsx'
git commit -m "feat: manage planned activity topics in admin lookups"
```

---

### Task 3: Sessions Model, Coverage Logic and API Client

**Files:**
- Create: `src/features/sessions/model.ts`
- Create: `src/features/sessions/coverage.ts`
- Create: `src/features/sessions/api.ts`
- Test: `src/features/sessions/coverage.test.ts`
- Test: `src/features/sessions/api.test.ts`

**Interfaces:**
- Consumes: Task 1's tables and routes.
- Produces (`model.ts`):

```ts
/** View models shared by the sessions server code and its client components. */
export const SESSION_PILLAR_IDS = { srhr: 3, skilling: 6 } as const;
export type SessionPillar = keyof typeof SESSION_PILLAR_IDS;
export const isSessionPillar = (code: string): code is SessionPillar => code in SESSION_PILLAR_IDS;
export const sessionPeriods = ["quarter", "year", "all"] as const;
export type SessionPeriod = (typeof sessionPeriods)[number];
export const periodLabels: Record<SessionPeriod, string> = {
  quarter: "This quarter",
  year: "This year",
  all: "All time",
};
export const parsePeriod = (value: unknown): SessionPeriod =>
  sessionPeriods.includes(value as SessionPeriod) ? (value as SessionPeriod) : "quarter";

export type FacilitatorLabel = "CREAW staff" | "External provider" | "Not assigned";
export interface ActivityTypeOption { id: number; name: string; active: boolean }
export interface ActivityTopicOption {
  id: number;
  activityTypeId: number;
  name: string;
  sequenceNo: number;
  active: boolean;
}
export interface AttendeeView {
  attendanceId: number;
  participantId: number;
  /** As the API sends it: masked. */
  name: string;
  ward: string | null;
  added: string;
}
export interface SessionDocument { id: number; name: string; added: string }
export interface SessionView {
  id: number;
  activityTypeId: number;
  activityType: string;
  topicId: number | null;
  /** The planned topic's name, else the free-text topic, else "Session #<id>". */
  topic: string;
  /** The free-text topic as stored; null when blank. */
  freeTopic: string | null;
  date: string;
  venue: string | null;
  notes: string | null;
  facilitator: FacilitatorLabel;
  communityWide: boolean;
  attendees: AttendeeView[];
  documents: SessionDocument[];
  logged: string;
  updated: string;
}
export interface TopicCoverage {
  topicId: number;
  name: string;
  sequenceNo: number;
  sessions: number;
  lastDelivered: string | null;
}
export interface TypeCoverage {
  activityTypeId: number;
  name: string;
  topics: TopicCoverage[];
  otherTopics: { name: string; sessions: number; lastDelivered: string }[];
}
export interface SessionSummary {
  sessionsHeld: number;
  peopleReached: number;
  topicsCovered: number;
  topicsPlanned: number;
  activeTypes: number;
}
export interface SessionWorkspace {
  pillar: SessionPillar;
  period: SessionPeriod;
  /** Every session of the pillar, newest first (the register is not period-filtered). */
  sessions: SessionView[];
  coverage: TypeCoverage[];
  summary: SessionSummary;
  activityTypes: ActivityTypeOption[];
  topics: ActivityTopicOption[];
  /** People an attendee can be picked from, labelled "<masked name> · #<id>". */
  participants: { id: number; label: string }[];
}
```

- Produces (`coverage.ts`): `periodStart(period: SessionPeriod, today: Date): string | null`, which returns a `YYYY-MM-DD` string. It returns the first day of the quarter or year in local time, and `null` for `all`. Also `buildCoverage(input): { coverage: TypeCoverage[]; summary: SessionSummary }`.
- Produces (`api.ts`):
  - `createSessionsApi(client, token)`, with:
    - `workspace(pillar: SessionPillar, period: SessionPeriod, today?: Date): Promise<SessionWorkspace>`
    - `logSession(pillar, values)`
    - `updateSession(pillar, sessionId, values)`
    - `attendance(pillar, sessionId): Promise<{ id: number; participant_id: number; is_deleted: boolean }[]>`, which reads with `includeDeleted=true`
    - `addAttendance(pillar, sessionId, participantId)`
    - `setAttendanceDeleted(pillar, attendanceId, deleted: boolean)`
    - `curriculum(pillar): Promise<{ types: ActivityTypeOption[]; topics: ActivityTopicOption[] }>`
    - `attach(pillar, sessionId, documentType, fileUrl)`
    - `viewDocument(pillar, documentId)`
  - `sessionsApi.workspace(pillar, period)`, the session-bound singleton.
  - `sessionMutationSchema` and `sessionFileSchema`.

- [ ] **Step 1: Write the failing coverage tests**

Create `src/features/sessions/coverage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCoverage, periodStart } from "./coverage";

const today = new Date(2026, 8, 30); // 30 Sep 2026, local time
const types = [
  { id: 4, name: "Health Talk", active: true },
  { id: 1, name: "YSLA", active: true },
];
const topics = [
  { id: 10, activityTypeId: 4, name: "Menstrual health", sequenceNo: 1, active: true },
  { id: 11, activityTypeId: 4, name: "Contraception", sequenceNo: 2, active: true },
  { id: 12, activityTypeId: 4, name: "Retired topic", sequenceNo: 3, active: false },
  { id: 20, activityTypeId: 1, name: "Savings cycle", sequenceNo: 1, active: true },
];
const session = (id: number, typeId: number, topicId: number | null, date: string, free: string | null = null) => ({
  id, activityTypeId: typeId, topicId, freeTopic: free, date,
});

describe("periodStart", () => {
  it("starts the quarter, the year, or nothing", () => {
    expect(periodStart("quarter", today)).toBe("2026-07-01");
    expect(periodStart("year", today)).toBe("2026-01-01");
    expect(periodStart("all", today)).toBeNull();
  });
});

describe("buildCoverage", () => {
  const sessions = [
    session(1, 4, 10, "2026-07-01"),
    session(2, 4, 10, "2026-09-10"),
    session(3, 4, null, "2026-09-24", "Facility referral day"),
    session(4, 1, 20, "2026-03-02"),
  ];
  const attendance = [
    { sessionId: 1, participantId: 5 },
    { sessionId: 2, participantId: 5 },
    { sessionId: 2, participantId: 6 },
    { sessionId: 4, participantId: 7 },
  ];

  it("marks topics covered in the quarter, counting the quarter's first day", () => {
    const { coverage, summary } = buildCoverage({ types, topics, sessions, attendance, period: "quarter", today });
    const health = coverage.find((row) => row.activityTypeId === 4)!;
    expect(health.topics.map((row) => [row.name, row.sessions, row.lastDelivered])).toEqual([
      ["Menstrual health", 2, "2026-09-10"],
      ["Contraception", 0, null],
    ]);
    expect(health.otherTopics).toEqual([
      { name: "Facility referral day", sessions: 1, lastDelivered: "2026-09-24" },
    ]);
    expect(summary).toEqual({
      sessionsHeld: 3,
      peopleReached: 2,
      topicsCovered: 1,
      topicsPlanned: 3,
      activeTypes: 2,
    });
  });

  it("widens to the year and to all time", () => {
    expect(buildCoverage({ types, topics, sessions, attendance, period: "year", today }).summary.topicsCovered).toBe(2);
    expect(buildCoverage({ types, topics, sessions, attendance, period: "all", today }).summary.sessionsHeld).toBe(4);
  });

  it("still returns a block per type when no topics are planned", () => {
    const { coverage } = buildCoverage({ types, topics: [], sessions, attendance, period: "all", today });
    expect(coverage.map((row) => row.topics.length)).toEqual([0, 0]);
  });
});
```

- [ ] **Step 2: Run the coverage tests and verify RED**

Run: `yarn test:run src/features/sessions/coverage.test.ts`
Expected: FAIL, because the modules don't exist yet.

- [ ] **Step 3: Implement `model.ts` and `coverage.ts`**

Write `model.ts` exactly as shown in Interfaces. Then write `coverage.ts`:

```ts
/** Pure curriculum coverage and headline counts for one pillar's sessions. */
import type {
  ActivityTopicOption,
  ActivityTypeOption,
  SessionPeriod,
  SessionSummary,
  TypeCoverage,
} from "./model";

const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** The first day of the period in local time, or null for all time. */
export function periodStart(period: SessionPeriod, today: Date): string | null {
  if (period === "all") return null;
  const month = period === "year" ? 0 : Math.floor(today.getMonth() / 3) * 3;
  return isoDay(new Date(today.getFullYear(), month, 1));
}

export interface CoverageInput {
  types: ActivityTypeOption[];
  topics: ActivityTopicOption[];
  sessions: { id: number; activityTypeId: number; topicId: number | null; freeTopic: string | null; date: string }[];
  attendance: { sessionId: number; participantId: number }[];
  period: SessionPeriod;
  today: Date;
}

export function buildCoverage(input: CoverageInput): { coverage: TypeCoverage[]; summary: SessionSummary } {
  const start = periodStart(input.period, input.today);
  const inPeriod = input.sessions.filter((row) => start === null || row.date >= start);
  const ids = new Set(inPeriod.map((row) => row.id));
  const activeTypes = input.types.filter((type) => type.active);
  const coverage: TypeCoverage[] = activeTypes.map((type) => {
    const ofType = inPeriod.filter((row) => row.activityTypeId === type.id);
    const topics = input.topics
      .filter((topic) => topic.activityTypeId === type.id && topic.active)
      .sort((a, b) => a.sequenceNo - b.sequenceNo)
      .map((topic) => {
        const delivered = ofType.filter((row) => row.topicId === topic.id).map((row) => row.date).sort();
        return {
          topicId: topic.id,
          name: topic.name,
          sequenceNo: topic.sequenceNo,
          sessions: delivered.length,
          lastDelivered: delivered.at(-1) ?? null,
        };
      });
    const others = new Map<string, { name: string; sessions: number; lastDelivered: string }>();
    for (const row of ofType.filter((item) => item.topicId === null && item.freeTopic)) {
      const entry = others.get(row.freeTopic!) ?? { name: row.freeTopic!, sessions: 0, lastDelivered: row.date };
      entry.sessions += 1;
      if (row.date > entry.lastDelivered) entry.lastDelivered = row.date;
      others.set(row.freeTopic!, entry);
    }
    return { activityTypeId: type.id, name: type.name, topics, otherTopics: [...others.values()] };
  });
  const planned = coverage.flatMap((block) => block.topics);
  return {
    coverage,
    summary: {
      sessionsHeld: inPeriod.length,
      peopleReached: new Set(
        input.attendance.filter((row) => ids.has(row.sessionId)).map((row) => row.participantId)
      ).size,
      topicsCovered: planned.filter((topic) => topic.sessions > 0).length,
      topicsPlanned: planned.length,
      activeTypes: activeTypes.length,
    },
  };
}
```

- [ ] **Step 4: Run the coverage tests and verify GREEN**

Run: `yarn test:run src/features/sessions/coverage.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing API tests**

Create `src/features/sessions/api.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createSessionsApi } from "./api";

beforeEach(() => resetMockStore());
const apiFor = (userId: number) =>
  createSessionsApi(createApiClient(new MockApiTransport(handleMockRequest)), issueMockToken(userId));
const today = new Date(2026, 8, 30);

describe("sessions workspace", () => {
  it("maps SRHR sessions with type, planned or free topic and facilitator label", async () => {
    const workspace = await apiFor(1).workspace("srhr", "quarter", today);
    expect(workspace.sessions.length).toBeGreaterThanOrEqual(3);
    expect(workspace.sessions.every((row) => ["Health Talk", "YSLA", "Mentorship", "Male Engagement"].includes(row.activityType))).toBe(true);
    const free = workspace.sessions.find((row) => row.topic === "Facility referral day")!;
    expect(free).toMatchObject({ topicId: null, freeTopic: "Facility referral day", facilitator: "CREAW staff" });
    const planned = workspace.sessions.find((row) => row.topic === "Menstrual health")!;
    expect(planned.date).toBe("2026-07-01");
    expect(workspace.sessions.map((row) => row.date)).toEqual(
      [...workspace.sessions.map((row) => row.date)].sort().reverse()
    );
  });

  it("keeps Skilling sessions on the Skilling page only", async () => {
    const skilling = await apiFor(1).workspace("skilling", "all", today);
    expect(skilling.sessions.map((row) => row.topic)).toEqual(["Workplace conduct"]);
    expect(skilling.activityTypes.map((row) => row.name)).toEqual(["Life Skills Session"]);
  });

  it("counts coverage for the period and lists attendees with masked names", async () => {
    const workspace = await apiFor(1).workspace("srhr", "quarter", today);
    const health = workspace.coverage.find((row) => row.name === "Health Talk")!;
    expect(health.topics.find((row) => row.name === "Menstrual health")?.sessions).toBe(1);
    expect(workspace.summary.topicsPlanned).toBe(14);
    const withPeople = workspace.sessions.find((row) => row.attendees.length > 0)!;
    expect(withPeople.attendees[0].name).toMatch(/•/);
  });

  it("still shows a session's retired topic and type names", async () => {
    const store = getMockStore();
    const topic = store.activity_topic.find((row) => row.name === "Menstrual health")!;
    Object.assign(topic, { is_deleted: true, status: "INACTIVE" });
    const workspace = await apiFor(1).workspace("srhr", "all", today);
    expect(workspace.sessions.some((row) => row.topic === "Menstrual health")).toBe(true);
    expect(workspace.topics.find((row) => row.id === topic.id)?.active ?? false).toBe(false);
  });

  it("loads with no planned topics when the topic lookup fails", async () => {
    const api = apiFor(1);
    const store = getMockStore();
    store.activity_topic.splice(0);
    const workspace = await api.workspace("srhr", "quarter", today);
    expect(workspace.summary.topicsPlanned).toBe(0);
    expect(workspace.sessions.length).toBeGreaterThanOrEqual(3);
  });
});
```

(The planned count is 14 because SRHR has 4 + 3 + 3 + 4 active topics.)

For the retired-topic test: if a lookup read hides deleted rows from a user with `LOOKUP_MANAGE`, read topics with `includeDeleted=true` when possible and mark `active` false for them. Otherwise fall back to `Topic #<id>`. Either way, the session must show its name when the row is readable. User 1 holds `LOOKUP_MANAGE`, so it is readable in this test.

- [ ] **Step 6: Run the API tests and verify RED**

Run: `yarn test:run src/features/sessions/api.test.ts`
Expected: FAIL, because `./api` does not exist.

- [ ] **Step 7: Implement `api.ts`**

Follow `src/features/vawg/api.ts` for the `all` and `table` helpers, `collectPages`, envelopes and `withSessionApi`. The required behavior:

```ts
/**
 * Typed client for one pillar's group sessions: activity types, planned topics,
 * sessions with their attendance and files, and the curriculum coverage.
 * Reads go through /pillars/<code>; the API scopes them to that pillar and masks names.
 */
const id = z.number().int().positive();
const optionalId = id.nullish().transform((value) => value ?? null);
const sessionSchema = z.object({
  id,
  pillar_id: id,
  enrollment_id: id.nullable(),
  activity_type_id: id,
  activity_topic_id: optionalId,
  session_date: z.string(),
  venue: z.string().nullable(),
  topic: z.string().nullable(),
  facilitator_user_id: id.nullable(),
  facilitator_provider_id: id.nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
const attendanceSchema = z.object({ id, session_id: id, participant_id: id, created_at: z.string(), is_deleted: z.boolean() });
const typeSchema = z.object({ id, pillar_id: id, name: z.string(), status: z.string(), is_deleted: z.boolean() });
const topicSchema = z.object({ id, activity_type_id: id, name: z.string(), sequence_no: z.number(), status: z.string(), is_deleted: z.boolean() });
const participantSchema = z.object({ id, first_name: z.string(), last_name: z.string(), ward_id: id.nullable().optional() });
const wardSchema = z.object({ id, name: z.string() });
const documentSchema = z.object({ id, owner_type: z.string(), owner_id: id, document_type: z.string(), created_at: z.string() });
```

Implement `workspace(pillar, period, today = new Date())` like this:

1. `Promise.all` the following:
   - required: `table("activity_session")`
   - `table("activity_attendance")`, falling back to `[]` on failure
   - `table("document")`, falling back to `[]` on failure
   - `/lookups/activity_type_definition`, falling back to `[]` on failure
   - `/lookups/activity_topic`, falling back to `[]` on failure
   - `/participants`, falling back to `[]` on failure
   - `/lookups/ward`, falling back to `[]` on failure
2. Keep only activity types whose `pillar_id === SESSION_PILLAR_IDS[pillar]`, and topics whose `activity_type_id` is one of those types.
3. A type or topic is `active` when it is `status === "ACTIVE" && !is_deleted`.
4. Keep only attendance rows that are not `is_deleted`.
5. The facilitator label is `facilitator_user_id ? "CREAW staff" : facilitator_provider_id ? "External provider" : "Not assigned"`.
6. The topic label is: the planned topic's name when `activity_topic_id` resolves in the topic list, else the free-text topic when it isn't blank, else `Session #${id}`.
7. The activity-type label is the type's name, else `Activity type #${id}`.
8. An attendee's `name` is `${first_name} ${last_name}` as sent (masked), their `ward` is the ward's name or null, and `added` is the attendance row's `created_at`.
9. Documents are those with `owner_type === "activity_session"` for the session, with name `titleCase(document_type)` and `added` set to `created_at`.
10. `communityWide` is `enrollment_id === null`.
11. Sort sessions newest first by `session_date`, then by `id` descending.
12. Call `buildCoverage({ types, topics, sessions, attendance, period, today })`.
13. `participants` are all participants mapped to `{ id, label: \`${first_name} ${last_name} · #${id}\` }`.

Implement the mutations like `vawg/api.ts`:

- `logSession` sends `POST /pillars/<code>?table=activity_session`.
- `updateSession` sends `PATCH ...&id=`.
- `attendance(pillar, sessionId)` reads `table=activity_attendance&includeDeleted=true` and filters it to the session.
- `addAttendance` sends a `POST` with `{ session_id, participant_id }`.
- `setAttendanceDeleted(pillar, attendanceId, deleted)` sends a `PATCH` with `{ is_deleted: deleted, status: deleted ? "INACTIVE" : "ACTIVE" }`.
- `curriculum(pillar)` returns the pillar's types and topics, with the `active` flags.
- `attach` sends a `POST` to the document table with owner `activity_session`.
- `viewDocument` sends `GET ...table=document&id=&download=true`.

Export the session-bound singleton:

```ts
export const sessionsApi = {
  async workspace(pillar: SessionPillar, period: SessionPeriod) {
    return (await withSessionApi(createSessionsApi)).workspace(pillar, period);
  },
};
```

- [ ] **Step 8: Run all the sessions tests and verify GREEN**

Run: `yarn test:run src/features/sessions`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/sessions
git commit -m "feat: model sessions, curriculum coverage and the sessions client"
```

---

### Task 4: Session Server Actions

**Files:**
- Create: `src/features/sessions/actions.ts`
- Test: `src/features/sessions/actions.test.ts`

**Interfaces:**
- Consumes: `createSessionsApi` from Task 3.
- Produces:
  - `logSessionAction(input: unknown): Promise<ActionResult>`
  - `updateSessionAction(input: unknown): Promise<ActionResult>`
  - `addAttendeeAction(input: unknown): Promise<ActionResult>`
  - `removeAttendeeAction(input: unknown): Promise<ActionResult>`
  - `attachSessionFileAction(input: unknown): Promise<ActionResult>`
  - `viewSessionFileAction(pillar: SessionPillar, sessionId: number, documentId: number)`, which returns `{ success, message, document: ViewedDocument | null }`, the same shape as `viewCaseFileAction`.
- Input shapes:
  - session inputs: `{ pillar: "srhr" | "skilling", sessionId?: number, activityTypeId: number, topicId: number | null, topic: string, sessionDate: string, venue: string, notes: string }`
  - attendee inputs: `{ pillar, sessionId, participantId }` and `{ pillar, sessionId, attendanceId }`

- [ ] **Step 1: Write the failing tests**

Create `src/features/sessions/actions.test.ts`. Use the same mocks as `src/features/vawg/actions.test.ts` (`server-only`, `next/headers` cookie store, `next/cache`):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { addAttendeeAction, logSessionAction, removeAttendeeAction, updateSessionAction } from "./actions";

const typeId = (name: string) => getMockStore().activity_type_definition.find((row) => row.name === name)!.id;
const topicId = (name: string) => getMockStore().activity_topic.find((row) => row.name === name)!.id;
const base = () => ({
  pillar: "srhr" as const,
  activityTypeId: typeId("Health Talk"),
  topicId: topicId("Contraception"),
  topic: "",
  sessionDate: "2026-09-29",
  venue: "Kibera Ward Office",
  notes: "",
});
beforeEach(() => {
  resetMockStore();
  cookieStore.get.mockReturnValue({ value: issueMockToken(1) });
});

describe("session actions", () => {
  it("logs a session on a planned topic with the signed-in facilitator", async () => {
    const result = await logSessionAction(base());
    expect(result.success).toBe(true);
    expect(getMockStore().activity_session.at(-1)).toMatchObject({
      pillar_id: 3,
      activity_topic_id: topicId("Contraception"),
      topic: null,
      facilitator_user_id: 1,
      notes: null,
    });
  });

  it("requires a free-text topic when no planned topic is chosen", async () => {
    const result = await logSessionAction({ ...base(), topicId: null, topic: "  " });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Choose a planned topic or describe the topic");
  });

  it("rejects a topic from another activity type", async () => {
    const before = getMockStore().activity_session.length;
    const result = await logSessionAction({ ...base(), topicId: topicId("Savings cycle") });
    expect(result).toMatchObject({ success: false, message: "That topic does not belong to this activity type" });
    expect(getMockStore().activity_session).toHaveLength(before);
  });

  it("rejects an activity type from the other pillar", async () => {
    const result = await logSessionAction({ ...base(), activityTypeId: typeId("Life Skills Session"), topicId: null, topic: "x" });
    expect(result).toMatchObject({ success: false, message: "That activity type is not part of this pillar" });
  });

  it("refuses users without session logging in the pillar", async () => {
    cookieStore.get.mockReturnValue({ value: issueMockToken(NO_SESSION_LOG_USER) });
    const result = await logSessionAction(base());
    expect(result.success).toBe(false);
  });

  it("edits a session without changing its facilitator", async () => {
    const session = getMockStore().activity_session.find((row) => row.pillar_id === 3)!;
    const result = await updateSessionAction({ ...base(), sessionId: session.id, venue: "New venue" });
    expect(result.success).toBe(true);
    expect(session).toMatchObject({ venue: "New venue", facilitator_user_id: 9 });
  });

  it("adds, removes and restores an attendee without duplicates", async () => {
    const session = getMockStore().activity_session.find((row) => row.pillar_id === 3)!;
    const participantId = getMockStore().participant.find(
      (person) => !getMockStore().activity_attendance.some((row) => row.session_id === session.id && row.participant_id === person.id)
    )!.id;
    expect((await addAttendeeAction({ pillar: "srhr", sessionId: session.id, participantId })).success).toBe(true);
    const duplicate = await addAttendeeAction({ pillar: "srhr", sessionId: session.id, participantId });
    expect(duplicate).toMatchObject({ success: false, message: "Already on the attendance list" });
    const row = getMockStore().activity_attendance.find((item) => item.session_id === session.id && item.participant_id === participantId)!;
    expect((await removeAttendeeAction({ pillar: "srhr", sessionId: session.id, attendanceId: row.id })).success).toBe(true);
    expect(row).toMatchObject({ is_deleted: true, status: "INACTIVE" });
    expect((await addAttendeeAction({ pillar: "srhr", sessionId: session.id, participantId })).success).toBe(true);
    expect(row).toMatchObject({ is_deleted: false, status: "ACTIVE" });
    expect(getMockStore().activity_attendance.filter((item) => item.session_id === session.id && item.participant_id === participantId)).toHaveLength(1);
  });

  it("refuses to remove attendance that belongs to another session", async () => {
    const other = getMockStore().activity_attendance[0];
    const session = getMockStore().activity_session.find((row) => row.pillar_id === 3 && row.id !== other.session_id)!;
    const result = await removeAttendeeAction({ pillar: "srhr", sessionId: session.id, attendanceId: other.id });
    expect(result.success).toBe(false);
  });
});
```

Replace `NO_SESSION_LOG_USER` with a constant set to a seeded user id whose grants lack `ACTIVITY_SESSION_LOG` for pillar 3. Find one by reading the role and user-role blocks around `src/lib/mock-api/seed.ts:160-215`; user 3 is a likely candidate. Declare the constant at the top of the file with a comment naming who that user is.

- [ ] **Step 2: Run the tests and verify RED**

Run: `yarn test:run src/features/sessions/actions.test.ts`
Expected: FAIL, because the actions are not exported.

- [ ] **Step 3: Implement `actions.ts`**

```ts
"use server";
/**
 * Server Actions for one pillar's group sessions: logging and editing a session,
 * correcting its attendance list, and its files.
 *
 * Each action re-checks the session, validates its input and checks the permission
 * in the session's pillar before calling the API, which enforces the same rules
 * again and writes the audit entry.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ViewedDocument } from "@/components/ui/document-viewer";
import { actionResult } from "@/lib/api/action-result";
import { withSessionApi } from "@/lib/api/session-api";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { titleCase } from "@/lib/format";
import { createSessionsApi } from "./api";
import { SESSION_PILLAR_IDS, type SessionPillar } from "./model";

const id = z.number().int().positive();
const pillar = z.enum(["srhr", "skilling"]);
const text = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const sessionInput = z.object({
  pillar,
  sessionId: id.optional(),
  activityTypeId: id,
  topicId: id.nullable(),
  topic: text(200),
  sessionDate: z.iso.date(),
  venue: text(160),
  notes: text(2000),
});
const api = () => withSessionApi(createSessionsApi);
const scope = (code: SessionPillar) => ({ pillarId: SESSION_PILLAR_IDS[code] });
const done = (code: SessionPillar, response: { success: boolean; resultCode: number; message: string }) => {
  if (response.success) revalidatePath(`/pillars/${code}`);
  return actionResult(response.resultCode, response.message);
};

/** Validates a session form against the pillar's curriculum; the API values, or an error result. */
async function sessionValues(input: unknown) {
  const parsed = sessionInput.safeParse(input);
  if (!parsed.success) return { error: actionResult(422, "Check the session details and try again") };
  const value = parsed.data;
  if (value.topicId === null && !value.topic)
    return { error: actionResult(422, "Choose a planned topic or describe the topic") };
  const session = await requireSession();
  if (!hasPermission(session.grants, "ACTIVITY_SESSION_LOG", scope(value.pillar)))
    return { error: actionResult(403, "You cannot log sessions in this pillar") };
  const { types, topics } = await (await api()).curriculum(value.pillar);
  if (!types.some((type) => type.id === value.activityTypeId))
    return { error: actionResult(422, "That activity type is not part of this pillar") };
  if (value.topicId !== null && !topics.some((topic) => topic.id === value.topicId && topic.activityTypeId === value.activityTypeId))
    return { error: actionResult(422, "That topic does not belong to this activity type") };
  return {
    value,
    userId: session.user.id,
    body: {
      activity_type_id: value.activityTypeId,
      activity_topic_id: value.topicId,
      topic: value.topicId === null ? value.topic : null,
      session_date: value.sessionDate,
      venue: value.venue,
      notes: value.notes,
    },
  };
}

export async function logSessionAction(input: unknown) {
  try {
    const checked = await sessionValues(input);
    if ("error" in checked) return checked.error;
    const response = await (await api()).logSession(checked.value.pillar, {
      ...checked.body,
      pillar_id: SESSION_PILLAR_IDS[checked.value.pillar],
      facilitator_user_id: checked.userId,
    });
    return done(checked.value.pillar, response);
  } catch {
    return actionResult(500, "Could not log the session");
  }
}

export async function updateSessionAction(input: unknown) {
  try {
    const checked = await sessionValues(input);
    if ("error" in checked) return checked.error;
    if (!checked.value.sessionId) return actionResult(422, "Check the session details and try again");
    const response = await (await api()).updateSession(checked.value.pillar, checked.value.sessionId, checked.body);
    return done(checked.value.pillar, response);
  } catch {
    return actionResult(500, "Could not update the session");
  }
}
```

The edit path keeps the current, possibly retired, type and topic valid. `curriculum()` returns inactive rows too, with `active: false`, so the membership checks still pass for them. The dialog (Task 6) only offers inactive options that are the session's current values.

`addAttendeeAction`:
- Parse `{ pillar, sessionId, participantId }`, `requireSession`, and check `ACTIVITY_SESSION_LOG`.
- Read `attendance(pillar, sessionId)`.
- If an active row exists for the participant, return `actionResult(422, "Already on the attendance list")`.
- If a deleted row exists, call `setAttendanceDeleted(pillar, row.id, false)`.
- Otherwise call `addAttendance`.
- Finish with `done(...)`.

`removeAttendeeAction`:
- Parse and check the permission.
- Read `attendance(pillar, sessionId)`. If `attendanceId` is not among its active rows, return `actionResult(404, "Attendee not found on this session")`.
- Otherwise call `setAttendanceDeleted(pillar, attendanceId, true)` and `done`.

`attachSessionFileAction` and `viewSessionFileAction` mirror `attachCaseFileAction` and `viewCaseFileAction` in `src/features/vawg/actions.ts`, with these differences:
- `DOCUMENT_UPLOAD` or `DOCUMENT_DOWNLOAD` is checked in the session's pillar scope.
- The owner check is `owner_type === "activity_session" && owner_id === sessionId`.
- `linkedRecord` is `` `Group session #${sessionId}` ``.

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `yarn test:run src/features/sessions/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sessions/actions.ts src/features/sessions/actions.test.ts
git commit -m "feat: log sessions and correct attendance with audited actions"
```

---

### Task 5: Summary Cards, Coverage Panel and Session Register

**Files:**
- Create: `src/features/sessions/components/summary-cards.tsx` (a Server Component; no hooks)
- Create: `src/features/sessions/components/coverage-panel.tsx` (`"use client"`)
- Create: `src/features/sessions/components/session-register.tsx` (`"use client"`)
- Test: `src/features/sessions/components.test.tsx` (new; Task 6 extends it)

**Interfaces:**
- Consumes: `SessionWorkspace` from Task 3.
- Produces:
  - `SessionSummaryCards({ summary, color, tint })`
  - `CoveragePanel({ workspace, onTopic }: { workspace: SessionWorkspace; onTopic: (topic: string) => void })`
  - `SessionRegister({ workspace, can }: { workspace: SessionWorkspace; can: SessionPermissions })`, where `export interface SessionPermissions { log: boolean; attach: boolean; download: boolean; export: boolean }` is added to `model.ts`
  - `SessionWorkspaceView({ workspace, can })`: the client wrapper that renders `CoveragePanel` above `SessionRegister` and shares the selected topic filter between them. It lives in `session-register.tsx` and is exported. The page (Task 7) renders it.

- [ ] **Step 1: Write the failing tests**

Create `src/features/sessions/components.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/pillars/srhr",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../actions", () => ({
  logSessionAction: vi.fn(async () => ({ success: true, message: "ok", resultCode: 201 })),
  updateSessionAction: vi.fn(async () => ({ success: true, message: "ok", resultCode: 200 })),
  addAttendeeAction: vi.fn(),
  removeAttendeeAction: vi.fn(),
  attachSessionFileAction: vi.fn(),
  viewSessionFileAction: vi.fn(),
}));
vi.mock("@/components/portal/data-actions", () => ({ auditedExportAction: vi.fn() }));
import { SessionSummaryCards } from "./components/summary-cards";
import { SessionWorkspaceView } from "./components/session-register";
import type { SessionWorkspace } from "./model";

afterEach(cleanup);
export const workspace: SessionWorkspace = {
  pillar: "srhr",
  period: "quarter",
  sessions: [
    {
      id: 2, activityTypeId: 4, activityType: "Health Talk", topicId: 10, topic: "Menstrual health",
      freeTopic: null, date: "2026-09-10", venue: "Kibera Ward Office", notes: "Good turnout",
      facilitator: "CREAW staff", communityWide: true,
      attendees: [{ attendanceId: 1, participantId: 5, name: "••ith ••••ani", ward: "Laini Saba", added: "2026-09-10T09:00:00Z" }],
      documents: [{ id: 9, name: "Attendance sheet", added: "2026-09-10T10:00:00Z" }],
      logged: "2026-09-10T08:00:00Z", updated: "2026-09-11T08:00:00Z",
    },
    {
      id: 3, activityTypeId: 1, activityType: "YSLA", topicId: null, topic: "Facility referral day",
      freeTopic: "Facility referral day", date: "2026-08-20", venue: null, notes: null,
      facilitator: "External provider", communityWide: true, attendees: [], documents: [],
      logged: "2026-08-20T08:00:00Z", updated: "2026-08-20T08:00:00Z",
    },
  ],
  coverage: [
    {
      activityTypeId: 4, name: "Health Talk",
      topics: [
        { topicId: 10, name: "Menstrual health", sequenceNo: 1, sessions: 1, lastDelivered: "2026-09-10" },
        { topicId: 11, name: "Contraception", sequenceNo: 2, sessions: 0, lastDelivered: null },
      ],
      otherTopics: [],
    },
    { activityTypeId: 1, name: "YSLA", topics: [], otherTopics: [{ name: "Facility referral day", sessions: 1, lastDelivered: "2026-08-20" }] },
  ],
  summary: { sessionsHeld: 2, peopleReached: 1, topicsCovered: 1, topicsPlanned: 2, activeTypes: 2 },
  activityTypes: [{ id: 4, name: "Health Talk", active: true }, { id: 1, name: "YSLA", active: true }],
  topics: [
    { id: 10, activityTypeId: 4, name: "Menstrual health", sequenceNo: 1, active: true },
    { id: 11, activityTypeId: 4, name: "Contraception", sequenceNo: 2, active: true },
  ],
  participants: [{ id: 5, label: "••ith ••••ani · #5" }, { id: 6, label: "••ce ••••yi · #6" }],
};
const all = { log: true, attach: true, download: true, export: true };

describe("session summary cards", () => {
  it("shows the four headline counts", () => {
    render(<SessionSummaryCards summary={workspace.summary} color="#000" tint="#fff" />);
    for (const label of ["Sessions held", "People reached", "Topics covered", "Active activity types"])
      expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
  });
});

describe("curriculum coverage and session register", () => {
  it("marks covered and uncovered topics and lists other topics", () => {
    render(<SessionWorkspaceView workspace={workspace} can={all} />);
    const panel = screen.getByRole("region", { name: "Curriculum coverage" });
    expect(within(panel).getByText("Menstrual health")).toBeInTheDocument();
    expect(within(panel).getByText("Not yet covered")).toBeInTheDocument();
    expect(within(panel).getByText("Other topics")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "This year" })).toHaveAttribute("href", "/pillars/srhr?period=year");
  });

  it("shows the register columns and filters by activity type and by a clicked topic", () => {
    render(<SessionWorkspaceView workspace={workspace} can={all} />);
    for (const heading of ["Activity type", "Topic", "Date", "Venue", "Facilitator", "Attendees"])
      expect(screen.getByRole("columnheader", { name: new RegExp(heading) })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "YSLA" }));
    expect(screen.queryByRole("button", { name: "Open Menstrual health, 10 Sept 2026" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.click(screen.getByRole("button", { name: "Show sessions on Menstrual health" }));
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("hides the export when the user cannot export", () => {
    render(<SessionWorkspaceView workspace={workspace} can={{ ...all, export: false }} />);
    expect(screen.queryByRole("button", { name: /CSV/ })).not.toBeInTheDocument();
  });

  it("shows a hint when no topics are planned", () => {
    render(<SessionWorkspaceView workspace={{ ...workspace, coverage: workspace.coverage.map((row) => ({ ...row, topics: [] })) }} can={all} />);
    expect(screen.getAllByText("No planned topics yet").length).toBeGreaterThan(0);
  });
});
```

The row open label `Open <topic>, <formatted date>` must use the repo's `formatDate` output. If `formatDate("2026-09-10")` does not give `10 Sept 2026`, change the expected string in the test to the real output, and use `formatDate` in the label.

- [ ] **Step 2: Run the tests and verify RED**

Run: `yarn test:run src/features/sessions/components.test.tsx`
Expected: FAIL, because the components don't exist.

- [ ] **Step 3: Implement `summary-cards.tsx`**

Follow `src/features/vawg/components/summary-cards.tsx` exactly, with four `MetricCard`s:

| Label | Value | Icon | Badge |
|---|---|---|---|
| `Sessions held` | `sessionsHeld` | `CalendarCheck` | neutral, `in period` |
| `People reached` | `peopleReached` | `Users` | info, `distinct attendees` |
| `Topics covered` | `` `${topicsCovered} of ${topicsPlanned}` `` | `BookOpenCheck` | success, `planned topics` |
| `Active activity types` | `activeTypes` | `Layers` | neutral, `configured` |

Use `.toLocaleString()` on the counts.

- [ ] **Step 4: Implement `coverage-panel.tsx`**

- Wrap it in `<section aria-labelledby="coverage-title" className="flex flex-col gap-4 rounded-2xl border border-creaw-line bg-white p-6">`, with an `h2` whose id is `coverage-title` and text `Curriculum coverage`.
- **Period selector:** three `next/link` links built from `sessionPeriods` and `periodLabels`, with `href={\`${usePathname()}?period=${period}\`}`. Mark the current period with `aria-current="page"`.
- **One block per activity type:** a `<details open>` whose `<summary>` shows the type name and `covered/planned`.
- **Planned topics:** an ordered list. Each topic is a `<button type="button" aria-label={\`Show sessions on ${name}\`} onClick={() => onTopic(name)}>`.
  - A covered topic shows a ✓ (`CircleCheck`, aria-hidden), the name, `formatDate(lastDelivered)` and `N session(s)`.
  - An uncovered topic shows ○ (`Circle`, aria-hidden), the name and `Not yet covered`.
- A type with no planned topics shows the text `No planned topics yet` and the sentence "Add them in Admin → Lookups → Activity topics".
- **Other topics:** when a type has entries, show a sub-heading `Other topics` and list their names and session counts, using the same button so they filter too.

- [ ] **Step 5: Implement `session-register.tsx`**

Follow `src/features/vawg/components/case-register.tsx`. It uses `TableCard`, `DataTable`, `useClientSort`, `useClientPaging`, `Pagination`, `ExportButton` and `FormBanner`.

The columns, in this order:

| Header | Sort value | Cell |
|---|---|---|
| `Activity type` | `activityType` | the type name |
| `Topic` | `topic` | the topic, plus a small `Other` badge when `topicId === null` |
| `Date` | `dateSortValue(date)` | `formatDate(date)` |
| `Venue` | `venue ?? ""` | `venue ?? "Not recorded"` |
| `Facilitator` | `facilitator` | the label |
| `Attendees` | `attendees.length` | the count |

Behavior:
- **Chips:** `All` plus the distinct `activityType` values of the sessions. `chipsLabel="Activity type"`.
- **Topic filter:** in `SessionWorkspaceView`, `useState<string | null>` holds the selected topic. When it is set, only rows with `topic === selected` show, and a `FormBanner` tone `"info"` (or the nearest existing tone) reads `Showing sessions on <topic>`, with a `Clear` button.
- **Search:** covers the joined `activityType`, `topic`, `venue` and `facilitator`. Its label is `Search sessions`.
- **Export:** `can.export && <ExportButton label="CSV" exportAction={() => auditedExportAction({ path: \`/pillars/${workspace.pillar}\`, routeTemplate: "/pillars/:pillar", query: { table: "activity_session" } })} />`.
- **Row opening:** `rowOpenLabel={(row) => \`Open ${row.topic}, ${formatDate(row.date)}\`}`. `onRowOpen` sets `selectedId`, which Task 6 uses for the drawer.
- **Titles:** the title is `Session register` and the subtitle is `Attendance arrives from the mobile app — open a session to review or correct it`.

`SessionWorkspaceView` renders `<CoveragePanel workspace={workspace} onTopic={setTopic} />`, then the register.

- [ ] **Step 6: Run the tests and verify GREEN**

Run: `yarn test:run src/features/sessions/components.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/sessions/components src/features/sessions/components.test.tsx src/features/sessions/model.ts
git commit -m "feat: show curriculum coverage and the session register"
```

---

### Task 6: Session Drawer and Dialogs

**Files:**
- Create: `src/features/sessions/components/session-drawer.tsx` (`"use client"`)
- Create: `src/features/sessions/components/session-dialogs.tsx` (`"use client"`)
- Modify: `src/features/sessions/components/session-register.tsx`: wire the drawer, the dialogs and the document viewer.
- Test: `src/features/sessions/components.test.tsx` (extend)

**Interfaces:**
- Consumes: the Task 4 actions and the Task 5 register.
- Produces:
  - `SessionDrawer({ session, pillar, can, onClose, onEdit, onAttach, onAddAttendee, onRemoveAttendee, onView })`
  - `SessionFormDialog({ open, workspace, session, onClose, onDone })`, where `session: SessionView | null` and `null` means "Log session"
  - `AddAttendeeDialog({ session, workspace, onClose, onDone })`
  - `RemoveAttendeeDialog({ session, attendee, onClose, onDone })`
  - `AttachSessionFileDialog({ session, pillar, onClose, onDone })`
  - `LogSessionButton({ workspace })`: a heading button that opens `SessionFormDialog` in log mode. The page (Task 7) renders it.

- [ ] **Step 1: Write the failing tests**

Append to `src/features/sessions/components.test.tsx`. At the top, import `import { LogSessionButton, SessionFormDialog } from "./components/session-dialogs";` and `import * as actions from "./actions";`, then add:

```tsx
describe("session drawer", () => {
  const open = () => {
    render(<SessionWorkspaceView workspace={workspace} can={all} />);
    fireEvent.click(screen.getByRole("button", { name: /^Open Menstrual health/ }));
    return screen.getByRole("dialog");
  };

  it("shows the header, overview and tabs", () => {
    const drawer = open();
    expect(drawer).toHaveTextContent("Group session · SRHR");
    expect(drawer).toHaveTextContent("Menstrual health");
    expect(drawer).toHaveTextContent("Kibera Ward Office · CREAW staff");
    expect(drawer).toHaveTextContent("Good turnout");
    for (const tab of ["Overview", "Attendance (1)", "Documents & photos (1)", "Activity"])
      expect(within(drawer).getByRole("tab", { name: tab })).toBeInTheDocument();
  });

  it("lists attendees with masked names and offers add and remove", () => {
    const drawer = open();
    fireEvent.click(within(drawer).getByRole("tab", { name: "Attendance (1)" }));
    expect(drawer).toHaveTextContent("••ith ••••ani");
    expect(drawer).toHaveTextContent("Laini Saba");
    expect(within(drawer).getByRole("button", { name: "Add attendee" })).toBeEnabled();
    expect(within(drawer).getByRole("button", { name: "Remove ••ith ••••ani" })).toBeEnabled();
  });

  it("builds the activity timeline newest first", () => {
    const drawer = open();
    fireEvent.click(within(drawer).getByRole("tab", { name: "Activity" }));
    const items = within(drawer).getAllByRole("listitem").map((item) => item.textContent);
    expect(items[0]).toMatch(/Session edited/);
    expect(items.at(-1)).toMatch(/Session logged/);
  });

  it("disables every change control without session logging, upload or download", () => {
    render(<SessionWorkspaceView workspace={workspace} can={{ log: false, attach: false, download: false, export: false }} />);
    fireEvent.click(screen.getByRole("button", { name: /^Open Menstrual health/ }));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(within(drawer).getByRole("button", { name: "Attach" })).toBeDisabled();
    fireEvent.click(within(drawer).getByRole("tab", { name: "Attendance (1)" }));
    expect(within(drawer).getByRole("button", { name: "Add attendee" })).toBeDisabled();
    expect(within(drawer).getByRole("button", { name: "Remove ••ith ••••ani" })).toBeDisabled();
    fireEvent.click(within(drawer).getByRole("tab", { name: "Documents & photos (1)" }));
    expect(within(drawer).getByRole("button", { name: "View Attendance sheet" })).toBeDisabled();
  });
});

describe("session form", () => {
  it("filters topics by the chosen activity type and needs free text for Other", async () => {
    render(<LogSessionButton workspace={workspace} />);
    fireEvent.click(screen.getByRole("button", { name: "Log session" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Activity type"), { target: { value: "4" } });
    const topic = within(dialog).getByLabelText("Topic") as HTMLSelectElement;
    expect([...topic.options].map((option) => option.text)).toEqual(["Menstrual health", "Contraception", "Other"]);
    fireEvent.change(topic, { target: { value: "other" } });
    expect(within(dialog).getByLabelText("Describe the topic")).toBeRequired();
  });

  it("keeps a retired topic selectable when editing a session that uses it", () => {
    const retired = { ...workspace, topics: workspace.topics.filter((row) => row.id !== 10) };
    render(<SessionFormDialog open workspace={retired} session={workspace.sessions[0]} onClose={() => {}} onDone={() => {}} />);
    const topic = screen.getByLabelText("Topic") as HTMLSelectElement;
    expect(topic.value).toBe("10");
    expect(topic.selectedOptions[0].text).toBe("Menstrual health");
  });

  it("submits the structured values", async () => {
    render(<LogSessionButton workspace={workspace} />);
    fireEvent.click(screen.getByRole("button", { name: "Log session" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Activity type"), { target: { value: "4" } });
    fireEvent.change(within(dialog).getByLabelText("Topic"), { target: { value: "11" } });
    fireEvent.change(within(dialog).getByLabelText("Date"), { target: { value: "2026-09-29" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Log session" }));
    await vi.waitFor(() =>
      expect(actions.logSessionAction).toHaveBeenCalledWith(
        expect.objectContaining({ pillar: "srhr", activityTypeId: 4, topicId: 11, topic: "", sessionDate: "2026-09-29" })
      )
    );
  });
});
```

If the shared `Timeline` does not render `listitem`s, assert the order through `textContent.indexOf("Session edited") < textContent.indexOf("Session logged")` instead, and say so in your report.

- [ ] **Step 2: Run the tests and verify RED**

Run: `yarn test:run src/features/sessions/components.test.tsx`
Expected: the new tests FAIL, and the Task 5 tests still pass.

- [ ] **Step 3: Implement `session-drawer.tsx`**

Follow `src/features/vawg/components/case-drawer.tsx`. It uses `RecordDrawer`, `FieldGrid`, `SectionTitle`, `DocumentRow`, `Timeline`, `Button` and `pillarLook`. The props:

- `initials`: the first two letters of `activityType`, uppercase.
- `kind`: `` `Group session · ${pillar === "srhr" ? "SRHR" : "Skilling"}` ``.
- `title`: `` `${session.topic} · ${formatDate(session.date)}` ``.
- `subtitle`: `` `${session.venue ?? "Venue not recorded"} · ${session.facilitator}` ``.
- `status`: `<StatusBadge tone="neutral">{session.communityWide ? "Community-wide" : "Linked participant"}</StatusBadge>`.
- `actions`: an outline **Edit** button (`disabled={!can.log}`) and an **Attach** button (`disabled={!can.attach}`).

The tabs:

- `overview`: a `FieldGrid` with:
  - Activity type
  - Topic (`session.topic`, with the suffix ` (Other)` when `topicId === null`)
  - Date
  - Venue
  - Facilitator
  - Reach: `Community-wide` or `Linked participant`
  - Notes (`notes ?? "—"`)
- `attendance`, labelled `` `Attendance (${session.attendees.length})` ``:
  - A note: "Attendance normally arrives from the mobile app. Use this list to correct it."
  - An **Add attendee** button (`disabled={!can.log}`).
  - One row per attendee showing the name, the ward (`ward ?? "Ward not recorded"`) and a link to `/participants`, plus a button with `aria-label={\`Remove ${name}\`}` (`disabled={!can.log}`).
  - With no attendees, the text `No attendees recorded yet.`
- `documents`, labelled `` `Documents & photos (${session.documents.length})` ``: a `DocumentRow` per file, with View and Download icon buttons named `View <name>` and `Download <name>` (`disabled={!can.download}`). With no files, the text `No files attached yet.`
- `activity`: `<Timeline events={…} />`. The events, newest first:
  - `Session edited` at `updated`, only when `updated !== logged`
  - `<name> added to attendance` at `added`, for each attendee
  - `<file> attached` at `added`, for each document
  - `Session logged` at `logged`

  Sort by timestamp descending and use `formatDate` for the detail.

- [ ] **Step 4: Implement `session-dialogs.tsx`**

Follow `EditCaseDialog` in `src/features/vawg/components/case-dialogs.tsx`, with `ActionDialog`, `useActionSubmit` and `fieldClass`.

`SessionFormDialog`:
- **Title:** `Log session` in log mode, or `Edit session` with an edit session.
- **State:** `typeId` (initially `session?.activityTypeId ?? ""`) and `topicValue` (initially `session ? String(session.topicId ?? "other") : ""`).
- **Type options:** the workspace's active types. When the edited session's type isn't among them, prepend `{ id: session.activityTypeId, name: session.activityType }`.
- **Topic options:** the active topics of `typeId`, sorted by `sequenceNo`. When editing and `session.topicId` is set but not among them, prepend `{ id: session.topicId, name: session.topic }`. Always end with `<option value="other">Other</option>`.
- **Fields:** `Activity type` (select, required), `Topic` (select, required), `Describe the topic` (text, required only when `topicValue === "other"`, shown only then, `defaultValue={session?.freeTopic ?? ""}`), `Date` (date, required), `Venue` and `Notes` (textarea).
- **Submit:** send

  ```ts
  {
    pillar,
    sessionId,
    activityTypeId: Number(typeId),
    topicId: topicValue === "other" ? null : Number(topicValue),
    topic,
    sessionDate,
    venue,
    notes,
  }
  ```

  to `updateSessionAction` when editing, or to `logSessionAction`. The success messages are `Session logged` and `Session updated`.
- The submit button text is `Log session` or `Save changes`.

`LogSessionButton` is a button labelled `Log session` with a `Plus` icon that opens `SessionFormDialog` in log mode and calls `router.refresh()` on done.

`AddAttendeeDialog`:
- A search input labelled `Find participant` filters `workspace.participants` by label.
- It excludes people already listed on the session (by `participantId`).
- The `<select size={6}>` is labelled `Participant`.
- It submits `addAttendeeAction({ pillar, sessionId, participantId })`, with the success message `Attendee added`.

`RemoveAttendeeDialog`:
- The confirmation text is `` `Remove ${attendee.name} from this session's attendance?` ``.
- It submits `removeAttendeeAction({ pillar, sessionId, attendanceId })`, with the success message `Attendee removed`.

`AttachSessionFileDialog` follows `AttachCaseFileDialog` with the types `attendance_sheet` (Attendance sheet), `group_photo` (Group photo) and `supporting_document` (Supporting document). It calls `attachSessionFileAction`.

- [ ] **Step 5: Wire it into `session-register.tsx`**

Mirror `CaseRegister`:
- Modal state `{ kind: "edit" } | { kind: "attach" } | { kind: "add" } | { kind: "remove"; attendanceId: number } | null`.
- The drawer shows `session={modal === null ? selected : null}`, so it is hidden while a dialog is open. The same `selectedId` restores it after `done`.
- `done(message)` clears the modal, sets the feedback and calls `router.refresh()`.
- `view(documentId)` calls `viewSessionFileAction(workspace.pillar, selected.id, documentId)` and opens `DocumentViewer`.

- [ ] **Step 6: Run the tests and verify GREEN**

Run: `yarn test:run src/features/sessions/components.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/sessions/components src/features/sessions/components.test.tsx
git commit -m "feat: add the session drawer, attendance corrections and session form"
```

---

### Task 7: Compose SRHR and Skilling Pages

**Files:**
- Modify: `src/features/pillars/components.tsx`: add `workspace?: React.ReactNode` and `showDomainTable?: boolean` (default `true`) props to `PillarContent`.
- Modify: `src/app/(portal)/pillars/[pillar]/page.tsx`: add `searchParams`, `loadSessionsWorkspace` and the SRHR/Skilling slots.
- Test: `src/app/(portal)/pillars/[pillar]/page.test.tsx` (extend)

**Interfaces:**
- Consumes: `sessionsApi.workspace`, `SessionSummaryCards`, `SessionWorkspaceView`, `LogSessionButton`, `parsePeriod`, `isSessionPillar`.
- Produces:
  - `PillarPage({ params, searchParams }: { params: Promise<{ pillar: string }>; searchParams?: Promise<{ period?: string }> })`. `searchParams` is optional, so the existing tests keep calling it without one.
  - The `PillarContent` props `workspace` and `showDomainTable`.

- [ ] **Step 1: Write the failing tests**

Change the test helper to accept a search string, and add the new cases:

```tsx
import { sessionsApi } from "@/features/sessions/api";

const render = async (pillar: string, period?: string) =>
  renderToStaticMarkup(
    await PillarPage({
      params: Promise.resolve({ pillar }),
      searchParams: Promise.resolve(period ? { period } : {}),
    })
  );

  it("composes the SRHR curriculum workspace", async () => {
    const html = await render("srhr");
    for (const text of ["Sessions held", "People reached", "Topics covered", "Curriculum coverage", "Session register", "Log session"])
      expect(html).toContain(text);
    expect(html).not.toContain("Outreach sessions");
    expect(html).not.toContain("Activity type ID");
  });

  it("adds the sessions workspace beside Skilling's trainee enrollments", async () => {
    const html = await render("skilling");
    expect(html).toContain("Session register");
    expect(html).toContain("Workplace conduct");
    expect(html).toContain("Trainee enrollments");
    expect(html).not.toContain("Facility referral day");
  });

  it("treats an invalid period as this quarter", async () => {
    const spy = vi.spyOn(sessionsApi, "workspace");
    await render("srhr", "decade");
    expect(spy).toHaveBeenCalledWith("srhr", "quarter");
  });

  it("keeps the SRHR page and shows a banner when sessions fail to load", async () => {
    vi.spyOn(sessionsApi, "workspace").mockRejectedValue(new Error("timeout"));
    const html = await render("srhr");
    expect(html).toContain("could not be loaded");
    expect(html).not.toContain("Session register");
  });

  it("shows the generic SRHR page to a user without session view", async () => {
    cookieStore.get.mockReturnValue({ value: issueMockToken(NO_SESSION_VIEW_USER) });
    const html = await render("srhr");
    expect(html).not.toContain("Session register");
  });
```

- Set `NO_SESSION_VIEW_USER` to a seeded user who can open the SRHR pillar (`DASHBOARD_VIEW` there) but lacks `ACTIVITY_SESSION_VIEW` there. Look it up in `src/lib/mock-api/seed.ts`.
- If no such user exists, drop that one test and record why in your report. The permission gate is still covered by the no-access test, and the code path is the same `hasPermission` call.
- Keep every existing test in the file.

- [ ] **Step 2: Run the tests and verify RED**

Run: `yarn test:run 'src/app/(portal)/pillars/[pillar]/page.test.tsx'`
Expected: the new tests FAIL.

- [ ] **Step 3: Add the `PillarContent` slots**

In `src/features/pillars/components.tsx`:
- Add `workspace` and `showDomainTable = true` to the destructured props, with doc comments:
  - `/** A dedicated workspace shown above the register, e.g. SRHR sessions. */`
  - `/** False hides the generic domain table when a workspace replaces it. */`
- Render `{workspace}` directly before `{register}`.
- Change the domain-table condition to `{!register && showDomainTable && pillar.domain && (`.

- [ ] **Step 4: Compose the page**

In `page.tsx`:

```ts
import { sessionsApi } from "@/features/sessions/api";
import { isSessionPillar, parsePeriod, SESSION_PILLAR_IDS, type SessionPeriod } from "@/features/sessions/model";
import { SessionSummaryCards } from "@/features/sessions/components/summary-cards";
import { SessionWorkspaceView } from "@/features/sessions/components/session-register";
import { LogSessionButton } from "@/features/sessions/components/session-dialogs";

/**
 * The pillar's group-session workspace, none for other pillars and users without
 * session access there, or "failed" when it can't load (the page then degrades).
 */
async function loadSessionsWorkspace(grants: readonly EffectiveGrant[], code: PillarCode, period: SessionPeriod) {
  if (!isSessionPillar(code)) return undefined;
  if (!hasPermission(grants, "ACTIVITY_SESSION_VIEW", { pillarId: SESSION_PILLAR_IDS[code] })) return undefined;
  return sessionsApi.workspace(code, period).catch(() => "failed" as const);
}
```

Then:
- Change the signature to `PillarPage({ params, searchParams }: { params: Promise<{ pillar: string }>; searchParams?: Promise<{ period?: string }> })`.
- Compute `const period = parsePeriod((await searchParams)?.period);`.
- Add `loadSessionsWorkspace(session.grants, code.data, period)` as the fourth entry of the existing `Promise.all`, as `sessions`.
- Compute the session state and permissions:

```ts
  const sessionsFailed = sessions === "failed";
  const sessionWorkspace = sessions !== "failed" ? sessions : undefined;
  const sessionPermissions = {
    log: can("ACTIVITY_SESSION_LOG"),
    attach: can("DOCUMENT_UPLOAD"),
    download: can("DOCUMENT_DOWNLOAD"),
    export: can("REPORT_EXPORT_CSV"),
  };
```

- Pass these props to `PillarContent`. Keep the VAWG branches exactly as they are, and give the sessions branch its own ternary arm:
  - `workspace={sessionWorkspace ? <SessionWorkspaceView workspace={sessionWorkspace} can={sessionPermissions} /> : sessionsFailed ? <AlertBanner tone="warning">The session register could not be loaded. Refresh the page to try again.</AlertBanner> : undefined}`
  - `showDomainTable={!(pillar.code === "srhr" && (sessionWorkspace || sessionsFailed))}`
  - In `kpis`: `sessionWorkspace ? <SessionSummaryCards summary={sessionWorkspace.summary} color={pillar.color} tint={pillar.tint} /> : …`
  - In `headingActions`: `sessionWorkspace && sessionPermissions.log ? <>{pillar.code === "skilling" && canCreateDomain ? <PillarDomainCreateButton code="skilling" /> : null}<LogSessionButton workspace={sessionWorkspace} /></> : …`, before the existing VAWG branch. When `headingActions` is undefined, the default actions render as before.
- SRHR's old raw-ID `PillarDomainCreateButton` must not render. `headingActions` replaces `defaultActions` whenever the sessions workspace loads with log permission.
- Without log permission, add a guard to `domainActions`: `pillar.code === "srhr" && sessionWorkspace ? undefined : …`.

If `page.tsx` passes 250 lines, move `loadVawgWorkspace`, `loadSessionsWorkspace` and `loadWroRegister` into `src/app/(portal)/pillars/[pillar]/loaders.ts` (no JSX; `loadWroRegister` returns JSX, so it becomes `loaders.tsx`). Note the move in your report.

- [ ] **Step 5: Run the tests and verify GREEN**

Run: `yarn test:run 'src/app/(portal)/pillars/[pillar]/page.test.tsx' src/features/pillars`
Expected: PASS, with no generic-pillar regression.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/(portal)/pillars/[pillar]' src/features/pillars/components.tsx
git commit -m "feat: compose the SRHR and Skilling curriculum workspaces"
```

---

### Task 8: Full Verification

**Files:**
- Modify only files needed to fix failures caused by Tasks 1–7.

- [ ] **Step 1: Run the focused suites**

Run: `yarn test:run src/lib/mock-api src/features/admin src/features/sessions src/features/pillars 'src/app/(portal)/pillars/[pillar]/page.test.tsx'`
Expected: zero failed tests.

- [ ] **Step 2: Run the full suite**

Run: `yarn test:run`
Expected: zero failed test files and zero failed tests. Only the known admin post-teardown errors may appear.

- [ ] **Step 3: Run the static checks and the build**

Run: `yarn typecheck`, `yarn lint`, `yarn format:check`, `yarn build`
Expected: each exits 0. If `format:check` fails only on files these tasks touched, run `yarn prettier --write <those files>` and re-check.

- [ ] **Step 4: Check the diff**

Run: `git diff --check` and `git status --short`
Expected: the diff check is clean and there are no untracked source files.

- [ ] **Step 5: Commit any verification fixes**

```bash
git add <only the files you fixed>
git commit -m "fix: finish curriculum and sessions verification"
```

Skip this step if nothing changed.
