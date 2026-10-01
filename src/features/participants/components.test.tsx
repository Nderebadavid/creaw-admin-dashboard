import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
vi.mock("./actions", () => ({
  listParticipantsAction: vi.fn(),
  registerParticipantAction: vi.fn(),
  updateParticipantAction: vi.fn(),
  exportParticipantsAction: vi.fn(),
  loadParticipantCurriculumAction: vi.fn(),
}));
import {
  listParticipantsAction,
  loadParticipantCurriculumAction,
  registerParticipantAction,
} from "./actions";
import { ParticipantsContent } from "./components";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("announces registration failure inside the active dialog", async () => {
  vi.mocked(registerParticipantAction).mockResolvedValue({
    resultCode: 422,
    success: false,
    message: "Duplicate participant",
    data: null,
  });
  render(
    <ParticipantsContent
      initial={{ items: [], page: 1, pageSize: 25, totalItems: 0, totalPages: 0 }}
      catalog={{ pillars: [{ id: 1, name: "VAWG" }], counties: [], wards: [] }}
      grants={[{ permissionCode: "PARTICIPANT_EDIT", pillarId: 1 }]}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Register participant" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox", { name: "First name" }), {
    target: { value: "Faith" },
  });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Last name" }), {
    target: { value: "Njeri" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Register participant" }));
  await waitFor(() =>
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Duplicate participant")
  );
});

const faith = {
  id: 10,
  name: "Faith Wanjiku",
  idNumber: "••••5678",
  phoneNumber: "••••4321",
  gender: "female",
  county: "Machakos",
  countyId: 1,
  ward: "Mlolongo",
  pillarIds: [1],
  enrollments: [
    {
      id: 3,
      pillarId: 1,
      category: "Legal aid",
      currentStage: "Intake",
      status: "ACTIVE",
      date: "2026-08-01",
    },
  ],
  currentStage: "Intake",
  consentGiven: true,
  registered: "2026-08-01",
  status: "ACTIVE",
  remarks: null,
  statusDescription: null,
  updated: null,
  curriculum: null,
};

function renderRegistry() {
  render(
    <ParticipantsContent
      heading={{
        title: "Participants",
        section: "Records",
        description: "One registry across all pillars — a participant can hold several enrollments",
      }}
      initial={{ items: [faith], page: 1, pageSize: 25, totalItems: 1, totalPages: 1 }}
      catalog={{ pillars: [{ id: 1, name: "VAWG" }], counties: [], wards: [] }}
      grants={[
        { permissionCode: "PARTICIPANT_EDIT", pillarId: 1 },
        { permissionCode: "REPORT_EXPORT_CSV", pillarId: null },
      ]}
    />
  );
}

it("puts the page actions beside the heading, like the design", () => {
  renderRegistry();
  const heading = screen.getByRole("heading", { level: 1, name: "Participants" });
  const header = heading.closest("[data-page-heading]") as HTMLElement;
  expect(within(header).getByRole("button", { name: "Register participant" })).toBeInTheDocument();
  expect(within(header).getByRole("button", { name: /Export CSV/ })).toBeInTheDocument();
});

it("frames the registry in the design's list card", () => {
  renderRegistry();
  expect(screen.getByRole("heading", { name: "Participant registry" })).toBeInTheDocument();
  expect(screen.getByText("IDs and phone numbers are always masked")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "VAWG" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByText("Click a row to open the record")).toBeInTheDocument();
});

it("opens a participant in the record drawer when the row is clicked", () => {
  renderRegistry();
  fireEvent.click(screen.getByText("Faith Wanjiku"));
  const drawer = screen.getByRole("dialog", { name: "Faith Wanjiku" });
  expect(drawer).toHaveTextContent("Participant · VAWG");
  expect(within(drawer).getByText("Pillar enrollments")).toBeInTheDocument();
  expect(within(drawer).getByRole("button", { name: "Edit participant" })).toBeInTheDocument();
});

