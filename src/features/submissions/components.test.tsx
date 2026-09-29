import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
vi.mock("server-only", () => ({}));
vi.mock("./actions", () => ({ reviewSubmissionAction: vi.fn() }));
vi.mock("@/components/portal/data-actions", () => ({ auditedExportAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { SubmissionsContent } from "./components";
import type { SubmissionRow } from "./api";

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
});
