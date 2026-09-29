import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ token: "" }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: state.token }) }) }));

import { getEffectiveGrants } from "@/lib/auth/permissions";
import { issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { submissionsApi } from "@/features/submissions/api";
import { referralsApi } from "@/features/referrals/api";
import { grantsApi } from "@/features/grants/api";
import { reportingApi } from "@/features/reporting/api";
import { loadNavigationStatus } from "./nav-status";

beforeEach(() => {
  resetMockStore();
  state.token = issueMockToken(1);
});

describe("loadNavigationStatus", () => {
  it("counts work waiting in each module the user can open", async () => {
    const status = await loadNavigationStatus(getEffectiveGrants(1));

    const submissions = await submissionsApi.listAll();
    expect(status.pendingSubmissions).toBe(
      submissions.filter((row) => row.status !== "Approved").length
    );
    expect(status.newReferrals).toBe(
      (await referralsApi.list({ status: "NEW", pageSize: 1 })).totalItems
    );
    const applications = (await grantsApi.list({ pageSize: 100 })).items;
    expect(status.grantsAwaiting).toBe(
      applications.filter((row) => row.status !== "APPROVED").length
    );
    expect(status.grantsAwaiting).toBeGreaterThan(0);
    expect(status.overdueReports).toBe(
      (await reportingApi.list({ status: "overdue", pageSize: 1 })).totalItems
    );
    expect(status.pendingSubmissions + status.overdueReports).toBeGreaterThan(0);
  });

  it("reports nothing for modules the user cannot open", async () => {
    expect(await loadNavigationStatus([])).toEqual({
      pendingSubmissions: 0,
      newReferrals: 0,
      grantsAwaiting: 0,
      overdueReports: 0,
    });
  });
});
