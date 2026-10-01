import { createElement } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { revealCaseObNumberAction, updateLegalCaseAction } from "./actions";
import { EditCaseDialog } from "./components/case-dialogs";
import type { LegalCaseView } from "./model";

const editableCase = {
  caseId: 1,
  caseTypeId: 2,
  court: "Kibera Law Courts",
  courtFileNumber: "CR 2210/26",
  obNumber: "OB/44/2026",
  assignedOfficer: "Cynthia Chelimo",
  counsellor: "Mary Achola",
  nextCourtDate: "2026-10-03",
};

beforeEach(() => {
  resetMockStore();
  cookieStore.get.mockReset();
  cookieStore.get.mockReturnValue({ value: issueMockToken(1) });
});
afterEach(cleanup);

describe("VAWG case actions", () => {
  it("updates the editable court fields", async () => {
    const result = await updateLegalCaseAction(editableCase);
    expect(result.success).toBe(true);
    expect(getMockStore().legal_case[0]).toMatchObject({
      case_type_id: 2,
      court_name: "Kibera Law Courts",
      court_file_number: "CR 2210/26",
      ob_number: "OB/44/2026",
      assigned_officer: "Cynthia Chelimo",
      counsellor: "Mary Achola",
      next_court_date: "2026-10-03",
    });
  });

  it("audits revealing the OB number", async () => {
    const result = await revealCaseObNumberAction(1);
    expect(result).toEqual({ success: true, value: "OB/44/2026" });
    expect(getMockStore().audit_logs.at(-1)?.action).toBe("REVEAL");
  });

  it("forbids a scoped user from updating a case outside their pillar", async () => {
    cookieStore.get.mockReturnValue({ value: issueMockToken(3) });
    const original = { ...getMockStore().legal_case[0] };
    const result = await updateLegalCaseAction(editableCase);
    expect(result.resultCode).toBe(403);
    expect(getMockStore().legal_case[0]).toEqual(original);
  });

  it("trims editable text and clears empty optional fields", async () => {
    const result = await updateLegalCaseAction({
      ...editableCase,
      court: "  Kibera Law Courts  ",
      courtFileNumber: "  ",
      assignedOfficer: null,
      counsellor: "",
      nextCourtDate: "",
    });
    expect(result.success).toBe(true);
    expect(getMockStore().legal_case[0]).toMatchObject({
      court_name: "Kibera Law Courts",
      court_file_number: null,
      assigned_officer: null,
      counsellor: null,
      next_court_date: null,
    });
  });

  it("preserves the stored OB number when the edit field is blank", async () => {
    const result = await updateLegalCaseAction({ ...editableCase, obNumber: "" });
    expect(result.success).toBe(true);
    expect(getMockStore().legal_case[0].ob_number).toBe("OB/44/2026");
  });

  it("rejects a masked OB token without changing the stored number", async () => {
    const original = { ...getMockStore().legal_case[0] };
    const result = await updateLegalCaseAction({ ...editableCase, obNumber: "••••2026" });
    expect(result.resultCode).toBe(422);
    expect(getMockStore().legal_case[0]).toEqual(original);
  });

  it("rejects a malformed court date without changing the case", async () => {
    const original = { ...getMockStore().legal_case[0] };
    const result = await updateLegalCaseAction({ ...editableCase, nextCourtDate: "03/10/2026" });
    expect(result.resultCode).toBe(422);
    expect(getMockStore().legal_case[0]).toEqual(original);
  });

  it("says so when a case has no OB number to reveal", async () => {
    getMockStore().legal_case[0].ob_number = null;
    expect(await revealCaseObNumberAction(1)).toEqual({
      success: false,
      error: "No OB number recorded",
    });
  });

  it("forbids a scoped user from revealing the OB number", async () => {
    cookieStore.get.mockReturnValue({ value: issueMockToken(3) });
    const audits = getMockStore().audit_logs.length;
    expect(await revealCaseObNumberAction(1)).toEqual({
      success: false,
      error: "Permission denied",
    });
    expect(getMockStore().audit_logs).toHaveLength(audits);
  });
});

it("shows the editable case fields with current court details", async () => {
  const legalCase = {
    id: 1,
    number: "CRW-VAWG-0001",
    survivor: "F. N.",
    caseType: "IPV",
    caseTypeId: 2,
    court: "Kibera Law Courts",
    courtFileNumber: "CR 2210/26",
    obNumber: "••••2026",
    assignedOfficer: "Cynthia Chelimo",
    counsellor: "Mary Achola",
    nextCourtDate: "2026-10-03",
  } as LegalCaseView;
  render(
    createElement(EditCaseDialog, {
      legalCase,
      onClose: vi.fn(),
      onDone: vi.fn(),
    })
  );
  // The case types load when the dialog opens.
  await screen.findAllByRole("option", { name: getMockStore().case_type[0].name });
  expect(screen.getByRole("dialog", { name: "Edit legal case" })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Case type" })).toHaveValue("2");
  expect(screen.getByRole("textbox", { name: "Court" })).toHaveValue("Kibera Law Courts");
  expect(screen.getByRole("textbox", { name: "Court file number" })).toHaveValue("CR 2210/26");
  expect(screen.getByRole("textbox", { name: "OB number" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Assigned officer" })).toHaveValue("Cynthia Chelimo");
  expect(screen.getByRole("textbox", { name: "Counsellor" })).toHaveValue("Mary Achola");
  expect(screen.getByLabelText("Next court date")).toHaveValue("2026-10-03");
});

it("selects the case type by ID when labels are duplicated", async () => {
  const store = getMockStore();
  const twin = { ...store.case_type[0], id: 900 };
  store.case_type.push(twin);
  const legalCase = {
    id: 1,
    number: "CRW-VAWG-0001",
    survivor: "F. N.",
    caseType: twin.name,
    caseTypeId: 900,
  } as LegalCaseView;
  render(
    createElement(EditCaseDialog, {
      legalCase,
      onClose: vi.fn(),
      onDone: vi.fn(),
    })
  );
  await waitFor(() => expect(screen.getAllByRole("option", { name: twin.name })).toHaveLength(2));
  expect(screen.getByRole("combobox", { name: "Case type" })).toHaveValue("900");
});
