"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination } from "@/components/data-table/pagination";
import { dateSortValue } from "@/components/data-table/sorting";
import { TableCard } from "@/components/data-table/table-card";
import { useClientPaging } from "@/components/data-table/use-client-paging";
import { useClientSort } from "@/components/data-table/use-client-sort";
import { auditedExportAction } from "@/components/portal/data-actions";
import { DocumentViewer, type ViewedDocument } from "@/components/ui/document-viewer";
import { ExportButton } from "@/components/ui/export-button";
import { FormBanner } from "@/components/ui/form-banner";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import { viewCaseFileAction } from "../actions";
import type { LegalCaseView, VawgWorkspace } from "../model";
import { AttachCaseFileDialog, CourtStatusDialog } from "./case-dialogs";
import { CaseDrawer } from "./case-drawer";
import { courtStatusLabel, courtStatusTone } from "./status";

const text = "font-medium text-creaw-ink-soft";

/** The register as an audited CSV export. */
export const exportCases = () =>
  auditedExportAction({
    path: "/pillars/vawg",
    routeTemplate: "/pillars/:pillar",
    query: { table: "legal_case" },
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
    id: "route",
    header: "Route",
    sortValue: (row) => row.route,
    cell: (row) => <span className={text}>{row.route}</span>,
  },
  {
    id: "counselling",
    header: "Counselling",
    sortValue: (row) => row.counselling.length,
    cell: (row) => (
      <span className={text}>
        {row.counselling.length} session{row.counselling.length === 1 ? "" : "s"}
      </span>
    ),
  },
  {
    id: "opened",
    header: "Opened",
    sortValue: (row) => dateSortValue(row.opened),
    cell: (row) => <span className={`whitespace-nowrap ${text}`}>{formatDate(row.opened)}</span>,
  },
  {
    id: "ruling",
    header: "Ruling date",
    sortValue: (row) => (row.ruling ? dateSortValue(row.ruling) : Number.MAX_SAFE_INTEGER),
    cell: (row) => (
      <span className={`whitespace-nowrap ${text}`}>
        {row.ruling ? formatDate(row.ruling) : "Not scheduled"}
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
];

/** The design's VAWG legal case register, with each case's record panel and actions. */
export function CaseRegister({
  workspace,
  can,
}: {
  workspace: VawgWorkspace;
  can: {
    edit: boolean;
    attach: boolean;
    download: boolean;
    reveal: boolean;
    export: boolean;
  };
}) {
  const router = useRouter();
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<{ kind: "status" } | { kind: "attach"; type?: string } | null>(
    null
  );
  const [viewing, setViewing] = useState<ViewedDocument | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const selected = workspace.cases.find((row) => row.id === selectedId) ?? null;
  const statuses = useMemo(
    () => ["All", ...new Set(workspace.cases.map((row) => courtStatusLabel(row.courtStatus)))],
    [workspace.cases]
  );
  const needle = search.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      workspace.cases.filter(
        (row) =>
          (status === "All" || courtStatusLabel(row.courtStatus) === status) &&
          (!needle ||
            `${row.number} ${row.survivor} ${row.caseType} ${row.route}`
              .toLocaleLowerCase()
              .includes(needle))
      ),
    [workspace.cases, status, needle]
  );
  const { rows, sorting } = useClientSort(filtered, columns);
  const { pageRows, pager, resetPage } = useClientPaging(rows);
  const done = (message: string) => {
    setModal(null);
    setFeedback(message);
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
      <TableCard
        title="Legal case register"
        subtitle="Survivor names stay masked in lists — open a case for the full record"
        chipsLabel="Court status"
        chips={statuses.map((label) => ({
          label,
          active: status === label,
          onSelect: () => {
            setStatus(label);
            resetPage();
          },
        }))}
        search={{
          value: search,
          label: "Search legal case register",
          onChange: (value) => {
            setSearch(value);
            resetPage();
          },
        }}
        actions={can.export && <ExportButton label="CSV" exportAction={exportCases} />}
        footer={<Pagination {...pager} hint="Click a row to open the record" />}
      >
        <DataTable
          framed={false}
          label="Legal case register"
          columns={columns}
          rows={pageRows}
          getRowId={(row) => row.id}
          filtered={filtered.length === 0 && (status !== "All" || needle.length > 0)}
          onRowOpen={(row) => setSelectedId(row.id)}
          rowOpenLabel={(row) => `Open ${row.number}`}
          sort={sorting.sort}
          onSortChange={(sort) => {
            sorting.onSortChange(sort);
            resetPage();
          }}
        />
      </TableCard>
      <CaseDrawer
        legalCase={modal === null ? selected : null}
        can={can}
        onClose={() => setSelectedId(null)}
        onStatus={() => setModal({ kind: "status" })}
        onAttach={(type) => setModal({ kind: "attach", type })}
        onView={(documentId) => void view(documentId)}
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
