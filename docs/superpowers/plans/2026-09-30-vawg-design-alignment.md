# VAWG Design Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the VAWG pillar page and legal-case drawer match the supplied reference while keeping every displayed field typed, permission-aware, and functional.

**Architecture:** Keep the dynamic route as a Server Component that loads pillar, submission, and VAWG workspace data in parallel, then pass serializable data into focused Client Components for the register, drawers, and dialogs. Extend the existing mock resource schema and `createVawgApi` rather than introducing display-only fixtures; reuse shared pillar, table, drawer, masked-field, and action-dialog primitives.

**Tech Stack:** Next.js 16.3 App Router, React 19.2, TypeScript 5, Tailwind CSS 4, Zod 4, Vitest 3, Testing Library, existing mock API transport.

## Global Constraints

- Preserve unrelated uncommitted work already present in the working tree.
- Read and follow `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, `node_modules/next/dist/docs/01-app/02-guides/forms.md`, and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` before production edits.
- Keep `src/app/(portal)/pillars/[pillar]/page.tsx` as a Server Component and keep stateful table/dialog behavior below explicit client boundaries.
- Authenticate, authorize, and validate again inside every Server Action.
- Survivor names stay abbreviated or masked in lists; protected values use audited reveal actions.
- Other pillar routes retain their current rendering and behavior.
- No new runtime dependency is required.

---

### Task 1: Extend the Legal-Case Resource and Workspace Mapping

**Files:**
- Modify: `src/types/db.ts`
- Modify: `src/lib/mock-api/schema.ts`
- Modify: `src/lib/mock-api/seed.ts`
- Modify: `src/lib/sensitive-fields.ts`
- Modify: `src/features/vawg/model.ts`
- Modify: `src/features/vawg/api.ts`
- Test: `src/features/vawg/api.test.ts`
- Test: `src/lib/sensitive-fields.test.ts`

**Interfaces:**
- Produces: `LegalCaseView` fields `court`, `assignedOfficer`, `nextCourtDate`, `courtFileNumber`, `obNumber`, and `counsellor`, each `string | null`.
- Produces: `createVawgApi(...).updateCase(caseId, values)` and `.revealCaseField(caseId, field)`.
- Consumes: existing `/pillars/vawg?table=legal_case` resource reads and PATCH writes.

- [ ] **Step 1: Write failing workspace and sensitivity tests**

Add assertions that describe the exact mapped contract:

```ts
it("maps the court record fields used by the register and drawer", async () => {
  const { cases } = await apiFor(1).workspace();
  expect(cases[0]).toMatchObject({
    court: "Kibera Law Courts",
    assignedOfficer: "Cynthia Chelimo",
    nextCourtDate: "2026-10-03",
    courtFileNumber: "CR 2210/26",
    obNumber: expect.stringMatching(/•+2026$/),
    counsellor: "Mary Achola",
  });
});
```

In `src/lib/sensitive-fields.test.ts`, assert:

```ts
expect(isSensitiveField("legal_case", "ob_number")).toBe(true);
expect(maskSensitiveValue("OB/44/2026")).toMatch(/•+2026$/);
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
yarn test:run src/features/vawg/api.test.ts src/lib/sensitive-fields.test.ts
```

Expected: FAIL because the six fields and `ob_number` sensitivity declaration do not exist.

- [ ] **Step 3: Extend the database, mock resource, seed, and view types**

Add this contract to `LegalCase` in `src/types/db.ts`, matching nullable schema fields:

```ts
court_name: string | null;
assigned_officer: string | null;
next_court_date: string | null;
court_file_number: string | null;
ob_number: string | null;
counsellor: string | null;
```

Add corresponding schema definitions to `legal_case` in `src/lib/mock-api/schema.ts`; use a nullable date string for `next_court_date`, and nullable strings with maximum lengths of 160, 160, 80, 80, and 160 for `court_name`, `assigned_officer`, `court_file_number`, `ob_number`, and `counsellor`. Add `ob_number` to `SENSITIVE_FIELDS.legal_case`.

Seed legal cases with the reference values, using `null` when a row has no value. Extend `LegalCaseView` with:

```ts
court: string | null;
assignedOfficer: string | null;
nextCourtDate: string | null;
courtFileNumber: string | null;
obNumber: string | null;
counsellor: string | null;
```

- [ ] **Step 4: Map and expose the fields in `createVawgApi`**

Extend `caseSchema` with the six nullable fields and map them verbatim into `LegalCaseView`:

```ts
court: row.court_name,
assignedOfficer: row.assigned_officer,
nextCourtDate: row.next_court_date,
courtFileNumber: row.court_file_number,
obNumber: row.ob_number,
counsellor: row.counsellor,
```

Add:

