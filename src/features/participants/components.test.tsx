import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
vi.mock("./actions", () => ({
  listParticipantsAction: vi.fn(),
  registerParticipantAction: vi.fn(),
  updateParticipantAction: vi.fn(),
  revealParticipantAction: vi.fn(),
  exportParticipantsAction: vi.fn(),
}));
import { registerParticipantAction } from "./actions";
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
  expect(screen.getByText("IDs masked — reveal inside a record (logged)")).toBeInTheDocument();
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
