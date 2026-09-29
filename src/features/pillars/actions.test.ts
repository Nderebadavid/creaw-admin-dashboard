import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { createPillarRecordAction, updatePillarRecordAction } from "./actions";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";

beforeEach(() => {
  resetMockStore();
  cookieStore.get.mockReset();
  cookieStore.get.mockReturnValue({ value: issueMockToken(1) });
});

describe("pillar mutations", () => {
  it("creates a scoped enrollment and records the change", async () => {
    const before = getMockStore().enrollment.length;
    const result = await createPillarRecordAction("vawg", 1, "Outreach");
    expect(result.success).toBe(true);
    expect(getMockStore().enrollment).toHaveLength(before + 1);
    expect(getMockStore().audit_logs.at(-1)).toMatchObject({ entity_type: "enrollment", action: "CREATE" });
  });

  it("updates an existing record in the permitted pillar", async () => {
    const row = getMockStore().enrollment.find(item => item.pillar_id === 1)!;
    const result = await updatePillarRecordAction("vawg", row.id, "Updated pathway");
    expect(result.success).toBe(true);
    expect(getMockStore().enrollment.find(item => item.id === row.id)?.entry_category).toBe("Updated pathway");
  });

  it("rejects cross-pillar creation", async () => {
    cookieStore.get.mockReturnValue({ value: issueMockToken(5) });
    const before = getMockStore().enrollment.length;
    const result = await createPillarRecordAction("wee", 1, "Outreach");
    expect(result.success).toBe(false);
    expect(getMockStore().enrollment).toHaveLength(before);
  });
});
