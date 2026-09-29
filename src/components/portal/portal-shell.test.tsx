import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/auth/actions", () => ({ logoutAction: vi.fn() }));
import { PortalShell, usePortalPeriod } from "./portal-shell";
afterEach(cleanup);
const session = {
  user: {
    id: 1,
    firstName: "Judy",
    lastName: "Mwangi",
    name: "Judy Mwangi",
    email: "judy@creaw.org",
    initials: "JM",
  },
  grants: [{ permissionCode: "DASHBOARD_VIEW", pillarId: null }],
};
function Content() {
  const period = usePortalPeriod();
  return <p>{period.quarter}</p>;
}
it("shows the signed-in identity and exposes quarter selection to pages", () => {
  render(
    <PortalShell session={session}>
      <Content />
    </PortalShell>
  );
  expect(screen.getByText("Judy Mwangi")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Reporting quarter"), { target: { value: "2026-Q2" } });
  expect(screen.getByText("2026-Q2")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Reporting quarter"), { target: { value: "2025-Q2" } });
  expect(screen.getByRole("option", { name: "Q3 2026 (Jul–Sep)" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
  expect(screen.getByText("Dashboard")).toHaveClass("sr-only");
});
it("opens a labelled mobile drawer and notification dialog", async () => {
  render(
    <PortalShell session={session}>
      <p>Content</p>
    </PortalShell>
  );
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  expect(await screen.findByRole("dialog", { name: "Navigation" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
  expect(await screen.findByRole("dialog", { name: "Notifications" })).toHaveTextContent(
    "No new notifications."
  );
});
