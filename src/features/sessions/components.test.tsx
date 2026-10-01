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
import { LogSessionButton, SessionFormDialog } from "./components/session-dialogs";
import * as actions from "./actions";
import type { SessionWorkspace } from "./model";

afterEach(cleanup);
export const workspace: SessionWorkspace = {
  pillar: "srhr",
  period: "quarter",
  sessions: [
    {
      id: 2,
      activityTypeId: 4,
      activityType: "Health Talk",
      topicId: 10,
      topic: "Menstrual health",
      freeTopic: null,
      date: "2026-09-10",
      venue: "Kibera Ward Office",
      notes: "Good turnout",
      facilitator: { name: "Wanjiru Otieno", kind: "staff" },
      facilitatorRef: { kind: "staff", id: 9 },
      communityWide: true,
      attendees: [
        {
          attendanceId: 1,
          participantId: 5,
          name: "Faith Kamani",
          ward: "Laini Saba",
          added: "2026-09-10T09:00:00Z",
        },
      ],
      documents: [{ id: 9, name: "Attendance sheet", added: "2026-09-10T10:00:00Z" }],
      logged: "2026-09-10T08:00:00Z",
      updated: "2026-09-11T08:00:00Z",
    },
    {
      id: 3,
      activityTypeId: 1,
      activityType: "YSLA",
      topicId: null,
      topic: "Facility referral day",
      freeTopic: "Facility referral day",
      date: "2026-08-20",
      venue: null,
      notes: null,
      facilitator: { name: "Faith Kimani", kind: "provider" },
      facilitatorRef: { kind: "provider", id: 1 },
      communityWide: true,
      attendees: [],
      documents: [],
      logged: "2026-08-20T08:00:00Z",
      updated: "2026-08-20T08:00:00Z",
    },
  ],
  coverage: [
    {
      activityTypeId: 4,
      name: "Health Talk",
      topics: [
        {
          topicId: 10,
          name: "Menstrual health",
          sequenceNo: 1,
          sessions: 1,
          lastDelivered: "2026-09-10",
        },
        { topicId: 11, name: "Contraception", sequenceNo: 2, sessions: 0, lastDelivered: null },
      ],
      otherTopics: [],
    },
    {
      activityTypeId: 1,
      name: "YSLA",
      topics: [],
      otherTopics: [{ name: "Facility referral day", sessions: 1, lastDelivered: "2026-08-20" }],
    },
  ],
  summary: {
    sessionsHeld: 2,
    peopleReached: 1,
    topicsCovered: 1,
    topicsPlanned: 2,
    activeTypes: 2,
  },
  activityTypes: [
    { id: 4, name: "Health Talk", active: true },
    { id: 1, name: "YSLA", active: true },
  ],
  topics: [
    { id: 10, activityTypeId: 4, name: "Menstrual health", sequenceNo: 1, active: true },
    { id: 11, activityTypeId: 4, name: "Contraception", sequenceNo: 2, active: true },
  ],
  facilitators: [
    { kind: "staff", id: 9, name: "Wanjiru Otieno", detail: "CREAW staff" },
    { kind: "staff", id: 1, name: "Amina Hassan", detail: "CREAW staff" },
    { kind: "provider", id: 1, name: "Faith Kimani", detail: "Counsellor · Kibera Clinic" },
  ],
  currentUser: { id: 1, name: "Amina Hassan" },
  participants: [
    { id: 5, label: "Faith Kamani · Laini Saba" },
    { id: 6, label: "Grace Wanyi · Kibera" },
  ],
};
const all = { log: true, attach: true, download: true, export: true };

