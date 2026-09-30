import "server-only";
import { hasModulePermission, type EffectiveGrant } from "@/lib/auth/grants";
import { collectPages } from "@/lib/api/pagination";
import { grantsApi } from "@/features/grants/api";
import { referralsApi } from "@/features/referrals/api";
import { reportingApi } from "@/features/reporting/api";
import { submissionsApi } from "@/features/submissions/api";
import type { NavigationStatus } from "./navigation";

export type { NavigationStatus };

const canOpen = (grants: readonly EffectiveGrant[], codes: string[]) =>
  codes.some((code) => hasModulePermission(grants, code));

/** Zero when the module is hidden or its data can't be read, so the shell never fails. */
async function count(allowed: boolean, load: () => Promise<number>) {
  if (!allowed) return 0;
  try {
    return await load();
  } catch {
    return 0;
  }
}

export async function loadNavigationStatus(
  grants: readonly EffectiveGrant[]
): Promise<NavigationStatus> {
  const [pendingSubmissions, newReferrals, grantsAwaiting, overdueReports] = await Promise.all([
    count(
      canOpen(grants, ["FIELD_SUBMISSION_VIEW"]),
      async () => (await submissionsApi.listAll()).filter((row) => row.status !== "Approved").length
    ),
    count(canOpen(grants, ["REFERRAL_VIEW"]), () => referralsApi.countByStatus("NEW")),
    count(canOpen(grants, ["GRANT_APPLICATION_VIEW"]), async () => {
      const rows = await collectPages((page, pageSize) => grantsApi.list({ page, pageSize }));
      return rows.filter((row) => row.status !== "APPROVED").length;
    }),
    count(
      canOpen(grants, ["NARRATIVE_REPORT_MANAGE", "GRANT_REPORT_VIEW"]),
      async () => (await reportingApi.list({ status: "overdue", pageSize: 1 })).totalItems
    ),
  ]);
  return { pendingSubmissions, newReferrals, grantsAwaiting, overdueReports };
}
