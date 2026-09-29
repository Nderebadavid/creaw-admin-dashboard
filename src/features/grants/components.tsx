"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { TableCard } from "@/components/data-table/table-card";
import { usePagedList } from "@/components/data-table/use-paged-list";
import { StatusBadge } from "@/components/ui/status-badge";
import { ExportButton } from "@/components/ui/export-button";
import { PageHeading } from "@/components/portal/page-heading";
import { formatDate } from "@/lib/format";
import type { GrantPage, GrantQuery, GrantRow } from "./api";
import { exportGrantsAction, listGrantsAction } from "./actions";

export { GrantDetailContent } from "./detail-content";

/** Sign-off stages in order; ACTIVE is a new application not yet prepared. */
const stages = ["ACTIVE", "PREPARED", "REVIEWED", "APPROVED"];
const stageLabel = (status: string) =>
  status === "ACTIVE" ? "New" : status[0] + status.slice(1).toLowerCase();
const tone = (status: string) =>
  status === "APPROVED" ? "success" : status === "REVIEWED" ? "warning" : "neutral";

const columns: DataColumn<GrantRow>[] = [
  {
    id: "applicant",
    header: "Applicant",
    cell: (row) => <span className="whitespace-nowrap font-semibold">{row.applicant}</span>,
  },
  { id: "project", header: "Programme", cell: (row) => row.project },
  {
    id: "requested",
    header: "Requested",
    cell: (row) => <span className="whitespace-nowrap tabular-nums">{row.requestedAmount}</span>,
  },
  { id: "type", header: "Grant type", cell: (row) => row.grantType.replaceAll("_", " ") },
  { id: "date", header: "Applied", cell: (row) => formatDate(row.createdAt) },
  {
    id: "stage",
    header: "Stage",
    cell: (row) => <StatusBadge tone={tone(row.status)}>{stageLabel(row.status)}</StatusBadge>,
  },
];

/** Grant applications queue; each row opens the application's sign-off page. */
export function GrantsContent({
  heading,
  initial,
  pillars,
  canExport,
}: {
  heading?: { title: string; section: string; description: string };
  initial: GrantPage;
  pillars: { id: number; name: string }[];
  canExport: boolean;
}) {
  const router = useRouter();
  const list = usePagedList<GrantRow, GrantQuery>(
    initial,
    { page: 1, pageSize: 25 },
    listGrantsAction
  );
  const [search, setSearch] = useState("");
  const actions = canExport && <ExportButton exportAction={() => exportGrantsAction(list.query)} />;

  return (
    <div className="space-y-5">
      {heading ? <PageHeading {...heading} actions={actions || undefined} /> : actions}
      {list.error && (
        <p role="alert" className="rounded-xl bg-creaw-danger-soft p-3 text-sm text-creaw-danger">
          {list.error}
        </p>
      )}
      <TableCard
        title="Applications queue"
        subtitle="Click an application to work its sign-off chain"
        chipsLabel="Grant stage"
        chips={[
          {
            label: "All",
            active: !list.query.status,
            onSelect: () => list.filter({ status: undefined }),
          },
          ...stages.map((status) => ({
            label: stageLabel(status),
            active: list.query.status === status,
            onSelect: () => list.filter({ status }),
          })),
        ]}
        filters={
          <select
            aria-label="Pillar"
            value={list.query.pillarId ?? ""}
            onChange={(event) => list.filter({ pillarId: Number(event.target.value) || undefined })}
            className="h-10 rounded-[10px] border border-creaw-line-strong bg-white px-3 text-sm"
          >
            <option value="">All pillars</option>
            {pillars.map((pillar) => (
              <option key={pillar.id} value={pillar.id}>
                {pillar.name}
              </option>
            ))}
          </select>
        }
        search={{
          value: search,
          label: "Search grants",
          onChange: (value) => {
            setSearch(value);
            list.filter({ search: value || undefined });
          },
        }}
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
          label="Grant applications"
          columns={columns}
          rows={list.data.items}
          getRowId={(row) => row.id}
          loading={list.loading}
          filtered={Boolean(list.query.pillarId || list.query.status || list.query.search)}
          onRowOpen={(row) => router.push(`/grants/${row.id}`)}
          rowOpenLabel={(row) => `Open application from ${row.applicant}`}
        />
      </TableCard>
    </div>
  );
}