describe("session summary cards", () => {
  it("shows the four headline counts", () => {
    render(<SessionSummaryCards summary={workspace.summary} color="#000" tint="#fff" />);
    for (const label of [
      "Sessions held",
      "People reached",
      "Topics covered",
      "Active activity types",
    ])
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
    expect(within(panel).getByRole("link", { name: "This year" })).toHaveAttribute(
      "href",
      "/pillars/srhr?period=year"
    );
  });

  it("shows the register columns and filters by activity type and by a clicked topic", () => {
    render(<SessionWorkspaceView workspace={workspace} can={all} />);
    for (const heading of ["Activity type", "Topic", "Date", "Venue", "Facilitator", "Attendees"])
      expect(screen.getByRole("columnheader", { name: new RegExp(heading) })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "YSLA" }));
    expect(
      screen.queryByRole("button", { name: "Open Menstrual health, 10 Sept 2026" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.click(screen.getByRole("button", { name: "Show sessions on Menstrual health" }));
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Open Menstrual health, 10 Sept 2026" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(
      screen.getByRole("button", { name: "Open Facility referral day, 20 Aug 2026" })
    ).toBeInTheDocument();
  });

  it("returns to page 1 when a topic is picked or cleared", () => {
    const filler = Array.from({ length: 12 }, (_, i) => ({
      ...workspace.sessions[1],
      id: 100 + i,
      date: `2026-09-${String(28 - i).padStart(2, "0")}`,
    }));
    render(
      <SessionWorkspaceView
        workspace={{ ...workspace, sessions: [...filler, workspace.sessions[0]] }}
        can={all}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("button", { name: "Show sessions on Menstrual health" }));
    expect(
      screen.getByRole("button", { name: "Open Menstrual health, 10 Sept 2026" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getAllByRole("row")).toHaveLength(11);
  });

  it("hides the export when the user cannot export", () => {
    render(<SessionWorkspaceView workspace={workspace} can={{ ...all, export: false }} />);
    expect(screen.queryByRole("button", { name: /CSV/ })).not.toBeInTheDocument();
  });

  it("shows a hint when no topics are planned", () => {
    render(
      <SessionWorkspaceView
        workspace={{
          ...workspace,
          coverage: workspace.coverage.map((row) => ({ ...row, topics: [] })),
        }}
        can={all}
      />
    );
    expect(screen.getAllByText("No planned topics yet").length).toBeGreaterThan(0);
  });
});

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
    expect(drawer).toHaveTextContent("Kibera Ward Office · Wanjiru Otieno");
    expect(drawer).toHaveTextContent("Good turnout");
    for (const tab of ["Overview", "Attendance (1)", "Documents & photos (1)", "Activity"])
      expect(within(drawer).getByRole("tab", { name: tab })).toBeInTheDocument();
  });

  it("lists attendees by full name and offers add and remove", () => {
    const drawer = open();
    fireEvent.click(within(drawer).getByRole("tab", { name: "Attendance (1)" }));
    expect(drawer).toHaveTextContent("Faith Kamani");
    expect(drawer).toHaveTextContent("Laini Saba");
    expect(within(drawer).getByRole("button", { name: "Add attendee" })).toBeEnabled();
    expect(within(drawer).getByRole("button", { name: "Remove Faith Kamani" })).toBeEnabled();
  });

  it("builds the activity timeline newest first", () => {
    const drawer = open();
    fireEvent.click(within(drawer).getByRole("tab", { name: "Activity" }));
    const items = within(drawer)
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(items[0]).toMatch(/Session edited/);
    expect(items.at(-1)).toMatch(/Session logged/);
  });

  it("disables every change control without session logging, upload or download", () => {
    render(
      <SessionWorkspaceView
        workspace={workspace}
        can={{ log: false, attach: false, download: false, export: false }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Open Menstrual health/ }));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(within(drawer).getByRole("button", { name: "Attach" })).toBeDisabled();
    fireEvent.click(within(drawer).getByRole("tab", { name: "Attendance (1)" }));
    expect(within(drawer).getByRole("button", { name: "Add attendee" })).toBeDisabled();
    expect(within(drawer).getByRole("button", { name: "Remove Faith Kamani" })).toBeDisabled();
    fireEvent.click(within(drawer).getByRole("tab", { name: "Documents & photos (1)" }));
    expect(within(drawer).getByRole("button", { name: "View Attendance sheet" })).toBeDisabled();
  });
});

