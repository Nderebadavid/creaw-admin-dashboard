import "server-only";
import type { MockStore } from "@/types/db";
import { createSeed } from "./seed";

// One process-local store survives development module reloads. Restarting the
// server clears it; production mock processes also remain isolated from each other.
// Bump the version in the key whenever MockStore gains or loses a field, or a
// running dev server keeps serving a store built with the old shape.
const globalStore = globalThis as typeof globalThis & { __creawMockStoreV4?: MockStore };
export function issueMockToken(userId: number): string {
  const token = crypto.randomUUID();
  getMockStore().sessions.set(token, userId);
  return token;
}
export function resolveMockToken(token: string | undefined): number | undefined {
  return token ? getMockStore().sessions.get(token) : undefined;
}
export function revokeMockToken(token: string): boolean {
  return getMockStore().sessions.delete(token);
}
/** Ends every session a user holds, e.g. after a password reset. */
export function revokeMockTokensFor(userId: number): void {
  const { sessions } = getMockStore();
  for (const [token, owner] of sessions) if (owner === userId) sessions.delete(token);
}
export function getMockStore(): MockStore {
  return (globalStore.__creawMockStoreV4 ??= createSeed());
}
export function resetMockStore(): MockStore {
  return (globalStore.__creawMockStoreV4 = createSeed());
}
