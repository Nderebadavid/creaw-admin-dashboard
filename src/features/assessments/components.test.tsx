import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
vi.mock("./actions", () => ({
  listAssessmentsAction: vi.fn(),
  recordAssessmentAction: vi.fn(),
  attachAssessmentDocumentAction: vi.fn(),
  recommendAssessmentAction: vi.fn(),
  approveAssessmentAction: vi.fn(),
  viewAssessmentDocumentAction: vi.fn(),
}));
import { listAssessmentsAction, recordAssessmentAction } from "./actions";
import { AssessmentsContent } from "./components";
afterEach(cleanup);
describe("assessment cards", () => {
  it("shows missing due diligence rows and distinct recommendation and approval controls", () => {
    render(
      <AssessmentsContent
        initial={{
          items: [
            {
              id: 1,
              organisation: "Tumaini Women Network",
              organisationId: 1,
              dueDiligence: "in_progress",
              score: 3,
              maxScore: 5,
              scores: [{ label: "Governance", score: 3, max: 5 }],
              documents: [
                { id: 1, name: "Bank reference letter", status: "not_obtained", documentId: null },
              ],
              status: "ACTIVE",
              recommendation: null,
              proposedRecommendation: null,
              notes: null,
              followUp: false,
              recordedAt: "2026-08-01T00:00:00.000Z",
              pillarId: 5,
            },
          ],
          page: 1,
          pageSize: 25,
          totalItems: 1,
          totalPages: 1,
        }}
        canRecommend
        canApprove={false}
        canAttach={false}
      />
    );
    expect(screen.getByText(/Bank reference letter/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open assessment" }));
    expect(screen.getByRole("button", { name: /approve recommendation/i })).toBeDisabled();
  });

  it("opens an organisation's assessment in the record drawer", () => {
    render(
      <AssessmentsContent
        heading={{
          title: "Organisation assessments",
          section: "Records",
          description: "WRO partner capacity scoring and due diligence",
        }}
        initial={{
          items: [
            {
              id: 1,
              organisation: "Tumaini Women Network",
              organisationId: 1,
              dueDiligence: "in_progress",
              score: 3.4,
              maxScore: 5,
              scores: [{ label: "Governance", score: 3, max: 5 }],
              documents: [
                { id: 1, name: "Bank reference letter", status: "not_obtained", documentId: null },
                { id: 2, name: "Registration certificate", status: "obtained", documentId: 9 },
              ],
              status: "ACTIVE",
              recommendation: null,
              proposedRecommendation: null,
              notes: null,
              followUp: false,
              recordedAt: "2026-08-01T00:00:00.000Z",
              pillarId: 5,
            },
          ],
          page: 1,
          pageSize: 25,
          totalItems: 1,
          totalPages: 1,
        }}
        canRecommend
        canApprove
        canAttach
      />
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Organisation assessments" })
    ).toBeInTheDocument();
    expect(screen.getByText("TW")).toBeInTheDocument();
    expect(screen.getByText("Due diligence 1 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open assessment" }));
    const drawer = screen.getByRole("dialog", { name: "Tumaini Women Network" });
    expect(drawer).toHaveTextContent("Capacity assessment");
    expect(drawer).toHaveTextContent("3.4 / 5");
    fireEvent.click(screen.getByRole("tab", { name: "Documents" }));
    expect(screen.getByRole("button", { name: "Attach Bank reference letter" })).toBeEnabled();
  });

  const empty = { items: [], page: 1, pageSize: 25, totalItems: 0, totalPages: 0 };
  const permissions = { canRecommend: true, canApprove: false, canAttach: false };

  it("creates an assessment from organisation and instrument names", async () => {
    vi.mocked(recordAssessmentAction).mockResolvedValue({
      resultCode: 201,
      success: true,
      message: "OK",
      data: { id: 9 },
    });
    vi.mocked(listAssessmentsAction).mockResolvedValue({
      resultCode: 200,
      success: true,
      message: "OK",
      data: empty,
    });
    render(
      <AssessmentsContent
        initial={empty}
        {...permissions}
        createOptions={{
          organisations: [
            { id: 4, name: "Tumaini Women Network" },
            { id: 7, name: "Kilifi Mothers Forum" },
          ],
          instruments: [
            {
              id: 2,
              name: "Organisation capacity",
              criteria: [
                { id: 11, label: "Governance", max: 5 },
                { id: 12, label: "Safeguarding", max: 5 },
              ],
            },
          ],
        }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "New assessment" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Organisation"), { target: { value: "7" } });
    expect(within(dialog).getByLabelText("Assessment instrument")).toHaveValue("2");
    // Every domain must be scored, as on the mobile app.
    fireEvent.click(within(dialog).getByRole("radio", { name: "Governance: 4" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save assessment" }));
    expect(within(dialog).getByText("Score every domain before saving.")).toBeInTheDocument();
    expect(recordAssessmentAction).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("radio", { name: "Safeguarding: 2" }));
    fireEvent.change(within(dialog).getByLabelText("Assessor notes"), {
      target: { value: "Strong board" },
    });
    fireEvent.click(within(dialog).getByLabelText(/Needs follow-up visit/));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save assessment" }));
    await waitFor(() =>
      expect(recordAssessmentAction).toHaveBeenCalledWith({
        organisationId: 7,
        instrumentId: 2,
        scores: [
          { criterionId: 11, score: 4 },
          { criterionId: 12, score: 2 },
        ],
        notes: "Strong board",
        followUp: true,
        documents: ["Registration certificate", "Audited accounts"],
      })
    );
    expect(await screen.findByText(/Assessment saved/)).toBeInTheDocument();
  });

  it("hides New assessment from a user who cannot create one", () => {
    render(<AssessmentsContent initial={empty} {...permissions} />);
    expect(screen.queryByRole("button", { name: "New assessment" })).not.toBeInTheDocument();
  });
});
