import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createReferralsApi } from "./api";

beforeEach(() => resetMockStore());
const apiFor = (userId: number) =>
  createReferralsApi(
    createApiClient(new MockApiTransport(handleMockRequest)),
    issueMockToken(userId)
  );

describe("referral workflows", () => {
  it("accepts in destination scope and creates one enrollment for the same participant", async () => {
    const api = apiFor(3); // WEE scoped lead
    const referral = await api.get(4); // Aisha: VAWG to WEE
    expect(referral?.canRespond).toBe(true);
    const before = getMockStore().enrollment.filter(
      (row) => row.participant_id === 6 && row.pillar_id === 2
    ).length;
    expect((await api.respond(4, "ACCEPTED")).resultCode).toBe(200);
    expect(getMockStore().referral[3].status).toBe("ACCEPTED");
    expect(
      getMockStore().enrollment.filter((row) => row.participant_id === 6 && row.pillar_id === 2)
    ).toHaveLength(before + 1);
  });

  it("names the participant to the receiving lead without source enrollment access", async () => {
    const api = apiFor(3); // WEE can view the incoming VAWG referral, not its VAWG enrollment
    expect(await api.getOrigin(7)).toBeNull();
    const referral = await api.get(4);
    expect(referral?.participantId).toBe(6);
    expect(referral?.participant).toMatch(/Aisha/);
    expect(referral?.participant).not.toContain("•");
  });

  it("names the external institution in list and detail view models", async () => {
    const api = apiFor(1);
    expect((await api.get(1))?.destinationName).toBe("Nairobi Women's Shelter");
    expect((await api.list({ page: 1, pageSize: 1 })).items[0].destinationName).toBe(
      "Nairobi Women's Shelter"
    );
  });

  it("preserves a historic external destination label after its institution is retired", async () => {
    getMockStore().partner_institution.find(
      (row) => row.name === "Nairobi Women's Shelter"
    )!.is_deleted = true;
    expect((await apiFor(1).get(1))?.destinationName).toBe("Nairobi Women's Shelter");
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
    const result = await api.create({
      enrollmentId: 1,
      fromPillarId: 1,
      toPillarId: 2,
      reason: "Business support",
    });
    expect(result.resultCode).toBe(201);
    expect(result.data).toMatchObject({
      enrollment_id: 1,
      from_pillar_id: 1,
      to_pillar_id: 2,
      status: "NEW",
    });
    expect(result.data?.to_project_id).toBeTypeOf("number");
    expect(
      (
        await api.create({
          enrollmentId: 2,
          fromPillarId: 2,
          toPillarId: 1,
          reason: "Wrong origin",
        })
      ).resultCode
    ).toBe(403);
  });

  it("creates an external referral with only its partner institution destination", async () => {
    const institutionId = getMockStore().partner_institution.find(
      (row) => row.name === "Nairobi Women's Shelter"
    )!.id;
    const result = await apiFor(5).create({
      enrollmentId: 1,
      fromPillarId: 1,
      toPillarId: 1,
      partnerInstitutionId: institutionId,
      reason: "Shelter placement",
    });
    expect(result).toMatchObject({
      resultCode: 201,
      data: { to_project_id: null, to_partner_institution_id: institutionId },
    });
    expect((await apiFor(5).get(result.data!.id))?.destinationName).toBe("Nairobi Women's Shelter");
  });

  it("accepts an external hand-off without creating a destination enrollment", async () => {
    const store = getMockStore();
    const before = store.enrollment.filter((row) => row.participant_id === 1).length;
    expect((await apiFor(5).respond(1, "ACCEPTED")).resultCode).toBe(200);
    expect(store.enrollment.filter((row) => row.participant_id === 1)).toHaveLength(before);
    expect(store.referral[0].status).toBe("ACCEPTED");
  });

  it("offers referral destination choices without granting lookup management", async () => {
    const destinations = await apiFor(5).destinations();
    expect(destinations.partnerInstitutions).toContainEqual(
      expect.objectContaining({ name: "Nairobi Women's Shelter" })
    );
    expect(destinations.internalPillarIds).toContain(2);
    expect(destinations.internalPillarIds).not.toContain(4); // Leadership has no project
  });

  it("does not duplicate an existing destination enrollment and rejects repeated acceptance", async () => {
    const store = getMockStore();
    const destinationEnrollment = {
      ...store.enrollment.find((row) => row.participant_id === 6)!,
      id: 1000,
      pillar_id: 2,
    };
    store.enrollment.push(destinationEnrollment);
    const api = apiFor(1);
    expect((await api.respond(4, "ACCEPTED")).resultCode).toBe(200);
    expect(
      store.enrollment.filter((row) => row.participant_id === 6 && row.pillar_id === 2)
    ).toEqual([destinationEnrollment]);
    const auditCount = store.audit_logs.length;
    expect((await api.respond(4, "ACCEPTED")).resultCode).toBe(422);
    expect(
      store.enrollment.filter((row) => row.participant_id === 6 && row.pillar_id === 2)
    ).toHaveLength(1);
    expect(store.audit_logs).toHaveLength(auditCount);
  });
});

describe("referral provenance", () => {
  it("names the officer who made a referral, or the background job", async () => {
    const api = apiFor(1);
    expect((await api.get(1))?.referredBy).toBe("Amina Wekesa");
    expect((await api.get(2))?.referredBy).toBe("System (background job)");
  });

  it("records the signed-in officer as the referrer of a new referral", async () => {
    const api = apiFor(1);
    const created = await api.create({
      enrollmentId: 1,
      fromPillarId: 1,
      toPillarId: 3,
      reason: "Peer support group intake",
    });
    expect(created.success).toBe(true);
    expect((await api.get(created.data!.id))?.referredBy).toBe("Judy Mwangi");
  });
});

describe("referral counts", () => {
  it("counts referrals by status without resolving the caller's grants", async () => {
    const requests: string[] = [];
    const api = createReferralsApi(
      createApiClient(
        new MockApiTransport((request) => {
          requests.push(request.path);
          return handleMockRequest(request);
        })
      ),
      issueMockToken(1)
    );
    const count = await api.countByStatus("NEW");
    expect(requests).toEqual(["/referrals"]);
    expect(count).toBe((await api.list({ status: "NEW", pageSize: 1 })).totalItems);
    expect(count).toBeGreaterThan(0);
  });
});
