import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("./actions", () => ({
  listAssessmentsAction: vi.fn(),
  attachAssessmentDocumentAction: vi.fn(),
  recommendAssessmentAction: vi.fn(),
  approveAssessmentAction: vi.fn(),
  viewAssessmentDocumentAction: vi.fn(),
}));
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
    expect(screen.getByText("Due diligence 1 of 2 documents")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open assessment" }));
    const drawer = screen.getByRole("dialog", { name: "Tumaini Women Network" });
    expect(drawer).toHaveTextContent("Capacity assessment");
    expect(drawer).toHaveTextContent("3.4 / 5");
    fireEvent.click(screen.getByRole("tab", { name: "Documents" }));
    expect(screen.getByRole("button", { name: "Attach Bank reference letter" })).toBeEnabled();
  });
});
