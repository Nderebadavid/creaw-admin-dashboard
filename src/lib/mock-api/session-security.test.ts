import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { handleMockRequest } from "./handlers";
import { resetMockStore } from "./store";

const call = (method: "GET" | "POST", path: "/auth/login" | "/auth/me" | "/auth/logout", token?: string, body?: unknown) =>
  handleMockRequest({ method, path, routeTemplate: path, correlationId: "session-security", token, body });

async function login(): Promise<string> {
  const response = await call("POST", "/auth/login", undefined, { username: "judy.mwangi", password: "creaw-demo" });
  expect(response.resultCode).toBe(200);
  return (response.data as { token: string }).token;
}

beforeEach(() => resetMockStore());

describe("issued mock sessions", () => {
  it("rejects guessed user-id tokens and arbitrary UUIDs", async () => {
    expect((await call("GET", "/auth/me", "mock-user-1")).resultCode).toBe(403);
    expect((await call("GET", "/auth/me", crypto.randomUUID())).resultCode).toBe(403);
    expect((await call("POST", "/auth/logout", "mock-user-1")).resultCode).toBe(403);
  });

  it("accepts only issued opaque tokens and revokes the exact token", async () => {
    const token = await login();
    expect(token).toMatch(/^[0-9a-f-]{36}$/i);
    expect((await call("GET", "/auth/me", token)).resultCode).toBe(200);
    expect((await call("POST", "/auth/logout", token)).resultCode).toBe(200);
    expect((await call("GET", "/auth/me", token)).resultCode).toBe(403);
    const fresh = await login();
    expect(fresh).not.toBe(token);
    expect((await call("GET", "/auth/me", fresh)).resultCode).toBe(200);
  });

  it("clears issued sessions when the mock store resets", async () => {
    const token = await login();
    resetMockStore();
    expect((await call("GET", "/auth/me", token)).resultCode).toBe(403);
  });
});
