import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./actions", () => ({
  listDonorsAction: vi.fn(),
  loadDonorDetailAction: vi.fn(),
  saveDonorAction: vi.fn(),
  setDonorStatusAction: vi.fn(),
  deleteDonorAction: vi.fn(),
}));
import {
  deleteDonorAction,
  listDonorsAction,
  loadDonorDetailAction,
  saveDonorAction,
  setDonorStatusAction,
} from "./actions";
import { DonorsContent } from "./components";
import type { DonorView } from "./api";

const mastercard: DonorView = {
  id: 3,
  name: "Mastercard Foundation",
  notes: "Jasiri funder",
  status: "ACTIVE",
  statusDescription: null,
  created: "2026-01-02T08:00:00.000Z",
  updated: "2026-01-05T08:00:00.000Z",
  projects: 2,
  activeProjects: 1,
  awarded: 120000,
};
const hewlett: DonorView = {
  ...mastercard,
  id: 4,
  name: "Hewlett",
  projects: null,
  activeProjects: null,
  awarded: null,
};
const ok = (data: unknown) => ({ resultCode: 200, success: true, message: "OK", data });
const done = { resultCode: 200, success: true, message: "OK" };
const manage = [{ permissionCode: "LOOKUP_MANAGE", pillarId: null }];

function renderDonors(grants = manage) {
  render(
    <DonorsContent
      initial={{
        items: [mastercard, hewlett],
        page: 1,
        pageSize: 25,
        totalItems: 2,
        totalPages: 1,
      }}
      grants={grants}
    />
  );
}

beforeEach(() => {
  vi.mocked(loadDonorDetailAction).mockResolvedValue(
    ok({
      projects: [
        {
          id: 1,
          name: "Jasiri business grants",
          pillarId: 2,
          pillar: "WEE",
          status: "ACTIVE",
          end: "2026-12-31",
        },
      ],
    }) as never
  );
  vi.mocked(listDonorsAction).mockResolvedValue(
    ok({ items: [mastercard], page: 1, pageSize: 25, totalItems: 1, totalPages: 1 }) as never
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("donors register", () => {
  it("shows project counts and awarded money, with dashes where the caller may not see them", () => {
    renderDonors();
    const row = screen.getByText("Mastercard Foundation").closest("tr")!;
    expect(row).toHaveTextContent("KES 120,000");
    expect(screen.getByText("Hewlett").closest("tr")).not.toHaveTextContent("KES");
  });

  it("sorts and filters through the API", async () => {
    renderDonors();
    fireEvent.click(screen.getByRole("button", { name: "Awarded" }));
    await waitFor(() =>
      expect(listDonorsAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: { by: "awarded", order: "asc" } })
      )
    );
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "INACTIVE" } });
    await waitFor(() =>
      expect(listDonorsAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ filters: { status: "INACTIVE" } })
      )
    );
  });

  it("opens a donor with its projects loaded on demand", async () => {
    renderDonors();
    expect(loadDonorDetailAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Mastercard Foundation"));
    const drawer = screen.getByRole("dialog", { name: "Mastercard Foundation" });
    expect(within(drawer).getByRole("region", { name: "Record" })).toHaveTextContent(
      "Jasiri funder"
    );
    expect(await within(drawer).findByText("Jasiri business grants")).toBeInTheDocument();
    expect(loadDonorDetailAction).toHaveBeenCalledWith(3);
  });

  it("offers no management controls without the lookup permission", () => {
    renderDonors([]);
    expect(screen.queryByRole("button", { name: "New donor" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Mastercard Foundation"));
    for (const name of ["Edit donor", "Deactivate", "Delete"])
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });

  it("adds a donor", async () => {
    vi.mocked(saveDonorAction).mockResolvedValue(done as never);
    renderDonors();
    fireEvent.click(screen.getByRole("button", { name: "New donor" }));
    const dialog = await screen.findByRole("dialog", { name: "New donor" });
    expect(within(dialog).queryByLabelText("Status")).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Donor name"), {
      target: { value: "Zeta Trust" },
    });
    fireEvent.change(within(dialog).getByLabelText("Notes"), { target: { value: "UK" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add donor" }));
    await waitFor(() =>
      expect(saveDonorAction).toHaveBeenCalledWith({
        id: undefined,
        name: "Zeta Trust",
        notes: "UK",
      })
    );
    expect(await screen.findByText("Donor added.")).toBeInTheDocument();
  });

  it("edits every detail including status and its reason", async () => {
    vi.mocked(saveDonorAction).mockResolvedValue(done as never);
    renderDonors();
    fireEvent.click(screen.getByText("Mastercard Foundation"));
    fireEvent.click(screen.getByRole("button", { name: "Edit donor" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit donor" });
    expect(within(dialog).getByLabelText("Donor name")).toHaveValue("Mastercard Foundation");
    fireEvent.change(within(dialog).getByLabelText("Donor name"), {
      target: { value: "Mastercard Fdn" },
    });
    fireEvent.change(within(dialog).getByLabelText("Status"), { target: { value: "INACTIVE" } });
    fireEvent.change(within(dialog).getByLabelText("Status reason"), {
      target: { value: "Ended" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(saveDonorAction).toHaveBeenCalledWith({
        id: 3,
        name: "Mastercard Fdn",
        notes: "Jasiri funder",
        status: "INACTIVE",
        statusDescription: "Ended",
      })
    );
  });

  it("deactivates with a reason and deletes after confirming, showing the API's refusal", async () => {
    vi.mocked(setDonorStatusAction).mockResolvedValue(done as never);
    vi.mocked(deleteDonorAction).mockResolvedValue({
      resultCode: 422,
      success: false,
      message: "This donor still has projects. Deactivate it instead of deleting it",
    } as never);
    renderDonors();
    fireEvent.click(screen.getByText("Mastercard Foundation"));
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    const status = await screen.findByRole("dialog", { name: "Deactivate donor" });
    fireEvent.change(within(status).getByLabelText("Reason (optional)"), {
      target: { value: "Ended" },
    });
    fireEvent.click(within(status).getByRole("button", { name: "Deactivate" }));
    await waitFor(() =>
      expect(setDonorStatusAction).toHaveBeenCalledWith({
        id: 3,
        status: "INACTIVE",
        reason: "Ended",
      })
    );
    expect(await screen.findByText("Donor deactivated.")).toBeInTheDocument();
    // The drawer is still open after the dialog closes.
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const remove = await screen.findByRole("dialog", { name: "Delete donor" });
    fireEvent.click(within(remove).getByRole("button", { name: "Delete donor" }));
    expect(await within(remove).findByRole("alert")).toHaveTextContent("still has projects");
    expect(deleteDonorAction).toHaveBeenCalledWith({ id: 3 });
  });
});
