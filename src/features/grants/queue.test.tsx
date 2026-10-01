import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("./actions", () => ({
  listGrantsAction: vi.fn(),
  exportGrantsAction: vi.fn(),
  createGrantApplicationAction: vi.fn(),
  listGrantRecommendationsAction: vi.fn(async () => ({ success: true, data: [] })),
}));
vi.mock("@/features/participants/actions", () => ({ listParticipantsAction: vi.fn() }));
import { listParticipantsAction } from "@/features/participants/actions";
import {
  createGrantApplicationAction,
  listGrantRecommendationsAction,
  listGrantsAction,
} from "./actions";
import { GrantsContent } from "./components";

afterEach(() => {
  cleanup();
  push.mockClear();
});

const row = {
  id: 2,
  applicant: "Rehema Karisa",
  project: "WEE business grants",
  pillarId: 2,
  status: "PREPARED",
  requestedAmount: "KES 120,000",
  grantType: "one_off",
  createdAt: "2026-09-01T00:00:00.000Z",
};

function renderQueue() {
  render(
    <GrantsContent
      heading={{
        title: "Grants",
        section: "Records",
        description: "WEE business grants and WRO sub-grants",
      }}
      initial={{ items: [row], page: 1, pageSize: 25, totalItems: 1, totalPages: 1 }}
      pillars={[{ id: 2, name: "WEE" }]}
      canExport
    />
  );
}

it("frames applications in the design's queue card", () => {
  renderQueue();
  const header = screen
    .getByRole("heading", { level: 1, name: "Grants" })
    .closest("[data-page-heading]") as HTMLElement;
  expect(within(header).getByRole("button", { name: /Export CSV/ })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Applications queue" })).toBeInTheDocument();
  expect(screen.getByText("Click an application to work its sign-off chain")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Prepared" })).toHaveAttribute("aria-pressed", "false");
});

it("opens an application's sign-off page from its row", () => {
  renderQueue();
  fireEvent.click(screen.getByText("Rehema Karisa"));
  expect(push).toHaveBeenCalledWith("/grants/2");
});

const programmes = [
  { id: 1, name: "Jasiri business grants", pillarId: 2 },
  { id: 5, name: "WRO sub-grants", pillarId: 5 },
];
const page = { items: [row], page: 1, pageSize: 25, totalItems: 1, totalPages: 1 };
const ok = { resultCode: 200, success: true, message: "OK" };

function renderWithProgrammes() {
  render(<GrantsContent initial={page} pillars={[]} canExport={false} programmes={programmes} />);
}

it("files a new application for a participant enrolled in the programme's pillar", async () => {
  vi.mocked(listParticipantsAction).mockResolvedValue({
    ...ok,
    data: {
      items: [{ id: 12, name: "Mwadi Kyende" }],
      page: 1,
      pageSize: 100,
      totalItems: 140,
      totalPages: 2,
    },
  } as never);
  vi.mocked(createGrantApplicationAction).mockResolvedValue({ ...ok, data: { id: 9 } });
  vi.mocked(listGrantsAction).mockResolvedValue({ ...ok, data: page } as never);
  renderWithProgrammes();
  fireEvent.click(screen.getByRole("button", { name: "New application" }));
  const dialog = screen.getByRole("dialog");
  await within(dialog).findByRole("option", { name: "Mwadi Kyende · Participant #12" });
  expect(listParticipantsAction).toHaveBeenCalledWith({ pillarId: 2, page: 1, pageSize: 100 });
  expect(dialog).toHaveTextContent("Showing the first 1 of 140 participants in this pillar.");
  expect(
    within(dialog)
      .getAllByRole("option")
      .map((option) => option.textContent)
  ).toEqual(expect.arrayContaining(["One off", "Staggered by milestone", "Asset grant"]));
  fireEvent.change(within(dialog).getByLabelText("Applicant"), { target: { value: "12" } });
  fireEvent.change(within(dialog).getByLabelText("Amount requested (KES)"), {
    target: { value: "75000" },
  });
  fireEvent.change(within(dialog).getByLabelText("Business or purpose"), {
    target: { value: "Posho mill" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "File application" }));
  await waitFor(() =>
    expect(createGrantApplicationAction).toHaveBeenCalledWith({
      projectId: 1,
      participantId: 12,
      requestedAmount: 75000,
      grantType: "one_off",
      notes: "Posho mill",
    })
  );
  expect(await screen.findByText(/Application filed and marked as prepared/)).toBeInTheDocument();
});

it("leads with Skilling's recommended graduates and pre-fills their notes", async () => {
  vi.mocked(listParticipantsAction).mockResolvedValue({
    ...ok,
    data: {
      items: [
        { id: 12, name: "Mwadi Kyende" },
        { id: 4, name: "Wanjiru Achieng" },
      ],
      page: 1,
      pageSize: 100,
      totalItems: 2,
      totalPages: 1,
    },
  } as never);
  vi.mocked(listGrantRecommendationsAction).mockResolvedValueOnce({
    ...ok,
    data: [
      {
        participantId: 4,
        name: "Wanjiru Achieng",
        course: "Tailoring & design",
        acceptedOn: "2026-04-09",
        suggestedNotes: "Skilling graduate · Tailoring & design · Self-employed",
      },
    ],
  } as never);
  renderWithProgrammes();
  fireEvent.click(screen.getByRole("button", { name: "New application" }));
  const dialog = screen.getByRole("dialog");
  const group = await within(dialog).findByRole("group", { name: "Recommended by Skilling" });
  expect(within(group).getByRole("option")).toHaveTextContent(
    "Wanjiru Achieng · Tailoring & design"
  );
  // The recommended graduate is not listed twice.
  expect(within(dialog).queryByRole("option", { name: /Participant #4/ })).toBeNull();
  fireEvent.change(within(dialog).getByLabelText("Applicant"), { target: { value: "4" } });
  expect(within(dialog).getByLabelText("Business or purpose")).toHaveValue(
    "Skilling graduate · Tailoring & design · Self-employed"
  );
  fireEvent.change(screen.getByLabelText("Programme"), { target: { value: "5" } });
  await waitFor(() =>
    expect(within(dialog).queryByRole("group", { name: "Recommended by Skilling" })).toBeNull()
  );
});

it("reloads the applicants when another programme is chosen", async () => {
  vi.mocked(listParticipantsAction).mockResolvedValue({
    ...ok,
    data: { items: [], page: 1, pageSize: 100, totalItems: 0, totalPages: 0 },
  } as never);
  renderWithProgrammes();
  fireEvent.click(screen.getByRole("button", { name: "New application" }));
  fireEvent.change(screen.getByLabelText("Programme"), { target: { value: "5" } });
  await waitFor(() =>
    expect(listParticipantsAction).toHaveBeenLastCalledWith({ pillarId: 5, page: 1, pageSize: 100 })
  );
  expect(screen.getByRole("button", { name: "File application" })).toBeDisabled();
});

it("offers no New application button without a programme to file under", () => {
  renderQueue();
  expect(screen.queryByRole("button", { name: "New application" })).not.toBeInTheDocument();
});
