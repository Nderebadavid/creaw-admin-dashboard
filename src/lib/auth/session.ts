/** The short-lived API access token. */
export const SESSION_COOKIE_NAME = "creaw_session";
/** The refresh token that renews the access token. */
export const REFRESH_COOKIE_NAME = "creaw_refresh";
/** When the access token expires and whether the user chose to stay signed in. */
export const SESSION_META_COOKIE_NAME = "creaw_session_meta";
/** Holds the open login challenge between the password step and the one-time code. */
export const LOGIN_CHALLENGE_COOKIE_NAME = "creaw_login_challenge";

export interface SessionUser {
  id: number;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  initials: string;
  /** Names of the user's active roles, e.g. ["Pillar Lead", "Data Entry"]. */
  roles: string[];
  middleName?: string | null;
  username?: string;
  /** Masked, e.g. "••••••3344". */
  phone?: string | null;
  status?: string;
}

export interface Session {
  user: SessionUser;
  grants: Array<{ permissionCode: string; pillarId: number | null }>;
}

export function toPortalSessionUser(
  user: {
    id: number;
    first_name: string;
    last_name: string;
    email: string | null;
    middle_name?: string | null;
    username?: string;
    phone_number?: string | null;
    status?: string;
  },
  roles: string[] = []
): SessionUser {
  const firstName = user.first_name;
  const lastName = user.last_name;
  return {
    id: user.id,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    email: user.email ?? "",
    initials: `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase(),
    roles,
    middleName: user.middle_name ?? null,
    username: user.username,
    phone: user.phone_number ?? null,
    status: user.status,
  };
}
