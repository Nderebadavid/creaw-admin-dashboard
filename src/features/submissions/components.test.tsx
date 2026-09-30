import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
vi.mock("server-only", () => ({}));
vi.mock("./actions", () => ({ reviewSubmissionAction: vi.fn() }));
vi.mock("@/components/portal/data-actions", () => ({ auditedExportAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { SubmissionsContent } from "./components";
import { reviewSubmissionAction } from "./actions";
import type { SubmissionRow } from "./api";

afterEach(cleanup);

const rows: SubmissionRow[] = [
  {
    id: 1,
    title: "Facility referral day",
    type: "Outreach",
    pillarId: 3,
    pillar: "SRHR",
    captured: "2026-09-27",
    source: "mobile",
    status: "Pending review",
    flag: null,
  },
  {
    id: 2,
    title: "Court attendance",
    type: "Case update",
    pillarId: 1,
    pillar: "VAWG",
    captured: "2026-09-26",
    source: "mobile",
    status: "Flagged",
    flag: "Check photo",
  },
];

describe("field submissions screen", () => {
  it("filters cards by status and search while keeping review permission visible", () => {
    render(<SubmissionsContent rows={rows} canReview={false} />);
    expect(screen.getByText("Facility referral day")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Flagged/ }));
    expect(screen.queryByText("Facility referral day")).not.toBeInTheDocument();
    expect(screen.getByText("Court attendance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review Court attendance/ })).toBeDisabled();
  });
  it("enables review only for records in the scoped review grant", () => {
    render(<SubmissionsContent rows={rows} reviewableIds={[2]} />);
    expect(screen.getByRole("button", { name: /Review Court attendance/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Review Facility referral day/ })).toBeDisabled();
  });
  it("offers export only when the displayed filter is wholly exportable", () => {
    render(<SubmissionsContent rows={rows} reviewableIds={[]} canExport exportableIds={[1]} />);
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
    // The design has status tabs and no search box; the Pending tab shows only the exportable card.
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pending review/ }));
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeInTheDocument();
  });

  it("lays out cards and page actions like the design", () => {
    render(
      <SubmissionsContent
        heading={{
          title: "Field submissions",
          section: "Overview",
          description: "Data captured on the MERL mobile app, waiting for verification",
        }}
        rows={rows}
        reviewableIds={[1, 2]}
        canExport
      />
    );
    const header = screen
      .getByRole("heading", { level: 1, name: "Field submissions" })
      .closest("[data-page-heading]") as HTMLElement;
    expect(within(header).getByRole("button", { name: "Export CSV" })).toBeInTheDocument();
    expect(screen.getByText("photo · outreach")).toBeInTheDocument();
    expect(screen.getByText("SRHR · Outreach")).toBeInTheDocument();
  });

  it("confirms before approving straight from a card", async () => {
    vi.mocked(reviewSubmissionAction).mockResolvedValue({
      success: true,
      message: "Submission approved.",
    });
    render(<SubmissionsContent rows={rows} reviewableIds={[1, 2]} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve Facility referral day" }));
    const dialog = screen.getByRole("dialog", { name: "Approve submission?" });
    expect(dialog).toHaveTextContent(
      "Approve “Facility referral day”? The data is merged into the linked record."
    );
    expect(reviewSubmissionAction).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(reviewSubmissionAction).toHaveBeenCalledWith(1, "approve"));
  });
});
