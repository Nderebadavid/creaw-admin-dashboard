import type { SubmissionRow, SubmissionStatus } from "./api";

export interface SubmissionFilters {
  status?: SubmissionStatus | "All";
  search?: string;
}

export function filterSubmissionRows<
  T extends Pick<SubmissionRow, "title" | "type" | "pillar" | "status">,
>(rows: readonly T[], filters: SubmissionFilters): T[] {
  const search = filters.search?.trim().toLocaleLowerCase() ?? "";
  return rows.filter(
    (row) =>
      (!filters.status || filters.status === "All" || row.status === filters.status) &&
      (!search || `${row.title} ${row.pillar} ${row.type}`.toLocaleLowerCase().includes(search))
  );
}
