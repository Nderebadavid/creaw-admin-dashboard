import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ userId: 1, token: "" }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: state.token }) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session-server", () => ({ requireSession: async () => ({ user: { id: state.userId }, grants: (await import("@/lib/auth/permissions")).getEffectiveGrants(state.userId) }) }));
import { getEffectiveGrants } from "@/lib/auth/permissions";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createRoleAction, updateRoleAction, createPermissionAction, setRolePermissionAction } from "./actions";

beforeEach(() => { resetMockStore(); state.userId = 1; state.token = issueMockToken(1); });
const asUser = (id: number) => { state.userId = id; state.token = issueMockToken(id); };

describe("role and permission Server Actions", () => {
  it("rejects built-in role edits and preserves system administrator grants", async () => {
    expect((await updateRoleAction({ id: 1, name: "Changed", description: "" })).resultCode).toBe(403);
    const permission = getMockStore().permission.find(row => row.code === "AUDIT_LOG_VIEW")!;
    expect((await setRolePermissionAction({ roleId: 1, permissionId: permission.id, enabled: false })).resultCode).toBe(403);
  });

  it("updates the matrix and immediately recomputes effective grants", async () => {
    const permission = getMockStore().permission.find(row => row.code === "AUDIT_LOG_VIEW")!;
    expect(getEffectiveGrants(3).some(grant => grant.permissionCode === permission.code)).toBe(false);
    expect((await setRolePermissionAction({ roleId: 3, permissionId: permission.id, enabled: true })).resultCode).toBe(200);
    expect(getEffectiveGrants(3).some(grant => grant.permissionCode === permission.code && grant.pillarId === 2)).toBe(true);
    expect(getMockStore().audit_logs.at(-1)?.entity_type).toBe("role_permission");
  });

  it("reactivates a revoked role permission in place", async () => {
    const permission = getMockStore().permission.find(row => row.code === "PARTICIPANT_VIEW")!;
    const link = getMockStore().role_permission.find(row => row.role_id === 3 && row.permission_id === permission.id)!;
    expect((await setRolePermissionAction({ roleId: 3, permissionId: permission.id, enabled: false })).resultCode).toBe(200);
    expect(link.is_deleted).toBe(true);
    expect((await setRolePermissionAction({ roleId: 3, permissionId: permission.id, enabled: true })).resultCode).toBe(200);
    expect(link.is_deleted).toBe(false);
    expect(getMockStore().role_permission.filter(row => row.role_id === 3 && row.permission_id === permission.id)).toHaveLength(1);
  });

  it("denies permission management without PERMISSION_MANAGE and validates new role/permission", async () => {
    asUser(3);
    expect((await createPermissionAction({ code: "NEW_SECRET", module: "ADMIN", name: "New secret" })).resultCode).toBe(403);
    expect((await setRolePermissionAction({ roleId: 3, permissionId: 1, enabled: true })).resultCode).toBe(403);
    asUser(1);
    expect((await createRoleAction({ code: "ANALYST", name: "Analyst" })).resultCode).toBe(201);
    expect((await createPermissionAction({ code: "ANALYST_VIEW", module: "REPORTING", name: "View analysis" })).resultCode).toBe(201);
    expect(getEffectiveGrants(1).some(grant => grant.permissionCode === "ANALYST_VIEW")).toBe(true);
  });
});
