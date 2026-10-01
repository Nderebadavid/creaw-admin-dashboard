import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { CaseDetail, LegalCaseView, VawgWorkspace } from "./model";
import {
  listCasesAction,
  loadCaseDetailAction,
  loadCaseOptionsAction,
  updateLegalCaseAction,
} from "./actions";
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
  listCasesAction: vi.fn(),
  loadCaseDetailAction: vi.fn(),
  loadCaseOptionsAction: vi.fn(),
  loadCounsellingOptionsAction: vi.fn(),
  logCounsellingAction: vi.fn(),
  updateCounsellingAction: vi.fn(),
}));
vi.mock("@/components/portal/data-actions", () => ({ auditedExportAction: vi.fn() }));

const legalCase: LegalCaseView = {
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
  requiresForms: false,
  status: "ACTIVE",
  statusDescription: null,
  outcomeNotes: null,
  created: "2026-08-01T08:00:00Z",
  updated: "2026-09-01T08:00:00Z",
  counselling: [],
  documents: [],
  missing: [],
};
const detail: CaseDetail = {
  counselling: [{ number: 1, date: "2026-08-10", counsellor: "Faith Kimani" }],
  documents: [{ id: 9, name: "P3 form" }],
  missing: ["Medical report"],
};
const page = (items: LegalCaseView[], totalItems = items.length) => ({
  items,
  page: 1,
  pageSize: 25,
  totalItems,
  totalPages: Math.max(1, Math.ceil(totalItems / 25)),
});
const workspace: Pick<VawgWorkspace, "cases" | "counselling" | "currentUserId"> = {
  cases: page([legalCase]),
  counselling: null,
  currentUserId: null,
};
const allowed = { edit: true, attach: true, download: true, reveal: true, export: true };
const denied = { edit: false, attach: false, download: false, reveal: false, export: false };
type ListQueryLike = import("@/lib/api/list").ListQuery;
const ok = <T,>(data: T) => ({ success: true, message: "OK", data });

