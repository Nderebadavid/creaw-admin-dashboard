import { dateSortValue, type SortValues } from "@/components/data-table/sorting";
import type { ReportView } from "./api";

export const ownerOf = (row: ReportView) =>
  row.ownerName ?? (row.ownerId ? `Staff #${row.ownerId}` : "Unassigned");

/** What each reporting calendar column sorts by: the text the cell shows. */
export const reportSortValues: SortValues<ReportView> = {
  report: (row) => row.title,
  programme: (row) => row.project,
  pillar: (row) => row.pillar,
  due: (row) => dateSortValue(row.dueDate),
  owner: ownerOf,
  status: (row) => row.status,
};
