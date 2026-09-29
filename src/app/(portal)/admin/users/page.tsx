import { notFound } from "next/navigation";
import { PageHeading } from "@/components/portal/page-heading";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { adminApi } from "@/features/admin/api";
import { UsersContent } from "@/features/admin/users-components";

export default async function UsersPage() {
  const session = await requireSession();
  const canManageUsers = hasPermission(session.grants, "USER_MANAGE"), canManageRoles = hasPermission(session.grants, "ROLE_MANAGE");
  if (!canManageUsers) notFound();
  const [initial, roles, assignments, pillars] = await Promise.all([
    adminApi.users({ page: 1, pageSize: 25 }), canManageRoles ? adminApi.roles() : [], canManageRoles ? adminApi.userRoles() : [], canManageRoles ? adminApi.pillars() : [],
  ]);
  return <><PageHeading title="Users & roles" section="Admin" description="Staff accounts, role grants and pillar scope" /><UsersContent initial={initial} roles={roles} assignments={assignments} pillars={pillars} canManageUsers={canManageUsers} canManageRoles={canManageRoles} currentUserId={session.user.id} /></>;
}
