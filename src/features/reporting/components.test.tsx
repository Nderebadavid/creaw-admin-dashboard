import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
vi.mock("./actions", () => ({ listReportsAction: vi.fn(), addDeadlineAction: vi.fn(), submitReportAction: vi.fn(), exportReportsAction: vi.fn() }));
import { ReportingContent } from "./components";
describe("reporting calendar", () => {
  it("shows overdue alert and owner and pillar filters", () => {
    render(<ReportingContent initial={{ items: [{ key: "narrative-1", id: 1, type: "narrative", title: "SRHR report", project: "SRHR", pillarId: 3, pillar: "SRHR", ownerId: 9, ownerName: "Amina Wekesa", dueDate: "2026-09-01", status: "overdue", submittedDate: null, documentId: null }], page: 1, pageSize: 25, totalItems: 1, totalPages: 1 }} catalog={{ projects: [{ id: 1, pillar_id: 3, name: "SRHR", donor_id: null }], pillars: [{ id: 3, name: "SRHR", lead_user_id: 9 }] }} canManage canExport={false} />);
    expect(screen.getByText(/1 report overdue/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Pillar")).toBeInTheDocument();
    expect(screen.getByLabelText("Owner")).toBeInTheDocument();
  });
});
