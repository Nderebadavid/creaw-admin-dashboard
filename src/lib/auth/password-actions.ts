"use server";

import { z } from "zod";
import { postAuth, SERVICE_UNREACHABLE, type AuthActionResult } from "./auth-request";
import { isStrongPassword } from "./password-rules";

export interface PasswordResetRequestResult extends AuthActionResult {
  /** Mock mode only: the token the emailed link would carry, so the flow can be walked through. */
  previewToken?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const preview = z.object({ previewToken: z.string().min(1) });

/**
 * Requests a reset link. The answer is the same whether or not the email
 * belongs to an account, so it cannot be used to discover staff addresses.
 */
export async function requestPasswordResetAction(
  email: string
): Promise<PasswordResetRequestResult> {
  if (typeof email !== "string" || !EMAIL.test(email.trim()))
    return { success: false, error: "Enter a valid work email address." };
  try {
    const response = await postAuth("/auth/password/forgot", { email: email.trim() });
    if (!response.success) return { success: false, error: response.message };
    // A real backend emails the link. Only the mock hands the token back, and
    // it is never passed on in any other mode.
    const data = preview.safeParse(response.data);
    const mock = (process.env.PORTAL_API_MODE ?? "mock") === "mock";
    return mock && data.success
      ? { success: true, previewToken: data.data.previewToken }
      : { success: true };
  } catch {
    return SERVICE_UNREACHABLE;
  }
}

/** Redeems a reset link's token for a new password. */
export async function resetPasswordAction(
  token: string,
  password: string
): Promise<AuthActionResult> {
  if (typeof token !== "string" || !token || typeof password !== "string")
    return { success: false, error: "This reset link is not valid. Request a new one." };
  if (!isStrongPassword(password))
    return { success: false, error: "Choose a password that meets every requirement." };
  try {
    const response = await postAuth("/auth/password/reset", { token, password });
    return response.success ? { success: true } : { success: false, error: response.message };
  } catch {
    return SERVICE_UNREACHABLE;
  }
}