```ts
updateCase(caseId: number, values: Record<string, string | number | null>) {
  return client.request(
    {
      method: "PATCH",
      path: PATH,
      routeTemplate: "/pillars/:pillar",
      token,
      query: { table: "legal_case", id: caseId },
      body: values,
    },
    vawgMutationSchema
  );
},
revealCaseField(caseId: number, field: "ob_number") {
  return client.request(
    {
      method: "GET",
      path: PATH,
      routeTemplate: "/pillars/:pillar",
      token,
      query: { table: "legal_case", id: caseId, field, reveal: true },
    },
    createEnvelopeSchema(z.union([z.object({ value: z.string() }), z.null()]))
  );
},
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: all selected tests pass with zero failures.

- [ ] **Step 6: Commit the data contract**

```bash
git add src/types/db.ts src/lib/mock-api/schema.ts src/lib/mock-api/seed.ts src/lib/sensitive-fields.ts src/lib/sensitive-fields.test.ts src/features/vawg/model.ts src/features/vawg/api.ts src/features/vawg/api.test.ts
git commit -m "feat: add VAWG court record fields"
```

---

### Task 2: Add Audited Edit and Reveal Actions

**Files:**
- Modify: `src/features/vawg/actions.ts`
- Modify: `src/features/vawg/components/case-dialogs.tsx`
- Test: `src/features/vawg/actions.test.ts`

**Interfaces:**
- Consumes: `createVawgApi(...).updateCase` and `.revealCaseField` from Task 1.
- Produces: `updateLegalCaseAction(input)` returning `ActionResult`.
- Produces: `revealCaseObNumberAction(caseId)` returning `RevealResult`.
- Produces: `EditCaseDialog` accepting `legalCase`, `caseTypes`, `onClose`, and `onDone`.

- [ ] **Step 1: Write failing action tests**

Create `src/features/vawg/actions.test.ts` using the session mocks from other action tests and assert:

```ts
it("updates the editable court fields", async () => {
  const result = await updateLegalCaseAction({
    caseId: 1,
    caseTypeId: 2,
    court: "Kibera Law Courts",
    courtFileNumber: "CR 2210/26",
    obNumber: "OB/44/2026",
    assignedOfficer: "Cynthia Chelimo",
    counsellor: "Mary Achola",
    nextCourtDate: "2026-10-03",
  });
  expect(result.success).toBe(true);
  expect(getMockStore().legal_case[0]).toMatchObject({
    court_name: "Kibera Law Courts",
    ob_number: "OB/44/2026",
  });
});

