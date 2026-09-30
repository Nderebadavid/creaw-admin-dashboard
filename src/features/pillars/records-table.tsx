"use client";

import { useMemo, useState, type ReactNode } from "react";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination } from "@/components/data-table/pagination";
import { dateSortValue } from "@/components/data-table/sorting";
import { TableCard } from "@/components/data-table/table-card";
import { useClientPaging } from "@/components/data-table/use-client-paging";
import { useClientSort } from "@/components/data-table/use-client-sort";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, titleCase } from "@/lib/format";
import type { PillarRecord } from "./api";

const columns: DataColumn<PillarRecord>[] = [
  {
    id: "record",
    header: "Record",
    cell: (row) => <span className="whitespace-nowrap font-semibold">{row.title}</span>,
    sortValue: (row) => row.title,
  },
  {
    id: "category",
    header: "Programme / area",
    cell: (row) => <span className="font-medium text-creaw-ink-soft">{row.category}</span>,
    sortValue: (row) => row.category,
  },
  {
    id: "status",
    header: "Status",
    cell: (row) => (
      <StatusBadge tone={row.status === "ACTIVE" ? "success" : "neutral"}>
        {titleCase(row.status)}
      </StatusBadge>
    ),
    sortValue: (row) => row.status,
  },
  {
    id: "updated",
    header: "Updated",
    cell: (row) => (
      <span className="whitespace-nowrap font-medium text-creaw-ink-soft">
        {formatDate(row.updatedAt)}
      </span>
    ),
    sortValue: (row) => dateSortValue(row.updatedAt),
  },
];

/** A pillar's programme records in the design's list card, sortable by any column. */
export function PillarRecordsTable({
  records,
  label,
  actions,
  headerActions,
}: {
  records: readonly PillarRecord[];
  label: string;
  /** Each record's action controls, rendered by the page and keyed by record id. */
  actions?: Record<PillarRecord["id"], ReactNode>;
  /** Controls for the card header, e.g. the create button when the page has no heading. */
  headerActions?: ReactNode;
}) {
  const [search, setSearch] = useState("");
  const needle = search.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      needle
        ? records.filter((row) =>
            `${row.title} ${row.category} ${row.status}`.toLocaleLowerCase().includes(needle)
          )
        : records,
    [records, needle]
  );
  const { rows, sorting } = useClientSort(filtered, columns);
  const { pageRows, pager, resetPage } = useClientPaging(rows);
  return (
    <TableCard
      title="Programme records"
      subtitle="Records in this pillar; identity details stay masked in the list."
      search={{
        value: search,
        label: `Search ${label}`,
        onChange: (value) => {
          setSearch(value);
          resetPage();
        },
      }}
      actions={headerActions}
      footer={<Pagination {...pager} />}
    >
      <DataTable
        framed={false}
        columns={columns}
        rows={pageRows}
        getRowId={(row) => row.id}
        label={label}
        filtered={needle.length > 0}
        rowActions={actions ? (row) => actions[row.id] : undefined}
        sort={sorting.sort}
        onSortChange={(sort) => {
          sorting.onSortChange(sort);
          resetPage();
        }}
      />
    </TableCard>
  );
}
