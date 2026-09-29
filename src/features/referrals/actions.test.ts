import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createReferralsApi } from "./api";

beforeEach(() => resetMockStore());
const apiFor = (userId: number) => createReferralsApi(createApiClient(new MockApiTransport(handleMockRequest)), issueMockToken(userId));

describe("referral workflows", () => {
  it("accepts in destination scope and creates one enrollment for the same participant", async () => {
    const api = apiFor(3); // WEE scoped lead
    const referral = await api.get(4); // Aisha: VAWG to WEE
    expect(referral?.canRespond).toBe(true);
    const before = getMockStore().enrollment.filter(row => row.participant_id === 6 && row.pillar_id === 2).length;
    expect((await api.respond(4, "ACCEPTED")).resultCode).toBe(200);
    expect(getMockStore().referral[3].status).toBe("ACCEPTED");
    expect(getMockStore().enrollment.filter(row => row.participant_id === 6 && row.pillar_id === 2)).toHaveLength(before + 1);
  });

  it("shows a disabled decision and returns 403 when destination scope mismatches", async () => {
    const api = apiFor(5); // VAWG scoped lead, referral 4 goes to WEE
    const referral = await api.get(4);
    expect(referral).toMatchObject({ canRespond: false });
    expect(referral?.respondDisabledReason).toMatch(/receiving pillar/i);
    expect((await api.respond(4, "ACCEPTED")).resultCode).toBe(403);
    expect(getMockStore().referral[3].status).toBe("NEW");
  });

  it("lets the origin edit or withdraw but not the destination, preserving history", async () => {
    expect((await apiFor(5).edit(4, "Updated reason")).resultCode).toBe(200);
    expect((await apiFor(3).edit(4, "Wrong side")).resultCode).toBe(403);
    expect((await apiFor(5).withdraw(4)).resultCode).toBe(200);
    expect(getMockStore().referral[3]).toMatchObject({ status: "WITHDRAWN", is_deleted: false });
  });

  it("creates only from an owned origin enrollment and assigns an internal destination", async () => {
    const api = apiFor(5); // VAWG lead
    const result = await api.create({ enrollmentId: 1, fromPillarId: 1, toPillarId: 2, reason: "Business support" });
    expect(result.resultCode).toBe(201);
    expect(result.data).toMatchObject({ enrollment_id: 1, from_pillar_id: 1, to_pillar_id: 2, status: "NEW" });
    expect(result.data?.to_project_id).toBeTypeOf("number");
    expect((await api.create({ enrollmentId: 2, fromPillarId: 2, toPillarId: 1, reason: "Wrong origin" })).resultCode).toBe(403);
  });
});
