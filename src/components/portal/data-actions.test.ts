import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const cookie = vi.hoisted(() => ({ value: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => cookie }) }));
import { resetMockStore, getMockStore, issueMockToken } from "@/lib/mock-api/store";
import { auditedExportAction } from "./data-actions";
beforeEach(() => {
  resetMockStore();
  cookie.value = issueMockToken(1);
});
it("exports the current filters across pages, with an audit entry", async () => {
  const result = await auditedExportAction({
    path: "/participants",
    routeTemplate: "/participants",
    query: { id: 1, page: 2, pageSize: 10 },
  });
  expect(result.success).toBe(true);
  if (result.success) expect(result.content.split("\r\n")).toHaveLength(2);
  expect(getMockStore().audit_logs.at(-1)?.action).toBe("EXPORT");
});
it("rejects untrusted export paths", async () => {
  expect(
    await auditedExportAction({
      path: "https://example.com/participants",
      routeTemplate: "/participants",
    })
  ).toMatchObject({ success: false });
});
