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
it("retains accessible names when collapsed and omits unavailable routes", () => {
  render(<PortalSidebar collapsed pathname="/dashboard" grants={[{permissionCode:"DASHBOARD_VIEW",pillarId:null}]} />);
  expect(screen.getByRole("link", {name:"Dashboard"})).toHaveAttribute("title", "Dashboard");
  expect(screen.getByText("Dashboard")).toHaveClass("sr-only");
  expect(screen.queryByRole("link", {name:"VAWG"})).not.toBeInTheDocument();
});
