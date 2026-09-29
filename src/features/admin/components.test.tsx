import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
vi.mock("./actions", () => ({ createUserAction: vi.fn(), updateUserAction: vi.fn(), setUserRoleAction: vi.fn(), createRoleAction: vi.fn(), updateRoleAction: vi.fn(), createPermissionAction: vi.fn(), setRolePermissionAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { UsersContent } from "./users-components";
import { PermissionsContent } from "./permissions-components";

describe("administration screens", () => {
  it("shows masked staff contacts, role scope and user controls", () => {
    render(<UsersContent initial={{ page: 1, pageSize: 25, totalItems: 1, totalPages: 1, items: [{ id: 2, first_name: "Grace", middle_name: null, last_name: "Wanjiru", username: "grace.wanjiru", email: "••••org", phone_number: "••••5678", status: "ACTIVE", is_deleted: false }] }} roles={[{ id: 2, code: "HEAD_MERL", name: "Head of MERL", description: null, status: "ACTIVE", is_deleted: false, is_system_role: true }]} assignments={[{ id: 2, user_id: 2, role_id: 2, pillar_id: null, status: "ACTIVE", is_deleted: false }]} pillars={[]} canManageUsers canManageRoles />);
    expect(screen.getByText("Grace Wanjiru")).toBeInTheDocument();
    expect(screen.getByText("System-wide")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add staff/i })).toBeInTheDocument();
    expect(screen.queryByText("grace@example.org")).not.toBeInTheDocument();
  });
  it("keeps built-in role matrix cells disabled", () => {
    render(<PermissionsContent roles={[{ id: 1, code: "SYSTEM_ADMIN", name: "System Administrator", description: null, status: "ACTIVE", is_deleted: false, is_system_role: true }]} permissions={[{ id: 1, code: "AUDIT_LOG_VIEW", name: "View audit log", module: "ADMIN", description: null, status: "ACTIVE", is_deleted: false }]} grants={[{ id: 1, role_id: 1, permission_id: 1, status: "ACTIVE", is_deleted: false }]} canManageRoles canManagePermissions />);
    expect(screen.getByText(/built-in roles cannot be edited/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view audit log/i })).toBeDisabled();
  });
});
