import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createGrantsApi } from "./api";

beforeEach(() => resetMockStore());
const apiFor = (userId: number) => createGrantsApi(createApiClient(new MockApiTransport(handleMockRequest)), issueMockToken(userId));

describe("grant workflows", () => {
  it("enforces prepared, reviewed, approved order and creates one award linked to the application", async () => {
    const api = apiFor(1);
    getMockStore().grant_application[2].status = "ACTIVE";
    expect((await api.advance(3, "APPROVED")).resultCode).toBe(422);
    expect((await api.advance(3, "REVIEWED")).resultCode).toBe(422);
    expect((await api.advance(3, "PREPARED")).resultCode).toBe(200);
    expect((await api.advance(3, "REVIEWED")).resultCode).toBe(200);
    expect((await api.advance(3, "APPROVED")).resultCode).toBe(200);
    expect(getMockStore().grant_award.filter(row => row.application_id === 3)).toHaveLength(1);
    expect((await api.advance(3, "APPROVED")).resultCode).toBe(422);
  });

  it("denies approval without the scoped permission and keeps amounts masked", async () => {
    const api = apiFor(3);
    expect((await api.advance(2, "APPROVED")).resultCode).toBe(403);
    const detail = await apiFor(1).get(1);
    expect(detail?.award?.amountAwarded).not.toBe("55000");
    expect(detail?.disbursements[0].amount).not.toBe("27500");
  });

  it("audits application pack downloads and filtered export", async () => {
    const api = apiFor(1);
    const pack = await api.downloadPack(1);
    expect(pack.success).toBe(true);
    expect(getMockStore().audit_logs.at(-1)?.action).toBe("DOWNLOAD");
    const exported = await api.export({ pillarId: 2, status: "APPROVED" });
    expect(exported.success).toBe(true);
    expect(getMockStore().audit_logs.at(-1)?.action).toBe("EXPORT");
    expect(exported.data?.content).not.toContain("27500");
  });

  it("joins awards and disbursements beyond the first page", async () => {
    const store = getMockStore();
    const award = store.grant_award[0];
    for (let i = 0; i < 101; i++) store.grant_disbursement.push({ ...store.grant_disbursement[0], id: 1000 + i, grant_id: award.id });
    expect((await apiFor(1).get(1))?.disbursements).toHaveLength(102);
  });
  it("audits access to a linked application document", async () => {
    const documentId = getMockStore().document.find(row => row.owner_type === "grant_application" && row.owner_id === 1)!.id;
    const response = await apiFor(1).viewDocument(documentId);
    expect(response.success).toBe(true);
    expect(getMockStore().audit_logs.at(-1)?.action).toBe("DOWNLOAD");
  });
});
