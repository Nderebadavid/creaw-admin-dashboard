import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/features/grants/actions", () => ({
  updateAwardAction: vi.fn(),
  updateDisbursementAction: vi.fn(),
}));
vi.mock("./actions", () => ({
  listProjectsAction: vi.fn(),
  loadProjectDetailAction: vi.fn(),
  loadProjectOptionsAction: vi.fn(),
  saveProjectAction: vi.fn(),
  setProjectStatusAction: vi.fn(),
  deleteProjectAction: vi.fn(),
}));
import {
  listProjectsAction,
  loadProjectDetailAction,
  loadProjectOptionsAction,
  saveProjectAction,
  setProjectStatusAction,
  deleteProjectAction,
} from "./actions";
import { ProjectsContent } from "./components";
import { updateAwardAction, updateDisbursementAction } from "@/features/grants/actions";
import type { ProjectView } from "./api";

const jasiri: ProjectView = {
  id: 1,
  name: "Jasiri business grants",
  pillarId: 2,
  pillar: "WEE",
  donorId: 3,
  donor: "Mastercard Foundation",
  start: "2026-01-01",
  end: "2026-12-31",
  notes: "Round one",
  status: "ACTIVE",
  statusDescription: null,
  created: "2026-01-02T08:00:00.000Z",
  updated: "2026-01-05T08:00:00.000Z",
  applications: 4,
  awards: 2,
  awarded: 120000,
  disbursed: 40000,
  reportsOverdue: 2,
};
const vawg: ProjectView = {
  ...jasiri,
  id: 2,
  name: "Safe spaces",
  pillarId: 1,
  pillar: "VAWG",
  donor: null,
  donorId: null,
  applications: null,
  awards: null,
  awarded: null,
  disbursed: null,
  reportsOverdue: null,
};
const pillars = [
  { id: 1, name: "VAWG" },
  { id: 2, name: "WEE" },
];
const ok = (data: unknown) => ({ resultCode: 200, success: true, message: "OK", data });
const page = (items: ProjectView[]) =>
  ok({ items, page: 1, pageSize: 25, totalItems: items.length, totalPages: 1 });

function renderProjects(grants = [{ permissionCode: "NARRATIVE_REPORT_MANAGE", pillarId: 2 }]) {
  render(
    <ProjectsContent
      initial={{
        items: [jasiri, vawg],
        page: 1,
        pageSize: 25,
        totalItems: 2,
        totalPages: 1,
      }}
      pillars={pillars}
      grants={grants}
    />
  );
}

