import type { UserRole } from "@/types/navigation";

export const SESSION_COOKIE_NAME = "creaw_session";

export interface SessionUser {
  id: number;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  initials: string;
  passwordChangeRequired: boolean;
  role: UserRole;
}

export interface Session {
  user: SessionUser;
  grants: Array<{ permissionCode: string; pillarId: number | null }>;
}

export function toPortalSessionUser(
  user: { id: number; first_name: string; last_name: string; email: string | null },
  grants: Session["grants"]
): SessionUser {
  const firstName = user.first_name;
  const lastName = user.last_name;
  const permissions = new Set(grants.map((grant) => grant.permissionCode));
  const role: UserRole = permissions.has("USER_MANAGE") && permissions.has("ROLE_MANAGE")
    ? "super_admin"
    : permissions.has("USER_MANAGE") ? "admin" : permissions.has("DASHBOARD_VIEW") ? "manager" : "member";
  return {
    id: user.id,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    email: user.email ?? "",
    initials: `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase(),
    passwordChangeRequired: false,
    role,
  };
}
