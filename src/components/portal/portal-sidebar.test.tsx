import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PortalSidebar } from "./portal-sidebar";
import { navigationGroups } from "./navigation";

afterEach(cleanup);
it("preserves the designer's five groups", () => {
  expect(navigationGroups.map(group => group.label)).toEqual(["Overview", "Pillars", "Records", "Reporting", "Admin"]);
});
it("uses the planned UI routes for reporting, audit and lookup pages", () => {
  const items = navigationGroups.flatMap(group => group.items);
  expect(items.find(item => item.label === "Reporting calendar")?.href).toBe("/reporting");
  expect(items.find(item => item.label === "Audit log")?.href).toBe("/audit");
  expect(items.find(item => item.label === "Lookup tables")?.href).toBe("/admin/lookups/pillar");
});
it("uses effective grants, scope, and implemented routes", () => {
  render(<PortalSidebar pathname="/participants/12" grants={[{permissionCode:"PARTICIPANT_VIEW", pillarId:2}, {permissionCode:"DASHBOARD_VIEW",pillarId:2}]} availableRoutes={["/dashboard", "/participants", "/pillars/vawg", "/pillars/wee", "/admin/users"]} />);
  expect(screen.getByRole("link", {name:"Participants"})).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", {name:"WEE"})).toBeInTheDocument();
  expect(screen.queryByRole("link", {name:"VAWG"})).not.toBeInTheDocument();
  expect(screen.queryByRole("link", {name:"Users & roles"})).not.toBeInTheDocument();
  expect(screen.queryByRole("link", {name:"Grants"})).not.toBeInTheDocument();
});
it("retains accessible names when collapsed and shows only implemented permitted routes", () => {
  render(<PortalSidebar collapsed pathname="/dashboard" grants={[{permissionCode:"DASHBOARD_VIEW",pillarId:null}]} />);
  expect(screen.getByRole("link", {name:"Dashboard"})).toHaveAttribute("title", "Dashboard");
  expect(screen.getByText("Dashboard")).toHaveClass("sr-only");
  expect(screen.getByRole("link", {name:"VAWG"})).toHaveAttribute("href", "/pillars/vawg");
  expect(screen.queryByRole("link", {name:"Participants"})).not.toBeInTheDocument();
});
it("does not advertise a pillar page to a grant that the page cannot serve", () => {
  render(<PortalSidebar pathname="/field-submissions" grants={[{permissionCode:"COUNSELLING_VIEW",pillarId:1}]} />);
  expect(screen.queryByRole("link", {name:"VAWG"})).not.toBeInTheDocument();
});
it("shows completed participant and referral routes to permitted users", () => {
  render(<PortalSidebar pathname="/participants" grants={[{permissionCode:"PARTICIPANT_VIEW",pillarId:2},{permissionCode:"REFERRAL_VIEW",pillarId:2}]} />);
  expect(screen.getByRole("link", {name:"Participants"})).toHaveAttribute("href", "/participants");
  expect(screen.getByRole("link", {name:"Referral queue"})).toHaveAttribute("href", "/referrals");
});
it("requires a global lookup grant while allowing a scoped pipeline grant", () => {
  render(<PortalSidebar pathname="/admin/pipelines" grants={[{permissionCode:"LOOKUP_MANAGE",pillarId:2},{permissionCode:"PILLAR_CONFIG_MANAGE",pillarId:2}]} />);
  expect(screen.getByRole("link", {name:"Pipeline config"})).toBeInTheDocument();
  expect(screen.queryByRole("link", {name:"Lookup tables"})).not.toBeInTheDocument();
});
