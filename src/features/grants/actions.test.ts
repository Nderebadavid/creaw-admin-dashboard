import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createGrantsApi } from "./api";

beforeEach(() => resetMockStore());
const apiFor = (userId: number) =>
  createGrantsApi(createApiClient(new MockApiTransport(handleMockRequest)), issueMockToken(userId));

describe("grant workflows", () => {
  it("enforces prepared, reviewed, approved order and creates one award linked to the application", async () => {
    const preparer = apiFor(3),
      reviewer = apiFor(4),
      approver = apiFor(1);
    getMockStore().grant_application[2].status = "ACTIVE";
    expect((await approver.advance(3, "APPROVED")).resultCode).toBe(422);
    expect((await reviewer.advance(3, "REVIEWED")).resultCode).toBe(422);
    expect((await preparer.advance(3, "PREPARED")).resultCode).toBe(200);
    expect((await preparer.advance(3, "REVIEWED")).resultCode).toBe(403);
    expect((await reviewer.advance(3, "REVIEWED")).resultCode).toBe(200);
    expect((await approver.advance(3, "APPROVED")).resultCode).toBe(200);
    expect(getMockStore().grant_award.filter((row) => row.application_id === 3)).toHaveLength(1);
    expect((await approver.advance(3, "APPROVED")).resultCode).toBe(422);
  });

  it("requires a third actor for approval and refuses missing sign-off history", async () => {
    const application = getMockStore().grant_application[3];
    application.status = "ACTIVE";
    expect((await apiFor(1).advance(application.id, "PREPARED")).resultCode).toBe(200);
    expect((await apiFor(3).advance(application.id, "REVIEWED")).resultCode).toBe(200);
    expect((await apiFor(1).advance(application.id, "APPROVED")).resultCode).toBe(403);
    expect(getMockStore().grant_award.some((row) => row.application_id === application.id)).toBe(
      false
    );
    getMockStore().audit_logs = getMockStore().audit_logs.filter(
      (row) => !(row.entity_type === "grant_application" && row.entity_id === 2)
    );
    expect((await apiFor(1).advance(2, "APPROVED")).resultCode).toBe(422);
  });

  it("uses an audited prepared-at-creation application as the first sign-off", async () => {
    const created = await handleMockRequest({
      method: "POST",
      path: "/grants",
      routeTemplate: "/grants",
      correlationId: crypto.randomUUID(),
      token: issueMockToken(3),
      body: {
        project_id: 1,
        participant_id: 3,
        requested_amount: 12000,
        grant_type: "staggered_by_milestone",
        status: "PREPARED",
      },
    });
    expect(created.resultCode).toBe(201);
    const id = (created.data as { id: number }).id;
    expect((await apiFor(3).advance(id, "REVIEWED")).resultCode).toBe(403);
    expect((await apiFor(4).advance(id, "REVIEWED")).resultCode).toBe(200);
  });

  it("cannot raise an award with management permission or beyond approved limits", async () => {
    const update = (userId: number, amount: number) =>
      handleMockRequest({
        method: "PATCH",
        path: "/grants/1",
        routeTemplate: "/grants/:id",
        correlationId: crypto.randomUUID(),
        token: issueMockToken(userId),
        query: { table: "grant_award" },
        body: { amount_awarded: amount },
      });
    expect((await update(3, 60000)).resultCode).toBe(403);
    expect((await update(1, 65000)).resultCode).toBe(422);
    expect((await update(1, 20000)).resultCode).toBe(422);
    expect((await update(1, 58000)).resultCode).toBe(200);
  });

  it("creates a reporting period only for an approved award and audits it", async () => {
    const input = { periodStart: "2026-10-01", periodEnd: "2026-12-31", dueDate: "2027-01-15" };
    expect((await apiFor(9).addGrantPeriod(1, input)).resultCode).toBe(403);
    const award = { ...getMockStore().grant_award[0], id: 2, application_id: 2 };
    getMockStore().grant_award.push(award);
    expect((await apiFor(3).addGrantPeriod(2, input)).resultCode).toBe(422);
    expect((await apiFor(3).addGrantPeriod(1, input)).resultCode).toBe(201);
    expect(getMockStore().grant_report.at(-1)).toMatchObject({
      grant_award_id: 1,
      reporting_period_start: input.periodStart,
      reporting_period_end: input.periodEnd,
      due_date: input.dueDate,
    });
    expect(getMockStore().audit_logs.at(-1)).toMatchObject({
      entity_type: "grant_report",
      action: "CREATE",
    });
  });

  it("denies approval without the scoped permission and returns amounts in full", async () => {
    const api = apiFor(3);
    expect((await api.advance(2, "APPROVED")).resultCode).toBe(403);
    const detail = await apiFor(1).get(1);
    expect(detail?.award?.amountAwarded).toBe(55000);
    expect(detail?.disbursements[0].amount).toBe(27500);
  });

  it("audits application pack downloads and filtered export", async () => {
    const api = apiFor(1);
    const pack = await api.downloadPack(1);
    expect(pack.success).toBe(true);
    expect(getMockStore().audit_logs.at(-1)?.action).toBe("DOWNLOAD");
    const exported = await api.export({ pillarId: 2, status: "APPROVED" });
    expect(exported.success).toBe(true);
    expect(getMockStore().audit_logs.at(-1)?.action).toBe("EXPORT");
  });

  it("joins awards and disbursements beyond the first page", async () => {
    const store = getMockStore();
    const award = store.grant_award[0];
    for (let i = 0; i < 101; i++)
      store.grant_disbursement.push({
        ...store.grant_disbursement[0],
        id: 1000 + i,
        grant_id: award.id,
      });
    expect((await apiFor(1).get(1))?.disbursements).toHaveLength(102);
  });
  it("audits access to a linked application document", async () => {
    const documentId = getMockStore().document.find(
      (row) => row.owner_type === "grant_application" && row.owner_id === 1
    )!.id;
    const response = await apiFor(1).viewDocument(documentId);
    expect(response.success).toBe(true);
    expect(getMockStore().audit_logs.at(-1)?.action).toBe("DOWNLOAD");
  });
});
