import { getEffectiveGrants, hasPermission } from "../../auth/permissions";
import { type ResourceContext } from "../context";
import { addsGrantsBeyondActor, envelope, type Row } from "../core";
import { type ApiEnvelope } from "@/types/api";
import type { MockStore, TableName } from "@/types/db";

type Check = (ctx: ResourceContext, body: Row) => ApiEnvelope<unknown> | undefined;

const LAST_ADMIN = "You cannot remove your last global permission-management grant";

/** True when the body writes any column outside `allowed`. */
const hasOtherKeys = (body: Row, allowed: string[]) =>
  Object.keys(body).some((key) => !allowed.includes(key));

/** The write soft-deletes or deactivates the row. */
const isDeactivating = (body: Row) =>
  body.is_deleted === true || Boolean(body.status && body.status !== "ACTIVE");

/** An inactive or deleted link row ends up active, or a new link is created. */
function becomesActive(ctx: ResourceContext, body: Row) {
  const { request, existing } = ctx;
  return (
    request.method === "POST" ||
    (!!existing &&
      (existing.is_deleted || existing.status !== "ACTIVE") &&
      (body.is_deleted ?? existing.is_deleted) === false &&
      (body.status ?? existing.status) === "ACTIVE")
  );
}

/**
 * A copy of the store with one row's status and soft-delete flag changed as
 * the body asks (or forced active), for "what would this change grant?" checks.
 */
function withStatusChange(
  store: MockStore,
  table: "user" | "role" | "role_permission",
  id: number | undefined,
  body: Row,
  forceActive = false
): MockStore {
  const rows = store[table] as unknown as Row[];
  return {
    ...store,
    [table]: rows.map((row) =>
      row.id === id
        ? {
            ...row,
            status: forceActive ? "ACTIVE" : ((body.status as string | undefined) ?? row.status),
            is_deleted: (body.is_deleted as boolean | undefined) ?? row.is_deleted,
          }
        : row
    ),
  };
}

/** The caller would no longer hold PERMISSION_MANAGE anywhere, so nobody could undo this. */
const losesPermissionManage = (userId: number, hypothetical: MockStore) =>
  !hasPermission(getEffectiveGrants(userId, hypothetical), "PERMISSION_MANAGE");

/** Codes a role confers; System Administrator implicitly holds every active permission. */
function roleCodes(store: MockStore, role: MockStore["role"][number]): string[] {
  const active = (row: { is_deleted: boolean; status: string }) =>
    !row.is_deleted && row.status === "ACTIVE";
  if (role.is_system_role && role.code === "SYSTEM_ADMIN")
    return store.permission.filter(active).map((permission) => permission.code);
  return store.role_permission
    .filter((link) => link.role_id === role.id && active(link))
    .map((link) => store.permission.find((p) => p.id === link.permission_id && active(p))?.code)
    .filter((code): code is string => !!code);
}

const checkUser: Check = (ctx, body) => {
  const { request, store, userId, grants, existing } = ctx;
  const allowed =
    request.method === "POST"
      ? ["first_name", "middle_name", "last_name", "username", "phone_number", "email"]
      : [
          "first_name",
          "middle_name",
          "last_name",
          "phone_number",
          "email",
          "status",
          "status_description",
          "is_deleted",
        ];
  if (hasOtherKeys(body, allowed)) return envelope(422);
  if (request.method === "PATCH" && existing?.id === userId && isDeactivating(body))
    return envelope(403, null, "You cannot disable your own account");
  // Reactivating an account must not hand it grants the caller doesn't hold.
  if (existing && existing.status !== "ACTIVE" && body.status === "ACTIVE") {
    const hypothetical = withStatusChange(store, "user", existing.id, body, true);
    if (addsGrantsBeyondActor(store, hypothetical, existing.id, grants))
      return envelope(403, null, "Account grants exceed your grants");
  }
  return undefined;
};