describe("session facilitators in the UI", () => {
  it("shows the name with a Staff or Provider tag in the register", () => {
    render(<SessionWorkspaceView workspace={workspace} can={all} />);
    const row = screen.getByRole("button", { name: /^Open Facility referral day/ }).closest("tr")!;
    expect(row).toHaveTextContent("Faith Kimani");
    expect(within(row).getByText("Provider")).toBeInTheDocument();
    const staffRow = screen.getByRole("button", { name: /^Open Menstrual health/ }).closest("tr")!;
    expect(within(staffRow).getByText("Staff")).toBeInTheDocument();
  });

  it("groups staff and providers and defaults to the current user when logging", () => {
    render(<LogSessionButton workspace={workspace} />);
    fireEvent.click(screen.getByRole("button", { name: "Log session" }));
    const select = within(screen.getByRole("dialog")).getByLabelText(
      "Facilitator"
    ) as HTMLSelectElement;
    expect([...select.querySelectorAll("optgroup")].map((g) => g.label)).toEqual([
      "CREAW staff",
      "External providers",
    ]);
    expect(select.value).toBe("staff:1");
    expect([...select.options].map((o) => o.text)).toContain(
      "Faith Kimani · Counsellor · Kibera Clinic"
    );
  });

  it("offers only Me when no facilitator options loaded", () => {
    render(<LogSessionButton workspace={{ ...workspace, facilitators: [] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Log session" }));
    const select = within(screen.getByRole("dialog")).getByLabelText(
      "Facilitator"
    ) as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual(["Me (Amina Hassan)"]);
    expect(select.value).toBe("staff:1");
  });

  it("keeps an edited session's facilitator selected when it is not among the options", () => {
    const gone = {
      ...workspace,
      facilitators: workspace.facilitators.filter((o) => o.id !== 1 || o.kind !== "provider"),
    };
    render(
      <SessionFormDialog
        open
        workspace={gone}
        session={workspace.sessions[1]}
        onClose={() => {}}
        onDone={() => {}}
      />
    );
    const select = screen.getByLabelText("Facilitator") as HTMLSelectElement;
    expect(select.value).toBe("provider:1");
    expect(select.selectedOptions[0].text).toBe("Faith Kimani");
  });

  it("does not assign the editor when a session has no facilitator", () => {
    const unassigned = { ...workspace.sessions[1], facilitatorRef: null };
    render(
      <SessionFormDialog
        open
        workspace={workspace}
        session={unassigned}
        onClose={() => {}}
        onDone={() => {}}
      />
    );
    const select = screen.getByLabelText("Facilitator") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(select.selectedOptions[0].text).toBe("Choose a facilitator");
    expect(select.required).toBe(true);
  });

  it("submits the chosen facilitator", async () => {
    render(<LogSessionButton workspace={workspace} />);
    fireEvent.click(screen.getByRole("button", { name: "Log session" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Activity type"), { target: { value: "4" } });
    fireEvent.change(within(dialog).getByLabelText("Topic"), { target: { value: "11" } });
    fireEvent.change(within(dialog).getByLabelText("Facilitator"), {
      target: { value: "provider:1" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Log session" }));
    await vi.waitFor(() =>
      expect(actions.logSessionAction).toHaveBeenCalledWith(
        expect.objectContaining({ facilitator: { kind: "provider", id: 1 } })
      )
    );
  });
});

describe("session form", () => {
  it("filters topics by the chosen activity type and needs free text for Other", async () => {
    render(<LogSessionButton workspace={workspace} />);
    fireEvent.click(screen.getByRole("button", { name: "Log session" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Activity type"), { target: { value: "4" } });
    const topic = within(dialog).getByLabelText("Topic") as HTMLSelectElement;
    expect([...topic.options].map((option) => option.text)).toEqual([
      "Menstrual health",
      "Contraception",
      "Other",
    ]);
    fireEvent.change(topic, { target: { value: "other" } });
    expect(within(dialog).getByLabelText("Describe the topic")).toBeRequired();
  });

  it("keeps a retired topic selectable when editing a session that uses it", () => {
    const retired = { ...workspace, topics: workspace.topics.filter((row) => row.id !== 10) };
    render(
      <SessionFormDialog
        open
        workspace={retired}
        session={workspace.sessions[0]}
        onClose={() => {}}
        onDone={() => {}}
      />
    );
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
        expect.objectContaining({
          pillar: "srhr",
          activityTypeId: 4,
          topicId: 11,
          topic: "",
          sessionDate: "2026-09-29",
        })
      )
    );
  });
});

describe("attendance corrections", () => {
  const openAttendance = () => {
    render(<SessionWorkspaceView workspace={workspace} can={all} />);
    fireEvent.click(screen.getByRole("button", { name: /^Open Menstrual health/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Attendance (1)" }));
  };

  it("hides the drawer while adding an attendee and offers only people not listed", async () => {
    vi.mocked(actions.addAttendeeAction).mockResolvedValue({
      success: true,
      message: "ok",
      resultCode: 201,
    } as never);
    openAttendance();
    fireEvent.click(screen.getByRole("button", { name: "Add attendee" }));
    const dialog = screen.getByRole("dialog");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    const options = [
      ...(within(dialog).getByLabelText("Participant") as HTMLSelectElement).options,
    ].map((o) => o.text);
    expect(options).toEqual(["Grace Wanyi · Kibera"]);
    fireEvent.change(within(dialog).getByLabelText("Participant"), { target: { value: "6" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add attendee" }));
    await vi.waitFor(() =>
      expect(actions.addAttendeeAction).toHaveBeenCalledWith({
        pillar: "srhr",
        sessionId: 2,
        participantId: 6,
      })
    );
  });

  it("confirms before removing an attendee", async () => {
    vi.mocked(actions.removeAttendeeAction).mockResolvedValue({
      success: true,
      message: "ok",
      resultCode: 200,
    } as never);
    openAttendance();
    fireEvent.click(screen.getByRole("button", { name: "Remove Faith Kamani" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Remove Faith Kamani from this session's attendance?");
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await vi.waitFor(() =>
      expect(actions.removeAttendeeAction).toHaveBeenCalledWith({
        pillar: "srhr",
        sessionId: 2,
        attendanceId: 1,
      })
    );
  });
});

describe("session form before a type is chosen", () => {
  it("keeps the topic empty and hides the free-text field", () => {
    render(<LogSessionButton workspace={workspace} />);
    fireEvent.click(screen.getByRole("button", { name: "Log session" }));
    const dialog = screen.getByRole("dialog");
    expect((within(dialog).getByLabelText("Topic") as HTMLSelectElement).value).toBe("");
    expect(within(dialog).queryByLabelText("Describe the topic")).not.toBeInTheDocument();
  });
});
