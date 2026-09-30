"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { TableCard } from "@/components/data-table/table-card";
import { usePagedList } from "@/components/data-table/use-paged-list";
import { ExportButton } from "@/components/ui/export-button";
import { PageHeading } from "@/components/portal/page-heading";
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
const select = "h-10 rounded-[10px] border border-creaw-line-strong bg-white px-2.5 text-sm";

/**
 * Immutable audit trail of creates, edits, reveals, uploads and exports.
 * Clicking an entry expands its input and before/after states in place.
 */
export function AuditContent({
  heading,
  initial,
  initialQuery = { page: 1, pageSize: 25 },
  canExport,
}: {
  heading?: { title: string; section: string; description: string };
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
      {list.error && (
        <p role="alert" className="rounded-xl bg-creaw-danger-soft p-3 text-sm text-creaw-danger">
          {list.error}
        </p>
      )}
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
            <select
              aria-label="Module"
              value={query.module ?? ""}
              onChange={(event) => list.filter({ module: event.target.value || undefined })}
              className={select}
            >
              <option value="">All modules</option>
              {modules.map((module) => (
                <option key={module} value={module}>
                  {module.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <select
              aria-label="Action"
              value={query.action ?? ""}
              onChange={(event) => list.filter({ action: event.target.value || undefined })}
              className={select}
            >
              <option value="">All actions</option>
              {actions.map((action) => (
                <option key={action}>{action}</option>
              ))}
            </select>
            <select
              aria-label="Performed by"
              value={query.userId ?? ""}
              onChange={(event) => list.filter({ userId: Number(event.target.value) || undefined })}
              className={select}
            >
              <option value="">All users</option>
              {actors.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <input
              aria-label="From date"
              type="date"
              value={query.from ?? ""}
              max={query.to}
              onChange={(event) => list.filter({ from: event.target.value || undefined })}
              className={select}
            />
            <input
              aria-label="To date"
              type="date"
              value={query.to ?? ""}
              min={query.from}
              onChange={(event) => list.filter({ to: event.target.value || undefined })}
              className={select}
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
