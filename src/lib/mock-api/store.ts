import "server-only";
import type { MockStore } from "@/types/db";
import { createSeed } from "./seed";

// One process-local store survives development module reloads. Restarting the
// server clears it; production mock processes also remain isolated from each other.
const globalStore = globalThis as typeof globalThis & {
  __creawMockStoreV1?: MockStore;
  __creawRevokedTokensV1?: Set<string>;
  __creawTokenSequenceV1?: Map<number, number>;
};
export function issueMockToken(userId: number): string {
  const sequence = globalStore.__creawTokenSequenceV1 ??= new Map();
  const version = (sequence.get(userId) ?? 0) + 1;
  sequence.set(userId, version);
  return `mock-user-${userId}${version === 1 ? "" : `-v${version}`}`;
}
export function isMockTokenRevoked(token: string): boolean {
  return (globalStore.__creawRevokedTokensV1 ??= new Set()).has(token);
}
export function revokeMockToken(token: string): void {
  (globalStore.__creawRevokedTokensV1 ??= new Set()).add(token);
}
export function getMockStore(): MockStore {
  return globalStore.__creawMockStoreV1 ??= createSeed();
}
export function resetMockStore(): MockStore {
  globalStore.__creawRevokedTokensV1 = new Set();
  globalStore.__creawTokenSequenceV1 = new Map();
  return globalStore.__creawMockStoreV1 = createSeed();
}
