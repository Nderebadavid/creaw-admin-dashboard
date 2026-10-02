import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { handleMockRequest } from "./handlers";
import { MOCK_OTP_CODE } from "./seed";
import { resetMockStore } from "./store";
import type { ApiRouteTemplate } from "../api/transport";

const call = (method: "GET" | "POST", path: ApiRouteTemplate, body?: unknown, token?: string) =>
  handleMockRequest({
    method,
    path,
    routeTemplate: path,
    correlationId: "auth-flow",
    token,
    body,
  });

const signIn = (username = "judy.mwangi", password = "creaw-demo") =>
  call("POST", "/auth/login", { username, password });

async function challengeFor(username = "judy.mwangi", password = "creaw-demo"): Promise<string> {
  const response = await signIn(username, password);
  expect(response.resultCode).toBe(200);
  return (response.data as { challengeId: string }).challengeId;
}

const verify = (challengeId: string, code: string) =>
  call("POST", "/auth/otp/verify", { challengeId, code });

beforeEach(() => resetMockStore());
afterEach(() => vi.useRealTimers());

describe("password step", () => {
  it("returns a challenge with masked contacts and no token", async () => {
    const response = await signIn();
    expect(response).toMatchObject({
      resultCode: 200,
      data: {
        challengeId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        maskedPhone: "07•• ••• 344",
        maskedEmail: "ju•••••@creaw.org",
      },
    });
    expect(JSON.stringify(response.data)).not.toContain("token");
    expect(JSON.stringify(response.data)).not.toContain("0711");
  });

  it("accepts the staff email in place of the username", async () => {
    expect((await signIn("Judy.Mwangi@creaw.org")).resultCode).toBe(200);
  });

  it("counts down failed attempts and locks the account for 15 minutes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T08:00:00Z"));
    expect(await signIn("judy.mwangi", "wrong")).toMatchObject({
      resultCode: 403,
      message: "Incorrect email or password. 4 attempts left before the account is locked.",
    });
    await signIn("judy.mwangi", "wrong");
    await signIn("judy.mwangi", "wrong");
    expect(await signIn("judy.mwangi", "wrong")).toMatchObject({
      message: "Incorrect email or password. 1 attempt left before the account is locked.",
    });
    expect((await signIn("judy.mwangi", "wrong")).resultCode).toBe(423);
    // The right password is refused while the lock holds.
    expect((await signIn()).resultCode).toBe(423);
    vi.setSystemTime(new Date("2026-09-30T08:15:01Z"));
    expect((await signIn()).resultCode).toBe(200);
  });

  it("answers an unknown account like a wrong password", async () => {
    expect(await signIn("nobody.here", "creaw-demo")).toMatchObject({
      resultCode: 403,
      message: "Incorrect email or password. 4 attempts left before the account is locked.",
    });
  });

  it("clears the failure count after a correct password", async () => {
    await signIn("judy.mwangi", "wrong");
    await signIn();
    expect((await signIn("judy.mwangi", "wrong")).message).toContain("4 attempts left");
  });
});

