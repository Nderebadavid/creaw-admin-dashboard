import type { SortValues } from "@/components/data-table/sorting";
import { dateSortValue } from "@/components/data-table/sorting";
import type { ParticipantView } from "./api";

/** What each registry column sorts by: the text the cell shows. Names arrive masked. */
export const participantSortValues = (
  pillarName: (id: number) => string
): SortValues<ParticipantView> => ({
  participant: (row) => row.name,
  county: (row) => `${row.county} ${row.ward}`,
  pillars: (row) => row.pillarIds.map(pillarName).join(", "),
  stage: (row) => row.currentStage,
  registered: (row) => dateSortValue(row.registered),
  status: (row) => row.status,
});
