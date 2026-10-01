import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  listSurvivorsAction,
  loadCaseDetailAction,
  loadCounsellingOptionsAction,
  loadSurvivorSessionsAction,
  logCounsellingAction,
  updateCounsellingAction,
} from "./actions";
import { CaseRegister } from "./components/case-register";
import { CounsellingRegister } from "./components/counselling-register";
import type {
  CounsellingFormOptions,
  CounsellingSessionView,
  LegalCaseView,
  SurvivorCounselling,
  VawgWorkspace,
} from "./model";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("./actions", () => ({
  viewCaseFileAction: vi.fn(),
  revealCaseObNumberAction: vi.fn(),
  updateLegalCaseAction: vi.fn(),
  setCourtStatusAction: vi.fn(),
  attachCaseFileAction: vi.fn(),
  listCasesAction: vi.fn(),
  loadCaseDetailAction: vi.fn(),
  loadCaseOptionsAction: vi.fn(),
  listSurvivorsAction: vi.fn(),
  loadSurvivorSessionsAction: vi.fn(),
  loadCounsellingOptionsAction: vi.fn(),
  logCounsellingAction: vi.fn(async () => ({ success: true, resultCode: 201, message: "OK" })),
  updateCounsellingAction: vi.fn(async () => ({ success: true, resultCode: 200, message: "OK" })),
  revealCounsellingNotesAction: vi.fn(),
}));
vi.mock("@/components/portal/data-actions", () => ({ auditedExportAction: vi.fn() }));

type ListQueryLike = import("@/lib/api/list").ListQuery;
const ok = <T,>(data: T) => ({ success: true, message: "OK", data });
const page = <T,>(items: T[], totalItems = items.length) => ({
  items,
  page: 1,
  pageSize: 25,
  totalItems,
  totalPages: Math.max(1, Math.ceil(totalItems / 25)),
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
const provider = {
  counsellor: { name: "Faith Kimani", kind: "provider" as const },
  counsellorRef: { kind: "provider" as const, id: 1 },
};
const aisha: SurvivorCounselling = {
  enrollmentId: 7,
  participantId: 6,
  name: "Aisha Mohamed",
  sessionCount: 2,
  lastDate: "2026-03-10",
  lastType: "follow_up",
  lastCounsellor: { name: "Cynthia Chelimo", kind: "staff" },
  caseNumber: "CRW-VAWG-0002",
};
const halima: SurvivorCounselling = {
  enrollmentId: 13,
  participantId: 2,
  name: "Halima Noor",
  sessionCount: 1,
  lastDate: "2026-02-10",
  lastType: "psychological_first_aid",
  lastCounsellor: { name: "Faith Kimani", kind: "provider" },
  caseNumber: null,
};
const sessionsOf: Record<number, CounsellingSessionView[]> = {
  7: [session(1, 7, 1), session(2, 7, 2)],
  13: [session(3, 13, 1, provider)],
};
const legalCase: LegalCaseView = {
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
  requiresForms: false,
  status: "ACTIVE",
  statusDescription: null,
  outcomeNotes: null,
  created: null,
  updated: null,
  counselling: [],
  documents: [],
  missing: [],
};
const options: CounsellingFormOptions = {
  survivors: [
    { enrollmentId: 7, label: "Aisha Mohamed", sessionCount: 2 },
    { enrollmentId: 13, label: "Halima Noor", sessionCount: 1 },
  ],
  counsellors: [
    { kind: "staff", id: 6, name: "Cynthia Chelimo", detail: "CREAW staff" },
    { kind: "provider", id: 1, name: "Faith Kimani", detail: "Counsellor" },
  ],
};
const workspace: Pick<VawgWorkspace, "cases" | "counselling" | "currentUserId"> = {
  cases: page([legalCase]),
  counselling: page([aisha, halima]),
  currentUserId: 6,
};
const allowed = { log: true, reveal: true };
const table = () => within(screen.getByRole("table", { name: "Counselling register" }));

beforeEach(() => {
  vi.mocked(listSurvivorsAction).mockResolvedValue(ok(page([aisha, halima])) as never);
  vi.mocked(loadSurvivorSessionsAction).mockImplementation((async (id: number) =>
    ok(sessionsOf[id] ?? [])) as never);
  vi.mocked(loadCounsellingOptionsAction).mockResolvedValue(ok(options) as never);
  vi.mocked(loadCaseDetailAction).mockResolvedValue(
    ok({ counselling: [], documents: [], missing: [] }) as never
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function openSurvivor(name: string, can = allowed) {
  render(<CounsellingRegister workspace={workspace} can={can} />);
  fireEvent.click(screen.getByRole("button", { name: `Open counselling for ${name}` }));
  const drawer = screen.getByRole("dialog");
  await within(drawer).findAllByRole("article");
  return drawer;
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
    expect(listSurvivorsAction).not.toHaveBeenCalled();
  });

  it("asks the API for survivors with or without a legal case, and for searches and sorts", async () => {
    vi.mocked(listSurvivorsAction).mockImplementation((async (query: ListQueryLike) => {
      const filters = (query.filters ?? {}) as Record<string, string>;
      const rows = [aisha, halima].filter(
        (row) => !filters.has_legal_case || (filters.has_legal_case === "true") === !!row.caseNumber
      );
      return ok(page(rows));
    }) as never);
    render(<CounsellingRegister workspace={workspace} can={allowed} />);
    const chips = screen.getByRole("group", { name: "Legal case" });
    fireEvent.click(within(chips).getByRole("button", { name: "Counselling only" }));
    await waitFor(() =>
      expect(listSurvivorsAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, filters: { has_legal_case: "false" } })
      )
    );
    await waitFor(() => expect(table().queryByText("Aisha Mohamed")).toBeNull());
    expect(table().getByText("Halima Noor")).toBeInTheDocument();
    fireEvent.click(within(chips).getByRole("button", { name: "With a legal case" }));
    await waitFor(() =>
      expect(listSurvivorsAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ filters: { has_legal_case: "true" } })
      )
    );
    fireEvent.change(screen.getByRole("searchbox", { name: "Search counselling register" }), {
      target: { value: "kimani" },
    });
    await waitFor(
      () =>
        expect(listSurvivorsAction).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: "kimani" })
        ),
      { timeout: 2000 }
    );
    fireEvent.click(screen.getByRole("button", { name: "Sessions" }));
    await waitFor(() =>
      expect(listSurvivorsAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: { by: "sessions", order: "asc" } })
      )
    );
  });
});

