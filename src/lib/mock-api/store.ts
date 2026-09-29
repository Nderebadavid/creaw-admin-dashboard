import "server-only";
import type { MockStore } from "@/types/db";
import { createSeed } from "./seed";

// One process-local store survives development module reloads. Restarting the
// server clears it; production mock processes also remain isolated from each other.
const globalStore = globalThis as typeof globalThis & { __creawMockStoreV1?: MockStore };
export function getMockStore(): MockStore {
  return globalStore.__creawMockStoreV1 ??= createSeed();
}
export function resetMockStore(): MockStore {
  return globalStore.__creawMockStoreV1 = createSeed();
}
