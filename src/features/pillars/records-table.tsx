"use client";

import { useState, type ReactNode } from "react";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { dateSortValue } from "@/components/data-table/sorting";
import { TableCard } from "@/components/data-table/table-card";
import { usePagedList } from "@/components/data-table/use-paged-list";
import { FormBanner } from "@/components/ui/form-banner";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ListQuery } from "@/lib/api/list";
import { formatDate, titleCase } from "@/lib/format";
import type { PaginatedData } from "@/types/api";
import { listPillarRecordsAction } from "./actions";
import type { PillarRecord } from "./api";
import { PillarEditButton } from "./record-controls";
import type { PillarCode } from "./schemas";

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

/** A pillar's programme records in the design's list card, paged and sorted by the API. */
export function PillarRecordsTable({
  code,
  initial,
  label,
  canEdit = false,
  headerActions,
}: {
  code: PillarCode;
  /** The first page, rendered by the server. */
  initial: PaginatedData<PillarRecord>;
  label: string;
  /** Whether each record gets an Edit control. */
  canEdit?: boolean;
  /** Controls for the card header, e.g. the create button when the page has no heading. */
  headerActions?: ReactNode;
}) {
  const list = usePagedList<PillarRecord, ListQuery>(
    initial,
    { page: 1, pageSize: initial.pageSize },
    (query) => listPillarRecordsAction(code, query)
  );
  const [search, setSearch] = useState("");
  return (
    <>
      <FormBanner tone="error">{list.error}</FormBanner>
      <TableCard
        title="Programme records"
        subtitle="Records in this pillar; identity details stay masked in the list."
        search={{
          value: search,
          label: `Search ${label}`,
          onChange: (value) => {
            setSearch(value);
            list.filter({ search: value || undefined });
          },
        }}
        actions={headerActions}
        footer={
          <Pagination
            page={list.data.page}
            pageSize={list.data.pageSize as PageSize}
            totalItems={list.data.totalItems}
            onPageChange={(page) => list.filter({ page }, false)}
            onPageSizeChange={(pageSize) => list.filter({ pageSize })}
          />
        }
      >
        <DataTable
          framed={false}
          columns={columns}
          rows={list.data.items}
          getRowId={(row) => row.id}
          label={label}
          filtered={search.trim().length > 0}
          rowActions={
            canEdit
              ? (row) => <PillarEditButton code={code} id={row.id} category={row.category} />
              : undefined
          }
          sort={list.query.sort}
          onSortChange={(sort) => list.filter({ sort })}
        />
      </TableCard>
    </>
  );
}
