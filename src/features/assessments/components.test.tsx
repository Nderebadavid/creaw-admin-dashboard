import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
vi.mock("./actions", () => ({
  listAssessmentsAction: vi.fn(),
  attachAssessmentDocumentAction: vi.fn(),
  recommendAssessmentAction: vi.fn(),
  approveAssessmentAction: vi.fn(),
}));
import { AssessmentsContent } from "./components";
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
});
