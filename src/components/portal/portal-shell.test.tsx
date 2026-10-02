import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const navigation = vi.hoisted(() => ({ pathname: "/dashboard", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("countyId=4"),
}));
vi.mock("@/lib/auth/actions", () => ({ logoutAction: vi.fn() }));
import { PortalShell } from "./portal-shell";
import { PageHeading } from "./page-heading";
afterEach(() => {
  cleanup();
  navigation.pathname = "/dashboard";
  navigation.push.mockClear();
});
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
it("puts the dashboard's period in the URL, keeping its other filters", () => {
  render(
    <PortalShell session={session}>
      <p>Content</p>
    </PortalShell>
  );
  expect(screen.getByText("Judy Mwangi")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Date range/ }));
  fireEvent.click(screen.getByRole("button", { name: "Last year" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  const lastYear = new Date().getFullYear() - 1;
  expect(navigation.push).toHaveBeenCalledWith(
    `/dashboard?countyId=4&from=${lastYear}-01-01&to=${lastYear}-12-31`,
    { scroll: false }
  );
  fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
  expect(screen.getByText("Dashboard")).toHaveClass("sr-only");
});
it("shows the period picker only on the dashboard", () => {
  navigation.pathname = "/participants";
  render(
    <PortalShell session={session}>
      <p>Content</p>
    </PortalShell>
  );
  expect(screen.queryByRole("button", { name: /Date range/ })).toBeNull();
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

it("shows the current page's title in the header, with no search box, and clears it on leaving", () => {
  const { rerender } = render(
    <PortalShell session={session}>
      <PageHeading title="Women's Economic Empowerment" section="Pillars" />
    </PortalShell>
  );
  const header = screen.getByRole("banner");
  expect(header).toHaveTextContent("Women's Economic Empowerment");
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText(/Search portal/)).not.toBeInTheDocument();
  rerender(
    <PortalShell session={session}>
      <PageHeading title="Participants" section="Records" />
    </PortalShell>
  );
  expect(header).toHaveTextContent("Participants");
  expect(header).not.toHaveTextContent("Women's Economic Empowerment");
  rerender(
    <PortalShell session={session}>
      <p>No heading</p>
    </PortalShell>
  );
  expect(header).not.toHaveTextContent("Participants");
});

it("keeps a page's own buttons as a slim row under the breadcrumb, without a big title or description", () => {
  render(
    <PortalShell session={session}>
      <PageHeading
        title="Participants"
        section="Records"
        description="One registry"
        actions={<button type="button">Register participant</button>}
      />
    </PortalShell>
  );
  expect(screen.getByRole("button", { name: "Register participant" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "Participants" })).toHaveClass("sr-only");
  expect(screen.queryByText("One registry")).not.toBeInTheDocument();
  // The breadcrumb stays on the page, where it was.
  const crumb = screen.getByText(/^Home/);
  expect(crumb).toHaveTextContent("Home / Records / Participants");
});
