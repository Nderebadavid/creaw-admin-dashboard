import "server-only";
import type { MockStore } from "@/types/db";
import { createSeed } from "./seed";

// One process-local store survives development module reloads. Restarting the
// server clears it; production mock processes also remain isolated from each other.
const globalStore = globalThis as typeof globalThis & { __creawMockStoreV2?: MockStore };
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
export function getMockStore(): MockStore {
  return globalStore.__creawMockStoreV2 ??= createSeed();
}
export function resetMockStore(): MockStore {
  return globalStore.__creawMockStoreV2 = createSeed();
}
