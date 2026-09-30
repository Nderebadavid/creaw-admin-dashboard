"use client";

import { useClientPaging } from "@/components/data-table/use-client-paging";
import { useClientSort } from "@/components/data-table/use-client-sort";
import { textSortValue } from "@/components/data-table/sorting";
import { useMemo, useState } from "react";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination } from "@/components/data-table/pagination";
import { TableCard } from "@/components/data-table/table-card";
import { useRouter } from "next/navigation";
import { RecordDrawer } from "@/components/ui/record-drawer";
import { FieldGrid } from "@/components/ui/record-parts";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { initials, titleCase } from "@/lib/format";
import type { PillarDomainRecord, PillarDomainView } from "./domain-api";

/** The design's tone for a register status, from the words it uses. */
export function statusTone(status: string): StatusTone {
  if (/active|verified|complete|judg|approved|closed|submitted|passed|obtained/i.test(status))
    return "success";
  if (/flagged|risk|suspended|dropped|overdue|declined|failed/i.test(status)) return "danger";
  if (/pending|hearing|mediation|diligence|awaiting|progress/i.test(status)) return "warning";
  if (/mention|plea|training|assessed|review|prepared|investigation/i.test(status)) return "info";
  return "neutral";
}

/** A pillar's own register (cases, applications, sessions…) in the design's list card. */
export function PillarDomainTable({
  domain,
  actions,
  recordKind = "Record",
  pillarName,
  accent,
  tint,
  recordPath,
}: {
  domain: PillarDomainView;
  actions?: React.ReactNode;
  /** What one row is, e.g. "Legal case", for the record panel's caption. */
  recordKind?: string;
  pillarName?: string;
  /** The pillar's colours for the record panel. */
  accent?: string;
  tint?: string;
  /**
   * Path prefix of a page that works the record (e.g. "/grants/" for a grant's
   * sign-off chain); rows open `${prefix}${id}` instead of the record panel.
   */
  recordPath?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [selected, setSelected] = useState<PillarDomainRecord | null>(null);
  const statuses = useMemo(
    () => ["All", ...new Set(domain.rows.map((row) => row.status))],
    [domain.rows]
  );
  const filtered = useMemo(
    () =>
      domain.rows.filter(
        (row) =>
          (status === "All" || row.status === status) &&
          (!search.trim() ||
            `${row.title} ${row.values.join(" ")}`
              .toLocaleLowerCase()
              .includes(search.trim().toLocaleLowerCase()))
      ),
    [domain.rows, search, status]
  );
  const columns: DataColumn<PillarDomainRecord>[] = domain.columns.map((header, index) => ({
    id: String(index),
    header,
    cell: (row) => (
      <span className={index === 0 ? "font-semibold" : "font-medium text-creaw-ink-soft"}>
        {row.values[index] ?? "—"}
      </span>
    ),
    sortValue: (row) => textSortValue(row.values[index]),
  }));
  columns.push({
    id: "status",
    header: "Status",
    sortValue: (row) => row.status,
    cell: (row) => <StatusBadge tone={statusTone(row.status)}>{titleCase(row.status)}</StatusBadge>,
  });
  const { rows: sorted, sorting } = useClientSort(filtered, columns);
  const { pageRows, pager, resetPage } = useClientPaging(sorted);
  return (
    <>
      <TableCard
        title={domain.title}
        subtitle={domain.subtitle}
        chipsLabel={`${domain.title} status`}
        chips={statuses.map((value) => ({
          label: value === "All" ? value : titleCase(value),
          active: status === value,
          onSelect: () => {
            setStatus(value);
            resetPage();
          },
        }))}
        search={{
          value: search,
          label: `Search ${domain.title.toLowerCase()}`,
          onChange: (value) => {
            setSearch(value);
            resetPage();
          },
        }}
        actions={actions}
        footer={<Pagination {...pager} hint="Click a row to open the record" />}
      >
        <DataTable
          framed={false}
          columns={columns}
          rows={pageRows}
          getRowId={(row) => row.id}
          label={domain.title}
          sort={sorting.sort}
          onSortChange={(sort) => {
            sorting.onSortChange(sort);
            resetPage();
          }}
          filtered={filtered.length === 0 && (status !== "All" || search.length > 0)}
          onRowOpen={(row) =>
            recordPath ? router.push(`${recordPath}${row.id}`) : setSelected(row)
          }
          rowOpenLabel={(row) => `View ${row.title}`}
        />
      </TableCard>
      {selected && (
        <RecordDrawer
          open
          onClose={() => setSelected(null)}
          initials={initials(selected.title)}
          kind={pillarName ? `${recordKind} · ${pillarName}` : recordKind}
          title={selected.title}
          subtitle={`${domain.title} · identity details stay masked`}
          accent={accent}
          tint={tint}
          status={
            <StatusBadge tone={statusTone(selected.status)}>
              {titleCase(selected.status)}
            </StatusBadge>
          }
          tabs={[
            {
              id: "overview",
              label: "Overview",
              content: (
                <FieldGrid
                  fields={[
                    ...domain.columns.map(
                      (header, index) => [header, selected.values[index] ?? "—"] as const
                    ),
                    ["Status", titleCase(selected.status)] as const,
                  ]}
                />
              ),
            },
          ]}
        />
      )}
    </>
  );
}
