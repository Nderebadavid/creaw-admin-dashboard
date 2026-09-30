import { isStrongPassword } from "../../auth/password-rules";
import { type MockContext } from "../context";
import { envelope } from "../core";
import { revokeMockTokensFor } from "../store";
import { findAccount, stringFields } from "./accounts";
import { type ApiEnvelope } from "@/types/api";

const RESET_TTL_MS = 30 * 60_000;
const EXPIRED_LINK = "This reset link has expired or was already used. Request a new one.";

/**
 * `POST /auth/password/forgot`: always succeeds, so the response never reveals
 * whether an email belongs to an account. The mock sends no email; it returns
 * the link's token as `previewToken`, which is only redeemable for a real account.
 */
export function forgotPassword({ request, store }: MockContext): ApiEnvelope<unknown> {
  const body = stringFields(request.body, "email");
  if (!body) return envelope(422);
  const token = crypto.randomUUID();
  const user = findAccount(store, body.email);
  if (user?.email?.toLowerCase() === body.email.trim().toLowerCase())
    store.resetTokens.set(token, { userId: user.id, expiresAt: Date.now() + RESET_TTL_MS });
  return envelope(200, { previewToken: token });
}

/** `POST /auth/password/reset`: redeems a reset link once and signs the user out everywhere. */
export function resetPassword({ request, store }: MockContext): ApiEnvelope<unknown> {
  const body = stringFields(request.body, "token", "password");
  if (!body) return envelope(422);
  const link = store.resetTokens.get(body.token);
  if (!link || link.expiresAt <= Date.now()) {
    store.resetTokens.delete(body.token);
    return envelope(410, null, EXPIRED_LINK);
  }
  if (!isStrongPassword(body.password))
    return envelope(422, null, "Choose a password that meets every requirement.");
  store.resetTokens.delete(body.token);
  store.passwords.set(link.userId, body.password);
  store.failedLogins.delete(`user:${link.userId}`);
  for (const [id, challenge] of store.loginChallenges)
    if (challenge.userId === link.userId) store.loginChallenges.delete(id);
  revokeMockTokensFor(link.userId);
  return envelope(200);
}
