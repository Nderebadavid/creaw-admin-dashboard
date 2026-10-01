import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createGrantsApi } from "@/features/grants/api";
import { createReferralsApi } from "@/features/referrals/api";
import { createReportingApi } from "@/features/reporting/api";

// The grants, referral and reporting summary cards read the list's `status` facet, so
// they cost no call of their own and count every matching record, not one page.

beforeEach(() => resetMockStore());
const client = () => createApiClient(new MockApiTransport(handleMockRequest));
const sum = (counts: Record<string, number> = {}) =>
  Object.values(counts).reduce((total, value) => total + value, 0);

describe("summary card counts", () => {
  it("counts grant applications per stage across pages, whatever stage is selected", async () => {
    const api = createGrantsApi(client(), issueMockToken(1));
    const all = await api.list({ page: 1, pageSize: 1 });
    expect(all.totalItems).toBeGreaterThan(0);
    expect(sum(all.facets?.status)).toBe(all.totalItems);
    const approved = await api.list({ page: 1, pageSize: 1, status: "APPROVED" });
    expect(approved.facets?.status).toEqual(all.facets?.status);
    expect(approved.totalItems).toBe(all.facets?.status.APPROVED ?? 0);
  });

  it("counts referrals per status across pages", async () => {
    const api = createReferralsApi(client(), issueMockToken(1));
    const all = await api.list({ page: 1, pageSize: 1 });
    expect(all.totalItems).toBeGreaterThan(0);
    expect(sum(all.facets?.status)).toBe(all.totalItems);
    expect(all.facets?.status.NEW ?? 0).toBe(await api.countByStatus("NEW"));
  });

  it("counts calendar reports per status over the other filters", async () => {
    const { list } = createReportingApi(client(), issueMockToken(1));
    const all = await list({ page: 1, pageSize: 1 });
    expect(all.totalItems).toBeGreaterThan(0);
    expect(sum(all.facets?.status)).toBe(all.totalItems);
    const overdue = await list({ page: 1, pageSize: 1, status: "overdue" });
    expect(overdue.facets?.status).toEqual(all.facets?.status);
    expect(overdue.totalItems).toBe(all.facets?.status.overdue ?? 0);
  });
});
