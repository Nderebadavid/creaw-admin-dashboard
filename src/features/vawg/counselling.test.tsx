import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { logCounsellingAction, updateCounsellingAction } from "./actions";
import { CaseRegister } from "./components/case-register";
import { CounsellingRegister } from "./components/counselling-register";
import type { CounsellingSessionView, LegalCaseView, VawgWorkspace } from "./model";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("./actions", () => ({
  viewCaseFileAction: vi.fn(),
  revealCaseObNumberAction: vi.fn(),
  updateLegalCaseAction: vi.fn(),
  setCourtStatusAction: vi.fn(),
  attachCaseFileAction: vi.fn(),
  logCounsellingAction: vi.fn(async () => ({ success: true, resultCode: 201, message: "OK" })),
  updateCounsellingAction: vi.fn(async () => ({ success: true, resultCode: 200, message: "OK" })),
  revealCounsellingNotesAction: vi.fn(),
}));
vi.mock("@/components/portal/data-actions", () => ({ auditedExportAction: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const session = (
  id: number,
  enrollmentId: number,
  number: number,
  change: Partial<CounsellingSessionView> = {}
): CounsellingSessionView => ({
  id,
  enrollmentId,
  number,
  date: `2026-0${number + 1}-10`,
  type: number === 1 ? "psychological_first_aid" : "follow_up",
  counsellor: { name: "Cynthia Chelimo", kind: "staff" },
  counsellorRef: { kind: "staff", id: 6 },
  notes: "••••••••••••ion.",
  ...change,
});
const legalCase = {
  id: 2,
  number: "CRW-VAWG-0002",
  survivor: "Aisha Mohamed",
  participantId: 6,
  enrollmentId: 7,
  caseType: "IPV — physical",
  caseTypeId: 2,
  route: "Court, direct",
  courtStatus: "mention",
  court: null,
  assignedOfficer: null,
  nextCourtDate: null,
  courtFileNumber: null,
  obNumber: null,
  counsellor: null,
  advocate: null,
  mediationAttempted: false,
  mediationOutcome: null,
  opened: "2026-05-02",
  ruling: null,
  closed: null,
  counselling: [],
  documents: [],
  missing: [],
} satisfies LegalCaseView;
const workspace: VawgWorkspace = {
  cases: [legalCase],
  summary: { survivors: 2, openCases: 1, sessions: 3, sessionsThisQuarter: 1, concluded: 0 },
  caseTypes: [{ id: 2, name: "IPV — physical" }],
  survivors: [
    { enrollmentId: 7, label: "Aisha Mohamed" },
    { enrollmentId: 13, label: "Halima Noor" },
  ],
  counselling: [
    {
      enrollmentId: 7,
      participantId: 6,
      name: "Aisha Mohamed",
      sessions: [session(1, 7, 1), session(2, 7, 2)],
      caseNumber: "CRW-VAWG-0002",
    },
    {
      enrollmentId: 13,
      participantId: 2,
      name: "Halima Noor",
      sessions: [
        session(3, 13, 1, {
          counsellor: { name: "Faith Kimani", kind: "provider" },
          counsellorRef: { kind: "provider", id: 1 },
        }),
      ],
      caseNumber: null,
    },
  ],
  counsellors: [
    { kind: "staff", id: 6, name: "Cynthia Chelimo", detail: "CREAW staff" },
    { kind: "provider", id: 1, name: "Faith Kimani", detail: "Counsellor" },
  ],
  currentUserId: 6,
};
const allowed = { log: true, reveal: true };
const table = () => within(screen.getByRole("table", { name: "Counselling register" }));

function openSurvivor(name: string, can = allowed) {
  render(<CounsellingRegister workspace={workspace} can={can} />);
  fireEvent.click(screen.getByRole("button", { name: `Open counselling for ${name}` }));
  return screen.getByRole("dialog");
}

describe("counselling register", () => {
  it("lists each survivor with sessions, the latest counsellor and any legal case", () => {
    render(<CounsellingRegister workspace={workspace} can={allowed} />);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    ["Survivor", "Sessions", "Last session", "Counsellor", "Legal case"].forEach((heading, i) =>
      expect(headers[i]).toContain(heading)
    );
    expect(table().getByText("CRW-VAWG-0002")).toBeInTheDocument();
    expect(table().getByText("None")).toBeInTheDocument();
    expect(table().getByText("Faith Kimani")).toBeInTheDocument();
    expect(table().getByText("Provider")).toBeInTheDocument();
  });

  it("filters to survivors with or without a legal case and searches counsellors", () => {
    render(<CounsellingRegister workspace={workspace} can={allowed} />);
    const chips = screen.getByRole("group", { name: "Legal case" });
    fireEvent.click(within(chips).getByRole("button", { name: "Counselling only" }));
    expect(table().queryByText("Aisha Mohamed")).toBeNull();
    expect(table().getByText("Halima Noor")).toBeInTheDocument();
    fireEvent.click(within(chips).getByRole("button", { name: "All" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search counselling register" }), {
      target: { value: "kimani" },
    });
    expect(table().queryByText("Aisha Mohamed")).toBeNull();
  });
});

describe("survivor drawer", () => {
  it("lists sessions in order with masked notes and the linked case", () => {
    const drawer = openSurvivor("Aisha Mohamed");
    expect(drawer).toHaveTextContent("Counselling · VAWG");
    expect(drawer).toHaveTextContent("Legal case CRW-VAWG-0002");
    const sessions = within(drawer).getAllByRole("article");
    expect(sessions.map((item) => item.getAttribute("aria-label"))).toEqual([
      "Session 1",
      "Session 2",
    ]);
    expect(sessions[0]).toHaveTextContent("Psychological first aid");
    expect(sessions[0]).toHaveTextContent("Staff");
    expect(
      within(sessions[0]).getByRole("button", { name: "Reveal Session 1 notes" })
    ).toBeEnabled();
    fireEvent.click(within(drawer).getByRole("tab", { name: "Linked records" }));
    expect(drawer).toHaveTextContent("CRW-VAWG-0002");
  });

  it("hides reveal and disables logging without permission", () => {
    const drawer = openSurvivor("Halima Noor", { log: false, reveal: false });
    expect(within(drawer).getByRole("button", { name: /Log session/ })).toBeDisabled();
    expect(within(drawer).getByRole("button", { name: "Edit session 1" })).toBeDisabled();
    expect(within(drawer).queryByRole("button", { name: /Reveal/ })).toBeNull();
  });
});

describe("counselling dialog", () => {
  it("logs the next session for the open survivor, defaulting to the signed-in counsellor", async () => {
    const drawer = openSurvivor("Aisha Mohamed");
    fireEvent.click(within(drawer).getByRole("button", { name: /Log session/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("This will be session 3 for Aisha Mohamed.");
    expect(within(dialog).getByLabelText("Counsellor")).toHaveValue("staff:6");
    expect(within(dialog).getByLabelText("Session type")).toHaveValue("follow_up");
    fireEvent.change(within(dialog).getByLabelText("Notes"), { target: { value: "Check-in" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Log session" }));
    await waitFor(() =>
      expect(logCounsellingAction).toHaveBeenCalledWith(
        expect.objectContaining({
          enrollmentId: 7,
          sessionType: "follow_up",
          counsellor: { kind: "staff", id: 6 },
          notes: "Check-in",
        })
      )
    );
  });

  it("edits a session without pre-filling its masked notes and keeps a departed counsellor", async () => {
    const departed = {
      ...workspace,
      counsellors: workspace.counsellors.filter((row) => row.kind === "staff"),
    };
    render(<CounsellingRegister workspace={departed} can={allowed} />);
    fireEvent.click(screen.getByRole("button", { name: "Open counselling for Halima Noor" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit session 1" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Notes")).toHaveValue("");
    expect(within(dialog).getByLabelText("Notes")).toHaveAttribute(
      "placeholder",
      "Leave blank to keep the current notes"
    );
    expect(within(dialog).getByLabelText("Counsellor")).toHaveValue("provider:1");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(updateCounsellingAction).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 3,
          counsellor: { kind: "provider", id: 1 },
          notes: "",
        })
      )
    );
  });

  it("opens from a legal case for that case's survivor", () => {
    render(
      <CaseRegister
        workspace={workspace}
        can={{
          edit: true,
          attach: true,
          download: true,
          reveal: true,
          export: false,
          counsel: true,
        }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Open CRW-VAWG-0002" }));
    fireEvent.click(screen.getByRole("button", { name: /Log counselling/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "This will be session 3 for Aisha Mohamed."
    );
  });
});