const checkRole: Check = (ctx, body) => {
  const { request, store, userId, grants, existing } = ctx;
  const allowed =
    request.method === "POST"
      ? ["code", "name", "description"]
      : ["name", "description", "status", "status_description", "is_deleted"];
  if (hasOtherKeys(body, allowed)) return envelope(422);
  if (existing?.is_system_role) return envelope(403, null, "Built-in roles cannot be edited");
  // Reactivating a role must not hand its holders grants the caller doesn't hold.
  if (existing && existing.status !== "ACTIVE" && body.status === "ACTIVE") {
    const hypothetical = withStatusChange(store, "role", existing.id, body, true);
    const holders = store.user_role.filter((link) => link.role_id === existing.id);
    if (holders.some((link) => addsGrantsBeyondActor(store, hypothetical, link.user_id, grants)))
      return envelope(403, null, "Role exceeds your grants");
  }
  // Disabling the role that carries the caller's only global PERMISSION_MANAGE locks everyone out.
  if (existing && isDeactivating(body) && hasPermission(grants, "PERMISSION_MANAGE")) {
    const hypothetical = withStatusChange(store, "role", existing.id, body);
    if (losesPermissionManage(userId, hypothetical)) return envelope(403, null, LAST_ADMIN);
  }
  return undefined;
};

const checkPermission: Check = (ctx, body) => {
  const allowed =
    ctx.request.method === "POST"
      ? ["code", "module", "name", "description"]
      : ["name", "description"];
  return hasOtherKeys(body, allowed) ? envelope(422) : undefined;
};

const checkUserRole: Check = (ctx, body) => {
  const { request, store, userId, grants, existing } = ctx;
  const creating = request.method === "POST";
  if (hasOtherKeys(body, creating ? ["user_id", "role_id", "pillar_id"] : ["status", "is_deleted"]))
    return envelope(422);
  if (existing?.user_id === userId && isDeactivating(body))
    return envelope(403, null, "You cannot revoke your own role");
  if (!becomesActive(ctx, body)) return undefined;

  const live = (row: { is_deleted: boolean; status: string }) =>
    !row.is_deleted && row.status === "ACTIVE";
  const roleId = creating ? body.role_id : existing?.role_id;
  const assigneeId = creating ? body.user_id : existing?.user_id;
  const scope = creating ? body.pillar_id : existing?.pillar_id;
  const role = store.role.find((row) => row.id === roleId && live(row));
  const assignee = store.user.find((row) => row.id === assigneeId && live(row));
  const validScope =
    scope === null ||
    (Number.isSafeInteger(scope) && store.pillar.some((row) => row.id === scope && live(row)));
  if (!role || !assignee || !validScope) return envelope(422);
  // Callers may only grant what they themselves hold in that scope.
  const pillarId = scope as number | null;
  if (roleCodes(store, role).some((code) => !hasPermission(grants, code, { pillarId })))
    return envelope(403, null, "Role exceeds your grants");
  return undefined;
};

const checkRolePermission: Check = (ctx, body) => {
  const { request, store, userId, grants, existing } = ctx;
  const creating = request.method === "POST";
  if (hasOtherKeys(body, creating ? ["role_id", "permission_id"] : ["status", "is_deleted"]))
    return envelope(422);
  const roleId = creating ? body.role_id : existing?.role_id;
  const role = store.role.find(
    (row) => row.id === roleId && !row.is_deleted && row.status === "ACTIVE"
  );
  if (!role) return envelope(422);
  if (role.is_system_role) return envelope(403, null, "Built-in role permissions cannot be edited");
  const permissionId = creating ? body.permission_id : existing?.permission_id;
  const permission = store.permission.find(
    (row) => row.id === permissionId && !row.is_deleted && row.status === "ACTIVE"
  );
  if (!permission) return envelope(422);
  if (becomesActive(ctx, body) && !hasPermission(grants, permission.code))
    return envelope(403, null, "Permission exceeds your grants");
  if (
    request.method === "PATCH" &&
    isDeactivating(body) &&
    permission.code === "PERMISSION_MANAGE"
  ) {
    const hypothetical = withStatusChange(store, "role_permission", existing?.id, body);
    if (losesPermissionManage(userId, hypothetical)) return envelope(403, null, LAST_ADMIN);
  }
  return undefined;
};

const checks: Partial<Record<TableName, Check>> = {
  user: checkUser,
  role: checkRole,
  permission: checkPermission,
  user_role: checkUserRole,
  role_permission: checkRolePermission,
};

/**
 * User, role, permission and grant write rules, including the guards that
 * stop callers escalating their own access or removing the last administrator.
 */
export function checkAccessControlWrite(
  ctx: ResourceContext,
  body: Row
): ApiEnvelope<unknown> | undefined {
  return checks[ctx.table]?.(ctx, body);
}
