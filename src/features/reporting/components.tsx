"use client";
import { DocumentViewer, type ViewedDocument } from "@/components/ui/document-viewer";
import { filterSelectClass } from "@/components/ui/form-styles";
import { FormBanner } from "@/components/ui/form-banner";
import { titleCase } from "@/lib/format";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertBanner } from "@/components/ui/alert-banner";
import { DataTable } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { TableCard } from "@/components/data-table/table-card";
import { usePagedList } from "@/components/data-table/use-paged-list";
import { ExportButton } from "@/components/ui/export-button";
import { PageHeading, type PageHeadingText } from "@/components/portal/page-heading";
import type { ReportPage, ReportQuery, ReportView } from "./api";
import { exportReportsAction, listReportsAction, viewReportDocumentAction } from "./actions";
import { reportColumns } from "./calendar/columns";
import { ReportSummaryCards } from "./calendar/summary-cards";
import { AddDeadlineDialog, SubmitReportDialog } from "./calendar/report-dialogs";

type Catalog = {
  projects: { id: number; pillar_id: number; name: string; donor_id: number | null }[];
  pillars: { id: number; name: string; lead_user_id: number | null }[];
  owners?: { id: number; name: string }[];
};

const statuses = ["overdue", "pending", "submitted"];

/**
 * Reporting calendar: narrative and grant-compliance reports due across
 * pillars. Clicking a report uploads its submission, or views what was sent
 * once it has been submitted.
 */
export function ReportingContent({
  heading,
  initial,
  catalog,
  canManage,
  canExport,
  narrativePillars = [],
  grantPillars = [],
}: {
  heading?: PageHeadingText;
  initial: ReportPage;
  catalog: Catalog;
  canManage: boolean;
  canExport: boolean;
  /** Pillars where the user manages narrative reports. */
  narrativePillars?: number[];
  /** Pillars where the user manages grant compliance reports. */
  grantPillars?: number[];
}) {
  const list = usePagedList<ReportView, ReportQuery>(
    initial,
    { page: 1, pageSize: 25 },
    listReportsAction
  );
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState("");
  const [viewing, setViewing] = useState<ViewedDocument | null>(null);
  const [actionError, setActionError] = useState("");
  const [modal, setModal] = useState<"deadline" | "submit" | null>(null);
  const [selected, setSelected] = useState<ReportView | null>(null);
  // Every overdue report in scope, not only this page's; the page's own when the API gives no counts.
  const overdue =
    list.data.facets?.status?.overdue ??
    list.data.items.filter((row) => row.status === "overdue").length;
  const owners = [
    ...new Set(
      catalog.pillars.map((pillar) => pillar.lead_user_id).filter((id): id is number => id !== null)
    ),
  ];
  const canSubmit = (row: ReportView) =>
    (row.type === "grant" ? grantPillars : narrativePillars).includes(row.pillarId);

  const done = (message: string) => {
    setModal(null);
    setFeedback(message);
    void list.refresh();
  };

  async function viewDocument(row: ReportView) {
    setActionError("");
    const response = await viewReportDocumentAction(row.type, row.id);
    if (response.success && response.document) setViewing(response.document);
    else setActionError(response.message);
  }

  function openReport(row: ReportView) {
    if (row.status === "submitted") {
      if (row.documentId) void viewDocument(row);
    } else if (canSubmit(row)) {
      setSelected(row);
      setModal("submit");
    }
  }

  const actions = (
    <>
      {canExport && <ExportButton exportAction={() => exportReportsAction(list.query)} />}
      {canManage && (
        <Button onClick={() => setModal("deadline")}>
          <CalendarDays size={16} />
          Add deadline
        </Button>
      )}
    </>
  );
  const error = actionError || list.error;

  return (
    <div className="space-y-5">
      {heading && <PageHeading {...heading} />}
      <ReportSummaryCards counts={list.data.facets?.status} />
      {overdue > 0 && (
        <AlertBanner tone="danger">
          <strong>
            {overdue} report{overdue === 1 ? "" : "s"} overdue
          </strong>
          <span className="ml-2">Follow up with the owner and submit the report.</span>
        </AlertBanner>
      )}
      <FormBanner tone="success">{feedback}</FormBanner>
      {!modal && <FormBanner tone="error">{error}</FormBanner>}
      <TableCard
        actions={actions}
        title="Reports due"
        subtitle="Click a report to upload the submission or view what was sent"
        chipsLabel="Report status"
        chips={[
          {
            label: "All",
            active: !list.query.status,
            onSelect: () => list.filter({ status: undefined }),
          },
          ...statuses.map((status) => ({
            label: titleCase(status),
            active: list.query.status === status,
            onSelect: () => list.filter({ status }),
          })),
        ]}
        filters={
          <>
            <select
              aria-label="Pillar"
              value={list.query.pillarId ?? ""}
              onChange={(event) =>
                list.filter({ pillarId: Number(event.target.value) || undefined })
              }
              className={filterSelectClass}
            >
              <option value="">All pillars</option>
              {catalog.pillars.map((pillar) => (
                <option key={pillar.id} value={pillar.id}>
                  {pillar.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Owner"
              value={list.query.ownerId ?? ""}
              onChange={(event) =>
                list.filter({ ownerId: Number(event.target.value) || undefined })
              }
              className={filterSelectClass}
            >
              <option value="">All owners</option>
              {owners.map((id) => (
                <option key={id} value={id}>
                  {catalog.owners?.find((owner) => owner.id === id)?.name ?? `Staff #${id}`}
                </option>
              ))}
            </select>
          </>
        }
        search={{
          value: search,
          label: "Search reports",
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
          label="Reports due"
          columns={reportColumns}
          sort={list.query.sort}
          onSortChange={(sort) => list.filter({ sort })}
          rows={list.data.items}
          getRowId={(row) => row.key}
          loading={list.loading}
          filtered={Boolean(
            list.query.pillarId || list.query.ownerId || list.query.status || list.query.search
          )}
          onRowOpen={openReport}
          rowOpenLabel={(row) =>
            row.status === "submitted" ? `View ${row.title}` : `Upload ${row.title}`
          }
        />
      </TableCard>
      <DocumentViewer document={viewing} onClose={() => setViewing(null)} />
      <AddDeadlineDialog
        open={modal === "deadline"}
        projects={catalog.projects.filter((project) =>
          narrativePillars.includes(project.pillar_id)
        )}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <SubmitReportDialog
        report={modal === "submit" ? selected : null}
        onClose={() => setModal(null)}
        onDone={done}
      />
    </div>
  );
}
