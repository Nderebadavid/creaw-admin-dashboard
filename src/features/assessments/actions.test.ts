import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createAssessmentsApi } from "./api";

beforeEach(() => resetMockStore());
const apiFor = (userId: number) => createAssessmentsApi(createApiClient(new MockApiTransport(handleMockRequest)), issueMockToken(userId));

describe("assessment workflows", () => {
  it("shows missing checks and attaches a document to the owning assessment", async () => {
    const api = apiFor(1);
    const before = await api.get(1);
    const missing = before!.documents.find(row => row.status === "not_obtained")!;
    const response = await api.attach(missing.id, "mock://documents/assessments/1/bank.pdf");
    expect(response.resultCode).toBe(200);
    const check = getMockStore().assessment_document_check.find(row => row.id === missing.id)!;
    expect(check.document_check_status).toBe("obtained");
    expect(check.document_id).toBeTypeOf("number");
    expect(getMockStore().document.find(row => row.id === check.document_id)).toMatchObject({ owner_type: "organisation_assessment", owner_id: 1 });
    expect((await api.viewDocument(check.document_id!)).success).toBe(true);
    expect(getMockStore().audit_logs.at(-1)?.action).toBe("DOWNLOAD");
  });

  it("keeps recommendation separate from approval and blocks non-approvers on POST and PATCH", async () => {
    const assessor = apiFor(14);
    const lead = apiFor(1);
    expect((await assessor.create({ organisationId: 1, instrumentId: 1, recommendation: "award" })).resultCode).toBe(403);
    expect((await assessor.approve(1, "award")).resultCode).toBe(403);
    expect((await lead.approve(1, "award")).resultCode).toBe(200);
    expect(getMockStore().organisation_assessment[0].overall_recommendation).toBe("award");
  });

  it("loads scores and checks beyond 100 rows", async () => {
    const store = getMockStore();
    for (let i = 0; i < 101; i++) store.assessment_document_check.push({ ...store.assessment_document_check[0], id: 1000 + i, assessment_id: 1, document_name: `Extra ${i}` });
    expect((await apiFor(1).get(1))?.documents).toHaveLength(107);
  });
  it("shows real shared criterion labels and maxima to a WRO-scoped assessor", async () => {
    getMockStore().assessment_criterion[0].max_score = 7;
    const view = await apiFor(8).get(1);
    expect(view?.scores[0]).toEqual({ label: "Governance", score: expect.any(Number), max: 7 });
  });
  it("allows the WRO pillar lead to view scoped assessment names and checks", async () => {
    const page = await apiFor(8).list();
    expect(page.items[0].organisation).not.toMatch(/^Organisation #/);
    expect(page.items[0].documents.length).toBeGreaterThan(0);
  });
});
