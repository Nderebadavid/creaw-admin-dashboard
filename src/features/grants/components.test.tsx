import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("./actions", () => ({
  listGrantsAction: vi.fn(),
  advanceGrantAction: vi.fn(),
  recordDisbursementAction: vi.fn(),
  downloadGrantPackAction: vi.fn(),
  exportGrantsAction: vi.fn(),
  logGrantReportAction: vi.fn(),
  viewGrantDocumentAction: vi.fn(),
}));
import { GrantDetailContent } from "./components";
describe("grant detail", () => {
  afterEach(cleanup);
  it("shows sign-off and masked disbursement values without enabling an unauthorized step", () => {
    render(
      <GrantDetailContent
        detail={{
          id: 1,
          applicant: "Participant #3",
          project: "WEE",
          pillarId: 2,
          status: "REVIEWED",
          requestedAmount: "KES 50,000",
          grantType: "staggered",
          createdAt: "2026-09-01",
          notes: null,
          participantId: 3,
          organisationId: null,
          stage: 2,
          nextStatus: "APPROVED",
          signoffs: { preparedBy: 4, reviewedBy: 3, approvedBy: null },
          award: { id: 1, amountAwarded: "••••", currency: "KES", lifecycle: "active" },
          reportingAwardId: null,
          disbursements: [{ id: 1, amount: "••••", date: "2026-09-02", notes: null }],
          reports: [],
          documents: [],
        }}
        canAdvance={false}
        canDisburse={false}
        canDownload={false}
        canLogReport={false}
      />
    );
    expect(screen.getByText("Sign-off chain")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve application/i })).toBeDisabled();
    expect(screen.queryByText("55000")).not.toBeInTheDocument();
  });
  it("offers an approved award reporting-period form with start, end, and due dates", async () => {
    render(
      <GrantDetailContent
        detail={{
          id: 1,
          applicant: "Participant #3",
          project: "WEE",
          pillarId: 2,
          status: "APPROVED",
          requestedAmount: "••••",
          grantType: "staggered",
          createdAt: "2026-09-01",
          notes: null,
          participantId: 3,
          organisationId: null,
          stage: 3,
          nextStatus: null,
          signoffs: { preparedBy: 4, reviewedBy: 3, approvedBy: 1 },
          award: { id: 1, amountAwarded: "••••", currency: "KES", lifecycle: "active" },
          reportingAwardId: 1,
          disbursements: [],
          reports: [],
          documents: [],
        }}
        canAdvance={false}
        canDisburse={false}
        canDownload={false}
        canLogReport
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /log reporting period/i }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Period start");
    expect(screen.getByRole("dialog")).toHaveTextContent("Period end");
    expect(screen.getByRole("dialog")).toHaveTextContent("Due date");
  });
});
