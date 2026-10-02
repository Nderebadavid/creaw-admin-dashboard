"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { postAuth, SERVICE_UNREACHABLE, type AuthActionResult } from "./auth-request";
import { createPortalApiClient } from "../api/portal-client";
import {
  LOGIN_CHALLENGE_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  toPortalSessionUser,
} from "./session";
import {
  clearSessionCookies,
  parseTokenPair,
  protectedCookie,
  writeSessionCookies,
} from "./tokens";

export type { AuthActionResult };

/** Where the one-time code was sent, already masked by the API. */
export interface OtpChannels {
  maskedPhone: string | null;
  maskedEmail: string | null;
}
export interface LoginActionResult extends AuthActionResult {
  challenge?: OtpChannels;
  /** The account is locked after too many failed attempts. */
  locked?: boolean;
}
export interface OtpActionResult extends AuthActionResult {
  /** The challenge is gone, so the user has to start again from the password step. */
  expired?: boolean;
}
export interface VerifyOtpActionResult extends OtpActionResult {
  user?: { firstName: string; initials: string; role: string | null };
}

const CHALLENGE_SECONDS = 60 * 10;
const RESULT_LOCKED = 423;
const RESULT_GONE = 410;
const CHALLENGE_EXPIRED: OtpActionResult = {
  success: false,
  expired: true,
  error: "Your verification code has expired. Sign in again to get a new one.",
};

const challengeData = z.object({
  challengeId: z.string().min(1),
  maskedPhone: z.string().nullable(),
  maskedEmail: z.string().nullable(),
});
const SIGN_IN_FAILED = { success: false, error: "Sign in failed. Please try again." } as const;
const currentUser = z.object({
  resultCode: z.number(),
  success: z.boolean(),
  message: z.string(),
  data: z
    .object({
      user: z.object({
        id: z.number(),
        first_name: z.string(),
        last_name: z.string(),
        email: z.string().nullable(),
      }),
      roles: z.array(z.string()).default([]),
    })
    .nullable(),
});
const challengeCookie = z.object({ id: z.string().min(1), remember: z.boolean() });

async function readChallenge(): Promise<z.infer<typeof challengeCookie> | undefined> {
  const raw = (await cookies()).get(LOGIN_CHALLENGE_COOKIE_NAME)?.value;
  if (!raw) return undefined;
  try {
    return challengeCookie.parse(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

/**
 * Step one: checks the password. Success opens a one-time code challenge, held
 * in an httpOnly cookie; the session itself is only created by `verifyOtpAction`.
 */
export async function loginAction(
  username: string,
  password: string,
  remember = true
): Promise<LoginActionResult> {
  if (
    typeof username !== "string" ||
    !username.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    return { success: false, error: "Enter your email or username and password." };
  }
  try {
    const response = await postAuth("/auth/login", { username: username.trim(), password });
    if (!response.success) {
      return {
        success: false,
        error: response.message,
        ...(response.resultCode === RESULT_LOCKED ? { locked: true } : {}),
      };
    }
    // A response without a challenge (for example a bare token) is refused:
    // a password alone must never sign anyone in.
    const data = challengeData.safeParse(response.data);
    if (!data.success) return SIGN_IN_FAILED;
    const { challengeId, maskedPhone, maskedEmail } = data.data;
    (await cookies()).set(
      LOGIN_CHALLENGE_COOKIE_NAME,
      JSON.stringify({ id: challengeId, remember: remember === true }),
      { ...protectedCookie, maxAge: CHALLENGE_SECONDS }
    );
    return { success: true, challenge: { maskedPhone, maskedEmail } };
  } catch {
    return SERVICE_UNREACHABLE;
  }
}

/**
 * Step two: exchanges the one-time code for the token pair, stores it in protected
 * cookies, and reads the signed-in user from `/auth/me` for the welcome screen.
 */
export async function verifyOtpAction(code: string): Promise<VerifyOtpActionResult> {
  if (typeof code !== "string" || !/^\d{6}$/.test(code))
    return { success: false, error: "Enter the 6-digit code." };
  const challenge = await readChallenge();
  if (!challenge) return CHALLENGE_EXPIRED;
  try {
    const response = await postAuth("/auth/otp/verify", { challengeId: challenge.id, code });
    const cookieStore = await cookies();
    if (!response.success) {
      if (response.resultCode !== RESULT_GONE) return { success: false, error: response.message };
      cookieStore.delete(LOGIN_CHALLENGE_COOKIE_NAME);
      return { ...CHALLENGE_EXPIRED, error: response.message };
    }
    // The code is spent from here on, so any failure ends the challenge and starts over.
    const pair = parseTokenPair(response.data);
    if (!pair) return abandonSignIn();
    let me: z.infer<typeof currentUser>;
    try {
      me = await createPortalApiClient().request(
        { method: "GET", path: "/auth/me", routeTemplate: "/auth/me", token: pair.token },
        currentUser
      );
    } catch {
      return abandonSignIn(pair);
    }
    if (!me.success || !me.data) return abandonSignIn(pair);
    cookieStore.delete(LOGIN_CHALLENGE_COOKIE_NAME);
    writeSessionCookies(cookieStore, pair, challenge.remember);
    const { firstName, initials } = toPortalSessionUser(me.data.user);
    return { success: true, user: { firstName, initials, role: me.data.roles[0] ?? null } };
  } catch {
    return SERVICE_UNREACHABLE;
  }
}

/**
 * Ends a sign-in whose code was accepted but whose session cannot be used: revokes the
 * issued tokens, drops the spent challenge, and sends the user back to the password step.
 */
async function abandonSignIn(pair?: {
  token: string;
  refreshToken: string;
}): Promise<VerifyOtpActionResult> {
  if (pair) {
    try {
      await postAuth("/auth/logout", { refreshToken: pair.refreshToken }, pair.token);
    } catch {
      // Unused tokens still expire on their own; the user must not be left stuck.
    }
  }
  (await cookies()).delete(LOGIN_CHALLENGE_COOKIE_NAME);
  return { success: false, expired: true, error: "Sign in failed. Please sign in again." };
}

/** Asks for a fresh code for the open challenge and restarts its 10 minutes. */
export async function resendOtpAction(): Promise<OtpActionResult> {
  const challenge = await readChallenge();
  if (!challenge) return CHALLENGE_EXPIRED;
  try {
    const response = await postAuth("/auth/otp/resend", { challengeId: challenge.id });
    const cookieStore = await cookies();
    if (!response.success) {
      if (response.resultCode !== RESULT_GONE) return { success: false, error: response.message };
      cookieStore.delete(LOGIN_CHALLENGE_COOKIE_NAME);
      return { ...CHALLENGE_EXPIRED, error: response.message };
    }
    cookieStore.set(LOGIN_CHALLENGE_COOKIE_NAME, JSON.stringify(challenge), {
      ...protectedCookie,
      maxAge: CHALLENGE_SECONDS,
    });
    return { success: true };
  } catch {
    return SERVICE_UNREACHABLE;
  }
}

/** Revokes the access and refresh tokens upstream, then clears every session cookie. */
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;
  if (token || refreshToken) {
    try {
      await postAuth("/auth/logout", refreshToken ? { refreshToken } : undefined, token);
    } catch {
      // A failed upstream logout must not leave the browser signed in.
    }
  }
  clearSessionCookies(cookieStore);
}
