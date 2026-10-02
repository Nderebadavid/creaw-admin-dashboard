"use client";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { filterSelectClass } from "@/components/ui/form-styles";
import { FormBanner } from "@/components/ui/form-banner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { TableCard } from "@/components/data-table/table-card";
import { usePagedList } from "@/components/data-table/use-paged-list";
import { ExportButton } from "@/components/ui/export-button";
import { PageHeading, type PageHeadingText } from "@/components/portal/page-heading";
import { listAuditAction, exportAuditAction } from "./actions";
import type { AuditPage, AuditRow } from "./api";
import type { AuditQuery } from "./schemas";
import { auditColumns } from "./trail/columns";
import { AuditEntryDetail } from "./trail/entry-detail";

const sources: [AuditQuery["source"], string][] = [
  [undefined, "All sources"],
  ["HTTP", "Portal"],
  ["KAFKA", "Kafka (system)"],
];

/**
 * Immutable audit trail of creates, edits, uploads and exports.
 * Clicking an entry expands its input and before/after states in place.
 */
export function AuditContent({
  heading,
  initial,
  initialQuery = { page: 1, pageSize: 25 },
  canExport,
}: {
  heading?: PageHeadingText;
  initial: AuditPage;
  /** Pre-applied filters, e.g. a record's history or "My activity". */
  initialQuery?: AuditQuery;
  canExport: boolean;
}) {
  const list = usePagedList<AuditRow, AuditQuery>(initial, initialQuery, listAuditAction);
  const [openId, setOpenId] = useState<number | null>(null);
  const { query } = list;
  // Filter options come from the entries seen so far; the API does the filtering.
  const seen = [...initial.items, ...list.data.items];
  const modules = [
    ...new Set(seen.map((row) => row.entity_type).filter((item): item is string => !!item)),
  ].sort();
  const actions = [...new Set(seen.map((row) => row.action))].sort();
  const actors = [
    ...new Map(
      seen
        .filter((row) => row.performed_by && row.performed_by_name)
        .map((row) => [row.performed_by!, row.performed_by_name!])
    ).entries(),
  ];
  const filtered = Boolean(
    query.search ||
    query.source ||
    query.module ||
    query.targetId ||
    query.action ||
    query.userId ||
    query.from ||
    query.to
  );

  const exportButton = (
    <span title={!canExport ? "CSV export permission required" : undefined}>
      <ExportButton disabled={!canExport} exportAction={() => exportAuditAction(query)} />
    </span>
  );

  return (
    <div className="space-y-5">
      {heading ? <PageHeading {...heading} actions={exportButton} /> : exportButton}
      {query.targetId && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-creaw-orange-soft px-3 py-1 font-semibold text-creaw-orange">
            History for {query.module ?? "record"} #{query.targetId}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => list.filter({ targetId: undefined, module: undefined })}
          >
            Clear record filter
          </Button>
        </div>
      )}
      <FormBanner tone="error">{list.error}</FormBanner>
      <TableCard
        title="Activity trail"
        subtitle="Portal, integration and background activity. Records are immutable."
        chipsLabel="Source"
        chips={sources.map(([source, label]) => ({
          label,
          active: query.source === source,
          onSelect: () => list.filter({ source }),
        }))}
        search={{
          value: query.search ?? "",
          label: "Search audit entries",
          onChange: (value) => list.filter({ search: value || undefined }),
        }}
        filters={
          <>
            <SearchableSelect
              compact
              label="Module"
              emptyLabel="All modules"
              value={query.module ?? null}
              onChange={(module) => list.filter({ module: module || undefined })}
              options={modules.map((module) => ({
                value: module,
                label: module.replaceAll("_", " "),
              }))}
            />
            <select
              aria-label="Action"
              value={query.action ?? ""}
              onChange={(event) => list.filter({ action: event.target.value || undefined })}
              className={filterSelectClass}
            >
              <option value="">All actions</option>
              {actions.map((action) => (
                <option key={action}>{action}</option>
              ))}
            </select>
            <SearchableSelect
              compact
              label="Performed by"
              emptyLabel="All users"
              value={query.userId ?? null}
              onChange={(id) => list.filter({ userId: Number(id) || undefined })}
              options={actors.map(([id, name]) => ({ value: id, label: name }))}
            />
            <input
              aria-label="From date"
              type="date"
              value={query.from ?? ""}
              max={query.to}
              onChange={(event) => list.filter({ from: event.target.value || undefined })}
              className={filterSelectClass}
            />
            <input
              aria-label="To date"
              type="date"
              value={query.to ?? ""}
              min={query.from}
              onChange={(event) => list.filter({ to: event.target.value || undefined })}
              className={filterSelectClass}
            />
          </>
        }
        footer={
          <Pagination
            page={list.data.page}
            pageSize={list.data.pageSize as PageSize}
            totalItems={list.data.totalItems}
            hint="Click an entry to see what changed"
            onPageChange={(page) => list.filter({ page }, false)}
            onPageSizeChange={(pageSize) => list.filter({ pageSize })}
          />
        }
      >
        <DataTable
          framed={false}
          label="Audit entries"
          columns={auditColumns}
          sort={list.query.sort}
          onSortChange={(sort) => list.filter({ sort })}
          rows={list.data.items}
          getRowId={(row) => row.id}
          loading={list.loading}
          filtered={filtered}
          onRowOpen={(row) => setOpenId((current) => (current === row.id ? null : row.id))}
          rowOpenLabel={(row) =>
            `${openId === row.id ? "Collapse" : "Expand"} audit entry ${row.id}`
          }
          renderExpanded={(row) => (openId === row.id ? <AuditEntryDetail row={row} /> : null)}
        />
      </TableCard>
    </div>
  );
}