beforeEach(() => {
  vi.mocked(loadProjectDetailAction).mockResolvedValue(
    ok({
      applications: [
        {
          id: 7,
          applicant: "Rehema Karisa",
          amount: 45000,
          grantType: "one_off",
          status: "APPROVED",
          award: {
            id: 11,
            amount: 40000,
            payments: [{ id: 21, amount: 15000, date: "2026-05-20", notes: "First tranche" }],
          },
        },
      ],
      reports: [{ id: 3, period: "2026-04-01 – 2026-06-30", due: "2026-08-30", submitted: null }],
    }) as never
  );
  vi.mocked(loadProjectOptionsAction).mockResolvedValue(
    ok({
      pillars,
      donors: [{ id: 3, name: "Mastercard Foundation" }],
    }) as never
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("projects register", () => {
  it("shows donor, period and grant figures, and a dash where the caller may not see them", () => {
    renderProjects();
    const row = screen.getByText("Jasiri business grants").closest("tr")!;
    expect(row).toHaveTextContent("Mastercard Foundation");
    expect(row).toHaveTextContent("01 Jan 2026 – 31 Dec 2026");
    expect(row).toHaveTextContent("KES 120,000");
    expect(row).toHaveTextContent("KES 40,000");
    expect(row).toHaveTextContent("2 overdue");
    const hidden = screen.getByText("Safe spaces").closest("tr")!;
    expect(hidden).not.toHaveTextContent("KES");
    expect(hidden).toHaveTextContent("—");
  });

  it("filters by pillar and sorts through the API", async () => {
    vi.mocked(listProjectsAction).mockResolvedValue(page([jasiri]) as never);
    renderProjects();
    fireEvent.click(screen.getByRole("button", { name: "WEE" }));
    await waitFor(() =>
      expect(listProjectsAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ filters: { pillar_id: 2 } })
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Awarded" }));
    await waitFor(() =>
      expect(listProjectsAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: { by: "awarded", order: "asc" } })
      )
    );
  });

  it("opens a project with its applications and reporting periods, loaded on demand", async () => {
    renderProjects();
    expect(loadProjectDetailAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Jasiri business grants"));
    const drawer = screen.getByRole("dialog", { name: "Jasiri business grants" });
    expect(drawer).toHaveTextContent("Project · WEE");
    expect(within(drawer).getByRole("region", { name: "Record" })).toHaveTextContent("Round one");
    const link = await within(drawer).findByRole("link", { name: /Rehema Karisa/ });
    expect(link).toHaveAttribute("href", "/grants/7");
    expect(within(drawer).getByRole("region", { name: "Reporting periods" })).toHaveTextContent(
      "Not submitted"
    );
    expect(loadProjectDetailAction).toHaveBeenCalledWith(1);
  });

  it("offers new and edit only for pillars the user manages", () => {
    renderProjects([]);
    expect(screen.queryByRole("button", { name: "New project" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Jasiri business grants"));
    expect(screen.queryByRole("button", { name: "Edit project" })).not.toBeInTheDocument();
    cleanup();
    renderProjects();
    expect(screen.getByRole("button", { name: "New project" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Safe spaces"));
    expect(screen.queryByRole("button", { name: "Edit project" })).not.toBeInTheDocument();
  });

  it("creates a project for a managed pillar", async () => {
    vi.mocked(saveProjectAction).mockResolvedValue({
      resultCode: 201,
      success: true,
      message: "Created",
    } as never);
    vi.mocked(listProjectsAction).mockResolvedValue(page([jasiri, vawg]) as never);
    renderProjects();
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    const dialog = await screen.findByRole("dialog", { name: "New project" });
    await within(dialog).findByRole("option", { name: "WEE" });
    // Only the managed pillar is offered.
    expect(within(dialog).queryByRole("option", { name: "VAWG" })).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Project name"), {
      target: { value: "Amani grants" },
    });
    fireEvent.change(within(dialog).getByLabelText("Pillar"), { target: { value: "2" } });
    fireEvent.change(within(dialog).getByLabelText("Donor"), { target: { value: "3" } });
    fireEvent.change(within(dialog).getByLabelText("Start date"), {
      target: { value: "2026-03-01" },
    });
    fireEvent.change(within(dialog).getByLabelText("End date"), {
      target: { value: "2026-09-30" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create project" }));
    await waitFor(() =>
      expect(saveProjectAction).toHaveBeenCalledWith({
        id: undefined,
        pillarId: 2,
        name: "Amani grants",
        donorId: 3,
        startDate: "2026-03-01",
        endDate: "2026-09-30",
        notes: null,
      })
    );
    expect(await screen.findByText("Project created.")).toBeInTheDocument();
  });

  it("edits a project with its current values filled in", async () => {
    vi.mocked(saveProjectAction).mockResolvedValue({
      resultCode: 200,
      success: true,
      message: "OK",
    } as never);
    vi.mocked(listProjectsAction).mockResolvedValue(page([jasiri, vawg]) as never);
    renderProjects();
    fireEvent.click(screen.getByText("Jasiri business grants"));
    fireEvent.click(screen.getByRole("button", { name: "Edit project" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit project" });
    expect(within(dialog).getByLabelText("Project name")).toHaveValue("Jasiri business grants");
    expect(within(dialog).getByLabelText("End date")).toHaveValue("2026-12-31");
    fireEvent.change(within(dialog).getByLabelText("End date"), {
      target: { value: "2027-03-31" },
    });
    await within(dialog).findByRole("option", { name: "Mastercard Foundation" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(saveProjectAction).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, endDate: "2027-03-31", donorId: 3 })
      )
    );
  });

  it("edits every detail, including the pillar, status and its reason", async () => {
    vi.mocked(saveProjectAction).mockResolvedValue({
      resultCode: 200,
      success: true,
      message: "OK",
    } as never);
    vi.mocked(listProjectsAction).mockResolvedValue(page([jasiri]) as never);
    renderProjects([
      { permissionCode: "NARRATIVE_REPORT_MANAGE", pillarId: 2 },
      { permissionCode: "NARRATIVE_REPORT_MANAGE", pillarId: 1 },
    ]);
    fireEvent.click(screen.getByText("Jasiri business grants"));
    fireEvent.click(screen.getByRole("button", { name: "Edit project" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit project" });
    await within(dialog).findByRole("option", { name: "Mastercard Foundation" });
    fireEvent.change(within(dialog).getByLabelText("Project name"), {
      target: { value: "Jasiri II" },
    });
    fireEvent.change(within(dialog).getByLabelText("Pillar"), { target: { value: "1" } });
    fireEvent.change(within(dialog).getByLabelText("Donor"), { target: { value: "" } });
    fireEvent.change(within(dialog).getByLabelText("Start date"), {
      target: { value: "2026-02-01" },
    });
    fireEvent.change(within(dialog).getByLabelText("Notes"), { target: { value: "Changed" } });
    fireEvent.change(within(dialog).getByLabelText("Status"), { target: { value: "INACTIVE" } });
    fireEvent.change(within(dialog).getByLabelText("Status reason"), {
      target: { value: "Paused" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(saveProjectAction).toHaveBeenCalledWith({
        id: 1,
        pillarId: 1,
        name: "Jasiri II",
        donorId: null,
        startDate: "2026-02-01",
        endDate: "2026-12-31",
        notes: "Changed",
        status: "INACTIVE",
        statusDescription: "Paused",
      })
    );
  });

  it("deactivates a project with an optional reason, and offers reactivation for an inactive one", async () => {
    vi.mocked(setProjectStatusAction).mockResolvedValue({
      resultCode: 200,
      success: true,
      message: "OK",
    } as never);
    vi.mocked(listProjectsAction).mockResolvedValue(page([jasiri]) as never);
    renderProjects();
    fireEvent.click(screen.getByText("Jasiri business grants"));
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    const dialog = await screen.findByRole("dialog", { name: "Deactivate project" });
    fireEvent.change(within(dialog).getByLabelText("Reason (optional)"), {
      target: { value: "Funding ended" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));
    await waitFor(() =>
      expect(setProjectStatusAction).toHaveBeenCalledWith({
        id: 1,
        status: "INACTIVE",
        reason: "Funding ended",
      })
    );
    expect(await screen.findByText("Project deactivated.")).toBeInTheDocument();
    cleanup();
    render(
      <ProjectsContent
        initial={{
          items: [{ ...jasiri, status: "INACTIVE" }],
          page: 1,
          pageSize: 25,
          totalItems: 1,
          totalPages: 1,
        }}
        pillars={pillars}
        grants={[{ permissionCode: "NARRATIVE_REPORT_MANAGE", pillarId: 2 }]}
      />
    );
    fireEvent.click(screen.getByText("Jasiri business grants"));
    expect(screen.getByRole("button", { name: "Reactivate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
  });

  it("offers delete only to those with the pillar configuration permission, and confirms it", async () => {
    vi.mocked(deleteProjectAction).mockResolvedValue({
      resultCode: 200,
      success: true,
      message: "OK",
    } as never);
    vi.mocked(listProjectsAction).mockResolvedValue(page([vawg]) as never);
    renderProjects();
    fireEvent.click(screen.getByText("Jasiri business grants"));
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    cleanup();
    renderProjects([
      { permissionCode: "NARRATIVE_REPORT_MANAGE", pillarId: 2 },
      { permissionCode: "PILLAR_CONFIG_MANAGE", pillarId: 2 },
    ]);
    fireEvent.click(screen.getByText("Jasiri business grants"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete project" });
    expect(dialog).toHaveTextContent("deactivate it instead");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete project" }));
    await waitFor(() => expect(deleteProjectAction).toHaveBeenCalledWith({ id: 1 }));
    expect(await screen.findByText("Project deleted.")).toBeInTheDocument();
  });

  it("shows the API's refusal when a project cannot be deleted", async () => {
    vi.mocked(deleteProjectAction).mockResolvedValue({
      resultCode: 422,
      success: false,
      message: "This project has grant applications. Deactivate it instead of deleting it",
    } as never);
    renderProjects([
      { permissionCode: "NARRATIVE_REPORT_MANAGE", pillarId: 2 },
      { permissionCode: "PILLAR_CONFIG_MANAGE", pillarId: 2 },
    ]);
    fireEvent.click(screen.getByText("Jasiri business grants"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete project" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete project" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("has grant applications");
  });

  it("edits a grant's awarded amount and its payments from the project, by permission", async () => {
    vi.mocked(updateAwardAction).mockResolvedValue({
      resultCode: 200,
      success: true,
      message: "OK",
    } as never);
    vi.mocked(updateDisbursementAction).mockResolvedValue({
      resultCode: 200,
      success: true,
      message: "OK",
    } as never);
    vi.mocked(listProjectsAction).mockResolvedValue(page([jasiri]) as never);
    renderProjects([]);
    fireEvent.click(screen.getByText("Jasiri business grants"));
    let drawer = screen.getByRole("dialog", { name: "Jasiri business grants" });
    expect(await within(drawer).findByText("KES 40,000")).toBeInTheDocument();
    expect(
      within(drawer).queryByRole("button", { name: /Edit awarded amount/ })
    ).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: /Edit payment/ })).not.toBeInTheDocument();
    cleanup();
    renderProjects([
      { permissionCode: "GRANT_APPLICATION_APPROVE", pillarId: 2 },
      { permissionCode: "GRANT_DISBURSEMENT_RECORD", pillarId: 2 },
    ]);
    fireEvent.click(screen.getByText("Jasiri business grants"));
    drawer = screen.getByRole("dialog", { name: "Jasiri business grants" });
    fireEvent.click(
      await within(drawer).findByRole("button", { name: "Edit awarded amount for Rehema Karisa" })
    );
    const award = await screen.findByRole("dialog", { name: "Edit awarded amount" });
    const amount = within(award).getByLabelText("Awarded amount (KES)");
    expect(amount).toHaveValue(40000);
    expect(amount).toHaveAttribute("min", "15000");
    fireEvent.change(amount, { target: { value: "42000" } });
    fireEvent.click(within(award).getByRole("button", { name: "Save amount" }));
    await waitFor(() =>
      expect(updateAwardAction).toHaveBeenCalledWith({ applicationId: 7, amount: 42000 })
    );
    expect(await screen.findByText("Awarded amount updated.")).toBeInTheDocument();
    drawer = screen.getByRole("dialog", { name: "Jasiri business grants" });
    fireEvent.click(
      await within(drawer).findByRole("button", { name: "Edit payment 1 for Rehema Karisa" })
    );
    const payment = await screen.findByRole("dialog", { name: "Edit payment" });
    expect(within(payment).getByLabelText("Payment date")).toHaveValue("2026-05-20");
    fireEvent.change(within(payment).getByLabelText("Amount (KES)"), {
      target: { value: "16000" },
    });
    fireEvent.click(within(payment).getByRole("button", { name: "Save payment" }));
    await waitFor(() =>
      expect(updateDisbursementAction).toHaveBeenCalledWith({
        applicationId: 7,
        disbursementId: 21,
        amount: 16000,
        date: "2026-05-20",
        notes: "First tranche",
      })
    );
    expect(await screen.findByText("Payment updated.")).toBeInTheDocument();
  });
});
