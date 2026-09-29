import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import type { ApiRouteTemplate } from "@/lib/api/transport";

const request = (userId: number, method: "GET" | "POST" | "PATCH", path: string, routeTemplate: ApiRouteTemplate, body?: unknown, query?: Record<string, string>) =>
  handleMockRequest({ method, path, routeTemplate, body, query, token: issueMockToken(userId), correlationId: "admin-security" });
beforeEach(() => resetMockStore());

describe("direct admin handler requests", () => {
  it("blocks forged scope changes, built-in role links and self lockout", async () => {
    const store = getMockStore();
    expect((await request(1, "PATCH", "/admin/users/1", "/admin/users/:id", { is_deleted: true })).resultCode).toBe(403);
    expect((await request(1, "PATCH", "/admin/users/1", "/admin/users/:id", { user_id: 4, role_id: 1, pillar_id: null }, { table: "user_role" })).resultCode).toBe(422);
    expect((await request(1, "PATCH", "/admin/permissions/1", "/admin/permissions/:id", { is_deleted: true }, { table: "role_permission" })).resultCode).toBe(403);
    expect((await request(1, "POST", "/admin/roles", "/admin/roles", { code: "SUPER", name: "Super", is_system_role: true })).resultCode).toBe(422);
    expect(store.user[0].is_deleted).toBe(false);
  });

  it("cannot assign a role whose effective permissions exceed the actor's global grants", async () => {
    const store = getMockStore();
    store.user[12].status = "ACTIVE";
    store.role.push({ ...store.role[2], id: 100, code: "ROLE_ASSIGNER", name: "Role assigner", is_system_role: false });
    const manage = store.permission.find(row => row.code === "ROLE_MANAGE")!;
    store.role_permission.push({ ...store.role_permission[0], id: 10000, role_id: 100, permission_id: manage.id });
    store.user_role.push({ ...store.user_role[0], id: 10000, user_id: 13, role_id: 100, pillar_id: null });
    // A built-in System Administrator has every active permission even if its
    // explicit link table is incomplete after a new permission is created.
    store.role_permission.filter(row => row.role_id === 1 && row.permission_id !== manage.id).forEach(row => { row.is_deleted = true; });
    store.permission.push({ ...store.permission[0], id: 10000, code: "FUTURE_ADMIN_GRANT", name: "Future grant" });
    const response = await request(13, "POST", "/admin/users", "/admin/users", { user_id: 4, role_id: 1, pillar_id: null }, { table: "user_role" });
    expect(response.resultCode).toBe(403);
    expect(store.user_role.some(row => row.user_id === 4 && row.role_id === 1)).toBe(false);
  });

  it("applies privilege checks when reactivating old grants", async () => {
    const store = getMockStore();
    store.user[12].status = "ACTIVE";
    store.role.push({ ...store.role[2], id: 100, code: "LIMITED_MANAGER", name: "Limited manager", is_system_role: false });
    const roleManage = store.permission.find(row => row.code === "ROLE_MANAGE")!;
    const permissionManage = store.permission.find(row => row.code === "PERMISSION_MANAGE")!;
    const auditView = store.permission.find(row => row.code === "AUDIT_LOG_VIEW")!;
    store.role_permission.push({ ...store.role_permission[0], id: 10000, role_id: 100, permission_id: roleManage.id });
    store.role_permission.push({ ...store.role_permission[0], id: 10001, role_id: 100, permission_id: permissionManage.id });
    store.user_role.push({ ...store.user_role[0], id: 10000, user_id: 13, role_id: 100, pillar_id: null });
    store.user_role.push({ ...store.user_role[0], id: 10001, user_id: 4, role_id: 1, pillar_id: null, is_deleted: true, status: "INACTIVE" });
    store.role_permission.push({ ...store.role_permission[0], id: 10002, role_id: 3, permission_id: auditView.id, is_deleted: true, status: "INACTIVE" });

    const roleResponse = await request(13, "PATCH", "/admin/users/10001", "/admin/users/:id", { is_deleted: false, status: "ACTIVE" }, { table: "user_role" });
    const permissionResponse = await request(13, "PATCH", "/admin/permissions/10002", "/admin/permissions/:id", { is_deleted: false, status: "ACTIVE" }, { table: "role_permission" });

    expect(roleResponse.resultCode).toBe(403);
    expect(permissionResponse.resultCode).toBe(403);
    expect(store.user_role.find(row => row.id === 10001)?.is_deleted).toBe(true);
    expect(store.role_permission.find(row => row.id === 10002)?.is_deleted).toBe(true);
  });
});
