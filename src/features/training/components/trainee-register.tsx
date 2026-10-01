"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { TableCard } from "@/components/data-table/table-card";
import { usePagedList } from "@/components/data-table/use-paged-list";
import type { ListQuery } from "@/lib/api/list";
import { auditedExportAction } from "@/components/portal/data-actions";
import { ExportButton } from "@/components/ui/export-button";
import { FormBanner } from "@/components/ui/form-banner";
import { listTraineesAction } from "../actions";
import {
  pathwayLabels,
  pathways,
  trainingStatuses,
  trainingStatusLabels,
  workStatusLabels,
  type Pathway,
  type TraineeView,
  type TrainingPermissions,
  type TrainingStatus,
  type TrainingWorkspace,
} from "../model";
import { OutcomeDialog, RecommendDialog, TraineeFormDialog } from "./trainee-dialogs";
import { TraineeDrawer } from "./trainee-drawer";
import { HandoffBadge, TrainingStatusBadge } from "./status";

const text = "font-medium text-creaw-ink-soft";

const columns: DataColumn<TraineeView>[] = [
  {
    id: "trainee",
    header: "Trainee",
    sortValue: (row) => row.name,
    cell: (row) => <span className="font-semibold">{row.name}</span>,
  },
  {
    id: "pathway",
    header: "Pathway",
    sortValue: (row) => pathwayLabels[row.pathway],
    cell: (row) => <span className={text}>{pathwayLabels[row.pathway]}</span>,
  },
  {
    id: "course",
    header: "Course",
    sortValue: (row) => row.course ?? "",
    cell: (row) => <span className={text}>{row.course ?? "Not recorded"}</span>,
  },
  {
    id: "institution",
    header: "Institution",
    sortValue: (row) => row.institution ?? "",
    cell: (row) => <span className={text}>{row.institution ?? "Not recorded"}</span>,
  },
  {
    id: "sessions",
    header: "Life-skills sessions",
    sortValue: (row) => row.lifeSkillsSessions,
    cell: (row) => <span className={text}>{row.lifeSkillsSessions}</span>,
  },
  {
    id: "status",
    header: "Status",
    sortValue: (row) => trainingStatusLabels[row.status],
    cell: (row) => <TrainingStatusBadge status={row.status} />,
  },
  {
    id: "outcome",
    header: "Work outcome",
    sortValue: (row) => (row.workStatus ? workStatusLabels[row.workStatus] : ""),
    cell: (row) => (
      <span className={text}>{row.workStatus ? workStatusLabels[row.workStatus] : "—"}</span>
    ),
  },
  {
    id: "grant",
    header: "Grant",
    sortValue: (row) => row.handoff.stage,
    cell: (row) =>
      row.handoff.stage === "none" ? (
        <span className={text}>—</span>
      ) : (
        <HandoffBadge stage={row.handoff.stage} />
      ),
  },
];

type Modal =
  { kind: "edit" } | { kind: "outcome" } | { kind: "recommend"; recommend: boolean } | null;

/** The Skilling trainee register, paged by the API. Opening a row selects it for the record panel. */
export function TraineeRegister({
  workspace,
  can,
}: {
  workspace: TrainingWorkspace;
  can: TrainingPermissions;
}) {
  const router = useRouter();
  const list = usePagedList<TraineeView, ListQuery>(
    workspace.trainees,
    { page: 1, pageSize: workspace.trainees.pageSize },
    listTraineesAction
  );
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [feedback, setFeedback] = useState("");
  const selected = list.data.items.find((row) => row.id === selectedId) ?? null;
  const pathway = (list.query.filters?.pathway as Pathway | undefined) ?? "All";
  const status = (list.query.filters?.training_status as TrainingStatus | undefined) ?? "All";
  const setFilter = (key: "pathway" | "training_status", value: string) =>
    list.filter({
      filters: { ...list.query.filters, [key]: value === "All" ? undefined : value },
    });
  const done = (message: string) => {
    setModal(null);
    setFeedback(message);
    void list.refresh();
    router.refresh();
  };

  return (
    <>
      <FormBanner tone="success">{feedback}</FormBanner>
      {!modal && <FormBanner tone="error">{list.error}</FormBanner>}
      <TableCard
        title="Trainee register"
        subtitle="Placements, outcomes and grant recommendations — open a trainee for the full record"
        chipsLabel="Pathway"
        chips={["All" as const, ...pathways].map((value) => ({
          label: value === "All" ? "All" : pathwayLabels[value],
          active: pathway === value,
          onSelect: () => setFilter("pathway", value),
        }))}
        filters={
          <label className="flex items-center gap-2 text-sm">
            Status
            <select
              value={status}
              onChange={(event) => setFilter("training_status", event.target.value)}
              className="rounded-lg border border-creaw-line-strong bg-white px-2.5 py-1.5"
            >
              <option value="All">All</option>
              {trainingStatuses.map((value) => (
                <option key={value} value={value}>
                  {trainingStatusLabels[value]}
                </option>
              ))}
            </select>
          </label>
        }
        search={{
          value: search,
          label: "Search trainees",
          onChange: (value) => {
            setSearch(value);
            list.filter({ search: value || undefined });
          },
        }}
        actions={
          can.export && (
            <ExportButton
              label="CSV"
              exportAction={() =>
                auditedExportAction({
                  path: "/pillars/skilling",
                  routeTemplate: "/pillars/:pillar",
                  query: { table: "training_enrollment" },
                })
              }
            />
          )
        }
        footer={
          <Pagination
            page={list.data.page}
            pageSize={list.data.pageSize as PageSize}
            totalItems={list.data.totalItems}
            hint="Click a row to open the trainee"
            onPageChange={(page) => list.filter({ page }, false)}
            onPageSizeChange={(pageSize) => list.filter({ pageSize })}
          />
        }
      >
        <DataTable
          framed={false}
          label="Trainee register"
          columns={columns}
          rows={list.data.items}
          getRowId={(row) => row.id}
          filtered={
            list.data.items.length === 0 &&
            (pathway !== "All" || status !== "All" || search.length > 0)
          }
          onRowOpen={(row) => setSelectedId(row.id)}
          rowOpenLabel={(row) => `Open ${row.name}, ${row.course ?? "course not recorded"}`}
          sort={list.query.sort}
          onSortChange={(sort) => list.filter({ sort })}
        />
      </TableCard>
      <TraineeDrawer
        trainee={modal === null ? selected : null}
        can={can}
        onClose={() => setSelectedId(null)}
        onEdit={() => setModal({ kind: "edit" })}
        onOutcome={() => setModal({ kind: "outcome" })}
        onRecommend={(recommend) => setModal({ kind: "recommend", recommend })}
      />
      <TraineeFormDialog
        key={modal?.kind === "edit" ? `edit-${selectedId}` : "edit-closed"}
        open={modal?.kind === "edit"}
        trainee={selected}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <OutcomeDialog
        key={modal?.kind === "outcome" ? `outcome-${selectedId}` : "outcome-closed"}
        trainee={modal?.kind === "outcome" ? selected : null}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <RecommendDialog
        trainee={modal?.kind === "recommend" ? selected : null}
        recommend={modal?.kind === "recommend" ? modal.recommend : true}
        onClose={() => setModal(null)}
        onDone={done}
      />
    </>
  );
}
