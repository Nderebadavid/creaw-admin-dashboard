import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { adminApi } from "@/features/admin/api";
import { PermissionsContent } from "@/features/admin/permissions-components";

export default async function PermissionsPage() {
  const session = await requireSession();
  const canManageRoles = hasPermission(session.grants, "ROLE_MANAGE"),
    canManagePermissions = hasPermission(session.grants, "PERMISSION_MANAGE");
  if (!canManageRoles && !canManagePermissions) notFound();
  const { roles, permissions, grants } = await adminApi.matrix();
  return (
    <PermissionsContent
      heading={{
        title: "Roles & permissions",
        section: "Admin",
        description: "Create roles and permissions, then choose exactly what each role can do",
      }}
      roles={roles}
      permissions={permissions}
      grants={grants}
      canManageRoles={canManageRoles}
      canManagePermissions={canManagePermissions}
    />
  );
}
