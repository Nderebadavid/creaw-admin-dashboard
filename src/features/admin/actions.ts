"use server";
/**
 * Server Actions for staff accounts, roles, permissions and role grants.
 *
 * Each action re-checks the session and validates its input with Zod before
 * checking permission (and pillar scope where it applies), then calls the
 * feature API and revalidates affected routes. The API enforces the same
 * rules again and writes the audit entry; these checks only fail fast.
 */
import { revalidatePath } from "next/cache";
import { actionResult } from "@/lib/api/action-result";
import { withSessionApi } from "@/lib/api/session-api";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { createAdminApi } from "./api";
import {
  permissionInputSchema,
  roleInputSchema,
  rolePermissionInputSchema,
  roleUpdateSchema,
  userInputSchema,
  userRoleInputSchema,
  userUpdateSchema,
} from "./schemas";

const denied = () => actionResult(403, "Permission denied");
function admin() {
  return withSessionApi(createAdminApi);
}
function refresh() {
  revalidatePath("/admin/users");
  revalidatePath("/admin/permissions");
}
function allowed(grants: Awaited<ReturnType<typeof requireSession>>["grants"], code: string) {
  return hasPermission(grants, code);
}

export async function listUsersAction(query: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}) {
  const session = await requireSession();
  if (!allowed(session.grants, "USER_MANAGE")) return { ...denied(), data: null };
  const page = query.page ?? 1,
    pageSize = query.pageSize ?? 25;
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100 ||
    (query.search?.length ?? 0) > 120 ||
    (query.status && !["ACTIVE", "INACTIVE", "DISABLED"].includes(query.status))
  )
    return { ...actionResult(422, "Check staff filters"), data: null };
  try {
    return {
      ...actionResult(200, "OK"),
      data: await (
        await admin()
      ).users({ page, pageSize, search: query.search, status: query.status }),
    };
  } catch {
    return { ...actionResult(500, "Could not load staff"), data: null };
  }
}

export async function createUserAction(input: unknown) {
  const session = await requireSession();
  if (!allowed(session.grants, "USER_MANAGE")) return denied();
  const parsed = userInputSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the staff details");
  try {
    const response = await (
      await admin()
    ).createUser({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      username: parsed.data.username,
      email: parsed.data.email,
      phone_number: parsed.data.phoneNumber,
    });
    if (response.success) refresh();
    return actionResult(response.resultCode, response.message, response.data?.id);
  } catch {
    return actionResult(500, "Could not create staff member");
  }
}
export async function updateUserAction(input: unknown) {
  const session = await requireSession();
  if (!allowed(session.grants, "USER_MANAGE")) return denied();
  const parsed = userUpdateSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the staff details");
  if (parsed.data.id === session.user.id && parsed.data.status && parsed.data.status !== "ACTIVE")
    return actionResult(403, "You cannot disable your own account");
  try {
    const response = await (
      await admin()
    ).updateUser(parsed.data.id, {
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: parsed.data.email,
      phone_number: parsed.data.phoneNumber,
      status: parsed.data.status,
    });
    if (response.success) refresh();
    return actionResult(
      response.success ? 200 : response.resultCode,
      response.message,
      response.data?.id
    );
  } catch {
    return actionResult(500, "Could not update staff member");
  }
}
export async function setUserRoleAction(input: unknown) {
  const session = await requireSession();
  if (!allowed(session.grants, "ROLE_MANAGE")) return denied();
  const parsed = userRoleInputSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the role grant");
  if (parsed.data.userId === session.user.id && !parsed.data.enabled)
    return actionResult(403, "You cannot revoke your own role");
  try {
    const client = await admin();
    const existing = (await client.userRoles()).find(
      (row) =>
        row.user_id === parsed.data.userId &&
        row.role_id === parsed.data.roleId &&
        row.pillar_id === parsed.data.pillarId
    );
    if (
      existing &&
      existing.is_deleted === !parsed.data.enabled &&
      existing.status === (parsed.data.enabled ? "ACTIVE" : "INACTIVE")
    )
      return actionResult(200, "No change", existing.id);
    if (!existing && !parsed.data.enabled) return actionResult(200, "No change");
    const response = await client.setUserRole(parsed.data, existing?.id);
    if (response.success) refresh();
    return actionResult(
      response.success ? 200 : response.resultCode,
      response.message,
      response.data?.id
    );
  } catch {
    return actionResult(500, "Could not update role grant");
  }
}
export async function createRoleAction(input: unknown) {
  const session = await requireSession();
  if (!allowed(session.grants, "ROLE_MANAGE")) return denied();
  const parsed = roleInputSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the role details");
  try {
    const response = await (await admin()).createRole(parsed.data);
    if (response.success) refresh();
    return actionResult(response.resultCode, response.message, response.data?.id);
  } catch {
    return actionResult(500, "Could not create role");
  }
}
export async function updateRoleAction(input: unknown) {
  const session = await requireSession();
  if (!allowed(session.grants, "ROLE_MANAGE")) return denied();
  const parsed = roleUpdateSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the role details");
  try {
    const response = await (
      await admin()
    ).updateRole(parsed.data.id, { name: parsed.data.name, description: parsed.data.description });
    if (response.success) refresh();
    return actionResult(response.resultCode, response.message, response.data?.id);
  } catch {
    return actionResult(500, "Could not update role");
  }
}
export async function createPermissionAction(input: unknown) {
  const session = await requireSession();
  if (!allowed(session.grants, "PERMISSION_MANAGE")) return denied();
  const parsed = permissionInputSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the permission details");
  try {
    const response = await (await admin()).createPermission(parsed.data);
    if (response.success) refresh();
    return actionResult(response.resultCode, response.message, response.data?.id);
  } catch {
    return actionResult(500, "Could not create permission");
  }
}
export async function setRolePermissionAction(input: unknown) {
  const session = await requireSession();
  if (!allowed(session.grants, "PERMISSION_MANAGE")) return denied();
  const parsed = rolePermissionInputSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the permission grant");
  try {
    const client = await admin();
    const existing = (await client.rolePermissions()).find(
      (row) => row.role_id === parsed.data.roleId && row.permission_id === parsed.data.permissionId
    );
    if (
      existing &&
      existing.is_deleted === !parsed.data.enabled &&
      existing.status === (parsed.data.enabled ? "ACTIVE" : "INACTIVE")
    )
      return actionResult(200, "No change", existing.id);
    if (!existing && !parsed.data.enabled) return actionResult(200, "No change");
    const response = await client.setRolePermission(parsed.data, existing?.id);
    if (response.success) refresh();
    return actionResult(
      response.success ? 200 : response.resultCode,
      response.message,
      response.data?.id
    );
  } catch {
    return actionResult(500, "Could not update permission grant");
  }
}
