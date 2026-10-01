"use client";
import { filterSelectClass } from "@/components/ui/form-styles";
import { FormBanner } from "@/components/ui/form-banner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { TableCard } from "@/components/data-table/table-card";
import { usePagedList } from "@/components/data-table/use-paged-list";
import { withSortValues } from "@/components/data-table/sorting";
import { StatusBadge } from "@/components/ui/status-badge";
import { ExportButton } from "@/components/ui/export-button";
import { PageHeading, type PageHeadingText } from "@/components/portal/page-heading";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pillarLook } from "@/components/portal/pillars";
import { formatDate, initials, titleCase } from "@/lib/format";
import type { GrantPage, GrantProgramme, GrantQuery, GrantRow } from "./api";
import { NewApplicationDialog } from "./queue/new-application-dialog";
import { GrantSummaryCards } from "./queue/summary-cards";
import { exportGrantsAction, listGrantsAction } from "./actions";

export { GrantDetailContent } from "./detail-content";
import { grantTone, stageLabel } from "./status";
import { updatedColumn } from "@/components/data-table/record-columns";
import { grantSortValues, grantStages as stages } from "./sort-values";

const cellText = "font-medium text-creaw-ink-soft";

export const grantColumns: DataColumn<GrantRow>[] = withSortValues(grantSortValues, [
  {
    id: "applicant",
    header: "Applicant",
    cell: (row) => {
      const look = pillarLook(row.pillarId);
      return (
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-[#FDF0E3] text-[13px] font-bold text-[#A1521A]"
            style={look && { backgroundColor: look.tint, color: look.color }}
          >
            {initials(row.applicant)}
          </span>
          <div>
            <span className="whitespace-nowrap font-semibold">{row.applicant}</span>
            <p className="text-[12.5px] text-creaw-faint">Application #{row.id}</p>
          </div>
        </div>
      );
    },
  },
  {
    id: "project",
    header: "Programme",
    cell: (row) => <span className={cellText}>{row.project}</span>,
  },
  {
    id: "requested",
    header: "Requested",
    cell: (row) => (
      <span className={`whitespace-nowrap tabular-nums ${cellText}`}>{row.requestedAmount}</span>
    ),
  },
  {
    id: "type",
    header: "Grant type",
    cell: (row) => <span className={cellText}>{titleCase(row.grantType)}</span>,
  },
  {
    id: "date",
    header: "Applied",
    cell: (row) => (
      <span className={`whitespace-nowrap ${cellText}`}>{formatDate(row.createdAt)}</span>
    ),
  },
  {
    id: "stage",
    header: "Stage",
    cell: (row) => <StatusBadge tone={grantTone(row.status)}>{stageLabel(row.status)}</StatusBadge>,
  },
  updatedColumn((row) => row.updatedAt),
]);

/** Grant applications queue; each row opens the application's sign-off page. */
export function GrantsContent({
  heading,
  initial,
  pillars,
  canExport,
  programmes = [],
}: {
  heading?: PageHeadingText;
  initial: GrantPage;
  pillars: { id: number; name: string }[];
  canExport: boolean;
  /** Programmes the user may file a new application for; none hides the button. */
  programmes?: readonly GrantProgramme[];
}) {
  const router = useRouter();
  const list = usePagedList<GrantRow, GrantQuery>(
    initial,
    { page: 1, pageSize: 25 },
    listGrantsAction
  );
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const actions = (canExport || programmes.length > 0) && (
    <>
      {canExport && <ExportButton exportAction={() => exportGrantsAction(list.query)} />}
      {programmes.length > 0 && (
        <Button onClick={() => setCreating(true)}>
          <Plus />
          New application
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-5">
      {heading ? <PageHeading {...heading} actions={actions || undefined} /> : actions}
      <GrantSummaryCards counts={list.data.facets?.status} />
      <FormBanner tone="success">{feedback}</FormBanner>
      <FormBanner tone="error">{list.error}</FormBanner>
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
          // Declined sits outside the sign-off chain but is still a stage to filter by.
          ...[...stages, "DECLINED"].map((status) => ({
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
            className={filterSelectClass}
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
          columns={grantColumns}
          sort={list.query.sort}
          onSortChange={(sort) => list.filter({ sort })}
          rows={list.data.items}
          getRowId={(row) => row.id}
          loading={list.loading}
          filtered={Boolean(list.query.pillarId || list.query.status || list.query.search)}
          onRowOpen={(row) => router.push(`/grants/${row.id}`)}
          rowOpenLabel={(row) => `Open application from ${row.applicant}`}
        />
      </TableCard>
      <NewApplicationDialog
        open={creating}
        programmes={programmes}
        onClose={() => setCreating(false)}
        onDone={(message) => {
          setCreating(false);
          setFeedback(message);
          void list.refresh();
        }}
      />
    </div>
  );
}
