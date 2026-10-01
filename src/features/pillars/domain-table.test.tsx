import { vi, afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PillarDomainTable } from "./domain-table";
import { listPillarDomainAction } from "./actions";
import type { PillarDomainView } from "./domain-api";
// Grant rows navigate to their sign-off page with the app router.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./actions", () => ({ listPillarDomainAction: vi.fn() }));

const row = (id: number, status = "PREPARED") => ({
  id,
  title: `Application #${id}`,
  values: [`Applicant ${id}`, "Posho mill", "KES 1,000"],
  status,
});
const domain: PillarDomainView = {
  title: "Grant applications",
  subtitle: "Prepared → Reviewed → Approved",
  columns: ["Applicant", "Business", "Requested"],
  rows: [row(1), row(2)],
  totalItems: 40,
  statuses: ["PREPARED", "APPROVED"],
};
const page = (rows: ReturnType<typeof row>[], pageNo = 1) => ({
  success: true,
  message: "OK",
  data: { items: rows, page: pageNo, pageSize: 25, totalItems: 40, totalPages: 2 },
});

beforeEach(() => vi.mocked(listPillarDomainAction).mockResolvedValue(page([row(3, "APPROVED")])));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("pillar domain register", () => {
  it("shows the first page the server rendered and opens a read-only record detail", () => {
    render(<PillarDomainTable code="wee" domain={domain} />);
    expect(screen.getByText("Applicant 1")).toBeInTheDocument();
    expect(listPillarDomainAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "View Application #2" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Applicant 2");
    expect(screen.getByRole("dialog")).toHaveTextContent("Prepared");
  });

  it("asks the API for the chosen status, search, sort and page", async () => {
    render(<PillarDomainTable code="wee" domain={domain} />);
    fireEvent.click(screen.getByRole("button", { name: "Approved" }));
    await waitFor(() =>
      expect(listPillarDomainAction).toHaveBeenLastCalledWith("wee", {
        page: 1,
        pageSize: 25,
        filters: { status: "APPROVED" },
      })
    );
    expect(await screen.findByText("Applicant 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Applicant" }));
    await waitFor(() =>
      expect(listPillarDomainAction).toHaveBeenLastCalledWith(
        "wee",
        expect.objectContaining({ page: 1, sort: { by: "0", order: "asc" } })
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(listPillarDomainAction).toHaveBeenLastCalledWith(
        "wee",
        expect.objectContaining({ page: 2 })
      )
    );
  });

  it("shows why a page could not load", async () => {
    vi.mocked(listPillarDomainAction).mockResolvedValueOnce({
      success: false,
      message: "Could not load the register.",
      data: null,
    });
    render(<PillarDomainTable code="wee" domain={domain} />);
    fireEvent.click(screen.getByRole("button", { name: "Approved" }));
    expect(await screen.findByText("Could not load the register.")).toBeInTheDocument();
  });
});
