import { type MockContext } from "../context";
import { envelope, safeRow, type Row } from "../core";
import { MOCK_OTP_CODE, MOCK_PASSWORD } from "../seed";
import {
  issueMockSession,
  refreshMockSession,
  revokeMockRefreshToken,
  revokeMockToken,
} from "../store";
import { findAccount, stringFields } from "./accounts";
import { forgotPassword, resetPassword } from "./password-reset";
import { type ApiEnvelope } from "@/types/api";
import { type MockStore } from "@/types/db";

const CHALLENGE_TTL_MS = 10 * 60_000;
const LOCK_MS = 15 * 60_000;
const MAX_FAILED_LOGINS = 5;
const MAX_WRONG_CODES = 5;
export const SESSION_EXPIRED = "Your session has expired. Sign in again.";
const LOCKED =
  "Account locked for 15 minutes after 5 failed attempts. Reset your password to unlock it now.";

type PublicRoute = (ctx: MockContext) => ApiEnvelope<unknown>;
const publicRoutes: Record<string, PublicRoute> = {
  "/auth/login": login,
  "/auth/otp/verify": verifyOtp,
  "/auth/otp/resend": resendOtp,
  "/auth/refresh": refresh,
  "/auth/password/forgot": forgotPassword,
  "/auth/password/reset": resetPassword,
  "/auth/logout": logout,
};

/** Sign-in, verification, password reset and logout: the routes reachable without a valid session. */
export function handleSessionRoutes(ctx: MockContext): ApiEnvelope<unknown> | undefined {
  const route = publicRoutes[ctx.url.pathname];
  if (!route) return undefined;
  return ctx.request.method === "POST" ? route(ctx) : envelope(422);
}

/** `0711203344` -> `07•• ••• 344`. */
function maskPhone(phone: string | null): string | null {
  return phone ? `${phone.slice(0, 2)}•• ••• ${phone.slice(-3)}` : null;
}