it("audits revealing the OB number", async () => {
  const result = await revealCaseObNumberAction(1);
  expect(result).toEqual({ success: true, value: "OB/44/2026" });
  expect(getMockStore().audit_logs.at(-1)?.action).toBe("SENSITIVE_REVEAL");
});
```

Add a scoped-user test expecting a forbidden update and unchanged case data.

- [ ] **Step 2: Run the action test and verify RED**

Run:

```bash
yarn test:run src/features/vawg/actions.test.ts
```

Expected: FAIL because the actions are not exported.

- [ ] **Step 3: Implement validated, authorized actions**

Define one Zod input schema with `caseId`, `caseTypeId`, trimmed nullable strings, and an ISO-date check for `nextCourtDate`. Re-check `CASE_EDIT` before `updateCase`; re-check `SENSITIVE_REVEAL` before `revealCaseField`; return the existing `actionResult` format for updates and `RevealResult` for reveal errors. Revalidate `/pillars/vawg` after a successful update.

Map UI values to API columns exactly:

```ts
{
  case_type_id: parsed.data.caseTypeId,
  court_name: parsed.data.court,
  court_file_number: parsed.data.courtFileNumber,
  ob_number: parsed.data.obNumber,
  assigned_officer: parsed.data.assignedOfficer,
  counsellor: parsed.data.counsellor,
  next_court_date: parsed.data.nextCourtDate,
}
```

- [ ] **Step 4: Implement `EditCaseDialog`**

Use `ActionDialog`, `useActionSubmit`, and existing field classes. The form contains case type, court, court-file number, OB number, assigned officer, counsellor, and next court date. Submit `updateLegalCaseAction` and report `${legalCase.number} updated` on success. Empty optional strings become `null` in the action schema.

- [ ] **Step 5: Run action tests and verify GREEN**

Run the command from Step 2. Expected: all VAWG action tests pass.

- [ ] **Step 6: Commit the mutation flow**

```bash
git add src/features/vawg/actions.ts src/features/vawg/actions.test.ts src/features/vawg/components/case-dialogs.tsx
git commit -m "feat: edit and reveal VAWG case details"
```

---

### Task 3: Wire the Dedicated VAWG Page Composition

**Files:**
- Modify: `src/app/(portal)/pillars/[pillar]/page.tsx`
- Modify: `src/features/pillars/components.tsx`
- Modify: `src/features/pillars/api.ts`
- Create: `src/features/vawg/components/summary-cards.tsx`
- Use: `src/features/vawg/components/heading-actions.tsx`
- Use: `src/features/vawg/components/case-register.tsx`
- Test: `src/app/(portal)/pillars/[pillar]/page.test.tsx`
- Test: `src/features/pillars/components.test.tsx`

**Interfaces:**
- Consumes: `vawgApi.workspace()`, `CaseRegister`, `VawgHeadingActions`, and the existing `PillarContent` extension points.
- Produces: `VawgSummaryCards({ summary, color, tint })`.
- Preserves: generic pillar behavior when `code !== "vawg"`.

- [ ] **Step 1: Write failing route-composition tests**

Mock the APIs and render the async page for `vawg`. Assert the result contains:

```ts
expect(html).toContain("Open legal case");
expect(html).toContain("Survivors supported");
expect(html).toContain("Open legal cases");
expect(html).toContain("Counselling sessions");
expect(html).toContain("Cases concluded");
expect(html).toContain("Legal case register");
```

Render a non-VAWG pillar and assert it still contains the generic `Programme records` card and does not contain `Open legal case`.

- [ ] **Step 2: Run the route and pillar tests and verify RED**

Run:

```bash
yarn test:run 'src/app/(portal)/pillars/[pillar]/page.test.tsx' src/features/pillars/components.test.tsx
```

Expected: the VAWG assertions fail because the route still renders the generic register.

- [ ] **Step 3: Implement VAWG summary cards**

Create four `MetricCard` instances in a responsive grid, using `Users`, `Scale`, `Brain`, and `CircleCheck` icons. Map values exactly:

```ts
summary.survivors
summary.openCases
summary.sessions
summary.concluded
```

Use `summary.sessionsThisQuarter` in the counselling detail badge and keep all labels identical to the reference.

- [ ] **Step 4: Load the workspace in the Server Component and inject VAWG slots**

When `code.data === "vawg"`, load `vawgApi.workspace()` in the same `Promise.all` as pillar and submissions. Pass:

```tsx
kpis={<VawgSummaryCards summary={workspace.summary} color={pillar.color} tint={pillar.tint} />}
register={<CaseRegister workspace={workspace} can={vawgPermissions} />}
headingActions={
  <VawgHeadingActions
    workspace={workspace}
    canExport={vawgPermissions.export}
    canOpenCase={vawgPermissions.edit}
  >
    {canCreate ? <PillarCreateButton code="vawg" name={pillar.name} variant="outline" /> : null}
  </VawgHeadingActions>
}
```

Set the heading description to `${pillar.name} pillar · lead ${pillar.leadName ?? "not assigned"}` for VAWG. Keep the existing generic props for every other code.

- [ ] **Step 5: Run the route and component tests and verify GREEN**

Run the command from Step 2. Expected: selected tests pass with no generic-pillar regression.

- [ ] **Step 6: Commit the page composition**

```bash
git add 'src/app/(portal)/pillars/[pillar]/page.tsx' 'src/app/(portal)/pillars/[pillar]/page.test.tsx' src/features/pillars/components.tsx src/features/pillars/components.test.tsx src/features/pillars/api.ts src/features/vawg/components/summary-cards.tsx src/features/vawg/components/heading-actions.tsx
git commit -m "feat: compose the VAWG pillar workspace"
```

---

### Task 4: Match the Register and Record Drawer

**Files:**
- Modify: `src/features/vawg/components/case-register.tsx`
- Modify: `src/features/vawg/components/case-drawer.tsx`
- Modify: `src/features/vawg/components/case-dialogs.tsx`
- Modify: `src/components/ui/record-drawer.tsx`
- Test: `src/features/vawg/components.test.tsx`
- Test: `src/components/ui/record-drawer.test.tsx`

**Interfaces:**
- Consumes: Task 1 `LegalCaseView`, Task 2 edit/reveal actions, and existing shared table/drawer primitives.
- Produces: the reference table columns and a 600px desktop drawer with Overview, Documents & photos, and Activity tabs.

- [ ] **Step 1: Write failing interaction and content tests**

Render a workspace containing one case and assert:

```ts
for (const heading of ["Case", "Case type", "Court", "Officer", "Next date", "Status"])
  expect(screen.getByRole("columnheader", { name: new RegExp(heading) })).toBeInTheDocument();

