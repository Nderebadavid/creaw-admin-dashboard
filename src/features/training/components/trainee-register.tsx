"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination } from "@/components/data-table/pagination";
import { TableCard } from "@/components/data-table/table-card";
import { useClientPaging } from "@/components/data-table/use-client-paging";
import { useClientSort } from "@/components/data-table/use-client-sort";
import { auditedExportAction } from "@/components/portal/data-actions";
import { ExportButton } from "@/components/ui/export-button";
import { FormBanner } from "@/components/ui/form-banner";
import {
  pathwayLabels,
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

/** The Skilling trainee register. Opening a row selects it for the record panel. */
export function TraineeRegister({
  workspace,
  can,
}: {
  workspace: TrainingWorkspace;
  can: TrainingPermissions;
}) {
  const router = useRouter();
  const [pathway, setPathway] = useState<Pathway | "All">("All");
  const [status, setStatus] = useState<TrainingStatus | "All">("All");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [feedback, setFeedback] = useState("");
  const selected = workspace.trainees.find((row) => row.id === selectedId) ?? null;
  const pathwaysPresent = useMemo(
    () => [...new Set(workspace.trainees.map((row) => row.pathway))],
    [workspace.trainees]
  );
  const needle = search.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      workspace.trainees.filter(
        (row) =>
          (pathway === "All" || row.pathway === pathway) &&
          (status === "All" || row.status === status) &&
          (!needle ||
            [row.name, row.course, row.institution].join(" ").toLocaleLowerCase().includes(needle))
      ),
    [workspace.trainees, pathway, status, needle]
  );
  const { rows, sorting } = useClientSort(filtered, columns);
  const { pageRows, pager, resetPage } = useClientPaging(rows);
  const done = (message: string) => {
    setModal(null);
    setFeedback(message);
    router.refresh();
  };

  return (
    <>
      <FormBanner tone="success">{feedback}</FormBanner>
      <TableCard
        title="Trainee register"
        subtitle="Placements, outcomes and grant recommendations — open a trainee for the full record"
        chipsLabel="Pathway"
        chips={["All" as const, ...pathwaysPresent].map((value) => ({
          label: value === "All" ? "All" : pathwayLabels[value],
          active: pathway === value,
          onSelect: () => {
            setPathway(value);
            resetPage();
          },
        }))}
        filters={
          <label className="flex items-center gap-2 text-sm">
            Status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as TrainingStatus | "All");
                resetPage();
              }}
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
            resetPage();
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
        footer={<Pagination {...pager} hint="Click a row to open the trainee" />}
      >
        <DataTable
          framed={false}
          label="Trainee register"
          columns={columns}
          rows={pageRows}
          getRowId={(row) => row.id}
          filtered={
            filtered.length === 0 && (pathway !== "All" || status !== "All" || needle.length > 0)
          }
          onRowOpen={(row) => setSelectedId(row.id)}
          rowOpenLabel={(row) => `Open ${row.name}, ${row.course ?? "course not recorded"}`}
          sort={sorting.sort}
          onSortChange={(sort) => {
            sorting.onSortChange(sort);
            resetPage();
          }}
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
        workspace={workspace}
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