describe("survivor drawer", () => {
  it("loads sessions in order with masked notes and shows the linked case", async () => {
    const drawer = await openSurvivor("Aisha Mohamed");
    expect(loadSurvivorSessionsAction).toHaveBeenCalledWith(7);
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

  it("says the sessions are loading before they arrive", () => {
    render(<CounsellingRegister workspace={workspace} can={allowed} />);
    fireEvent.click(screen.getByRole("button", { name: "Open counselling for Aisha Mohamed" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Loading sessions…");
  });

  it("hides reveal and disables logging without permission", async () => {
    const drawer = await openSurvivor("Halima Noor", { log: false, reveal: false });
    expect(within(drawer).getByRole("button", { name: /Log session/ })).toBeDisabled();
    expect(within(drawer).getByRole("button", { name: "Edit session 1" })).toBeDisabled();
    expect(within(drawer).queryByRole("button", { name: /Reveal/ })).toBeNull();
  });
});

describe("counselling dialog", () => {
  it("logs the next session for the open survivor, defaulting to the signed-in counsellor", async () => {
    const drawer = await openSurvivor("Aisha Mohamed");
    fireEvent.click(within(drawer).getByRole("button", { name: /Log session/ }));
    const dialog = screen.getByRole("dialog");
    // The options load when the dialog opens.
    await within(dialog).findByRole("option", { name: "Cynthia Chelimo" });
    expect(loadCounsellingOptionsAction).toHaveBeenCalled();
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
    vi.mocked(loadCounsellingOptionsAction).mockResolvedValue(
      ok({
        ...options,
        counsellors: options.counsellors.filter((row) => row.kind === "staff"),
      }) as never
    );
    const drawer = await openSurvivor("Halima Noor");
    fireEvent.click(within(drawer).getByRole("button", { name: "Edit session 1" }));
    const dialog = screen.getByRole("dialog");
    await within(dialog).findByRole("option", { name: "Cynthia Chelimo" });
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

  it("opens from a legal case for that case's survivor", async () => {
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
    const dialog = screen.getByRole("dialog");
    await within(dialog).findByRole("option", { name: "Cynthia Chelimo" });
    expect(dialog).toHaveTextContent("This will be session 3 for Aisha Mohamed.");
  });
});
