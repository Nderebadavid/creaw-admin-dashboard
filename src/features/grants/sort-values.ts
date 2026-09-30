import { dateSortValue, type SortValues } from "@/components/data-table/sorting";
import type { GrantRow } from "./api";

/** Sign-off stages in order; ACTIVE is a new application not yet prepared. */
export const grantStages = ["ACTIVE", "PREPARED", "REVIEWED", "APPROVED"];

/** What each grant queue column sorts by. Amounts sort by value and stages by sign-off order. */
export const grantSortValues: SortValues<GrantRow> = {
  applicant: (row) => row.applicant,
  project: (row) => row.project,
  requested: (row) => Number(row.requestedAmount.replace(/[^\d.]/g, "")),
  type: (row) => row.grantType,
  date: (row) => dateSortValue(row.createdAt),
  // Statuses outside the sign-off path (e.g. rejected) come after the last stage.
  stage: (row) =>
    grantStages.includes(row.status) ? grantStages.indexOf(row.status) : grantStages.length,
};
