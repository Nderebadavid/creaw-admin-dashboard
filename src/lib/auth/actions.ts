"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { postAuth, SERVICE_UNREACHABLE, type AuthActionResult } from "./auth-request";
import { LOGIN_CHALLENGE_COOKIE_NAME, SESSION_COOKIE_NAME, toPortalSessionUser } from "./session";

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
const SESSION_SECONDS = 60 * 60 * 12;
const RESULT_LOCKED = 423;
const RESULT_GONE = 410;
const CHALLENGE_EXPIRED: OtpActionResult = {
  success: false,
  expired: true,
  error: "Your verification code has expired. Sign in again to get a new one.",
};

const protectedCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

const challengeData = z.object({
  challengeId: z.string().min(1),
  maskedPhone: z.string().nullable(),
  maskedEmail: z.string().nullable(),
});
const sessionData = z.object({
  token: z.string().min(1),
  user: z.object({
    id: z.number(),
    first_name: z.string(),
    last_name: z.string(),
    email: z.string().nullable(),
  }),
  roles: z.array(z.string()).default([]),
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
    if (!data.success) return { success: false, error: "Sign in failed. Please try again." };
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

/** Step two: exchanges the one-time code for the session cookie. */
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
    const data = sessionData.safeParse(response.data);
    if (!data.success) return { success: false, error: "Sign in failed. Please try again." };
    cookieStore.delete(LOGIN_CHALLENGE_COOKIE_NAME);
    cookieStore.set(SESSION_COOKIE_NAME, data.data.token, {
      ...protectedCookie,
      ...(challenge.remember ? { maxAge: SESSION_SECONDS } : {}),
    });
    const { firstName, initials } = toPortalSessionUser(data.data.user);
    return { success: true, user: { firstName, initials, role: data.data.roles[0] ?? null } };
  } catch {
    return SERVICE_UNREACHABLE;
  }
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

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    try {
      await postAuth("/auth/logout", undefined, token);
    } catch {
      // A failed upstream logout must not leave the browser signed in.
    }
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}
