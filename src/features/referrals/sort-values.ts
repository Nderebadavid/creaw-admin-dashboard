import { dateSortValue, type SortValues } from "@/components/data-table/sorting";
import type { ReferralView } from "./api";

/** What each referral queue column sorts by: the text the cell shows. */
export const referralSortValues: SortValues<ReferralView> = {
  participant: (row) => row.participant,
  route: (row) => `${row.fromPillar} ${row.destinationName}`,
  reason: (row) => row.reason,
  referredBy: (row) => row.referredBy,
  date: (row) => dateSortValue(row.date),
  status: (row) => row.status,
};
