import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/auth/actions", () => ({ logoutAction: vi.fn() }));
import { PortalShell, usePortalDateRange } from "./portal-shell";
afterEach(cleanup);
const session = {
  user: {
    id: 1,
    firstName: "Judy",
    lastName: "Mwangi",
    name: "Judy Mwangi",
    email: "judy@creaw.org",
    initials: "JM",
    roles: ["System Administrator"],
  },
  grants: [{ permissionCode: "DASHBOARD_VIEW", pillarId: null }],
};
function Content() {
  const { range } = usePortalDateRange();
  return <p>{`${range.from}..${range.to}`}</p>;
}
it("shows the signed-in identity and shares the applied date range with pages", () => {
  render(
    <PortalShell session={session}>
      <Content />
    </PortalShell>
  );
  expect(screen.getByText("Judy Mwangi")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Date range/ }));
  fireEvent.click(screen.getByRole("button", { name: "Last year" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  const lastYear = new Date().getFullYear() - 1;
  expect(screen.getByText(`${lastYear}-01-01..${lastYear}-12-31`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
  expect(screen.getByText("Dashboard")).toHaveClass("sr-only");
});
it("opens a labelled mobile drawer and the notifications panel", async () => {
  render(
    <PortalShell session={session}>
      <p>Content</p>
    </PortalShell>
  );
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  expect(await screen.findByRole("dialog", { name: "Navigation" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
  expect(screen.getByRole("region", { name: "Notifications" })).toHaveTextContent(
    "You're all caught up."
  );
});
