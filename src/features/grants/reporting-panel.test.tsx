import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
vi.mock("server-only", () => ({}));
vi.mock("./actions", () => ({
  advanceGrantAction: vi.fn(),
  downloadGrantPackAction: vi.fn(),
  exportGrantsAction: vi.fn(),
  listGrantsAction: vi.fn(),
  logGrantReportAction: vi.fn(),
  recordDisbursementAction: vi.fn(),
  viewGrantDocumentAction: vi.fn(),
}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getEffectiveGrants, hasPermission } from "@/lib/auth/permissions";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createGrantsApi } from "./api";
import { GrantDetailContent } from "./components";

beforeEach(() => resetMockStore());

describe("grant compliance panel", () => {
  it("renders reporting creation and existing periods for a manager without financial award view", async () => {
    const store = getMockStore();
    store.user[12].status = "ACTIVE";
    const roleId = store.user_role.find((row) => row.user_id === 13)!.role_id;
    for (const code of ["GRANT_APPLICATION_VIEW", "GRANT_REPORT_MANAGE"]) {
      const permission = store.permission.find((row) => row.code === code)!;
      store.role_permission.push({
        ...store.role_permission[0],
        id: 1000 + permission.id,
        role_id: roleId,
        permission_id: permission.id,
      });
    }
    const grants = getEffectiveGrants(13);
    expect(hasPermission(grants, "GRANT_AWARD_VIEW", { pillarId: 2 })).toBe(false);
    expect(hasPermission(grants, "GRANT_REPORT_VIEW", { pillarId: 2 })).toBe(false);
    const api = createGrantsApi(
      createApiClient(new MockApiTransport(handleMockRequest)),
      issueMockToken(13)
    );
    const detail = await api.get(1);
    expect(detail).not.toBeNull();
    expect(detail?.award).toBeNull();
    render(
      <GrantDetailContent
        detail={detail!}
        canAdvance={false}
        canDisburse={false}
        canDownload={false}
        canLogReport={hasPermission(grants, "GRANT_REPORT_MANAGE", { pillarId: detail!.pillarId })}
      />
    );
    expect(screen.getByRole("button", { name: "Log reporting period" })).toBeEnabled();
    expect(screen.getByText(/30 Aug 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/55,000/)).not.toBeInTheDocument();
  });
});
