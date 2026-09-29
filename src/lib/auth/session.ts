export const SESSION_COOKIE_NAME = "creaw_session";

export interface SessionUser {
  id: number;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  initials: string;
}

export interface Session {
  user: SessionUser;
  grants: Array<{ permissionCode: string; pillarId: number | null }>;
}

export function toPortalSessionUser(user: {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
}): SessionUser {
  const firstName = user.first_name;
  const lastName = user.last_name;
  return {
    id: user.id,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    email: user.email ?? "",
    initials: `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase(),
  };
}
