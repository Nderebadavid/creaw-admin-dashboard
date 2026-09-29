import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { reviewSubmissionAction } from "./actions";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";

beforeEach(() => {
  resetMockStore();
  cookieStore.get.mockReset();
  cookieStore.get.mockReturnValue({ value: issueMockToken(1) });
});

describe("submission review", () => {
  it("approves a recorded submission and writes an audit row", async () => {
    const id = getMockStore().participant_stage_event.find(
      (row) => row.stage_event_status === "recorded"
    )!.id;
    const result = await reviewSubmissionAction(id, "approve");
    expect(result.success).toBe(true);
    expect(
      getMockStore().participant_stage_event.find((row) => row.id === id)?.stage_event_status
    ).toBe("verified");
    expect(getMockStore().audit_logs.at(-1)).toMatchObject({
      entity_type: "participant_stage_event",
      entity_id: id,
      action: "UPDATE",
    });
  });

  it("rejects a cross-pillar review without a mutation", async () => {
    cookieStore.get.mockReturnValue({ value: issueMockToken(5) });
    const row = getMockStore().participant_stage_event.find((event) => {
      const enrollment = getMockStore().enrollment.find((item) => item.id === event.enrollment_id);
      return enrollment?.pillar_id === 2;
    })!;
    const before = row.stage_event_status;
    const result = await reviewSubmissionAction(row.id, "approve");
    expect(result.success).toBe(false);
    expect(row.stage_event_status).toBe(before);
  });
  it("reviews a scoped event whose enrollment is after the first hundred", async () => {
    cookieStore.get.mockReturnValue({ value: issueMockToken(5) });
    const store = getMockStore();
    const enrollment = store.enrollment.find((item) => item.pillar_id === 1)!;
    const event = store.participant_stage_event.find(
      (item) => item.enrollment_id === enrollment.id
    )!;
    for (let index = 0; index < 110; index += 1)
      store.enrollment.push({ ...enrollment, id: 501 + index });
    store.participant_stage_event.push({
      ...event,
      id: 501,
      enrollment_id: 610,
      stage_event_status: "recorded",
      local_ref: "late-501",
    });
    const result = await reviewSubmissionAction(501, "approve");
    expect(result.success).toBe(true);
    expect(store.participant_stage_event.find((item) => item.id === 501)?.stage_event_status).toBe(
      "verified"
    );
  });
});
