"use client";
import { LocationFilter } from "@/components/data-table/location-filter";
import { hasLocation, locationParams, type LocationQuery } from "@/lib/api/location";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { dateSortValue } from "@/components/data-table/sorting";
import { TableCard } from "@/components/data-table/table-card";
import { usePagedList } from "@/components/data-table/use-paged-list";
import { useRecordDetail } from "@/components/ui/use-record-detail";
import type { ListQuery } from "@/lib/api/list";
import { auditedExportAction } from "@/components/portal/data-actions";
import { DocumentViewer, type ViewedDocument } from "@/components/ui/document-viewer";
import { ExportButton } from "@/components/ui/export-button";
import { FormBanner } from "@/components/ui/form-banner";
import { recordStatusColumn, updatedColumn } from "@/components/data-table/record-columns";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import { listCasesAction, loadCaseDetailAction, viewCaseFileAction } from "../actions";
import { courtStatuses, type LegalCaseView, type VawgWorkspace } from "../model";
import { AttachCaseFileDialog, CourtStatusDialog, EditCaseDialog } from "./case-dialogs";
import { CaseDrawer } from "./case-drawer";
import { CounsellingFormDialog } from "./counselling-dialogs";
import { courtStatusLabel, courtStatusTone } from "./status";

const text = "font-medium text-creaw-ink-soft";

/** The register as an audited CSV export. */
/** Exports the case register, narrowed to the given location when there is one. */
export const exportCases = (location: LocationQuery = {}) =>
  auditedExportAction({
    path: "/pillars/vawg",
    routeTemplate: "/pillars/:pillar",
    query: { table: "legal_case", ...locationParams(location) },
  });
