import { cookies } from "next/headers";
import type { ApiClient } from "@/lib/api/client";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { permissionListSchema, permissionMutationSchema, pillarCatalogSchema, roleInputSchema, roleListSchema, roleMutationSchema, rolePermissionListSchema, rolePermissionMutationSchema, roleSchema, userListSchema, userMutationSchema, userRoleListSchema, userRoleMutationSchema, rolePermissionInputSchema, userRoleInputSchema, pipelineListSchema, stageListSchema, pipelineMutationSchema, stageMutationSchema, lookupListSchema, lookupMutationSchema, type LookupTable } from "./schemas";
import type { z } from "zod";

export type UserView = z.infer<typeof userListSchema>["data"] extends infer T ? NonNullable<T> extends { items: (infer U)[] } ? U : never : never;
export type RoleView = z.infer<typeof roleSchema>;
export type PermissionView = NonNullable<z.infer<typeof permissionListSchema>["data"]>["items"][number];
export type UserRoleView = NonNullable<z.infer<typeof userRoleListSchema>["data"]>["items"][number];
export type RolePermissionView = NonNullable<z.infer<typeof rolePermissionListSchema>["data"]>["items"][number];
export type PipelineView = NonNullable<z.infer<typeof pipelineListSchema>["data"]>["items"][number];
export type StageView = NonNullable<z.infer<typeof stageListSchema>["data"]>["items"][number];
export type LookupView = NonNullable<z.infer<typeof lookupListSchema>["data"]>["items"][number];
export type AdminPage<T> = { items: T[]; page: number; pageSize: number; totalItems: number; totalPages: number };
function required<T>(result: { success: boolean; data: T | null; message: string }): T { if (!result.success || result.data === null) throw new Error(result.message); return result.data; }
type UserListQuery = { page?: number; pageSize?: number; search?: string; status?: string };
export function createAdminApi(client: ApiClient, token: string) {
  const getAll = async <T>(path: "/admin/users" | "/admin/roles" | "/admin/permissions", table: "user_role" | "role_permission" | undefined, schema: z.ZodType<{ success: boolean; data: AdminPage<T> | null; message: string }>) => {
    const items: T[] = [];
    for (let page = 1;; page++) {
      const result = required(await client.request({ method: "GET", path, routeTemplate: path, token, query: { table, includeDeleted: table ? true : undefined, page, pageSize: 100 } }, schema));
      items.push(...result.items);
      if (page >= result.totalPages) return items;
    }
  };
  return {
    async users(query: UserListQuery = {}) { return required(await client.request({ method: "GET", path: "/admin/users", routeTemplate: "/admin/users", token, query: { page: query.page ?? 1, pageSize: query.pageSize ?? 25, search: query.search, status: query.status } }, userListSchema)); },
    roles: () => getAll("/admin/roles", undefined, roleListSchema),
    permissions: () => getAll("/admin/permissions", undefined, permissionListSchema),
    userRoles: () => getAll("/admin/users", "user_role", userRoleListSchema),
    rolePermissions: () => getAll("/admin/permissions", "role_permission", rolePermissionListSchema),
    async pillars() { return required(await client.request({ method: "GET", path: "/admin/users", routeTemplate: "/admin/users", token, query: { catalog: "pillars" } }, pillarCatalogSchema)); },
    async pipelinePillars() { return required(await client.request({ method: "GET", path: "/admin/pipelines", routeTemplate: "/admin/pipelines", token, query: { catalog: "pillars" } }, pillarCatalogSchema)); },
    pipelines(query: { page?: number; pageSize?: number } = {}) { return client.request({ method: "GET", path: "/admin/pipelines", routeTemplate: "/admin/pipelines", token, query: { page: query.page ?? 1, pageSize: query.pageSize ?? 100 } }, pipelineListSchema).then(required); },
    stages(pipelineId: number, query: { page?: number; pageSize?: number } = {}) { return client.request({ method: "GET", path: "/admin/pipelines", routeTemplate: "/admin/pipelines", token, query: { table: "stage_definition", pipeline_id: pipelineId, page: query.page ?? 1, pageSize: query.pageSize ?? 100, sortBy: "step_no" } }, stageListSchema).then(required); },
    createPipeline(body: { pillar_id: number; name: string; first_stage: string; last_stage: string }) { return client.request({ method: "POST", path: "/admin/pipelines", routeTemplate: "/admin/pipelines", token, body }, pipelineMutationSchema); },
    stageCommand(pipelineId: number, body: { action: string; stageId?: number; name?: string; position?: number; direction?: "up" | "down" }) { return client.request({ method: "PATCH", path: `/admin/pipelines/${pipelineId}`, routeTemplate: "/admin/pipelines/:id", token, query: { operation: "stage" }, body }, stageMutationSchema); },
    lookupList(table: LookupTable, query: { page?: number; pageSize?: number; search?: string; parentId?: number; status?: string } = {}) { const relation = table === "sub_county" ? "county_id" : table === "ward" ? "sub_county_id" : undefined; return client.request({ method: "GET", path: `/lookups/${table}`, routeTemplate: "/lookups/:table", token, query: { page: query.page ?? 1, pageSize: query.pageSize ?? 25, search: query.search, ...(relation && query.parentId ? { [relation]: query.parentId } : {}), status: query.status, includeDeleted: true } }, lookupListSchema).then(required); },
    createLookup(table: LookupTable, body: Record<string, unknown>) { return client.request({ method: "POST", path: `/lookups/${table}`, routeTemplate: "/lookups/:table", token, body }, lookupMutationSchema); },
    updateLookup(table: LookupTable, id: number, body: Record<string, unknown>) { return client.request({ method: "PATCH", path: `/lookups/${table}/${id}`, routeTemplate: "/lookups/:table/:id", token, body }, lookupMutationSchema); },
    createUser(body: { first_name: string; last_name: string; username: string; email?: string; phone_number?: string }) { return client.request({ method: "POST", path: "/admin/users", routeTemplate: "/admin/users", token, body }, userMutationSchema); },
    updateUser(id: number, body: { first_name: string; last_name: string; email?: string | null; phone_number?: string | null; status?: string }) { return client.request({ method: "PATCH", path: `/admin/users/${id}`, routeTemplate: "/admin/users/:id", token, body: Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined)) }, userMutationSchema); },
    createRole(body: z.input<typeof roleInputSchema>) { return client.request({ method: "POST", path: "/admin/roles", routeTemplate: "/admin/roles", token, body }, roleMutationSchema); },
    updateRole(id: number, body: { name: string; description?: string | null }) { return client.request({ method: "PATCH", path: `/admin/roles/${id}`, routeTemplate: "/admin/roles/:id", token, body }, roleMutationSchema); },
    createPermission(body: { code: string; module: string; name: string; description?: string }) { return client.request({ method: "POST", path: "/admin/permissions", routeTemplate: "/admin/permissions", token, body }, permissionMutationSchema); },
    setUserRole(input: z.input<typeof userRoleInputSchema>, existingId?: number) {
      return existingId ? client.request({ method: "PATCH", path: `/admin/users/${existingId}`, routeTemplate: "/admin/users/:id", token, query: { table: "user_role" }, body: { is_deleted: !input.enabled, status: input.enabled ? "ACTIVE" : "INACTIVE" } }, userRoleMutationSchema)
        : client.request({ method: "POST", path: "/admin/users", routeTemplate: "/admin/users", token, query: { table: "user_role" }, body: { user_id: input.userId, role_id: input.roleId, pillar_id: input.pillarId } }, userRoleMutationSchema);
    },
    setRolePermission(input: z.input<typeof rolePermissionInputSchema>, existingId?: number) {
      return existingId ? client.request({ method: "PATCH", path: `/admin/permissions/${existingId}`, routeTemplate: "/admin/permissions/:id", token, query: { table: "role_permission" }, body: { is_deleted: !input.enabled, status: input.enabled ? "ACTIVE" : "INACTIVE" } }, rolePermissionMutationSchema)
        : client.request({ method: "POST", path: "/admin/permissions", routeTemplate: "/admin/permissions", token, query: { table: "role_permission" }, body: { role_id: input.roleId, permission_id: input.permissionId } }, rolePermissionMutationSchema);
    },
  };
}
async function bound() { const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value; if (!token) throw new Error("Sign in required"); return createAdminApi(createPortalApiClient(), token); }
export const adminApi = { users: async (query?: UserListQuery) => (await bound()).users(query), roles: async () => (await bound()).roles(), permissions: async () => (await bound()).permissions(), userRoles: async () => (await bound()).userRoles(), rolePermissions: async () => (await bound()).rolePermissions(), pillars: async () => (await bound()).pillars() };
