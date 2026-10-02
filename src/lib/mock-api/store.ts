import "server-only";
import { formatApiTime } from "../auth/token-time";
import type { MockStore, MockTokenPair } from "@/types/db";
import { createSeed } from "./seed";

// One process-local store survives development module reloads. Restarting the
// server clears it; production mock processes also remain isolated from each other.
// Bump the version in the key whenever MockStore gains or loses a field, or a
// running dev server keeps serving a store built with the old shape.
const globalStore = globalThis as typeof globalThis & { __creawMockStoreV5?: MockStore };

export const ACCESS_TOKEN_MS = 30 * 60_000;
export const REFRESH_TOKEN_MS = 7 * 24 * 60 * 60_000;
/** How long a just-rotated refresh token still answers with its successor (parallel refreshes). */
export const REFRESH_GRACE_MS = 10_000;

/** API timestamps have whole seconds, so expiry is kept at that precision too. */
const toSecond = (epochMs: number) => Math.floor(epochMs / 1000) * 1000;

function issueAccessToken(userId: number, now: number) {
  const token = crypto.randomUUID();
  const expiresAt = toSecond(now + ACCESS_TOKEN_MS);
  getMockStore().sessions.set(token, { userId, expiresAt });
  return { token, expireAt: formatApiTime(expiresAt) };
}

/** Signs a user in: a fresh access token and a refresh token good for seven days. */
export function issueMockSession(userId: number): MockTokenPair {
  const now = Date.now();
  const refreshToken = crypto.randomUUID();
  const expiresAt = toSecond(now + REFRESH_TOKEN_MS);
  getMockStore().refreshTokens.set(refreshToken, { userId, expiresAt });
  return {
    ...issueAccessToken(userId, now),
    refreshToken,
    refreshExpireAt: formatApiTime(expiresAt),
  };
}

/** An access token for tests and fixtures that only need to call the API as a user. */
export function issueMockToken(userId: number): string {
  return issueMockSession(userId).token;
}

/**
 * Exchanges a refresh token for a new pair, rotating it. A token reused within the grace
 * window gets the same successor; reused after it, every session of its user ends.
 */
export function refreshMockSession(refreshToken: string): MockTokenPair | undefined {
  const { refreshTokens } = getMockStore();
  const record = refreshTokens.get(refreshToken);
  const now = Date.now();
  if (!record || record.expiresAt <= now) {
    refreshTokens.delete(refreshToken);
    return undefined;
  }
  if (record.rotated) {
    if (now - record.rotated.at <= REFRESH_GRACE_MS) return record.rotated.successor;
    revokeMockTokensFor(record.userId);
    return undefined;
  }
  const next = crypto.randomUUID();
  refreshTokens.set(next, { userId: record.userId, expiresAt: record.expiresAt });
  const successor: MockTokenPair = {
    ...issueAccessToken(record.userId, now),
    refreshToken: next,
    refreshExpireAt: formatApiTime(record.expiresAt),
  };
  record.rotated = { at: now, successor };
  return successor;
}

/** The user an access token belongs to, while it is live. */
export function resolveMockToken(token: string | undefined): number | undefined {
  if (!token) return undefined;
  const { sessions } = getMockStore();
  const session = sessions.get(token);
  if (session && session.expiresAt <= Date.now()) sessions.delete(token);
  return sessions.get(token)?.userId;
}

export function revokeMockToken(token: string): boolean {
  return getMockStore().sessions.delete(token);
}

/** Ends a refresh token and every token rotated from the same sign-in that is still live. */
export function revokeMockRefreshToken(refreshToken: string): void {
  const { refreshTokens } = getMockStore();
  let current = refreshTokens.get(refreshToken) ? refreshToken : undefined;
  while (current) {
    const record = refreshTokens.get(current);
    refreshTokens.delete(current);
    current = record?.rotated?.successor.refreshToken;
  }
}

/** Ends every session a user holds, e.g. after a password reset. */
export function revokeMockTokensFor(userId: number): void {
  const { sessions, refreshTokens } = getMockStore();
  for (const [token, session] of sessions) if (session.userId === userId) sessions.delete(token);
  for (const [token, record] of refreshTokens)
    if (record.userId === userId) refreshTokens.delete(token);
}

export function getMockStore(): MockStore {
  return (globalStore.__creawMockStoreV5 ??= createSeed());
}
export function resetMockStore(): MockStore {
  return (globalStore.__creawMockStoreV5 = createSeed());
}
