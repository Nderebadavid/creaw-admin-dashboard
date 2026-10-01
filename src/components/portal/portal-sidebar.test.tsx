import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PortalSidebar } from "./portal-sidebar";
import { navigationGroups } from "./navigation";

afterEach(cleanup);
it("preserves the designer's five groups", () => {
  expect(navigationGroups.map((group) => group.label)).toEqual([
    "Overview",
    "Pillars",
    "Records",
    "Reporting",
    "Admin",
  ]);
});
it("uses the planned UI routes for reporting, audit and lookup pages", () => {
  const items = navigationGroups.flatMap((group) => group.items);
  expect(items.find((item) => item.label === "Reporting calendar")?.href).toBe("/reporting");
  expect(items.find((item) => item.label === "Audit log")?.href).toBe("/audit");
  expect(items.find((item) => item.label === "Lookup tables")?.href).toBe("/admin/lookups/pillar");
});
it("uses effective grants, scope, and implemented routes", () => {
  render(
    <PortalSidebar
      pathname="/participants/12"
      grants={[
        { permissionCode: "PARTICIPANT_VIEW", pillarId: 2 },
        { permissionCode: "DASHBOARD_VIEW", pillarId: 2 },
      ]}
      availableRoutes={[
        "/dashboard",
        "/participants",
        "/pillars/vawg",
        "/pillars/wee",
        "/admin/users",
      ]}
    />
  );
  expect(screen.getByRole("link", { name: "Participants" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  expect(screen.getByRole("link", { name: "WEE" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "VAWG" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Users & roles" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Grants" })).not.toBeInTheDocument();
});
it("retains accessible names when collapsed and shows only implemented permitted routes", () => {
  render(
    <PortalSidebar
      collapsed
      pathname="/dashboard"
      grants={[{ permissionCode: "DASHBOARD_VIEW", pillarId: null }]}
    />
  );
  expect(screen.getByText("Dashboard")).toHaveClass("sr-only");
  expect(screen.getByRole("link", { name: "VAWG" })).toHaveAttribute("href", "/pillars/vawg");
  expect(screen.queryByRole("link", { name: "Participants" })).not.toBeInTheDocument();
});
it("does not advertise a pillar page to a grant that the page cannot serve", () => {
  render(
    <PortalSidebar
      pathname="/field-submissions"
      grants={[{ permissionCode: "COUNSELLING_VIEW", pillarId: 1 }]}
    />
  );
  expect(screen.queryByRole("link", { name: "VAWG" })).not.toBeInTheDocument();
});
it("shows completed participant and referral routes to permitted users", () => {
  render(
    <PortalSidebar
      pathname="/participants"
      grants={[
        { permissionCode: "PARTICIPANT_VIEW", pillarId: 2 },
        { permissionCode: "REFERRAL_VIEW", pillarId: 2 },
      ]}
    />
  );
  expect(screen.getByRole("link", { name: "Participants" })).toHaveAttribute(
    "href",
    "/participants"
  );
  expect(screen.getByRole("link", { name: "Referral queue" })).toHaveAttribute(
    "href",
    "/referrals"
  );
});
it("requires a global lookup grant while allowing a scoped pipeline grant", () => {
  render(
    <PortalSidebar
      pathname="/admin/pipelines"
      grants={[
        { permissionCode: "LOOKUP_MANAGE", pillarId: 2 },
        { permissionCode: "PILLAR_CONFIG_MANAGE", pillarId: 2 },
      ]}
    />
  );
  expect(screen.getByRole("link", { name: "Pipeline config" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Lookup tables" })).not.toBeInTheDocument();
});

const busyGrants = [
  { permissionCode: "FIELD_SUBMISSION_VIEW", pillarId: null },
  { permissionCode: "REFERRAL_VIEW", pillarId: null },
  { permissionCode: "NARRATIVE_REPORT_MANAGE", pillarId: null },
];
const busyStatus = { pendingSubmissions: 5, newReferrals: 2, grantsAwaiting: 0, overdueReports: 1 };

it("badges modules with waiting work", () => {
  render(<PortalSidebar pathname="/dashboard" grants={busyGrants} status={busyStatus} />);
  expect(screen.getByRole("link", { name: /Field submissions/ })).toHaveTextContent("5");
  expect(screen.getByRole("link", { name: /Referral queue/ })).toHaveTextContent("2");
  expect(screen.getByRole("link", { name: /Reporting calendar/ })).toHaveTextContent("1");
});

it("marks waiting work with a dot when collapsed", () => {
  render(<PortalSidebar collapsed pathname="/dashboard" grants={busyGrants} status={busyStatus} />);
  expect(screen.getByRole("link", { name: /Field submissions/ })).toHaveAccessibleName(
    "Field submissions, 5 waiting"
  );
});

it("shows the reporting window with the overdue count and a calendar link", () => {
  render(
    <PortalSidebar
      pathname="/dashboard"
      grants={busyGrants}
      status={busyStatus}
      today={new Date("2026-09-27T09:00:00")}
    />
  );
  expect(screen.getByText("Q3 reporting window")).toBeInTheDocument();
  expect(
    screen.getByText("1 donor report overdue. Submit before 30 Sep to stay compliant.")
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Review calendar" })).toHaveAttribute(
    "href",
    "/reporting"
  );
});

it("hides the reporting window from users without the calendar", () => {
  render(
    <PortalSidebar
      pathname="/dashboard"
      grants={[{ permissionCode: "DASHBOARD_VIEW", pillarId: null }]}
      status={busyStatus}
    />
  );
  expect(screen.queryByText("Q3 reporting window")).not.toBeInTheDocument();
});

it("hides platform-wide admin pages from pillar-scoped grants", () => {
  render(
    <PortalSidebar
      pathname="/dashboard"
      grants={[
        { permissionCode: "AUDIT_LOG_VIEW", pillarId: 2 },
        { permissionCode: "USER_MANAGE", pillarId: 2 },
        { permissionCode: "DASHBOARD_VIEW", pillarId: 2 },
      ]}
    />
  );
  expect(screen.queryByRole("link", { name: "Audit log" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Users & roles" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
});

it("names a collapsed icon in a tooltip on hover or keyboard focus, and hides it after", () => {
  render(
    <PortalSidebar
      collapsed
      pathname="/dashboard"
      grants={[
        { permissionCode: "DASHBOARD_VIEW", pillarId: null },
        { permissionCode: "FIELD_SUBMISSION_VIEW", pillarId: null },
      ]}
      status={{ pendingSubmissions: 3, newReferrals: 0, grantsAwaiting: 0, overdueReports: 0 }}
    />
  );
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  const dashboard = screen.getByRole("link", { name: "Dashboard" });
  fireEvent.mouseEnter(dashboard);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Dashboard");
  fireEvent.mouseLeave(dashboard);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  const submissions = screen.getByRole("link", { name: "Field submissions, 3 waiting" });
  fireEvent.focus(submissions);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Field submissions · 3 waiting");
  fireEvent.blur(submissions);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it("shows no tooltip when the sidebar is expanded, since the labels are visible", () => {
  render(
    <PortalSidebar
      pathname="/dashboard"
      grants={[{ permissionCode: "DASHBOARD_VIEW", pillarId: null }]}
    />
  );
  fireEvent.mouseEnter(screen.getByRole("link", { name: "Dashboard" }));
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it("leaves the hidden Leadership pillar out of the navigation", () => {
  render(
    <PortalSidebar
      pathname="/dashboard"
      grants={[{ permissionCode: "DASHBOARD_VIEW", pillarId: null }]}
    />
  );
  expect(screen.queryByRole("link", { name: "Leadership" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "VAWG" })).toBeInTheDocument();
});
