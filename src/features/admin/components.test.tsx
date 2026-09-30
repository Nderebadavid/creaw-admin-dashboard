import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
vi.mock("./actions", () => ({
  createUserAction: vi.fn(),
  listUsersAction: vi.fn(),
  updateUserAction: vi.fn(),
  setUserRoleAction: vi.fn(),
  createRoleAction: vi.fn(),
  updateRoleAction: vi.fn(),
  createPermissionAction: vi.fn(),
  setRolePermissionAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { UsersContent } from "./users-components";
import { PermissionsContent } from "./permissions-components";
import { setRolePermissionAction } from "./actions";

const editableRole = {
  id: 3,
  code: "PILLAR_LEAD",
  name: "Pillar Lead",
  description: null,
  status: "ACTIVE",
  is_deleted: false,
  is_system_role: false,
};
const permission = (id: number, code: string, name: string) => ({
  id,
  code,
  name,
  module: "ADMIN",
  description: null,
  status: "ACTIVE",
  is_deleted: false,
});
const grant = (id: number, permissionId: number) => ({
  id,
  role_id: 3,
  permission_id: permissionId,
  status: "ACTIVE",
  is_deleted: false,
});
afterEach(() => {
  cleanup();
  vi.mocked(setRolePermissionAction).mockReset();
});

describe("administration screens", () => {
  it("shows masked staff contacts, role scope and user controls", () => {
    render(
      <UsersContent
        initial={{
          page: 1,
          pageSize: 25,
          totalItems: 1,
          totalPages: 1,
          items: [
            {
              id: 2,
              first_name: "Grace",
              middle_name: null,
              last_name: "Wanjiru",
              username: "grace.wanjiru",
              email: "••••org",
              phone_number: "••••5678",
              status: "ACTIVE",
              is_deleted: false,
            },
          ],
        }}
        roles={[
          {
            id: 2,
            code: "HEAD_MERL",
            name: "Head of MERL",
            description: null,
            status: "ACTIVE",
            is_deleted: false,
            is_system_role: true,
          },
        ]}
        assignments={[
          { id: 2, user_id: 2, role_id: 2, pillar_id: null, status: "ACTIVE", is_deleted: false },
        ]}
        pillars={[]}
        canManageUsers
        canManageRoles
      />
    );
    expect(screen.getByText("Grace Wanjiru")).toBeInTheDocument();
    expect(screen.getByText("System-wide")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add user" })).toBeInTheDocument();
    expect(screen.queryByText("grace@example.org")).not.toBeInTheDocument();
  });
  it("lays out staff accounts like the design", () => {
    render(
      <UsersContent
        heading={{
          title: "Users & roles",
          section: "Admin",
          description: "Staff accounts and the roles that drive their navigation",
        }}
        initial={{
          page: 1,
          pageSize: 25,
          totalItems: 1,
          totalPages: 1,
          items: [
            {
              id: 2,
              first_name: "Grace",
              middle_name: null,
              last_name: "Wanjiru",
              username: "grace.wanjiru",
              email: "••••org",
              phone_number: "••••5678",
              status: "ACTIVE",
              is_deleted: false,
            },
          ],
        }}
        roles={[
          {
            id: 2,
            code: "HEAD_MERL",
            name: "Head of MERL",
            description: null,
            status: "ACTIVE",
            is_deleted: false,
            is_system_role: true,
          },
          {
            id: 3,
            code: "PILLAR_LEAD",
            name: "Pillar Lead",
            description: null,
            status: "ACTIVE",
            is_deleted: false,
            is_system_role: false,
          },
        ]}
        assignments={[
          { id: 2, user_id: 2, role_id: 2, pillar_id: null, status: "ACTIVE", is_deleted: false },
          { id: 3, user_id: 2, role_id: 3, pillar_id: 1, status: "ACTIVE", is_deleted: false },
        ]}
        pillars={[{ id: 1, name: "VAWG" }]}
        permissionCount={42}
        canManageUsers
        canManageRoles
      />
    );
    const header = screen
      .getByRole("heading", { level: 1, name: "Users & roles" })
      .closest("[data-page-heading]") as HTMLElement;
    expect(within(header).getByRole("button", { name: "Add user" })).toBeInTheDocument();
    for (const label of ["Staff accounts", "Roles configured", "Multi-role users", "Permissions"])
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Pillar scope" })).toBeInTheDocument();
    expect(screen.getByText("System-wide, VAWG")).toBeInTheDocument();
    expect(
      screen.getByText("Multi-role users see the union of their roles’ modules")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions for Grace Wanjiru" })).toBeInTheDocument();
  });
  it("keeps built-in role matrix cells disabled", () => {
    render(
      <PermissionsContent
        roles={[
          {
            id: 1,
            code: "SYSTEM_ADMIN",
            name: "System Administrator",
            description: null,
            status: "ACTIVE",
            is_deleted: false,
            is_system_role: true,
          },
        ]}
        permissions={[
          {
            id: 1,
            code: "AUDIT_LOG_VIEW",
            name: "View audit log",
            module: "ADMIN",
            description: null,
            status: "ACTIVE",
            is_deleted: false,
          },
        ]}
        grants={[{ id: 1, role_id: 1, permission_id: 1, status: "ACTIVE", is_deleted: false }]}
        canManageRoles
        canManagePermissions
      />
    );
    expect(screen.getByText(/built-in roles cannot be edited/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view audit log/i })).toBeDisabled();
  });
  it("puts role and permission creation beside the heading and explains the matrix", () => {
    render(
      <PermissionsContent
        heading={{
          title: "Roles & permissions",
          section: "Admin",
          description: "Create roles and permissions, then choose exactly what each role can do",
        }}
        roles={[]}
        permissions={[]}
        grants={[]}
        canManageRoles
        canManagePermissions
      />
    );
    const header = screen
      .getByRole("heading", { level: 1, name: "Roles & permissions" })
      .closest("[data-page-heading]") as HTMLElement;
    expect(within(header).getByRole("button", { name: "New permission" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "New role" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Matrix overview/ }));
    for (const label of ["Granted", "Not granted", "Unsaved"])
      expect(screen.getByText(label)).toBeInTheDocument();
  });
  it("reconciles refreshed authoritative grants while retaining only unresolved drafts", async () => {
    const first = permission(1, "AUDIT_LOG_VIEW", "View audit log"),
      second = permission(2, "USER_MANAGE", "Manage users");
    const props = {
      roles: [editableRole],
      permissions: [first, second],
      canManageRoles: true,
      canManagePermissions: true,
    };
    const view = render(<PermissionsContent {...props} grants={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /view audit log/i }));
    expect(screen.getByText("1 unsaved change")).toBeInTheDocument();

    view.rerender(<PermissionsContent {...props} grants={[grant(10, second.id)]} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /manage users/i })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    );
    expect(screen.getByRole("button", { name: /view audit log/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByText("1 unsaved change")).toBeInTheDocument();

    view.rerender(
      <PermissionsContent {...props} grants={[grant(10, second.id), grant(11, first.id)]} />
    );
    await waitFor(() => expect(screen.queryByText("1 unsaved change")).not.toBeInTheDocument());
  });
  it("reports partial saves by successful operations, even when grant and revoke counts cancel", async () => {
    const add = permission(2, "USER_MANAGE", "Manage users"),
      remove = permission(1, "AUDIT_LOG_VIEW", "View audit log"),
      fail = permission(3, "ROLE_MANAGE", "Manage roles");
    const action = vi.mocked(setRolePermissionAction);
    action
      .mockResolvedValueOnce({ resultCode: 200, success: true, message: "OK", data: { id: 20 } })
      .mockResolvedValueOnce({ resultCode: 200, success: true, message: "OK", data: { id: 21 } })
      .mockResolvedValueOnce({ resultCode: 403, success: false, message: "Denied", data: null });
    const props = {
      roles: [editableRole],
      permissions: [add, remove, fail],
      canManageRoles: true,
      canManagePermissions: true,
    };
    const view = render(<PermissionsContent {...props} grants={[grant(10, remove.id)]} />);
    fireEvent.click(screen.getByRole("button", { name: /manage users/i }));
    fireEvent.click(screen.getByRole("button", { name: /view audit log/i }));
    fireEvent.click(screen.getByRole("button", { name: /manage roles/i }));
    fireEvent.click(screen.getByRole("button", { name: /review & save/i }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /save changes/i })
    );
    await waitFor(() => expect(action).toHaveBeenCalledTimes(3));
    expect(screen.getByText(/some changes were saved/i)).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    view.rerender(<PermissionsContent {...props} grants={[grant(11, add.id)]} />);
    await waitFor(() => expect(screen.getByText("1 unsaved change")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /manage users/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /view audit log/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: /manage roles/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
  it("accepts a fresh empty authoritative snapshot after a locally saved grant", async () => {
    const item = permission(1, "AUDIT_LOG_VIEW", "View audit log");
    vi.mocked(setRolePermissionAction).mockResolvedValue({
      resultCode: 200,
      success: true,
      message: "OK",
      data: { id: 10 },
    });
    const props = {
      roles: [editableRole],
      permissions: [item],
      canManageRoles: true,
      canManagePermissions: true,
    };
    const view = render(<PermissionsContent {...props} grants={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /view audit log/i }));
    fireEvent.click(screen.getByRole("button", { name: /review & save/i }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /save changes/i })
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /view audit log/i })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/permission changes saved/i)
    );

    view.rerender(<PermissionsContent {...props} grants={[]} />);
    expect(screen.getByRole("button", { name: /view audit log/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.queryByText("1 unsaved change")).not.toBeInTheDocument();
  });
});
