import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { listTraineesAction, recordOutcomeAction, setRecommendationAction } from "./actions";
import { TraineeRegister } from "./components/trainee-register";
import type { TraineeView, TrainingWorkspace } from "./model";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("./actions", () => ({
  enrolTraineeAction: vi.fn(),
  updateTraineeAction: vi.fn(),
  recordOutcomeAction: vi.fn(async () => ({ success: true, resultCode: 200, message: "OK" })),
  setRecommendationAction: vi.fn(async () => ({ success: true, resultCode: 200, message: "OK" })),
  revealSalaryAction: vi.fn(),
  listTraineesAction: vi.fn(),
  loadTraineeOptionsAction: vi.fn(),
}));
vi.mock("@/components/portal/data-actions", () => ({ auditedExportAction: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const none = {
  stage: "none" as const,
  referralId: null,
  recommendedOn: null,
  decidedOn: null,
  applicationOn: null,
  awardedOn: null,
};
const base: TraineeView = {
  id: 1,
  enrollmentId: 4,
  name: "Wanjiru Achieng",
  pathway: "apprenticeship",
  course: "Tailoring & design",
  institutionId: 7,
  institution: "Mathare Skills Centre",
  trainerId: 3,
  trainer: "James Otieno",
  startDate: "2025-11-09",
  completionDate: "2026-04-02",
  status: "completed",
  workStatus: "self_employed",
  workstation: "Tailoring workshop, Mathare",
  salary: "•8000",
  lifeSkillsSessions: 2,
  recommended: true,
  handoff: {
    stage: "application_filed",
    referralId: 2,
    recommendedOn: "2026-04-02",
    decidedOn: "2026-04-09",
    applicationOn: "2026-04-20",
    awardedOn: null,
  },
  recordStatus: "ACTIVE",
  statusDescription: null,
  created: "2025-11-01T08:00:00.000Z",
  updated: "2026-04-20T08:00:00.000Z",
};
const trainees: TraineeView[] = [
  base,
  {
    ...base,
    id: 2,
    name: "Grace Wambui",
    pathway: "community_center",
    course: "ICT basics",
    institution: null,
    institutionId: null,
    trainer: null,
    trainerId: null,
    status: "ongoing",
    completionDate: null,
    workStatus: null,
    workstation: null,
    salary: null,
    recommended: false,
    handoff: none,
    lifeSkillsSessions: 0,
  },
  {
    ...base,
    id: 3,
    name: "Mercy Akinyi",
    pathway: "tvet",
    course: "Electrical installation",
    status: "completed",
    workStatus: "employed",
    recommended: true,
    handoff: { ...none, stage: "referred", referralId: 9, recommendedOn: "2026-09-02" },
  },
  {
    ...base,
    id: 4,
    name: "Halima Noor",
    pathway: "tvet",
    course: "Plumbing",
    status: "completed",
    workStatus: "seeking_work",
    salary: null,
    recommended: false,
    handoff: none,
  },
];
type ListQueryLike = import("@/lib/api/list").ListQuery;
const page = (items: TraineeView[], totalItems = items.length) => ({
  items,
  page: 1,
  pageSize: 25,
  totalItems,
  totalPages: 1,
});
const workspace: TrainingWorkspace = {
  trainees: page(trainees),
  summary: {
    enrolled: 4,
    completed: 3,
    droppedOut: 0,
    completionRate: 100,
    inWork: 2,
    inWorkRate: 67,
    recommended: 2,
    acceptedByWee: 1,
  },
};
const allowed = { edit: true, recommend: true, reveal: true, export: true };
const denied = { edit: false, recommend: false, reveal: false, export: false };

const table = () => within(screen.getByRole("table", { name: "Trainee register" }));

function open(name: string, can = allowed) {
  render(<TraineeRegister workspace={workspace} can={can} />);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Open ${name}`) }));
  return screen.getByRole("dialog");
}

describe("trainee register", () => {
  it("shows the columns in order with names, never ids", () => {
    render(<TraineeRegister workspace={workspace} can={allowed} />);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    const wanted = [
      "Trainee",
      "Pathway",
      "Course",
      "Institution",
      "Life-skills sessions",
      "Status",
      "Work outcome",
      "Grant",
      "Record",
      "Updated",
    ];
    wanted.forEach((heading, i) => expect(headers[i]).toContain(heading));
    expect(screen.getByText("Application filed")).toBeInTheDocument();
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(screen.queryByText(/#\d/)).toBeNull();
  });

  it("asks the API for the pathway, status and search the user picks", async () => {
    vi.mocked(listTraineesAction).mockImplementation((async (query: ListQueryLike) => {
      const filters = (query.filters ?? {}) as Record<string, string>;
      const rows = trainees.filter(
        (row) =>
          (!filters.pathway || row.pathway === filters.pathway) &&
          (!filters.training_status || row.status === filters.training_status) &&
          (!query.search || `${row.name} ${row.course}`.toLowerCase().includes(query.search))
      );
      return { success: true, message: "OK", data: page(rows) };
    }) as never);
    render(<TraineeRegister workspace={workspace} can={allowed} />);
    expect(listTraineesAction).not.toHaveBeenCalled();
    const chips = screen.getByRole("group", { name: "Pathway" });
    fireEvent.click(within(chips).getByRole("button", { name: "TVET" }));
    await waitFor(() =>
      expect(listTraineesAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, filters: { pathway: "tvet" } })
      )
    );
    await waitFor(() => expect(table().queryByText("Wanjiru Achieng")).toBeNull());
    expect(table().getByText("Mercy Akinyi")).toBeInTheDocument();
    fireEvent.click(within(chips).getByRole("button", { name: "All" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
      target: { value: "ongoing" },
    });
    await waitFor(() =>
      expect(listTraineesAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ filters: { training_status: "ongoing" } })
      )
    );
    expect(await table().findByText("Grace Wambui")).toBeInTheDocument();
    expect(table().queryByText("Mercy Akinyi")).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
      target: { value: "All" },
    });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search trainees" }), {
      target: { value: "tailoring" },
    });
    await waitFor(
      () =>
        expect(listTraineesAction).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: "tailoring" })
        ),
      { timeout: 2000 }
    );
    expect(await table().findByText("Wanjiru Achieng")).toBeInTheDocument();
    await waitFor(() => expect(table().queryByText("Halima Noor")).toBeNull());
  });

  it("shows the record status and when each trainee last changed", () => {
    render(<TraineeRegister workspace={workspace} can={allowed} />);
    const row = screen.getByRole("button", { name: /^Open Wanjiru Achieng/ }).closest("tr")!;
    expect(within(row).getByText("Active")).toBeInTheDocument();
    expect(within(row).getByText("20 Apr 2026")).toBeInTheDocument();
  });

  it("sorts on the server by the clicked column", async () => {
    vi.mocked(listTraineesAction).mockResolvedValue({
      success: true,
      message: "OK",
      data: page(trainees),
    } as never);
    render(<TraineeRegister workspace={workspace} can={allowed} />);
    fireEvent.click(screen.getByRole("button", { name: "Trainee" }));
    await waitFor(() =>
      expect(listTraineesAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: { by: "trainee", order: "asc" } })
      )
    );
  });
});

describe("trainee drawer", () => {
  it("shows the placement, outcome and masked salary with the three tabs", () => {
    const drawer = open("Wanjiru Achieng");
    expect(drawer).toHaveTextContent("Trainee · Skilling");
    expect(drawer).toHaveTextContent("Tailoring & design · Mathare Skills Centre");
    expect(drawer).toHaveTextContent("James Otieno");
    expect(drawer).toHaveTextContent("Self-employed");
    expect(drawer).toHaveTextContent("•8000");
    expect(within(drawer).getByRole("button", { name: "Reveal Monthly salary" })).toBeEnabled();
    for (const tab of ["Overview", "Grant hand-off", "Activity"])
      expect(within(drawer).getByRole("tab", { name: tab })).toBeInTheDocument();
  });

  it("ends the overview with the record's status and dates", () => {
    const drawer = open("Wanjiru Achieng");
    const record = within(drawer).getByRole("region", { name: "Record" });
    expect(within(record).getByText("Active")).toBeInTheDocument();
    expect(record).toHaveTextContent("Created01 Nov 2025");
    expect(record).toHaveTextContent("Last updated20 Apr 2026");
  });

  it("traces the hand-off and offers no recommend control once WEE accepted", () => {
    const drawer = open("Wanjiru Achieng");
    fireEvent.click(within(drawer).getByRole("tab", { name: "Grant hand-off" }));
    const steps = within(drawer).getByRole("list", { name: "Grant hand-off steps" });
    expect(steps).toHaveTextContent("Accepted by WEE");
    expect(steps).toHaveTextContent("Grant application filed");
    expect(steps).toHaveTextContent("Grant awarded");
    expect(steps).toHaveTextContent("Not yet");
    expect(within(drawer).queryByRole("button", { name: /Recommend for grant/ })).toBeNull();
    expect(within(drawer).queryByRole("button", { name: /Withdraw/ })).toBeNull();
  });

  it("disables recommending until training is completed, with the reason", () => {
    const button = within(open("Grace Wambui")).getByRole("button", {
      name: /Recommend for grant/,
    });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Only completed trainees can be recommended");
  });

  it("confirms a recommendation before sending it", async () => {
    const drawer = open("Halima Noor");
    fireEvent.click(within(drawer).getByRole("button", { name: /Recommend for grant/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("This sends Halima Noor to WEE as a grant referral");
    fireEvent.click(within(dialog).getByRole("button", { name: "Recommend" }));
    await waitFor(() =>
      expect(setRecommendationAction).toHaveBeenCalledWith({ traineeId: 4, recommend: true })
    );
  });

  it("offers to withdraw a pending recommendation", async () => {
    const drawer = open("Mercy Akinyi");
    fireEvent.click(within(drawer).getByRole("button", { name: /Withdraw recommendation/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Withdraw" }));
    await waitFor(() =>
      expect(setRecommendationAction).toHaveBeenCalledWith({ traineeId: 3, recommend: false })
    );
  });

  it("disables editing and recommending without permission", () => {
    const drawer = open("Halima Noor", denied);
    expect(within(drawer).getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(within(drawer).getByRole("button", { name: /Record outcome/ })).toBeDisabled();
    expect(within(drawer).getByRole("button", { name: /Recommend for grant/ })).toBeDisabled();
    expect(within(drawer).queryByRole("button", { name: "Reveal Monthly salary" })).toBeNull();
  });
});

describe("outcome dialog", () => {
  it("shows only the fields that apply to the chosen status and work status", async () => {
    const drawer = open("Grace Wambui");
    fireEvent.click(within(drawer).getByRole("button", { name: /Record outcome/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByLabelText(/Completion date/)).toBeNull();
    expect(within(dialog).queryByLabelText("Work status")).toBeNull();

    fireEvent.change(within(dialog).getByLabelText("Training status"), {
      target: { value: "completed" },
    });
    expect(within(dialog).getByLabelText("Completion date")).toBeRequired();
    expect(within(dialog).queryByLabelText("Workplace")).toBeNull();

    fireEvent.change(within(dialog).getByLabelText("Work status"), {
      target: { value: "further_training" },
    });
    expect(within(dialog).getByLabelText("Workplace")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Monthly salary (KES)")).toBeNull();

    fireEvent.change(within(dialog).getByLabelText("Work status"), {
      target: { value: "employed" },
    });
    fireEvent.change(within(dialog).getByLabelText("Completion date"), {
      target: { value: "2026-09-25" },
    });
    fireEvent.change(within(dialog).getByLabelText("Monthly salary (KES)"), {
      target: { value: "15000" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save outcome" }));
    await waitFor(() =>
      expect(recordOutcomeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          traineeId: 2,
          status: "completed",
          completionDate: "2026-09-25",
          workStatus: "employed",
          salary: 15000,
        })
      )
    );
  });

  it("never pre-fills the masked salary", () => {
    const drawer = open("Wanjiru Achieng");
    fireEvent.click(within(drawer).getByRole("button", { name: /Record outcome/ }));
    const salary = within(screen.getByRole("dialog")).getByLabelText("Monthly salary (KES)");
    expect(salary).toHaveValue(null);
    expect(salary).toHaveAttribute("placeholder", "Leave blank to keep the current value");
  });
});
