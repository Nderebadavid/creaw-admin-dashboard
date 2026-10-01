import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { makeRow } from "@/lib/mock-api/rows";
import { createParticipantsApi } from "./api";

beforeEach(() => resetMockStore());
const apiFor = (userId: number) =>
  createParticipantsApi(
    createApiClient(new MockApiTransport(handleMockRequest)),
    issueMockToken(userId)
  );

describe("participant workflows", () => {
  it("paginates combined participant and geography data after pillar, county and search filters", async () => {
    const api = apiFor(1);
    const countyId = getMockStore().county.find((row) => row.name === "Nairobi")!.id;
    const first = await api.list({ pillarId: 2, countyId, search: "female", page: 1, pageSize: 1 });
    expect(first).toMatchObject({ page: 1, pageSize: 1, totalItems: 1, totalPages: 1 });
    expect(first.items[0]).toMatchObject({ county: "Nairobi", pillarIds: [6, 2] });
    expect(first.items[0].name).toBe("Faith Atieno");
    expect(first.items[0].idNumber).not.toBe("35510442");
    expect(first.items[0].idNumber).toContain("•");
  });

  it("reads later participant pages without dropping joined enrollments", async () => {
    const api = apiFor(1);
    const page = await api.list({ page: 2, pageSize: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.items[0].pillarIds).toContain(2);
  });

  it("rejects a duplicate identity before writing a registration", async () => {
    const api = apiFor(1);
    const count = getMockStore().participant.length;
    const result = await api.register({
      firstName: "Other",
      lastName: "Person",
      idNumber: "29481172",
      pillarId: 1,
      consentGiven: true,
    });
    expect(result).toMatchObject({ success: false, resultCode: 422 });
    expect(getMockStore().participant).toHaveLength(count);
  });

  it("registers into the requested pillar on one participant record", async () => {
    const api = apiFor(3); // WEE scope
    const result = await api.register({
      firstName: "New",
      lastName: "Person",
      pillarId: 2,
      consentGiven: true,
    });
    expect(result.resultCode).toBe(201);
    const id = result.data!.id;
    expect(getMockStore().enrollment.filter((row) => row.participant_id === id)).toMatchObject([
      { pillar_id: 2 },
    ]);
    const forbidden = await api.register({
      firstName: "Another",
      lastName: "Person",
      pillarId: 1,
      consentGiven: true,
    });
    expect(forbidden.resultCode).toBe(403);
  });

  it("audits an authorized sensitive reveal and otherwise keeps the field masked", async () => {
    const api = apiFor(1);
    const detail = await api.get(1);
    expect(detail?.idNumber).not.toBe("29481172");
    const result = await api.reveal(1, "id_number");
    expect(result).toMatchObject({ success: true, data: { id_number: "29481172" } });
    expect(getMockStore().audit_logs.at(-1)?.action).toBe("REVEAL");
    expect(JSON.stringify(getMockStore().audit_logs)).not.toContain("29481172");
  });

  it("does not reveal identity data to a viewer without reveal permission", async () => {
    const audits = getMockStore().audit_logs.length;
    expect((await apiFor(13).reveal(1, "id_number")).resultCode).toBe(403);
    expect(getMockStore().audit_logs).toHaveLength(audits);
  });

  it("shows the latest pipeline stage instead of the enrollment entry category", async () => {
    const store = getMockStore();
    const enrollment = store.enrollment.find((row) => row.participant_id === 1)!;
    const pipeline = store.pipeline_definition.find(
      (row) => row.pillar_id === enrollment.pillar_id
    )!;
    const laterStage = store.stage_definition.find(
      (row) => row.pipeline_id === pipeline.id && row.step_no === 2
    )!;
    store.participant_stage_event.push(
      makeRow(
        "participant_stage_event",
        {
          enrollment_id: enrollment.id,
          stage_definition_id: laterStage.id,
          event_date: "2026-09-29T09:00:00.000Z",
        },
        10000,
        "2026-09-29T09:00:00.000Z"
      )
    );
    const participant = await apiFor(1).get(1);
    expect(participant?.currentStage).toBe(laterStage.name);
    expect(participant?.currentStage).not.toBe(enrollment.entry_category);
  });

  it("joins enrollments beyond the first API page", async () => {
    const store = getMockStore();
    const enrolled = store.enrollment.find((row) => row.participant_id === 1)!;
    for (let index = 0; index < 101; index++)
      store.enrollment.push({
        ...enrolled,
        id: 1000 + index,
        participant_id: null,
        organisation_id: 1,
      });
    store.enrollment.push({ ...enrolled, id: 1200, pillar_id: 2 });
    const participant = await apiFor(1).get(1);
    expect(participant?.enrollments.map((row) => row.id)).toContain(1200);
  });

  it("exports only the filtered participant set with masked identity values", async () => {
    const response = await handleMockRequest({
      method: "GET",
      path: "/participants",
      routeTemplate: "/participants",
      correlationId: "filtered-export",
      token: issueMockToken(1),
      query: { pillarId: 2, format: "csv" },
    });
    expect(response.resultCode).toBe(200);
    const content = (response.data as { content: string }).content;
    expect(content).not.toContain("29481172");
    expect(content).not.toContain("Faith Njeri");
    expect(content.split("\r\n")).toHaveLength(
      getMockStore().participant.filter((row) => storeHasEnrollmentInPillar(row.id, 2)).length + 1
    );
    expect(getMockStore().audit_logs.at(-1)?.action).toBe("EXPORT");
  });
});

function storeHasEnrollmentInPillar(participantId: number, pillarId: number) {
  return getMockStore().enrollment.some(
    (row) => row.participant_id === participantId && row.pillar_id === pillarId && !row.is_deleted
  );
}

describe("curriculum through the participants API", () => {
  it("maps progress onto the view and loads topics and milestones for the drawer", async () => {
    const api = apiFor(9); // SRHR lead
    const page = await api.list({ pageSize: 100, sort: { by: "curriculum", order: "desc" } });
    const srhr = page.items.filter((row) => row.curriculum);
    expect(srhr.length).toBeGreaterThan(0);
    expect(srhr[0].curriculum).toMatchObject({ total: 14, done: expect.any(Number) });
    const detail = await api.curriculum(srhr[0].id);
    expect(detail?.topics).toHaveLength(14);
    expect(detail?.milestones.map((row) => row.name)).toContain("Graduation");
  });

  it("filters to participants who are behind", async () => {
    const behind = await apiFor(9).list({ pageSize: 100, behind: true });
    expect(behind.items.length).toBeGreaterThan(0);
    expect(behind.items.every((row) => row.curriculum?.behind === true)).toBe(true);
  });

  it("gives staff without SRHR access no progress", async () => {
    const page = await apiFor(5).list({ pageSize: 100 }); // VAWG lead
    expect(page.items.every((row) => row.curriculum === null)).toBe(true);
    const some = page.items[0];
    expect((await apiFor(5).curriculum(some.id))?.topics).toEqual([]);
  });
});
