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
    expect(first.items[0].idNumber).toBe("35510442");
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

  it("returns the full identity number on the detail read", async () => {
    const detail = await apiFor(1).get(1);
    expect(detail?.idNumber).toBe("29481172");
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

  it("exports only the filtered participant set without participants outside the filter", async () => {
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

  it("records disability and refugee status at registration and filters on disability", async () => {
    const api = apiFor(1);
    const created = await api.register({
      firstName: "Amina",
      lastName: "Yusuf",
      pillarId: 1,
      consentGiven: true,
      disability: true,
      refugee: true,
    });
    expect(created.success).toBe(true);
    const pwd = await api.list({ pwd: true, pageSize: 100 });
    const amina = pwd.items.find((row) => row.name === "Amina Yusuf");
    expect(amina).toMatchObject({ disability: true, refugee: true });
    expect(pwd.items.every((row) => row.disability)).toBe(true);
  });

  it("lets only record managers correct identity details", async () => {
    const person = getMockStore().participant.find((row) => !row.is_deleted)!;
    // Head of MERL edits participants everywhere but cannot correct identity details.
    expect((await apiFor(2).update({ id: person.id, remarks: "Visited" })).resultCode).toBe(200);
    expect((await apiFor(2).update({ id: person.id, disability: true })).resultCode).toBe(403);
    const corrected = await apiFor(1).update({
      id: person.id,
      disability: true,
      dateOfBirth: "1999-02-01",
      idNumber: "",
    });
    expect(corrected.success).toBe(true);
    const view = (await apiFor(1).list({ pwd: true, pageSize: 100 })).items.find(
      (row) => row.id === person.id
    );
    expect(view).toMatchObject({ disability: true, dateOfBirth: "1999-02-01", idNumber: null });
  });
});
