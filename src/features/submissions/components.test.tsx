import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("server-only", () => ({}));
vi.mock("./actions", () => ({ reviewSubmissionAction: vi.fn() }));
vi.mock("@/components/portal/data-actions", () => ({ auditedExportAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { SubmissionsContent } from "./components";
import type { SubmissionRow } from "./api";

afterEach(cleanup);

const rows: SubmissionRow[] = [
  { id: 1, title: "Facility referral day", type: "Outreach", pillarId: 3, pillar: "SRHR", captured: "2026-09-27", source: "mobile", status: "Pending review", flag: null },
  { id: 2, title: "Court attendance", type: "Case update", pillarId: 1, pillar: "VAWG", captured: "2026-09-26", source: "mobile", status: "Flagged", flag: "Check photo" },
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
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Facility" } });
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeInTheDocument();
  });
});
