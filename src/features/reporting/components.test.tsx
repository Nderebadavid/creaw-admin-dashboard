import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
vi.mock("./actions", () => ({
  listReportsAction: vi.fn(),
  addDeadlineAction: vi.fn(),
  submitReportAction: vi.fn(),
  exportReportsAction: vi.fn(),
  viewReportDocumentAction: vi.fn(),
}));
import { ReportingContent } from "./components";

afterEach(cleanup);
describe("reporting calendar", () => {
  it("shows overdue alert and owner and pillar filters", () => {
    render(
      <ReportingContent
        initial={{
          items: [
            {
              key: "narrative-1",
              id: 1,
              type: "narrative",
              title: "SRHR report",
              project: "SRHR",
              pillarId: 3,
              pillar: "SRHR",
              ownerId: 9,
              ownerName: "Amina Wekesa",
              applicationId: null,
              periodStart: "2026-07-01",
              periodEnd: "2026-09-01",
              dueDate: "2026-09-01",
              status: "overdue",
              submittedDate: null,
              documentId: null,
            },
          ],
          page: 1,
          pageSize: 25,
          totalItems: 1,
          totalPages: 1,
        }}
        catalog={{
          projects: [{ id: 1, pillar_id: 3, name: "SRHR", donor_id: null }],
          pillars: [{ id: 3, name: "SRHR", lead_user_id: 9 }],
        }}
        canManage
        canExport={false}
      />
    );
    expect(screen.getByText(/1 report overdue/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Pillar")).toBeInTheDocument();
    expect(screen.getByLabelText("Owner")).toBeInTheDocument();
  });

  it("frames reports due like the design and opens a report from its row", () => {
    render(
      <ReportingContent
        heading={{
          title: "Reporting calendar",
          section: "Reporting",
          description: "Donor and grant reports across pillars",
        }}
        initial={{
          items: [
            {
              key: "narrative-1",
              id: 1,
              type: "narrative",
              title: "SRHR report",
              project: "SRHR programme",
              pillarId: 3,
              pillar: "SRHR",
              ownerId: 9,
              ownerName: "Amina Wekesa",
              applicationId: null,
              periodStart: "2026-07-01",
              periodEnd: "2026-09-01",
              dueDate: "2026-09-01",
              status: "pending",
              submittedDate: null,
              documentId: null,
            },
          ],
          page: 1,
          pageSize: 25,
          totalItems: 1,
          totalPages: 1,
        }}
        catalog={{
          projects: [{ id: 1, pillar_id: 3, name: "SRHR programme", donor_id: null }],
          pillars: [{ id: 3, name: "SRHR", lead_user_id: 9 }],
        }}
        canManage
        canExport
        narrativePillars={[3]}
      />
    );
    const header = screen
      .getByRole("heading", { level: 1, name: "Reporting calendar" })
      .closest("[data-page-heading]") as HTMLElement;
    expect(within(header).getByRole("button", { name: "Add deadline" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reports due" })).toBeInTheDocument();
    expect(
      screen.getByText("Click a report to upload the submission or view what was sent")
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Donor / programme" })).toBeInTheDocument();
    expect(screen.getByText("Owner · Amina Wekesa")).toBeInTheDocument();
    fireEvent.click(screen.getByText("SRHR report"));
    expect(screen.getByRole("dialog", { name: "Upload report submission" })).toBeInTheDocument();
  });
});