const amina = {
  ...faith,
  id: 11,
  name: "Amina Hassan",
  pillarIds: [3],
  enrollments: [{ ...faith.enrollments[0], id: 4, pillarId: 3, category: "Peer educator" }],
  curriculum: { done: 6, total: 14, lastAttended: "2026-06-01", behind: true },
};
const srhrGrants = [
  { permissionCode: "PARTICIPANT_VIEW", pillarId: 3 },
  { permissionCode: "PARTICIPANT_EDIT", pillarId: 3 },
];
function renderSrhr(grants = srhrGrants) {
  render(
    <ParticipantsContent
      initial={{ items: [faith, amina], page: 1, pageSize: 25, totalItems: 2, totalPages: 1 }}
      catalog={{ pillars: [{ id: 3, name: "SRHR" }], counties: [], wards: [] }}
      grants={grants}
    />
  );
}

it("shows curriculum progress per participant and a dash where there is none", () => {
  renderSrhr();
  const row = screen.getByText("Amina Hassan").closest("tr")!;
  expect(within(row).getByText("6/14")).toBeInTheDocument();
  expect(within(row).getByText("Behind")).toBeInTheDocument();
  const column = screen
    .getAllByRole("columnheader")
    .findIndex((header) => header.textContent === "Curriculum");
  const cells = within(screen.getByText("Faith Wanjiku").closest("tr")!).getAllByRole("cell");
  expect(cells[column]).toHaveTextContent("—");
});

it("sorts the register by curriculum progress on the server", async () => {
  vi.mocked(listParticipantsAction).mockResolvedValue({
    resultCode: 200,
    success: true,
    message: "OK",
    data: { items: [amina], page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
  });
  renderSrhr();
  fireEvent.click(screen.getByRole("button", { name: "Curriculum" }));
  await waitFor(() =>
    expect(listParticipantsAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: { by: "curriculum", order: "asc" } })
    )
  );
});

it("filters to participants who are behind, only for those who may view SRHR participants", async () => {
  vi.mocked(listParticipantsAction).mockResolvedValue({
    resultCode: 200,
    success: true,
    message: "OK",
    data: { items: [amina], page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
  });
  renderSrhr();
  fireEvent.change(screen.getByRole("combobox", { name: "Curriculum" }), {
    target: { value: "behind" },
  });
  await waitFor(() =>
    expect(listParticipantsAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ behind: true })
    )
  );
  cleanup();
  renderSrhr([{ permissionCode: "PARTICIPANT_VIEW", pillarId: 1 }]);
  expect(screen.queryByRole("combobox", { name: "Curriculum" })).not.toBeInTheDocument();
});

it("opens the curriculum in the drawer: progress, topics in order, milestones", async () => {
  vi.mocked(loadParticipantCurriculumAction).mockResolvedValue({
    resultCode: 200,
    success: true,
    message: "OK",
    data: {
      topics: [
        {
          id: 1,
          name: "Menstrual health",
          type: "Health Talk",
          sequence: 1,
          attended: "2026-06-01",
        },
        { id: 2, name: "Contraception", type: "Health Talk", sequence: 2, attended: null },
      ],
      milestones: [
        { id: 7, name: "Baseline survey", reachedAt: "2026-05-01" },
        { id: 9, name: "Graduation", reachedAt: null },
      ],
    },
  });
  renderSrhr();
  fireEvent.click(screen.getByText("Amina Hassan"));
  const drawer = screen.getByRole("dialog", { name: "Amina Hassan" });
  const section = within(drawer).getByRole("region", { name: "Curriculum" });
  expect(section).toHaveTextContent("6 of 14 topics · 43%");
  expect(within(section).getByText("Behind")).toBeInTheDocument();
  const topics = await within(section).findByRole("list", { name: "Curriculum topics" });
  expect(
    within(topics)
      .getAllByRole("listitem")
      .map((item) => item.textContent)
  ).toEqual([
    expect.stringContaining("Menstrual health"),
    expect.stringContaining("Contraception"),
  ]);
  expect(topics).toHaveTextContent("Attended 01 Jun 2026");
  expect(topics).toHaveTextContent("Not yet");
  expect(within(section).getByLabelText("Curriculum milestones")).toHaveTextContent(
    "Baseline survey01 May 2026"
  );
  expect(loadParticipantCurriculumAction).toHaveBeenCalledWith(11);
});

it("shows no curriculum section for a participant without progress", () => {
  renderSrhr();
  fireEvent.click(screen.getByText("Faith Wanjiku"));
  const drawer = screen.getByRole("dialog", { name: "Faith Wanjiku" });
  expect(within(drawer).queryByRole("region", { name: "Curriculum" })).not.toBeInTheDocument();
  expect(loadParticipantCurriculumAction).not.toHaveBeenCalled();
});
