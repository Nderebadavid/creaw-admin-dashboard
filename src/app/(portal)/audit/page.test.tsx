import { describe, expect, it, vi } from "vitest";

const list = vi.hoisted(() =>
  vi.fn(async () => ({
    items: [],
    page: 1,
    pageSize: 25,
    totalItems: 0,
    totalPages: 0,
  }))
);
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/session-server", () => ({
  requireSession: async () => ({
    user: { id: 7 },
    grants: [{ permissionCode: "AUDIT_LOG_VIEW", pillarId: null }],
  }),
}));
vi.mock("@/features/audit/api", () => ({ auditApi: { list } }));
vi.mock("@/features/audit/components", () => ({ AuditContent: () => null }));

import AuditPage from "./page";

describe("audit page", () => {
  it("filters to one user's activity from the userId parameter", async () => {
    await AuditPage({ searchParams: Promise.resolve({ userId: "7" }) });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ userId: 7 }));
  });

  it("rejects a malformed userId", async () => {
    await expect(AuditPage({ searchParams: Promise.resolve({ userId: "abc" }) })).rejects.toThrow(
      "NOT_FOUND"
    );
  });
});
