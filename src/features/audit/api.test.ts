import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createAuditApi } from "./api";

beforeEach(() => resetMockStore());
const audit = (userId = 1) =>
  createAuditApi(createApiClient(new MockApiTransport(handleMockRequest)), issueMockToken(userId));

describe("audit log boundary", () => {
  it("masks nested metadata in list, detail and CSV export", async () => {
    const store = getMockStore();
    store.audit_logs[0].entity_type = "participant";
    store.audit_logs[0].input_payload = JSON.stringify({
      nested: {
        phone_number: "0712345678",
        token: "secret-token",
        notes: "Private case note",
        arbitrary: "private@example.org",
      },
      safe: "shown",
    });
    store.audit_logs[0].previous_state = JSON.stringify({
      first_name: "Faith",
      legal_case: { outcome_notes: "Safety plan" },
    });
    store.audit_logs[0].new_state = JSON.stringify({
      id_number: "29481172",
      email: "private@example.org",
    });
    const page = await audit().list({ search: "grant_application", page: 1, pageSize: 2 });
    expect(page.totalItems).toBeGreaterThan(0);
    const detail = await audit().get(store.audit_logs[0].id);
    const csv = await audit().export({ action: "UPDATE" });
    for (const output of [JSON.stringify(detail), csv.content]) {
      expect(output).not.toContain("0712345678");
      expect(output).not.toContain("secret-token");
      expect(output).not.toContain("Private case note");
      expect(output).not.toContain("Faith");
      expect(output).not.toContain("29481172");
      expect(output).not.toContain("private@example.org");
    }
    expect(getMockStore().audit_logs.at(-1)?.action).toBe("EXPORT");
    expect(getMockStore().audit_logs[0].input_payload).toContain("0712345678"); // immutable source record
  });

  it("filters all rows before paging and refuses audit mutation or unauthorized export", async () => {
    const first = await audit().list({ source: "HTTP", action: "UPDATE", page: 1, pageSize: 1 });
    const second = await audit().list({ source: "HTTP", action: "UPDATE", page: 2, pageSize: 1 });
    expect(first.totalItems).toBe(second.totalItems);
    expect(first.items[0]?.id).not.toBe(second.items[0]?.id);
    const raw = await handleMockRequest({
      method: "PATCH",
      path: "/audit-logs/1",
      routeTemplate: "/audit-logs",
      correlationId: "test",
      token: issueMockToken(1),
      body: { action: "FORGED" },
    });
    expect(raw.resultCode).toBeGreaterThanOrEqual(400);
    await expect(audit(11).export()).rejects.toThrow();
  });

  it("redacts primitive strings in array and top-level metadata across reads, export and new writes", async () => {
    const store = getMockStore();
    const id = store.audit_logs[0].id;
    store.audit_logs[0].input_payload = JSON.stringify([
      "secret-in-array",
      { status: "APPROVED", details: ["nested-secret"] },
    ]);
    store.audit_logs[0].previous_state = JSON.stringify("top-level-secret");
    store.audit_logs[0].new_state = JSON.stringify({
      status: "APPROVED",
      comments: ["private-comment"],
    });
    const listRow = (await audit().list({ page: 1, pageSize: 100 })).items.find(
      (row) => row.id === id
    )!;
    const detail = await audit().get(id);
    const csv = await audit().export();
    for (const output of [JSON.stringify(listRow), JSON.stringify(detail), csv.content]) {
      for (const secret of [
        "secret-in-array",
        "nested-secret",
        "top-level-secret",
        "private-comment",
      ])
        expect(output).not.toContain(secret);
      expect(output).toContain("APPROVED");
    }

    const assessment = store.organisation_assessment[0];
    const write = await handleMockRequest({
      method: "PATCH",
      path: `/assessments/${assessment.id}`,
      routeTemplate: "/assessments/:id",
      correlationId: "audit-array-write",
      token: issueMockToken(1),
      body: { section_comments: ["new-write-secret"] },
    });
    expect(write.resultCode).toBe(200);
    const recorded = store.audit_logs.at(-1)!;
    expect(JSON.stringify(recorded)).not.toContain("new-write-secret");
  });
});
