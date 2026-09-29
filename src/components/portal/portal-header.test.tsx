import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const logoutAction = vi.fn(async () => undefined);
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/auth/actions", () => ({ logoutAction: () => logoutAction() }));

import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";

afterEach(() => {
  cleanup();
  logoutAction.mockClear();
});

const status = { pendingSubmissions: 5, newReferrals: 0, grantsAwaiting: 2, overdueReports: 1 };

describe("NotificationsMenu", () => {
  it("lists waiting work as links and flags unread items on the bell", () => {
    render(<NotificationsMenu status={status} />);
    const bell = screen.getByRole("button", { name: "Notifications, 3 unread" });
    fireEvent.click(bell);
    const menu = screen.getByRole("region", { name: "Notifications" });
    expect(within(menu).getByRole("link", { name: /1 donor report overdue/ })).toHaveAttribute(
      "href",
      "/reporting"
    );
    expect(
      within(menu).getByRole("link", { name: /5 field submissions awaiting review/ })
    ).toHaveAttribute("href", "/field-submissions");
    expect(
      within(menu).getByRole("link", { name: /2 grant applications awaiting sign-off/ })
    ).toHaveAttribute("href", "/grants");
    expect(within(menu).queryByText(/referral/)).not.toBeInTheDocument();
  });

  it("clears the unread marker after confirming Mark all read", async () => {
    render(<NotificationsMenu status={status} />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications, 3 unread" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    const dialog = await screen.findByRole("dialog", { name: "Mark all as read?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark all read" }));
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  it("says when there is nothing waiting", () => {
    render(<NotificationsMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });
});

const user = {
  id: 7,
  firstName: "Judy",
  lastName: "Mwangi",
  name: "Judy Mwangi",
  email: "judy@creaw.org",
  initials: "JM",
  roles: ["System Administrator", "Head of MERL"],
};

describe("UserMenu", () => {
  it("shows the role line and links the user's own activity", () => {
    render(<UserMenu user={user} canManageUsers canViewAudit />);
    expect(screen.getByText("System Administrator + Head of MERL")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Account for Judy Mwangi" }));
    expect(screen.getByRole("link", { name: "My activity" })).toHaveAttribute(
      "href",
      "/audit?userId=7"
    );
    expect(screen.getByRole("link", { name: "Users & roles" })).toHaveAttribute(
      "href",
      "/admin/users"
    );
  });

  it("hides admin links the user cannot open", () => {
    render(<UserMenu user={user} canManageUsers={false} canViewAudit={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Account for Judy Mwangi" }));
    expect(screen.queryByRole("link", { name: "Users & roles" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My activity" })).not.toBeInTheDocument();
  });

  it("asks before signing out", async () => {
    render(<UserMenu user={user} canManageUsers canViewAudit />);
    fireEvent.click(screen.getByRole("button", { name: "Account for Judy Mwangi" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    const dialog = await screen.findByRole("dialog", { name: "Sign out?" });
    expect(dialog).toHaveTextContent(
      "Sign out of the MERL Portal on this device? Unsaved changes will be lost."
    );
    expect(logoutAction).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out" }));
    expect(logoutAction).toHaveBeenCalledOnce();
  });
});
