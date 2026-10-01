import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createProvidersApi } from "./api";

beforeEach(() => resetMockStore());
const clientFor = () => createApiClient(new MockApiTransport(handleMockRequest));
const apiFor = (userId: number, client = clientFor()) =>
  createProvidersApi(client, issueMockToken(userId));

describe("providers directory", () => {
  it("maps providers with institution, contacts and linked work", async () => {
    const { providers } = await apiFor(1).directory();
    const faith = providers.find((row) => row.name === "Faith Kimani")!;
    expect(faith).toMatchObject({ type: "counsellor", active: true });
    expect(faith.phone).toBe("0711 900 221");
    expect(faith.linkedWork).toBe(
      faith.workload.sessions.count +
        faith.workload.counselling.count +
        faith.workload.trainees.count +
        faith.workload.cases.count
    );
    expect(providers.find((row) => row.name === "Judy Muthoni")!.institution).toBe("Independent");
  });

  it("says Unknown institution, not Independent, when the institution is unresolved", async () => {
    const store = getMockStore();
    const faith = store.external_provider.find((row) => row.first_name === "Faith")!;
    const institution = store.partner_institution.find(
      (row) => row.id === faith.affiliated_institution_id
    )!;
    institution.is_deleted = true;
    const { providers, institutions } = await apiFor(1).directory();
    expect(providers.find((row) => row.name === "Faith Kimani")).toMatchObject({
      institutionId: institution.id,
      institution: "Unknown institution",
    });
    expect(institutions.some((row) => row.id === institution.id)).toBe(false);
  });

  it("names an inactive institution but offers only active ones", async () => {
    const store = getMockStore();
    const faith = store.external_provider.find((row) => row.first_name === "Faith")!;
    const institution = store.partner_institution.find(
      (row) => row.id === faith.affiliated_institution_id
    )!;
    institution.status = "INACTIVE";
    const { providers, institutions } = await apiFor(1).directory();
    expect(providers.find((row) => row.name === "Faith Kimani")!.institution).toBe(
      institution.name
    );
    expect(institutions.some((row) => row.id === institution.id)).toBe(false);
  });

  it("offers the partner institutions for the form", async () => {
    const { institutions } = await apiFor(1).directory();
    expect(institutions.length).toBeGreaterThan(0);
    expect(institutions[0]).toEqual({ id: expect.any(Number), name: expect.any(String) });
  });
});
