import { getEffectiveGrants, hasPermission } from "../../auth/permissions";
import { type ResourceContext } from "../context";
import { addsGrantsBeyondActor, envelope, type Row } from "../core";
import { type ApiEnvelope } from "@/types/api";

/** User, role, permission and grant write rules, including the guards that stop callers escalating their own access or removing the last administrator. */
export function checkAccessControlWrite(
  ctx: ResourceContext,
  body: Row
): ApiEnvelope<unknown> | undefined {
  const { request, store, userId, grants, table, existing } = ctx;
  if (table === "user") {
    const permitted =
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
    if (Object.keys(body).some((key) => !permitted.includes(key))) return envelope(422);
    if (
      request.method === "PATCH" &&
      existing?.id === userId &&
      (body.is_deleted === true || (body.status && body.status !== "ACTIVE"))
    )
      return envelope(403, null, "You cannot disable your own account");
    if (existing && existing.status !== "ACTIVE" && body.status === "ACTIVE") {
      // Apply the change to a copy of the store and recompute the caller's own
      // grants: if they would lose PERMISSION_MANAGE, no one could undo it.
      const hypothetical = {
        ...store,
        user: store.user.map((row) =>
          row.id === existing.id
            ? {
                ...row,
                status: "ACTIVE",
                is_deleted:
                  body.is_deleted === undefined ? row.is_deleted : (body.is_deleted as boolean),
              }
            : row
        ),
      };
      if (addsGrantsBeyondActor(store, hypothetical, existing.id, grants))
        return envelope(403, null, "Account grants exceed your grants");
    }
  }
  if (table === "role") {
    const permitted =
      request.method === "POST"
        ? ["code", "name", "description"]
        : ["name", "description", "status", "status_description", "is_deleted"];
    if (Object.keys(body).some((key) => !permitted.includes(key))) return envelope(422);
    if (existing?.is_system_role) return envelope(403, null, "Built-in roles cannot be edited");
    if (existing && existing.status !== "ACTIVE" && body.status === "ACTIVE") {
      const hypothetical = {
        ...store,
        role: store.role.map((row) =>
          row.id === existing.id
            ? {
                ...row,
                status: "ACTIVE",
                is_deleted:
                  body.is_deleted === undefined ? row.is_deleted : (body.is_deleted as boolean),
              }
            : row
        ),
      };
      if (
        store.user_role.some(
          (link) =>
            link.role_id === existing.id &&
            addsGrantsBeyondActor(store, hypothetical, link.user_id, grants)
        )
      )
        return envelope(403, null, "Role exceeds your grants");
    }
    if (
      existing &&
      (body.is_deleted === true || (body.status && body.status !== "ACTIVE")) &&
      hasPermission(grants, "PERMISSION_MANAGE")
    ) {
      // Same last-admin guard as role_permission below: disabling the role
      // that carries the caller's only global PERMISSION_MANAGE locks everyone out.
      const hypothetical = {
        ...store,
        role: store.role.map((row) =>
          row.id === existing.id
            ? {
                ...row,
                is_deleted:
                  body.is_deleted === undefined ? row.is_deleted : (body.is_deleted as boolean),
                status: body.status === undefined ? row.status : (body.status as string),
              }
            : row
        ),
      };
      if (!hasPermission(getEffectiveGrants(userId, hypothetical), "PERMISSION_MANAGE"))
        return envelope(
          403,
          null,
          "You cannot remove your last global permission-management grant"
        );
    }
  }
  if (table === "permission") {
    const permitted =
      request.method === "POST"
        ? ["code", "module", "name", "description"]
        : ["name", "description"];
    if (Object.keys(body).some((key) => !permitted.includes(key))) return envelope(422);
  }
  if (table === "user_role") {
    const permitted =
      request.method === "POST" ? ["user_id", "role_id", "pillar_id"] : ["status", "is_deleted"];
    if (Object.keys(body).some((key) => !permitted.includes(key))) return envelope(422);
    if (
      existing?.user_id === userId &&
      (body.is_deleted === true || (body.status && body.status !== "ACTIVE"))
    )
      return envelope(403, null, "You cannot revoke your own role");
    const becomingActive =
      request.method === "POST" ||
      (!!existing &&
        (existing.is_deleted || existing.status !== "ACTIVE") &&
        (body.is_deleted ?? existing.is_deleted) === false &&
        (body.status ?? existing.status) === "ACTIVE");
    if (becomingActive) {
      const targetRole = store.role.find(
        (role) =>
          role.id === (request.method === "POST" ? body.role_id : existing?.role_id) &&
          !role.is_deleted &&
          role.status === "ACTIVE"
      );
      const targetUser = store.user.find(
        (user) =>
          user.id === (request.method === "POST" ? body.user_id : existing?.user_id) &&
          !user.is_deleted &&
          user.status === "ACTIVE"
      );
      const scope = request.method === "POST" ? body.pillar_id : existing?.pillar_id;
      if (
        !targetRole ||
        !targetUser ||
        (scope !== null &&
          (!Number.isSafeInteger(scope) ||
            !store.pillar.some(
              (pillar) => pillar.id === scope && !pillar.is_deleted && pillar.status === "ACTIVE"
            )))
      )
        return envelope(422);
      const roleCodes =
        targetRole.is_system_role && targetRole.code === "SYSTEM_ADMIN"
          ? store.permission
              .filter((permission) => !permission.is_deleted && permission.status === "ACTIVE")
              .map((permission) => permission.code)
          : store.role_permission
              .filter(
                (link) =>
                  link.role_id === targetRole.id && !link.is_deleted && link.status === "ACTIVE"
              )
              .map(
                (link) =>
                  store.permission.find(
                    (permission) =>
                      permission.id === link.permission_id &&
                      !permission.is_deleted &&
                      permission.status === "ACTIVE"
                  )?.code
              )
              .filter((code): code is string => !!code);
      if (
        roleCodes.some((code) => !hasPermission(grants, code, { pillarId: scope as number | null }))
      )
        return envelope(403, null, "Role exceeds your grants");
    }
  }
  if (table === "role_permission") {
    const permitted =
      request.method === "POST" ? ["role_id", "permission_id"] : ["status", "is_deleted"];
    if (Object.keys(body).some((key) => !permitted.includes(key))) return envelope(422);
    const targetRoleId = request.method === "POST" ? body.role_id : existing?.role_id;
    const targetRole = store.role.find(
      (role) => role.id === targetRoleId && !role.is_deleted && role.status === "ACTIVE"
    );
    if (!targetRole) return envelope(422);
    if (targetRole.is_system_role)
      return envelope(403, null, "Built-in role permissions cannot be edited");
    const targetPermissionId =
      request.method === "POST" ? body.permission_id : existing?.permission_id;
    const targetPermission = store.permission.find(
      (item) => item.id === targetPermissionId && !item.is_deleted && item.status === "ACTIVE"
    );
    if (!targetPermission) return envelope(422);
    const becomingActive =
      request.method === "POST" ||
      (!!existing &&
        (existing.is_deleted || existing.status !== "ACTIVE") &&
        (body.is_deleted ?? existing.is_deleted) === false &&
        (body.status ?? existing.status) === "ACTIVE");
    if (becomingActive && !hasPermission(grants, targetPermission.code))
      return envelope(403, null, "Permission exceeds your grants");
    if (
      request.method === "PATCH" &&
      (body.is_deleted === true || (body.status && body.status !== "ACTIVE")) &&
      targetPermission.code === "PERMISSION_MANAGE"
    ) {
      const hypothetical = {
        ...store,
        role_permission: store.role_permission.map((link) =>
          link.id === existing?.id
            ? {
                ...link,
                is_deleted:
                  body.is_deleted === undefined ? link.is_deleted : (body.is_deleted as boolean),
                status: body.status === undefined ? link.status : (body.status as string),
              }
            : link
        ),
      };
      if (!hasPermission(getEffectiveGrants(userId, hypothetical), "PERMISSION_MANAGE"))
        return envelope(
          403,
          null,
          "You cannot remove your last global permission-management grant"
        );
    }
  }
  return undefined;
}
