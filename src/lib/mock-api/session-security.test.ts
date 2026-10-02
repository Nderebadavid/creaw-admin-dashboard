import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { handleMockRequest } from "./handlers";
import { MOCK_OTP_CODE } from "./seed";
import { resetMockStore } from "./store";

const call = (
  method: "GET" | "POST",
  path: "/auth/login" | "/auth/otp/verify" | "/auth/me" | "/auth/logout" | "/auth/refresh",
  token?: string,
  body?: unknown
) =>
  handleMockRequest({
    method,
    path,
    routeTemplate: path,
    correlationId: "session-security",
    token,
    body,
  });

interface Pair {
  token: string;
  expireAt: string;
  refreshToken: string;
  refreshExpireAt: string;
}

async function loginPair(): Promise<Pair> {
  const password = await call("POST", "/auth/login", undefined, {
    username: "judy.mwangi",
    password: "creaw-demo",
  });
  expect(password.resultCode).toBe(200);
  const { challengeId } = password.data as { challengeId: string };
  const response = await call("POST", "/auth/otp/verify", undefined, {
    challengeId,
    code: MOCK_OTP_CODE,
  });
  expect(response.resultCode).toBe(200);
  return response.data as Pair;
}

const login = async () => (await loginPair()).token;
const refresh = (refreshToken: string) =>
  call("POST", "/auth/refresh", undefined, { refreshToken });
const me = (token: string) => call("GET", "/auth/me", token);

beforeEach(() => resetMockStore());
afterEach(() => vi.useRealTimers());

describe("issued mock sessions", () => {
  it("rejects guessed user-id tokens and arbitrary UUIDs as expired sessions", async () => {
    expect((await me("mock-user-1")).resultCode).toBe(401);
    expect((await me(crypto.randomUUID())).resultCode).toBe(401);
  });

  it("accepts only issued opaque tokens and revokes the exact token", async () => {
    const token = await login();
    expect(token).toMatch(/^[0-9a-f-]{36}$/i);
    expect((await me(token)).resultCode).toBe(200);
    expect((await call("POST", "/auth/logout", token)).resultCode).toBe(200);
    expect((await me(token)).resultCode).toBe(401);
    const fresh = await login();
    expect(fresh).not.toBe(token);
    expect((await me(fresh)).resultCode).toBe(200);
  });

  it("clears issued sessions when the mock store resets", async () => {
    const token = await login();
    resetMockStore();
    expect((await me(token)).resultCode).toBe(401);
  });

  it("expires the access token after 30 minutes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T08:00:00Z"));
    const token = await login();
    vi.setSystemTime(new Date("2026-09-30T08:29:59Z"));
    expect((await me(token)).resultCode).toBe(200);
    vi.setSystemTime(new Date("2026-09-30T08:30:00Z"));
    expect((await me(token)).resultCode).toBe(401);
  });
});

describe("refresh tokens", () => {
  it("rotates into a new pair that keeps the original seven-day limit", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T08:00:00Z"));
    const first = await loginPair();
    vi.setSystemTime(new Date("2026-09-30T08:45:00Z"));
    const response = await refresh(first.refreshToken);
    expect(response.resultCode).toBe(200);
    const next = response.data as Pair;
    expect(next.token).not.toBe(first.token);
    expect(next.refreshToken).not.toBe(first.refreshToken);
    expect(next.expireAt).toBe("2026-09-30 12:15:00");
    expect(next.refreshExpireAt).toBe(first.refreshExpireAt);
    expect((await me(next.token)).resultCode).toBe(200);
  });

  it("answers a parallel refresh with the same successor", async () => {
    const { refreshToken } = await loginPair();
    const once = await refresh(refreshToken);
    const twice = await refresh(refreshToken);
    expect(twice).toEqual(once);
  });

  it("ends every session when a rotated token is reused after the grace window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T08:00:00Z"));
    const stolen = await loginPair();
    const other = await loginPair();
    const next = (await refresh(stolen.refreshToken)).data as Pair;
    vi.setSystemTime(new Date("2026-09-30T08:00:11Z"));
    expect((await refresh(stolen.refreshToken)).resultCode).toBe(401);
    expect((await me(next.token)).resultCode).toBe(401);
    expect((await refresh(next.refreshToken)).resultCode).toBe(401);
    expect((await refresh(other.refreshToken)).resultCode).toBe(401);
  });

  it("refuses an expired, unknown or missing refresh token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T08:00:00Z"));
    const { refreshToken } = await loginPair();
    expect((await refresh(crypto.randomUUID())).resultCode).toBe(401);
    expect((await call("POST", "/auth/refresh", undefined, {})).resultCode).toBe(422);
    vi.setSystemTime(new Date("2026-10-07T08:00:00Z"));
    expect((await refresh(refreshToken)).resultCode).toBe(401);
  });

  it("revokes the refresh token on logout, and logout never fails", async () => {
    const { token, refreshToken } = await loginPair();
    expect((await call("POST", "/auth/logout", token, { refreshToken })).resultCode).toBe(200);
    expect((await refresh(refreshToken)).resultCode).toBe(401);
    expect((await call("POST", "/auth/logout", "mock-user-1")).resultCode).toBe(200);
  });
});
