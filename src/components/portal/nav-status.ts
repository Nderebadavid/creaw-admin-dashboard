import "server-only";
import { hasModulePermission, type EffectiveGrant } from "@/lib/auth/grants";
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
    count(canOpen(grants, ["FIELD_SUBMISSION_VIEW"]), () => submissionsApi.countUnapproved()),
    count(canOpen(grants, ["REFERRAL_VIEW"]), () => referralsApi.countByStatus("NEW")),
    count(canOpen(grants, ["GRANT_APPLICATION_VIEW"]), () => grantsApi.countAwaitingSignoff()),
    count(
      canOpen(grants, ["NARRATIVE_REPORT_MANAGE", "GRANT_REPORT_VIEW"]),
      async () => (await reportingApi.list({ status: "overdue", pageSize: 1 })).totalItems
    ),
  ]);
  return { pendingSubmissions, newReferrals, grantsAwaiting, overdueReports };
}