beforeEach(() => {
  vi.mocked(listCasesAction).mockResolvedValue(ok(page([legalCase])) as never);
  vi.mocked(loadCaseDetailAction).mockResolvedValue(ok(detail) as never);
  vi.mocked(loadCaseOptionsAction).mockResolvedValue(
    ok({ survivors: [], caseTypes: [{ id: 2, name: "IPV — physical" }] }) as never
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Opens the case's drawer and waits for its counselling and files to load. */
async function open(can: typeof allowed, source = workspace) {
  render(<CaseRegister workspace={source} can={can} />);
  fireEvent.click(screen.getByRole("button", { name: "Open CRW-VAWG-0142" }));
  const drawer = screen.getByRole("dialog");
  await within(drawer).findByRole("tab", { name: "Documents & photos (2)" });
  return drawer;
}

describe("VAWG case register", () => {
  it("shows the reference columns in order from the page the server rendered", () => {
    render(<CaseRegister workspace={workspace} can={allowed} />);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    const wanted = ["Case", "Case type", "Court", "Officer", "Next date", "Status"];
    // The table appends an "Open" row-action column after the data columns.
    expect(headers.slice(wanted.length)).toEqual(["Open"]);
    wanted.forEach((heading, i) => expect(headers[i]).toContain(heading));
    expect(screen.getByText("Kibera Law Courts")).toBeInTheDocument();
    expect(screen.getByText("Grace Otieno")).toBeInTheDocument();
    expect(screen.getByText(/Faith Njeri/)).toBeInTheDocument();
    expect(listCasesAction).not.toHaveBeenCalled();
  });

  it("searches, filters by court status and sorts through the API", async () => {
    vi.mocked(listCasesAction).mockImplementation((async (query: ListQueryLike) =>
      ok(
        page(query.search === "nowhere" ? [] : [legalCase], query.search === "nowhere" ? 0 : 1)
      )) as never);
    render(<CaseRegister workspace={workspace} can={allowed} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search legal case register" }), {
      target: { value: "nowhere" },
    });
    await waitFor(
      () =>
        expect(listCasesAction).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: "nowhere", page: 1 })
        ),
      { timeout: 2000 }
    );
    await waitFor(() => expect(screen.queryByText("Kibera Law Courts")).not.toBeInTheDocument());
    fireEvent.change(screen.getByRole("searchbox", { name: "Search legal case register" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Hearing" }));
    await waitFor(() =>
      expect(listCasesAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ filters: { court_status: "in_hearing" } })
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Court" }));
    await waitFor(() =>
      expect(listCasesAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: { by: "court", order: "asc" } })
      )
    );
    expect(await screen.findByText("Kibera Law Courts")).toBeInTheDocument();
  });

  it("opens the record drawer with the reference header and fields", async () => {
    const drawer = await open(allowed);
    expect(loadCaseDetailAction).toHaveBeenCalledWith(142);
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

  it("shows the header at once and the files once they have loaded", async () => {
    render(<CaseRegister workspace={workspace} can={allowed} />);
    fireEvent.click(screen.getByRole("button", { name: "Open CRW-VAWG-0142" }));
    const drawer = screen.getByRole("dialog");
    expect(drawer).toHaveTextContent("CRW-VAWG-0142 · Faith Njeri");
    expect(within(drawer).getByRole("tab", { name: "Documents & photos" })).toBeInTheDocument();
    fireEvent.click(within(drawer).getByRole("tab", { name: "Documents & photos" }));
    expect(drawer).toHaveTextContent("Loading case files…");
    expect(await within(drawer).findByRole("button", { name: "View P3 form" })).toBeEnabled();
  });

  it("opens the edit dialog and hides the drawer meanwhile", async () => {
    const drawer = await open(allowed);
    fireEvent.click(within(drawer).getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("dialog", { name: "Edit legal case" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /CRW-VAWG-0142/ })).not.toBeInTheDocument();
  });

  it("keeps a case's type selected when it is missing from the case type list", async () => {
    vi.mocked(loadCaseOptionsAction).mockResolvedValue(
      ok({ survivors: [], caseTypes: [{ id: 5, name: "Other type" }] }) as never
    );
    const drawer = await open(allowed);
    fireEvent.click(within(drawer).getByRole("button", { name: "Edit" }));
    await screen.findByRole("option", { name: "Other type" });
    const select = screen.getByLabelText("Case type") as HTMLSelectElement;
    expect(select.value).toBe("2");
    expect(select.selectedOptions[0]).toHaveTextContent("IPV — physical");
  });

  it("disables gated controls without permission", async () => {
    const drawer = await open(denied);
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
    const drawer = await open(allowed);
    fireEvent.click(within(drawer).getByRole("button", { name: "Edit" }));
    await screen.findByRole("option", { name: "IPV — physical" });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: /CRW-VAWG-0142/ })).toBeInTheDocument()
    );
    expect(updateLegalCaseAction).toHaveBeenCalledWith(expect.objectContaining({ caseId: 142 }));
    expect(screen.queryByRole("dialog", { name: "Edit legal case" })).not.toBeInTheDocument();
    // The register and the drawer's detail reload so the saved values show.
    await waitFor(() => expect(listCasesAction).toHaveBeenCalled());
  });

  it("shows the advocate in the overview, or Not assigned", async () => {
    const drawer = await open(allowed);
    expect(drawer).toHaveTextContent("Advocate");
    expect(drawer).toHaveTextContent("Judy Muthoni");
    cleanup();
    const unassigned = { ...workspace, cases: page([{ ...legalCase, advocate: null }]) };
    render(<CaseRegister workspace={unassigned} can={allowed} />);
    fireEvent.click(screen.getByRole("button", { name: "Open CRW-VAWG-0142" }));
    const overview = within(screen.getByRole("dialog")).getByText("Advocate").parentElement!;
    expect(overview).toHaveTextContent("Not assigned");
  });

  it("names the counsellor on counselling activity when known", async () => {
    const drawer = await open(allowed);
    fireEvent.click(within(drawer).getByRole("tab", { name: /Activity/ }));
    expect(drawer).toHaveTextContent("Counselling session 1 · Faith Kimani");
    cleanup();
    vi.mocked(loadCaseDetailAction).mockResolvedValue(
      ok({ ...detail, counselling: [{ number: 1, date: "2026-08-10", counsellor: null }] }) as never
    );
    render(<CaseRegister workspace={workspace} can={allowed} />);
    fireEvent.click(screen.getByRole("button", { name: "Open CRW-VAWG-0142" }));
    const next = screen.getByRole("dialog");
    await within(next).findByRole("tab", { name: "Documents & photos (2)" });
    fireEvent.click(within(next).getByRole("tab", { name: /Activity/ }));
    expect(next).toHaveTextContent("Counselling session 1 logged");
  });
});
