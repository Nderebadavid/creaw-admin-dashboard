import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./actions", () => ({
  listGrantsAction: vi.fn(),
  advanceGrantAction: vi.fn(),
  createGrantApplicationAction: vi.fn(),
  declineGrantAction: vi.fn(),
  sendBackGrantAction: vi.fn(),
  updateAwardAction: vi.fn(),
  updateDisbursementAction: vi.fn(),
  recordDisbursementAction: vi.fn(),
  downloadGrantPackAction: vi.fn(),
  exportGrantsAction: vi.fn(),
  logGrantReportAction: vi.fn(),
  viewGrantDocumentAction: vi.fn(),
}));
vi.mock("@/features/participants/actions", () => ({ listParticipantsAction: vi.fn() }));
import {
  declineGrantAction,
  sendBackGrantAction,
  updateAwardAction,
  updateDisbursementAction,
} from "./actions";
import { GrantDetailContent } from "./components";
describe("grant detail", () => {
  afterEach(cleanup);
  it("shows sign-off and disbursement values without enabling an unauthorized step", () => {
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
          declineReason: null,
          previousStatus: null,
          sendBackReason: null,
          history: [],
          signoffs: { preparedBy: 4, reviewedBy: 3, approvedBy: null },
          award: { id: 1, amountAwarded: 55000, currency: "KES", lifecycle: "active" },
          reportingAwardId: null,
          disbursements: [{ id: 1, amount: 27500, date: "2026-09-02", notes: null }],
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
          declineReason: null,
          previousStatus: null,
          sendBackReason: null,
          history: [],
          signoffs: { preparedBy: 4, reviewedBy: 3, approvedBy: 1 },
          award: { id: 1, amountAwarded: 55000, currency: "KES", lifecycle: "active" },
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
    declineReason: null,
    previousStatus: null,
    sendBackReason: null,
    history: [],
    signoffs: { preparedBy: 4, reviewedBy: 3, approvedBy: 1 },
    award: { id: 1, amountAwarded: 100000, currency: "KES", lifecycle: "active" },
    reportingAwardId: 1,
    disbursements: [
      { id: 1, amount: 40000, date: "2026-09-10", notes: "Tranche 1" },
      { id: 2, amount: 20000, date: "2026-09-20", notes: null },
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

  const inReview = {
    ...approvedDetail,
    status: "PREPARED",
    stage: 1,
    nextStatus: "REVIEWED" as const,
    signoffs: { preparedBy: 4, reviewedBy: null, approvedBy: null },
    award: null,
    reportingAwardId: null,
    disbursements: [],
    reports: [],
    documents: [],
  };
  const permissions = {
    canAdvance: true,
    canDisburse: true,
    canDownload: true,
    canLogReport: true,
  };

  it("declines an application in its sign-off chain once a reason is given", async () => {
    vi.mocked(declineGrantAction).mockResolvedValue({
      resultCode: 200,
      success: true,
      message: "OK",
      data: null,
    });
    render(<GrantDetailContent detail={inReview} {...permissions} />);
    fireEvent.click(screen.getByRole("button", { name: "Decline application" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("This cannot be undone");
    expect(within(dialog).getByLabelText("Reason for declining")).toBeRequired();
    fireEvent.change(within(dialog).getByLabelText("Reason for declining"), {
      target: { value: "Business plan not viable" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Decline application" }));
    await waitFor(() =>
      expect(declineGrantAction).toHaveBeenCalledWith({
        id: 1,
        reason: "Business plan not viable",
      })
    );
    expect(await screen.findByText("Application declined.")).toBeInTheDocument();
  });

  it("sends the latest sign-off back with a reason, only for an officer who holds that step", async () => {
    vi.mocked(sendBackGrantAction).mockResolvedValue({
      resultCode: 200,
      success: true,
      message: "OK",
      data: null,
    });
    const reviewed = { ...inReview, previousStatus: "PREPARED" as const };
    const { rerender } = render(
      <GrantDetailContent detail={reviewed} {...permissions} canSendBack={false} />
    );
    expect(screen.getByRole("button", { name: "Send back" })).toBeDisabled();
    rerender(<GrantDetailContent detail={reviewed} {...permissions} canSendBack />);
    fireEvent.click(screen.getByRole("button", { name: "Send back" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("returns the application to prepared");
    expect(within(dialog).getByLabelText("Reason for sending back")).toBeRequired();
    fireEvent.change(within(dialog).getByLabelText("Reason for sending back"), {
      target: { value: "Wrong amount entered" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send back" }));
    await waitFor(() =>
      expect(sendBackGrantAction).toHaveBeenCalledWith({ id: 1, reason: "Wrong amount entered" })
    );
    expect(await screen.findByText("Sign-off sent back.")).toBeInTheDocument();
  });

  it("shows why the sign-off was sent back, and offers nothing to send back when new or declined", () => {
    const { rerender } = render(
      <GrantDetailContent
        detail={{ ...inReview, previousStatus: "PREPARED", sendBackReason: "Wrong amount entered" }}
        {...permissions}
        canSendBack
      />
    );
    expect(screen.getByRole("heading", { name: "Sign-off sent back" })).toBeInTheDocument();
    expect(screen.getByText("Wrong amount entered")).toBeInTheDocument();
    rerender(<GrantDetailContent detail={inReview} {...permissions} canSendBack />);
    expect(screen.queryByRole("button", { name: "Send back" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign-off sent back" })).not.toBeInTheDocument();
  });

  it("disables declining for an officer who cannot decide the next step", () => {
    render(<GrantDetailContent detail={inReview} {...permissions} canAdvance={false} />);
    expect(screen.getByRole("button", { name: "Decline application" })).toBeDisabled();
  });

  it("shows a declined application as closed, with its reason and no further actions", () => {
    render(
      <GrantDetailContent
        detail={{
          ...inReview,
          status: "DECLINED",
          nextStatus: null,
          declineReason: "Business plan not viable",
          previousStatus: null,
          sendBackReason: null,
        }}
        {...permissions}
      />
    );
    expect(screen.getByRole("heading", { name: "Application declined" })).toBeInTheDocument();
    expect(screen.getByText("Business plan not viable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Decline application" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark as|approve/i })).not.toBeInTheDocument();
    // The step that was pending is shown as never reached, not as the current step.
    expect(screen.queryByText("Current step")).not.toBeInTheDocument();
    expect(screen.getAllByText("Not reached")).toHaveLength(2);
  });

  it("offers no decline once an application is approved", () => {
    render(
      <GrantDetailContent
        detail={{ ...approvedDetail, disbursements: [], reports: [], documents: [] }}
        {...permissions}
      />
    );
    expect(screen.queryByRole("button", { name: "Decline application" })).not.toBeInTheDocument();
  });

  it("shows who decided each step when the history is opened", () => {
    render(
      <GrantDetailContent
        detail={{
          ...inReview,
          history: [
            { event: "SUBMITTED", byName: null, at: "2026-09-01T08:00:00.000Z" },
            { event: "PREPARED", byName: "Daniel Kiprono", at: "2026-09-12T09:30:00.000Z" },
          ],
        }}
        {...permissions}
      />
    );
    expect(screen.queryByRole("list", { name: "Sign-off history" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View history" }));
    const entries = within(screen.getByRole("list", { name: "Sign-off history" })).getAllByRole(
      "listitem"
    );
    // Newest first.
    expect(entries[0]).toHaveTextContent("Marked as prepared · Daniel Kiprono");
    expect(entries[1]).toHaveTextContent("Application received");
    fireEvent.click(screen.getByRole("button", { name: "Hide history" }));
    expect(screen.queryByRole("list", { name: "Sign-off history" })).not.toBeInTheDocument();
  });

  const editable = {
    ...approvedDetail,
    disbursements: [...approvedDetail.disbursements],
    reports: [],
    documents: [],
  };

  it("edits the awarded amount, with the limits explained, for an officer who may", async () => {
    vi.mocked(updateAwardAction).mockResolvedValue({
      resultCode: 200,
      success: true,
      message: "OK",
      data: null,
    });
    const { rerender } = render(
      <GrantDetailContent detail={editable} {...permissions} canEditAward={false} />
    );
    expect(screen.queryByRole("button", { name: "Edit awarded amount" })).not.toBeInTheDocument();
    rerender(<GrantDetailContent detail={editable} {...permissions} canEditAward />);
    fireEvent.click(screen.getByRole("button", { name: "Edit awarded amount" }));
    const dialog = screen.getByRole("dialog", { name: "Edit awarded amount" });
    const input = within(dialog).getByLabelText(/Awarded amount/);
    expect(input).toHaveValue(100000);
    expect(input).toHaveAttribute("min", "60000");
    expect(dialog).toHaveTextContent("It cannot be more than was requested");
    expect(dialog).toHaveTextContent("60,000 already paid");
    fireEvent.change(input, { target: { value: "90000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save amount" }));
    await waitFor(() =>
      expect(updateAwardAction).toHaveBeenCalledWith({ applicationId: 1, amount: 90000 })
    );
    expect(await screen.findByText("Awarded amount updated.")).toBeInTheDocument();
  });

  it("corrects a recorded payment, filled in with its current values", async () => {
    vi.mocked(updateDisbursementAction).mockResolvedValue({
      resultCode: 200,
      success: true,
      message: "OK",
      data: null,
    });
    render(<GrantDetailContent detail={editable} {...permissions} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit payment 1" }));
    const dialog = screen.getByRole("dialog", { name: "Edit payment" });
    expect(within(dialog).getByLabelText("Amount (KES)")).toHaveValue(40000);
    expect(within(dialog).getByLabelText("Payment date")).toHaveValue("2026-09-10");
    expect(within(dialog).getByLabelText("Reference or note")).toHaveValue("Tranche 1");
    fireEvent.change(within(dialog).getByLabelText("Amount (KES)"), { target: { value: "35000" } });
    fireEvent.change(within(dialog).getByLabelText("Reference or note"), {
      target: { value: "Tranche 1 (corrected)" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save payment" }));
    await waitFor(() =>
      expect(updateDisbursementAction).toHaveBeenCalledWith({
        applicationId: 1,
        disbursementId: 1,
        amount: 35000,
        date: "2026-09-10",
        notes: "Tranche 1 (corrected)",
      })
    );
    expect(await screen.findByText("Payment updated.")).toBeInTheDocument();
  });

  it("shows the API's refusal when a correction breaks a rule, and offers no payment edit without permission", async () => {
    vi.mocked(updateDisbursementAction).mockResolvedValue({
      resultCode: 422,
      success: false,
      message: "Payment exceeds the approved award or the application is not approved",
      data: null,
    });
    const { rerender } = render(<GrantDetailContent detail={editable} {...permissions} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit payment 2" }));
    const dialog = screen.getByRole("dialog", { name: "Edit payment" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save payment" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "exceeds the approved award"
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    rerender(<GrantDetailContent detail={editable} {...permissions} canDisburse={false} />);
    expect(screen.queryByRole("button", { name: /Edit payment/ })).not.toBeInTheDocument();
  });
});
