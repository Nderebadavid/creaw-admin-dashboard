import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { VawgWorkspace } from "./model";
import { updateLegalCaseAction } from "./actions";
import { CaseRegister } from "./components/case-register";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("./actions", () => ({
  viewCaseFileAction: vi.fn(),
  revealCaseObNumberAction: vi.fn(),
  updateLegalCaseAction: vi.fn(),
  setCourtStatusAction: vi.fn(),
  attachCaseFileAction: vi.fn(),
  openLegalCaseAction: vi.fn(),
}));
vi.mock("@/components/portal/data-actions", () => ({ auditedExportAction: vi.fn() }));

afterEach(cleanup);

const workspace: VawgWorkspace = {
  cases: [
    {
      id: 142,
      number: "CRW-VAWG-0142",
      survivor: "Faith Njeri",
      participantId: 7,
      enrollmentId: 3,
      caseType: "IPV — physical",
      caseTypeId: 2,
      route: "Court, direct",
      courtStatus: "in_hearing",
      court: "Kibera Law Courts",
      assignedOfficer: "Grace Otieno",
      nextCourtDate: "2026-10-14",
      courtFileNumber: "CR 2210/26",
      obNumber: "OB ••••/26",
      counsellor: "Mercy Achieng",
      advocate: "Judy Muthoni",
      mediationAttempted: false,
      mediationOutcome: null,
      opened: "2026-08-01",
      ruling: null,
      closed: null,
      counselling: [{ number: 1, date: "2026-08-10", counsellor: "Faith Kimani" }],
      documents: [{ id: 9, name: "P3 form" }],
      missing: ["Medical report"],
    },
  ],
  summary: { survivors: 1, openCases: 1, sessions: 1, sessionsThisQuarter: 1, concluded: 0 },
  caseTypes: [{ id: 2, name: "IPV — physical" }],
  survivors: [],
};
const allowed = { edit: true, attach: true, download: true, reveal: true, export: true };
const denied = { edit: false, attach: false, download: false, reveal: false, export: false };

function open(can: typeof allowed) {
  render(<CaseRegister workspace={workspace} can={can} />);
  fireEvent.click(screen.getByRole("button", { name: "Open CRW-VAWG-0142" }));
  return screen.getByRole("dialog");
}