describe("verification step", () => {
  it("issues a token pair only for the right code, and only once", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T14:07:27Z"));
    const challengeId = await challengeFor();
    const response = await verify(challengeId, MOCK_OTP_CODE);
    expect(response).toEqual({
      resultCode: 200,
      success: true,
      message: "Login successful",
      data: {
        token: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        // 30 minutes and 7 days, on the API's East Africa clock.
        expireAt: "2026-09-26 17:37:27",
        refreshToken: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        refreshExpireAt: "2026-10-03 17:07:27",
      },
    });
    const { token } = response.data as { token: string };
    expect(await call("GET", "/auth/me", undefined, token)).toMatchObject({
      resultCode: 200,
      data: { user: { first_name: "Judy", last_name: "Mwangi" }, roles: ["System Administrator"] },
    });
    expect((await verify(challengeId, MOCK_OTP_CODE)).resultCode).toBe(410);
  });

  it("rejects a wrong code and drops the challenge after five of them", async () => {
    const challengeId = await challengeFor();
    for (let attempt = 0; attempt < 4; attempt++)
      expect((await verify(challengeId, "000000")).resultCode).toBe(403);
    expect((await verify(challengeId, "000000")).resultCode).toBe(410);
    expect((await verify(challengeId, MOCK_OTP_CODE)).resultCode).toBe(410);
  });

  it("expires a challenge after 10 minutes unless the code is resent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T08:00:00Z"));
    const expired = await challengeFor();
    const resent = await challengeFor();
    vi.setSystemTime(new Date("2026-09-30T08:09:00Z"));
    expect((await call("POST", "/auth/otp/resend", { challengeId: resent })).resultCode).toBe(200);
    vi.setSystemTime(new Date("2026-09-30T08:10:01Z"));
    expect((await verify(expired, MOCK_OTP_CODE)).resultCode).toBe(410);
    expect((await call("POST", "/auth/otp/resend", { challengeId: expired })).resultCode).toBe(410);
    expect((await verify(resent, MOCK_OTP_CODE)).resultCode).toBe(200);
  });

  it("rejects malformed verification requests", async () => {
    expect((await call("POST", "/auth/otp/verify", { code: MOCK_OTP_CODE })).resultCode).toBe(422);
    expect((await call("GET", "/auth/otp/verify")).resultCode).toBe(422);
    expect((await verify(crypto.randomUUID(), MOCK_OTP_CODE)).resultCode).toBe(410);
  });
});

describe("password reset", () => {
  const forgot = (email: string) => call("POST", "/auth/password/forgot", { email });
  const reset = (token: string, password: string) =>
    call("POST", "/auth/password/reset", { token, password });
  const previewToken = async (email: string) =>
    ((await forgot(email)).data as { previewToken: string }).previewToken;

  it("answers known and unknown emails identically", async () => {
    const known = await forgot("judy.mwangi@creaw.org");
    const unknown = await forgot("nobody@creaw.org");
    expect(known.resultCode).toBe(200);
    expect(unknown.resultCode).toBe(200);
    expect(Object.keys(unknown.data as object)).toEqual(Object.keys(known.data as object));
    expect(
      (await reset(await previewToken("nobody@creaw.org"), "Str0ng!Passw0rd")).resultCode
    ).toBe(410);
  });

  it("replaces the password, ends existing sessions and works once", async () => {
    const session = (await verify(await challengeFor(), MOCK_OTP_CODE)).data as {
      token: string;
      refreshToken: string;
    };
    const token = await previewToken("judy.mwangi@creaw.org");
    expect((await reset(token, "Str0ng!Passw0rd")).resultCode).toBe(200);
    expect((await call("GET", "/auth/me", undefined, session.token)).resultCode).toBe(401);
    expect(
      (await call("POST", "/auth/refresh", { refreshToken: session.refreshToken })).resultCode
    ).toBe(401);
    expect((await signIn("judy.mwangi", "creaw-demo")).resultCode).toBe(403);
    expect((await signIn("judy.mwangi", "Str0ng!Passw0rd")).resultCode).toBe(200);
    expect((await reset(token, "An0ther!Passw0rd")).resultCode).toBe(410);
  });

  it("unlocks a locked account", async () => {
    for (let attempt = 0; attempt < 5; attempt++) await signIn("judy.mwangi", "wrong");
    expect((await signIn()).resultCode).toBe(423);
    await reset(await previewToken("judy.mwangi@creaw.org"), "Str0ng!Passw0rd");
    expect((await signIn("judy.mwangi", "Str0ng!Passw0rd")).resultCode).toBe(200);
  });

  it("refuses a weak password and keeps the link usable", async () => {
    const token = await previewToken("judy.mwangi@creaw.org");
    expect((await reset(token, "short")).resultCode).toBe(422);
    expect((await reset(token, "Str0ng!Passw0rd")).resultCode).toBe(200);
  });

  it("expires a reset link after 30 minutes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T08:00:00Z"));
    const token = await previewToken("judy.mwangi@creaw.org");
    vi.setSystemTime(new Date("2026-09-30T08:30:01Z"));
    expect((await reset(token, "Str0ng!Passw0rd")).resultCode).toBe(410);
  });
});