fireEvent.click(screen.getByRole("button", { name: "Open CRW-VAWG-0142" }));
const drawer = screen.getByRole("dialog");
expect(drawer).toHaveTextContent("CRW-VAWG-0142 · Faith N.");
expect(drawer).toHaveTextContent("IPV — physical · Kibera Law Courts");
expect(drawer).toHaveTextContent("CR 2210/26");
expect(within(drawer).getByRole("button", { name: "Edit" })).toBeEnabled();
expect(within(drawer).getByRole("button", { name: "Reveal OB number" })).toBeEnabled();
```

Add a permission test where Edit, Status, Attach, Reveal, and download controls are disabled or absent according to the `can` flags.

- [ ] **Step 2: Run component tests and verify RED**

Run:

```bash
yarn test:run src/features/vawg/components.test.tsx src/components/ui/record-drawer.test.tsx
```

Expected: FAIL on missing reference columns, fields, and Edit action.

- [ ] **Step 3: Replace the register columns and search projection**

Use the exact ordered columns:

```ts
const columns: DataColumn<LegalCaseView>[] = [caseColumn, caseTypeColumn, courtColumn, officerColumn, nextDateColumn, statusColumn];
```

Render `court ?? "—"`, `assignedOfficer ?? "Not assigned"`, and `nextCourtDate ? formatDate(nextCourtDate) : "Pending"`. Search the concatenated case number, survivor, case type, court, officer, next date, and status label.

- [ ] **Step 4: Match the drawer header and overview**

Pass `subtitle={`${legalCase.caseType} · ${legalCase.court ?? "Court not assigned"}`}`. Add an outline Edit button before Status and Attach. Replace the overview grid with the reference fields and render OB number through:

```tsx
<MaskedField
  label="OB number"
  maskedValue={legalCase.obNumber ?? "—"}
  revealAction={
    can.reveal && legalCase.obNumber
      ? () => revealCaseObNumberAction(legalCase.id)
      : undefined
  }
/>
```

Keep the linked participant, documents, missing-file warnings, audited view/download controls, and activity timeline.

- [ ] **Step 5: Wire the edit modal state**

Extend register modal state with `{ kind: "edit" }`; hide the drawer while an action dialog is open; render `EditCaseDialog` with case types; refresh and restore the selected case after a successful save.

- [ ] **Step 6: Tune the shared drawer to the reference dimensions without affecting other drawers**

Keep the existing `w-[min(600px,100vw)]`, full-height positioning, overlay, and responsive behavior. Adjust only spacing, tab border, header/action wrapping, and panel background values verified against the screenshot. Add or update `RecordDrawer` tests for accessible tab selection and close behavior.

- [ ] **Step 7: Run component tests and verify GREEN**

Run the command from Step 2. Expected: all selected tests pass.

- [ ] **Step 8: Commit the register and drawer alignment**

```bash
git add src/features/vawg/components/case-register.tsx src/features/vawg/components/case-drawer.tsx src/features/vawg/components/case-dialogs.tsx src/features/vawg/components.test.tsx src/components/ui/record-drawer.tsx src/components/ui/record-drawer.test.tsx
git commit -m "feat: align the VAWG case register and drawer"
```

---

### Task 5: Complete Automated and Visual Verification

**Files:**
- Modify only files required to fix failures attributable to Tasks 1–4.

**Interfaces:**
- Consumes: the completed VAWG workspace.
- Produces: fresh evidence for tests, types, lint, build, desktop fidelity, and narrow-screen usability.

- [ ] **Step 1: Run all VAWG-focused tests**

```bash
yarn test:run src/features/vawg src/features/pillars/components.test.tsx 'src/app/(portal)/pillars/[pillar]/page.test.tsx' src/components/ui/record-drawer.test.tsx src/lib/sensitive-fields.test.ts
```

Expected: all selected tests pass with zero failures.

- [ ] **Step 2: Run the complete test suite**

```bash
yarn test:run
```

Expected: zero failed test files and zero failed tests.

- [ ] **Step 3: Run static checks**

```bash
yarn typecheck
yarn lint
```

Expected: both commands exit 0 without errors.

- [ ] **Step 4: Run the production build**

```bash
yarn build
```

Expected: Next.js production compilation and route generation complete with exit code 0.

- [ ] **Step 5: Verify the desktop page and drawer in Chrome**

Open `http://localhost:3000/pillars/vawg`, sign in with the repository's demo account, and compare against the supplied reference. Confirm the heading actions, chips, hero, KPI row, overview panels, table columns, drawer width, header, tabs, fields, actions, and dimmed overlay are materially aligned. Open a case and capture the page and drawer states for evidence.

- [ ] **Step 6: Verify narrow-screen behavior**

Set a mobile-width viewport, reload, open a case, and confirm the drawer fills the viewport without clipped actions, tabs, fields, or close control. Reset the viewport override afterwards.

- [ ] **Step 7: Review the final diff and commit verification fixes**

```bash
git diff --check
git status --short
git diff --stat
```

Confirm unrelated pre-existing changes remain intact. If verification required code changes, stage only those task files and commit them with:

```bash
git commit -m "fix: finish VAWG visual alignment"
```
