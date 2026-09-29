import { notFound } from "next/navigation";
import { PageHeading } from "@/components/portal/page-heading";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { adminApi } from "@/features/admin/api";
import { PermissionsContent } from "@/features/admin/permissions-components";

export default async function PermissionsPage() {
  const session = await requireSession();
  const canManageRoles = hasPermission(session.grants, "ROLE_MANAGE"),
    canManagePermissions = hasPermission(session.grants, "PERMISSION_MANAGE");
  if (!canManageRoles && !canManagePermissions) notFound();
  const [roles, permissions, grants] = await Promise.all([
    adminApi.roles(),
    canManagePermissions ? adminApi.permissions() : [],
    canManagePermissions ? adminApi.rolePermissions() : [],
  ]);
  return (
    <>
      <PageHeading
        title="Roles & permissions"
        section="Admin"
        description="Create roles and permissions, then choose exactly what each role can do"
      />
      <PermissionsContent
        roles={roles}
        permissions={permissions}
        grants={grants}
        canManageRoles={canManageRoles}
        canManagePermissions={canManagePermissions}
      />
    </>
  );
}
