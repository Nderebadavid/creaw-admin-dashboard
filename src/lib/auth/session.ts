import type { UserRole } from "@/types/navigation";

// Shared between the login/logout route handlers, proxy.ts, and the
// dashboard layout's server-side session lookup -- keeps the cookie name
// (and the identity-service response/role shapes) in one place.

export const SESSION_COOKIE_NAME = "vsla_session";

/**
 * vsla-identity-service's ResponseDto envelope. docs/api-testing/README.md
 * documents the field as `payload`, but the live dev environment actually
 * returns it as `data` (confirmed 2026-09-13 against POST /auth/login) --
 * check both rather than trust the docs over the wire.
 */
export interface IdentityServiceEnvelope<T> {
  resultCode: number;
  success: boolean;
  message: string;
  payload?: T;
  data?: T;
}

/** Reads the envelope's payload regardless of which field name the server used. */
export function unwrapEnvelope<T>(
  envelope: IdentityServiceEnvelope<T> | null | undefined
): T | undefined {
  return envelope?.payload ?? envelope?.data;
}

export interface AuthResponsePayload {
  token: string;
  expireAt: string;
  refreshToken?: string;
  refreshExpireAt?: string;
  /** Omitted entirely when false -- only present (as true) when set. */
  requirePasswordChange?: boolean;
}

/**
 * `expireAt` comes back as a timezone-less local date-time (e.g.
 * "2026-08-09T15:30:00"), so treating it as UTC can be off by the server's
 * offset. Clamped to a sane range so a bad parse can't produce a
 * near-infinite or negative-lifetime cookie.
 */
export function cookieMaxAgeSeconds(expireAt: string): number {
  const MIN_SECONDS = 60; // 1 minute
  const FALLBACK_SECONDS = 60 * 60; // 1 hour, used when parsing looks unreliable
  const MAX_SECONDS = 60 * 60 * 24; // 1 day

  const parsed = Date.parse(expireAt);
  if (Number.isNaN(parsed)) return FALLBACK_SECONDS;

  const seconds = Math.floor((parsed - Date.now()) / 1000);
  if (seconds < MIN_SECONDS) return FALLBACK_SECONDS;
  return Math.min(seconds, MAX_SECONDS);
}

/** vsla-identity-service's UserProfileDto (GET /users/me). */
export interface UserProfilePayload {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  passwordChangeRequired: boolean;
  staffId: number;
  memberId: number;
  roles: Array<{ id: number; name: string; groupId: number | null }>;
}

/**
 * The identity service's role catalog is admin-managed (`/roles` CRUD) and
 * not fully enumerated anywhere we can read at build time, so this is a
 * best-effort keyword mapping onto our small nav-gating UserRole set --
 * not a source of truth. Confirmed exact names: ROLE_SUPER_ADMIN, ROLE_ADMIN
 * (both seen in docs/api-testing/README.md). The rest are guesses based on
 * typical VSLA group-officer titles; adjust once the real role names are
 * known. Unrecognized roles fall back to "guest" (least privilege) rather
 * than silently over-granting access.
 */
const ROLE_RULES: Array<{ pattern: RegExp; role: UserRole }> = [
  { pattern: /SUPER_ADMIN/i, role: "super_admin" },
  { pattern: /^ROLE_ADMIN$/i, role: "admin" },
  { pattern: /CHAIR|TREASURER|SECRETARY|MANAGER/i, role: "manager" },
  { pattern: /MEMBER/i, role: "member" },
];

const ROLE_PRIVILEGE_ORDER: UserRole[] = [
  "super_admin",
  "admin",
  "manager",
  "member",
  "guest",
];

/** Maps the backend's role names to our UserRole set, picking the most
 * privileged recognized role when the user holds several. */
export function resolveUserRole(roles: Array<{ name: string }>): UserRole {
  const mapped = new Set<UserRole>();

  for (const { name } of roles) {
    const rule = ROLE_RULES.find((r) => r.pattern.test(name));
    if (rule) {
      mapped.add(rule.role);
    } else {
      console.warn(`[session] unrecognized backend role "${name}" -- update ROLE_RULES in session.ts`);
    }
  }

  return ROLE_PRIVILEGE_ORDER.find((role) => mapped.has(role)) ?? "guest";
}

/** The signed-in user, shaped for display -- used by both the server-side
 * session lookup and the client context it seeds. Lives here (not in
 * session-server.ts) so client components can import the type without
 * pulling in the "server-only"-guarded fetch code. */
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

export function toSessionUser(payload: UserProfilePayload): SessionUser {
  return {
    id: payload.id,
    firstName: payload.firstName,
    lastName: payload.lastName,
    name: `${payload.firstName} ${payload.lastName}`.trim(),
    email: payload.email,
    initials: `${payload.firstName[0] ?? ""}${payload.lastName[0] ?? ""}`.toUpperCase(),
    passwordChangeRequired: payload.passwordChangeRequired,
    role: resolveUserRole(payload.roles),
  };
}
