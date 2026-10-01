import type { ReactNode } from "react";
import { RecordStatusBadge } from "@/components/ui/record-status";
import { FieldGrid, SectionTitle } from "@/components/ui/record-parts";
import { formatDate, formatUpdated } from "@/lib/format";

/**
 * The standard record facts every drawer ends with: the record's status and the reason
 * for it, when it was created and last changed, and its notes. Sensitive notes are passed
 * in already wrapped (e.g. a masked field).
 */
export function RecordSection({
  status,
  statusDescription,
  created,
  updated,
  notes = [],
}: {
  status: string;
  /** Why the record has its status, shown only when there is a reason. */
  statusDescription?: string | null;
  created?: string | null;
  updated?: string | null;
  /** Labelled notes, e.g. ["Notes", …], ["Remarks", …] or ["Outcome notes", <span/>]. */
  notes?: readonly (readonly [string, ReactNode])[];
}) {
  const fields: [string, ReactNode][] = [
    ["Record status", <RecordStatusBadge key="status" status={status} />],
    ...(statusDescription ? ([["Status note", statusDescription]] as [string, ReactNode][]) : []),
    ["Created", created ? formatDate(created) : "—"],
    ["Last updated", updated ? formatUpdated(updated) : "—"],
    ...notes.map(([label, value]) => [label, value ?? "—"] as [string, ReactNode]),
  ];
  return (
    <section aria-label="Record" className="flex flex-col gap-2.5">
      <SectionTitle>Record</SectionTitle>
      <FieldGrid fields={fields} />
    </section>
  );
}