const columns: DataColumn<LegalCaseView>[] = [
  {
    id: "case",
    header: "Case",
    sortValue: (row) => row.id,
    cell: (row) => (
      <div>
        <span className="whitespace-nowrap font-semibold">{row.number}</span>
        <p className="text-[12.5px] text-creaw-faint">{row.survivor}</p>
      </div>
    ),
  },
  {
    id: "type",
    header: "Case type",
    sortValue: (row) => row.caseType,
    cell: (row) => <span className={text}>{row.caseType}</span>,
  },
  {
    id: "court",
    header: "Court",
    sortValue: (row) => row.court ?? "",
    cell: (row) => <span className={text}>{row.court ?? "—"}</span>,
  },
  {
    id: "officer",
    header: "Officer",
    sortValue: (row) => row.assignedOfficer ?? "",
    cell: (row) => <span className={text}>{row.assignedOfficer ?? "Not assigned"}</span>,
  },
  {
    id: "nextDate",
    header: "Next date",
    sortValue: (row) =>
      row.nextCourtDate ? dateSortValue(row.nextCourtDate) : Number.MAX_SAFE_INTEGER,
    cell: (row) => (
      <span className={`whitespace-nowrap ${text}`}>
        {row.nextCourtDate ? formatDate(row.nextCourtDate) : "Pending"}
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    sortValue: (row) => courtStatusLabel(row.courtStatus),
    cell: (row) => (
      <StatusBadge tone={courtStatusTone(row.courtStatus)}>
        {courtStatusLabel(row.courtStatus)}
      </StatusBadge>
    ),
  },
  recordStatusColumn((row) => row.status),
  updatedColumn((row) => row.updated),
];

/** The design's VAWG legal case register, paged by the API, with each case's record panel and actions. */
export function CaseRegister({
  workspace,
  can,
  toolbar,
}: {
  workspace: Pick<VawgWorkspace, "cases" | "counselling" | "currentUserId">;
  can: {
    edit: boolean;
    attach: boolean;
    download: boolean;
    export: boolean;
    /** May log counselling (shown only when the user can also view it). */
    counsel?: boolean;
  };
  /** Extra buttons for the register's toolbar, e.g. logging a new record. */
  toolbar?: React.ReactNode;
}) {
  const router = useRouter();
  const list = usePagedList<LegalCaseView, ListQuery>(
    workspace.cases,
    { page: 1, pageSize: workspace.cases.pageSize },
    listCasesAction
  );
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<
    | { kind: "status" }
    | { kind: "edit" }
    | { kind: "attach"; type?: string }
    | { kind: "counselling" }
    | null
  >(null);
  const [viewing, setViewing] = useState<ViewedDocument | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const detail = useRecordDetail(selectedId, loadCaseDetailAction);
  const row = list.data.items.find((item) => item.id === selectedId) ?? null;
  const selected = row ? { ...row, ...detail.data } : null;
  const status = list.query.filters?.court_status ? String(list.query.filters.court_status) : "All";
  const done = (message: string) => {
    setModal(null);
    setFeedback(message);
    void list.refresh();
    detail.reload();
    router.refresh();
  };
  async function view(documentId: number) {
    if (!selected) return;
    setError("");
    const result = await viewCaseFileAction(selected.id, documentId);
    if (result.success && result.document) setViewing(result.document);
    else setError(result.message);
  }

  return (
    <>
      <FormBanner tone="success">{feedback}</FormBanner>
      <FormBanner tone="error">{error}</FormBanner>
      {!modal && <FormBanner tone="error">{list.error}</FormBanner>}
      <TableCard
        title="Legal case register"
        subtitle="Open a case for the full record"
        chipsLabel="Court status"
        filters={
          <LocationFilter value={list.query} onChange={(location) => list.filter(location)} />
        }
        chips={["All", ...courtStatuses].map((value) => ({
          label: value === "All" ? value : courtStatusLabel(value),
          active: status === value,
          onSelect: () =>
            list.filter({ filters: value === "All" ? undefined : { court_status: value } }),
        }))}
        search={{
          value: search,
          label: "Search legal case register",
          onChange: (value) => {
            setSearch(value);
            list.filter({ search: value || undefined });
          },
        }}
        actions={
          <>
            {toolbar}
            {can.export && (
              <ExportButton label="CSV" exportAction={() => exportCases(list.query)} />
            )}
          </>
        }
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
          label="Legal case register"
          columns={columns}
          rows={list.data.items}
          getRowId={(item) => item.id}
          filtered={
            list.data.items.length === 0 &&
            (status !== "All" || search.length > 0 || hasLocation(list.query))
          }
          onRowOpen={(item) => setSelectedId(item.id)}
          rowOpenLabel={(item) => `Open ${item.number}`}
          sort={list.query.sort}
          onSortChange={(sort) => list.filter({ sort })}
        />
      </TableCard>
      <CaseDrawer
        legalCase={modal === null ? selected : null}
        detailLoading={detail.loading}
        can={can}
        onClose={() => setSelectedId(null)}
        onEdit={() => setModal({ kind: "edit" })}
        onStatus={() => setModal({ kind: "status" })}
        onAttach={(type) => setModal({ kind: "attach", type })}
        onView={(documentId) => void view(documentId)}
        onCounsel={
          workspace.counselling !== null ? () => setModal({ kind: "counselling" }) : undefined
        }
      />
      <CounsellingFormDialog
        key={modal?.kind === "counselling" ? `counsel-${selectedId}` : "counsel-closed"}
        open={modal?.kind === "counselling"}
        currentUserId={workspace.currentUserId}
        enrollmentId={selected?.enrollmentId}
        session={null}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <EditCaseDialog
        key={modal?.kind === "edit" ? `edit-${selectedId}` : "edit-closed"}
        legalCase={modal?.kind === "edit" ? selected : null}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <CourtStatusDialog
        legalCase={modal?.kind === "status" ? selected : null}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <AttachCaseFileDialog
        key={modal?.kind === "attach" ? (modal.type ?? "any") : "closed"}
        legalCase={modal?.kind === "attach" ? selected : null}
        documentType={modal?.kind === "attach" ? modal.type : undefined}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <DocumentViewer
        document={viewing}
        onClose={() => setViewing(null)}
        onReplace={
          can.attach
            ? () => {
                setViewing(null);
                setModal({ kind: "attach" });
              }
            : undefined
        }
      />
    </>
  );
}
