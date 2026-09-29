import type { StandardColumns } from "@/types/db";
import { getMockStore } from "../mock-api/store";

export interface EffectiveGrant { permissionCode: string; pillarId: number | null }
const active = (row: StandardColumns) => !row.is_deleted && row.status === "ACTIVE";

export function getEffectiveGrants(userId: number): EffectiveGrant[] {
  const store = getMockStore();
  if (!store.user.some((row) => row.id === userId && active(row))) return [];
  const grants = new Map<string, EffectiveGrant>();
  for (const assignment of store.user_role.filter((row) => row.user_id === userId && active(row))) {
    const role = store.role.find((row) => row.id === assignment.role_id && active(row));
    if (!role) continue;
    if (assignment.pillar_id !== null && !store.pillar.some((row) => row.id === assignment.pillar_id && active(row))) continue;
    if (role.is_system_role && role.code === "SYSTEM_ADMIN") for (const permission of store.permission.filter(active)) {
      grants.set(`${permission.code}:${assignment.pillar_id}`, { permissionCode: permission.code, pillarId: assignment.pillar_id });
    }
    for (const link of store.role_permission.filter((row) => row.role_id === assignment.role_id && active(row))) {
      const permission = store.permission.find((row) => row.id === link.permission_id && active(row));
      if (permission) grants.set(`${permission.code}:${assignment.pillar_id}`, { permissionCode: permission.code, pillarId: assignment.pillar_id });
    }
  }
  return [...grants.values()];
}

export function hasPermission(grants: readonly EffectiveGrant[], code: string, options: { pillarId?: number | null } = {}): boolean {
  return grants.some((grant) => grant.permissionCode === code && (grant.pillarId === null || (options.pillarId != null && grant.pillarId === options.pillarId)));
}

export function hasModulePermission(grants: readonly EffectiveGrant[], code: string): boolean {
  return grants.some((grant) => grant.permissionCode === code);
}
