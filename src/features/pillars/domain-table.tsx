"use client";

import { updatedColumn } from "@/components/data-table/record-columns";
import { textSortValue } from "@/components/data-table/sorting";
import { usePagedList } from "@/components/data-table/use-paged-list";
import { useState } from "react";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { TableCard } from "@/components/data-table/table-card";
import { FormBanner } from "@/components/ui/form-banner";
import type { ListQuery } from "@/lib/api/list";
import { listPillarDomainAction } from "./actions";
import type { PillarCode } from "./schemas";
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

/** A pillar's own register (grant applications…) in the design's list card, paged by the API. */
export function PillarDomainTable({
  code,
  domain,
  actions,
  recordKind = "Record",
  pillarName,
  accent,
  tint,
  recordPath,
}: {
  code: PillarCode;
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
  const list = usePagedList<PillarDomainRecord, ListQuery>(
    { items: domain.rows, page: 1, pageSize: 25, totalItems: domain.totalItems, totalPages: 1 },
    { page: 1, pageSize: 25 },
    (query) => listPillarDomainAction(code, query)
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PillarDomainRecord | null>(null);
  const status = list.query.filters?.status ? String(list.query.filters.status) : "All";
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
  columns.push(updatedColumn((row) => row.updated));
  return (
    <>
      {!selected && <FormBanner tone="error">{list.error}</FormBanner>}
      <TableCard
        title={domain.title}
        subtitle={domain.subtitle}
        chipsLabel={`${domain.title} status`}
        chips={["All", ...domain.statuses].map((value) => ({
          label: value === "All" ? value : titleCase(value),
          active: status === value,
          onSelect: () => list.filter({ filters: value === "All" ? undefined : { status: value } }),
        }))}
        search={{
          value: search,
          label: `Search ${domain.title.toLowerCase()}`,
          onChange: (value) => {
            setSearch(value);
            list.filter({ search: value || undefined });
          },
        }}
        actions={actions}
        footer={
          <Pagination
            page={list.data.page}
            pageSize={list.data.pageSize as PageSize}
            totalItems={list.data.totalItems}
            hint="Click a row to open the record"
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
          label={domain.title}
          sort={list.query.sort}
          onSortChange={(sort) => list.filter({ sort })}
          filtered={list.data.items.length === 0 && (status !== "All" || search.length > 0)}
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
