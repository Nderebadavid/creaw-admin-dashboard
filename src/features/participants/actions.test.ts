import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createParticipantsApi } from "./api";

beforeEach(() => resetMockStore());
const apiFor = (userId: number) => createParticipantsApi(createApiClient(new MockApiTransport(handleMockRequest)), issueMockToken(userId));

describe("participant workflows", () => {
  it("paginates combined participant and geography data after pillar, county and search filters", async () => {
    const api = apiFor(1);
    const countyId = getMockStore().county.find(row => row.name === "Nairobi")!.id;
    const first = await api.list({ pillarId: 2, countyId, search: "female", page: 1, pageSize: 1 });
    expect(first).toMatchObject({ page: 1, pageSize: 1, totalItems: 1, totalPages: 1 });
    expect(first.items[0]).toMatchObject({ county: "Nairobi", pillarIds: [6, 2] });
    expect(first.items[0].name).not.toBe("Faith Atieno");
    expect(first.items[0].idNumber).not.toBe("35510442");
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
    const result = await api.register({ firstName: "Other", lastName: "Person", idNumber: "29481172", pillarId: 1, consentGiven: true });
    expect(result).toMatchObject({ success: false, resultCode: 422 });
    expect(getMockStore().participant).toHaveLength(count);
  });

  it("registers into the requested pillar on one participant record", async () => {
    const api = apiFor(3); // WEE scope
    const result = await api.register({ firstName: "New", lastName: "Person", pillarId: 2, consentGiven: true });
    expect(result.resultCode).toBe(201);
    const id = result.data!.id;
    expect(getMockStore().enrollment.filter(row => row.participant_id === id)).toMatchObject([{ pillar_id: 2 }]);
    const forbidden = await api.register({ firstName: "Another", lastName: "Person", pillarId: 1, consentGiven: true });
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
});
