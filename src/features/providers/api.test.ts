import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createProvidersApi } from "./api";

beforeEach(() => resetMockStore());
const clientFor = () => createApiClient(new MockApiTransport(handleMockRequest));
const apiFor = (userId: number, client = clientFor()) =>
  createProvidersApi(client, issueMockToken(userId));

describe("providers directory", () => {
  it("maps providers with institution, masked contacts and linked work", async () => {
    const { providers } = await apiFor(1).directory();
    const faith = providers.find((row) => row.name === "Faith Kimani")!;
    expect(faith).toMatchObject({ type: "counsellor", active: true });
    expect(faith.phone).toMatch(/•/);
    expect(faith.linkedWork).toBe(
      faith.workload.sessions.count +
        faith.workload.counselling.count +
        faith.workload.trainees.count +
        faith.workload.cases.count
    );
    expect(providers.find((row) => row.name === "Judy Muthoni")!.institution).toBe("Independent");
  });

  it("offers the partner institutions for the form", async () => {
    const { institutions } = await apiFor(1).directory();
    expect(institutions.length).toBeGreaterThan(0);
    expect(institutions[0]).toEqual({ id: expect.any(Number), name: expect.any(String) });
  });
});
