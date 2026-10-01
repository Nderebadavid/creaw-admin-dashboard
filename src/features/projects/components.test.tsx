import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./actions", () => ({
  listProjectsAction: vi.fn(),
  loadProjectDetailAction: vi.fn(),
  loadProjectOptionsAction: vi.fn(),
  saveProjectAction: vi.fn(),
}));
import {
  listProjectsAction,
  loadProjectDetailAction,
  loadProjectOptionsAction,
  saveProjectAction,
} from "./actions";
import { ProjectsContent } from "./components";
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
});
