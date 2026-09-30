import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/pillars/srhr",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("./actions", () => ({
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
    expect(screen.getByRole("button", { name: "Open Menstrual health, 10 Sept 2026" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("button", { name: "Open Facility referral day, 20 Aug 2026" })).toBeInTheDocument();
  });

  it("returns to page 1 when a topic is picked or cleared", () => {
    const filler = Array.from({ length: 12 }, (_, i) => ({
      ...workspace.sessions[1],
      id: 100 + i,
      date: `2026-09-${String(28 - i).padStart(2, "0")}`,
    }));
    render(<SessionWorkspaceView workspace={{ ...workspace, sessions: [...filler, workspace.sessions[0]] }} can={all} />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("button", { name: "Show sessions on Menstrual health" }));
    expect(screen.getByRole("button", { name: "Open Menstrual health, 10 Sept 2026" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getAllByRole("row")).toHaveLength(11);
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