/** `judy.mwangi@creaw.org` -> `ju•••••@creaw.org`. */
function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}•••••@${domain}`;
}

/**
 * `POST /auth/login`: the password step. A correct password earns a one-time
 * code challenge, never a session; the token is issued by `/auth/otp/verify`.
 */
function login({ request, store }: MockContext): ApiEnvelope<unknown> {
  const body = stringFields(request.body, "username", "password");
  if (!body) return envelope(422);
  const user = findAccount(store, body.username);
  // Unknown names are counted too, so the reply never reveals which accounts exist.
  const key = user ? `user:${user.id}` : `name:${body.username.trim().toLowerCase()}`;
  const now = Date.now();
  if ((store.failedLogins.get(key)?.lockedUntil ?? 0) > now) return envelope(423, null, LOCKED);
  if (!user || body.password !== (store.passwords.get(user.id) ?? MOCK_PASSWORD))
    return failedLogin(store, key, now);
  store.failedLogins.delete(key);
  const challengeId = crypto.randomUUID();
  store.loginChallenges.set(challengeId, {
    userId: user.id,
    expiresAt: now + CHALLENGE_TTL_MS,
    wrongCodes: 0,
  });
  return envelope(200, {
    challengeId,
    maskedPhone: maskPhone(user.phone_number),
    maskedEmail: maskEmail(user.email),
  });
}

/** Counts a wrong password and locks the account on the fifth. */
function failedLogin(store: MockStore, key: string, now: number): ApiEnvelope<unknown> {
  const previous = store.failedLogins.get(key);
  // A lock that has run out starts the count again.
  const count = (previous?.lockedUntil ? 0 : (previous?.count ?? 0)) + 1;
  const left = MAX_FAILED_LOGINS - count;
  store.failedLogins.set(key, { count, lockedUntil: left > 0 ? 0 : now + LOCK_MS });
  if (left <= 0) return envelope(423, null, LOCKED);
  return envelope(
    403,
    null,
    `Incorrect email or password. ${left} attempt${left === 1 ? "" : "s"} left before the account is locked.`
  );
}

/** The challenge if it is still usable; an expired one is removed. */
function liveChallenge(store: MockStore, challengeId: string) {
  const challenge = store.loginChallenges.get(challengeId);
  if (challenge && challenge.expiresAt <= Date.now()) store.loginChallenges.delete(challengeId);
  return store.loginChallenges.get(challengeId);
}

/** `POST /auth/otp/verify`: the second step. The right code ends the challenge and issues the session. */
function verifyOtp({ request, store }: MockContext): ApiEnvelope<unknown> {
  const body = stringFields(request.body, "challengeId", "code");
  if (!body) return envelope(422);
  const challenge = liveChallenge(store, body.challengeId);
  if (!challenge)
    return envelope(410, null, "This code has expired. Sign in again to get a new one.");
  if (body.code !== MOCK_OTP_CODE) {
    challenge.wrongCodes += 1;
    if (challenge.wrongCodes < MAX_WRONG_CODES)
      return envelope(403, null, "That code isn’t right. Check the latest SMS and try again.");
    store.loginChallenges.delete(body.challengeId);
    return envelope(410, null, "Too many incorrect codes. Sign in again to get a new one.");
  }
  store.loginChallenges.delete(body.challengeId);
  // Only the token pair: the user, grants and roles come from `/auth/me`.
  return envelope(200, issueMockSession(challenge.userId), "Login successful");
}

/** `POST /auth/refresh`: rotates a refresh token into a new token pair. */
function refresh({ request }: MockContext): ApiEnvelope<unknown> {
  const body = stringFields(request.body, "refreshToken");
  if (!body) return envelope(422);
  const pair = refreshMockSession(body.refreshToken);
  return pair ? envelope(200, pair) : envelope(401, null, SESSION_EXPIRED);
}

/** `POST /auth/otp/resend`: restarts the challenge's 10 minutes and its wrong-code count. */
function resendOtp({ request, store }: MockContext): ApiEnvelope<unknown> {
  const body = stringFields(request.body, "challengeId");
  if (!body) return envelope(422);
  const challenge = liveChallenge(store, body.challengeId);
  if (!challenge)
    return envelope(410, null, "This code has expired. Sign in again to get a new one.");
  challenge.expiresAt = Date.now() + CHALLENGE_TTL_MS;
  challenge.wrongCodes = 0;
  return envelope(200);
}

/** `POST /auth/logout`: ends the access token and its refresh token; always succeeds. */
function logout({ request }: MockContext): ApiEnvelope<unknown> {
  if (request.token) revokeMockToken(request.token);
  const body = stringFields(request.body, "refreshToken");
  if (body) revokeMockRefreshToken(body.refreshToken);
  return envelope(200);
}

/** `GET /auth/me`: the signed-in user and their effective grants. */
export function handleCurrentUser(ctx: MockContext): ApiEnvelope<unknown> | undefined {
  const { request, store, url, userId, grants } = ctx;
  if (url.pathname === "/auth/me") {
    const user = store.user.find((row) => row.id === userId)!;
    return request.method === "GET"
      ? envelope(200, {
          // The caller's own email is shown in the account menu, so it is not masked.
          user: { ...safeRow("user", user as unknown as Row), email: user.email },
          grants,
          roles: activeRoleNames(store, userId),
        })
      : envelope(422);
  }
  return undefined;
}

/** Distinct names of the user's active, non-deleted role assignments. */
function activeRoleNames(store: MockContext["store"], userId: number): string[] {
  const live = (row: { is_deleted: boolean; status: string }) =>
    !row.is_deleted && row.status === "ACTIVE";
  const roleIds = store.user_role
    .filter((row) => row.user_id === userId && live(row))
    .map((row) => row.role_id);
  return [
    ...new Set(
      store.role.filter((role) => roleIds.includes(role.id) && live(role)).map((role) => role.name)
    ),
  ];
}