describe("VAWG case register", () => {
  it("shows the reference columns in order", () => {
    render(<CaseRegister workspace={workspace} can={allowed} />);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    const wanted = ["Case", "Case type", "Court", "Officer", "Next date", "Status"];
    // The table appends an "Open" row-action column after the data columns.
    expect(headers.slice(wanted.length)).toEqual(["Open"]);
    wanted.forEach((heading, i) => expect(headers[i]).toContain(heading));
    expect(screen.getByText("Kibera Law Courts")).toBeInTheDocument();
    expect(screen.getByText("Grace Otieno")).toBeInTheDocument();
    expect(screen.getByText(/Faith Njeri/)).toBeInTheDocument();
  });

  it("searches the court and officer", () => {
    render(<CaseRegister workspace={workspace} can={allowed} />);
    const search = screen.getByRole("searchbox", { name: "Search legal case register" });
    fireEvent.change(search, { target: { value: "nowhere" } });
    expect(screen.queryByText("Kibera Law Courts")).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "grace" } });
    expect(screen.getByText("Kibera Law Courts")).toBeInTheDocument();
  });

  it("opens the record drawer with the reference header and fields", () => {
    const drawer = open(allowed);
    expect(drawer).toHaveTextContent("Legal case · VAWG");
    expect(drawer).toHaveTextContent("CRW-VAWG-0142 · Faith Njeri");
    expect(drawer).toHaveTextContent("IPV — physical · Kibera Law Courts");
    expect(drawer).toHaveTextContent("CR 2210/26");
    expect(drawer).toHaveTextContent("Grace Otieno");
    expect(drawer).toHaveTextContent("Mercy Achieng");
    expect(within(drawer).getByRole("button", { name: "Edit" })).toBeEnabled();
    expect(within(drawer).getByRole("button", { name: "Reveal OB number" })).toBeEnabled();
    expect(within(drawer).queryByRole("button", { name: /Reveal survivor/i })).toBeNull();
    for (const tab of ["Overview", "Documents & photos", "Activity"])
      expect(within(drawer).getByRole("tab", { name: new RegExp(tab) })).toBeInTheDocument();
  });

  it("opens the edit dialog and hides the drawer meanwhile", () => {
    const drawer = open(allowed);
    fireEvent.click(within(drawer).getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("dialog", { name: "Edit legal case" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /CRW-VAWG-0142/ })).not.toBeInTheDocument();
  });

  it("keeps a case's type selected when it is missing from the case type list", () => {
    const orphan = { ...workspace, caseTypes: [{ id: 5, name: "Other type" }] };
    render(<CaseRegister workspace={orphan} can={allowed} />);
    fireEvent.click(screen.getByRole("button", { name: "Open CRW-VAWG-0142" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Edit" }));
    const select = screen.getByLabelText("Case type") as HTMLSelectElement;
    expect(select.value).toBe("2");
    expect(select.selectedOptions[0]).toHaveTextContent("IPV — physical");
  });

  it("disables gated controls without permission", () => {
    const drawer = open(denied);
    expect(within(drawer).getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(within(drawer).getByRole("button", { name: "Status" })).toBeDisabled();
    expect(within(drawer).getByRole("button", { name: "Attach" })).toBeDisabled();
    expect(within(drawer).queryByRole("button", { name: "Reveal OB number" })).toBeNull();
    fireEvent.click(within(drawer).getByRole("tab", { name: /Documents/ }));
    expect(within(drawer).getByRole("button", { name: "View P3 form" })).toBeDisabled();
    expect(within(drawer).getByRole("button", { name: "Download P3 form" })).toBeDisabled();
    expect(within(drawer).getByRole("button", { name: "Attach Medical report" })).toBeDisabled();
  });

  it("restores the selected case's drawer after a successful save", async () => {
    vi.mocked(updateLegalCaseAction).mockResolvedValue({
      success: true,
      message: "Saved",
      resultCode: 0,
      data: null,
    } as Awaited<ReturnType<typeof updateLegalCaseAction>>);
    const drawer = open(allowed);
    fireEvent.click(within(drawer).getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: /CRW-VAWG-0142/ })).toBeInTheDocument()
    );
    expect(updateLegalCaseAction).toHaveBeenCalledWith(expect.objectContaining({ caseId: 142 }));
    expect(screen.queryByRole("dialog", { name: "Edit legal case" })).not.toBeInTheDocument();
  });

  it("shows the advocate in the overview, or Not assigned", () => {
    const drawer = open(allowed);
    expect(drawer).toHaveTextContent("Advocate");
    expect(drawer).toHaveTextContent("Judy Muthoni");
    cleanup();
    const unassigned = {
      ...workspace,
      cases: [{ ...workspace.cases[0], advocate: null }],
    };
    render(<CaseRegister workspace={unassigned} can={allowed} />);
    fireEvent.click(screen.getByRole("button", { name: "Open CRW-VAWG-0142" }));
    const overview = within(screen.getByRole("dialog")).getByText("Advocate").parentElement!;
    expect(overview).toHaveTextContent("Not assigned");
  });

  it("names the counsellor on counselling activity when known", () => {
    const drawer = open(allowed);
    fireEvent.click(within(drawer).getByRole("tab", { name: /Activity/ }));
    expect(drawer).toHaveTextContent("Counselling session 1 · Faith Kimani");
    cleanup();
    const unnamed = {
      ...workspace,
      cases: [
        {
          ...workspace.cases[0],
          counselling: [{ number: 1, date: "2026-08-10", counsellor: null }],
        },
      ],
    };
    render(<CaseRegister workspace={unnamed} can={allowed} />);
    fireEvent.click(screen.getByRole("button", { name: "Open CRW-VAWG-0142" }));
    const next = screen.getByRole("dialog");
    fireEvent.click(within(next).getByRole("tab", { name: /Activity/ }));
    expect(next).toHaveTextContent("Counselling session 1 logged");
  });
});
