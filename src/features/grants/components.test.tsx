import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
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
    fireEvent.click(screen.getByRole("button", { name: /log report/i }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Period start");
    expect(screen.getByRole("dialog")).toHaveTextContent("Period end");
    expect(screen.getByRole("dialog")).toHaveTextContent("Due date");
  });

  const approvedDetail = {
    id: 1,
    applicant: "Rehema Karisa",
    project: "WEE business grants",
    pillarId: 2,
    status: "APPROVED",
    requestedAmount: "KES 120,000",
    grantType: "staggered_by_milestone",
    createdAt: "2026-09-01",
    notes: null,
    participantId: 3,
    organisationId: null,
    stage: 3,
    nextStatus: null,
    signoffs: { preparedBy: 4, reviewedBy: 3, approvedBy: 1 },
    award: { id: 1, amountAwarded: "100000", currency: "KES", lifecycle: "active" },
    reportingAwardId: 1,
    disbursements: [
      { id: 1, amount: "40000", date: "2026-09-10", notes: "Tranche 1" },
      { id: 2, amount: "20000", date: "2026-09-20", notes: null },
    ],
    reports: [],
    documents: [],
  } as const;

  it("lays out the application like the design", () => {
    render(
      <GrantDetailContent
        heading={{
          title: "Grant application",
          section: "Records",
          description: "Rehema Karisa · WEE business grants",
        }}
        detail={{
          ...approvedDetail,
          signoffs: { ...approvedDetail.signoffs },
          award: { ...approvedDetail.award },
          disbursements: [...approvedDetail.disbursements],
          reports: [],
          documents: [],
        }}
        canAdvance={false}
        canDisburse
        canDownload
        canLogReport
      />
    );
    const header = screen
      .getByRole("heading", { level: 1, name: "Grant application" })
      .closest("[data-page-heading]") as HTMLElement;
    expect(
      within(header).getByRole("button", { name: "Download application pack" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Documents & photos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Compliance reports" })).toBeInTheDocument();
    expect(screen.getByText("KES 60,000")).toBeInTheDocument();
    expect(screen.getByText("of KES 100,000 awarded")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Disbursed" })).toHaveAttribute(
      "aria-valuenow",
      "60"
    );
  });

  it("locks compliance reporting until the application is awarded", () => {
    render(
      <GrantDetailContent
        detail={{
          ...approvedDetail,
          status: "PREPARED",
          stage: 1,
          nextStatus: "REVIEWED",
          signoffs: { preparedBy: 4, reviewedBy: null, approvedBy: null },
          award: null,
          reportingAwardId: null,
          disbursements: [],
          reports: [],
          documents: [],
        }}
        canAdvance
        canDisburse
        canDownload
        canLogReport
      />
    );
    expect(screen.getByText("Log report · locked until awarded")).toBeInTheDocument();
    expect(
      screen.getByText("Disbursement opens once the application is approved.")
    ).toBeInTheDocument();
  });
});
