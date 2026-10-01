import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ProjectsPanel } from "./projects-panel";

afterEach(cleanup);
const base = {
  id: 1,
  name: "Jasiri business grants",
  pillar_id: 2,
  donor_name: "Mastercard Foundation",
  end_date: "2026-12-31",
  applications_count: 4,
  awarded_total: 120000,
  reports_overdue: 2,
};

it("lists each project with donor, end date, applications, money and overdue reports", () => {
  render(<ProjectsPanel projects={[base]} subtitle="WEE funded initiatives" />);
  const panel = screen.getByRole("region", { name: "Projects" });
  expect(panel).toHaveTextContent("WEE funded initiatives");
  const item = within(panel).getByRole("listitem");
  expect(item).toHaveTextContent("Jasiri business grants");
  expect(item).toHaveTextContent("Mastercard Foundation · ends 31 Dec 2026");
  expect(item).toHaveTextContent("4 applications");
  expect(item).toHaveTextContent("KES 120,000 awarded");
  expect(item).toHaveTextContent("2 overdue");
  expect(within(panel).getByRole("link", { name: "All projects" })).toHaveAttribute(
    "href",
    "/projects"
  );
});

it("leaves out figures the caller cannot see, and says so when there are no projects", () => {
  const { rerender } = render(
    <ProjectsPanel
      projects={[{ ...base, applications_count: null, awarded_total: null, reports_overdue: 0 }]}
    />
  );
  const item = screen.getByRole("listitem");
  expect(item).not.toHaveTextContent("application");
  expect(item).not.toHaveTextContent("awarded");
  expect(item).not.toHaveTextContent("overdue");
  rerender(<ProjectsPanel projects={[]} />);
  expect(screen.getByText("No active projects.")).toBeInTheDocument();
});

it("shows the pillar chip when the list spans pillars", () => {
  render(<ProjectsPanel projects={[base]} showPillar />);
  expect(screen.getByRole("listitem")).toHaveTextContent("WEE");
});
