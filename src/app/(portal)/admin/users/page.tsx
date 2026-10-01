import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { adminApi } from "@/features/admin/api";
import { UsersContent } from "@/features/admin/users-components";

export default async function UsersPage() {
  const session = await requireSession();
  const canManageUsers = hasPermission(session.grants, "USER_MANAGE"),
    canManageRoles = hasPermission(session.grants, "ROLE_MANAGE");
  if (!canManageUsers) notFound();
  const [initial, access] = await Promise.all([
    adminApi.users({ page: 1, pageSize: 25 }),
    canManageRoles ? adminApi.access() : null,
  ]);
  return (
    <UsersContent
      heading={{
        title: "Users & roles",
        section: "Admin",
        description: "Staff accounts and the roles that drive their navigation",
      }}
      initial={initial}
      roles={access?.roles ?? []}
      pillars={access?.pillars ?? []}
      permissionCount={access?.permission_count ?? undefined}
      multiRoleUsers={access?.multi_role_users}
      canManageUsers={canManageUsers}
      canManageRoles={canManageRoles}
      currentUserId={session.user.id}
    />
  );
}
