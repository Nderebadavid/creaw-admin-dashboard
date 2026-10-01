"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { dateSortValue } from "@/components/data-table/sorting";
import { TableCard } from "@/components/data-table/table-card";
import { usePagedList } from "@/components/data-table/use-paged-list";
import { useLoadedOptions } from "@/components/ui/use-loaded-options";
import { useRecordDetail } from "@/components/ui/use-record-detail";
import type { ListQuery } from "@/lib/api/list";
import type { PaginatedData } from "@/types/api";
import { loadAssessmentOptionsAction } from "@/features/assessments/actions";
import { recordStatusColumn, updatedColumn } from "@/components/data-table/record-columns";
import { pillarLook } from "@/components/portal/pillars";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/ui/form-banner";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { formatDate, initials, titleCase } from "@/lib/format";
import { NewAssessmentDialog } from "@/features/assessments/cards/assessment-dialogs";
import { listOrganisationsAction, loadOrganisationDetailAction } from "../actions";
import {
  WRO_PILLAR_ID,
  type OrganisationStage,
  type OrganisationView,
  type PipelineStageDef,
} from "../model";
import { OrganisationDrawer } from "./organisation-drawer";
import { RegisterOrganisationDialog } from "./register-organisation-dialog";
import { StageDialog } from "./stage-dialog";

export const dueDiligenceTone = (status: string): StatusTone =>
  status === "passed"
    ? "success"
    : status === "failed"
      ? "danger"
      : status === "in_progress"
        ? "warning"
        : "neutral";

/** The register's chips and the API filters they ask for. */
const filters = {
  All: undefined,
  "Due diligence": { in_due_diligence: "true" },
  Contracted: { is_contracted: "true" },
} as const;
type Filter = keyof typeof filters;

const stageName = (row: OrganisationView, stages: readonly PipelineStageDef[]) =>
  stages[row.currentStage]?.name ?? "Not started";

const columnsFor = (stages: readonly PipelineStageDef[]): DataColumn<OrganisationView>[] => [
  {
    id: "organisation",
    header: "Organisation",
    sortValue: (row) => row.name,
    cell: (row) => {
      const look = pillarLook(WRO_PILLAR_ID);
      return (
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-[38px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
            style={{ backgroundColor: look?.tint, color: look?.color }}
          >
            {initials(row.name)}
          </span>
          <div>
            <span className="whitespace-nowrap font-semibold">{row.name}</span>
            <p className="text-[12.5px] text-creaw-faint">
              {row.registrationNumber ?? "No registration number"}
            </p>
          </div>
        </div>
      );
    },
  },
  {
    id: "legalForm",
    header: "Legal form",
    sortValue: (row) => row.legalForm,
    cell: (row) => <span className="font-medium text-creaw-ink-soft">{row.legalForm}</span>,
  },
  {
    id: "location",
    header: "County",
    sortValue: (row) => `${row.county} ${row.ward}`,
    cell: (row) => (
      <div className="font-medium text-creaw-ink-soft">
        {row.county}
        <p className="text-[12.5px] font-normal text-creaw-faint">{row.ward}</p>
      </div>
    ),
  },
  {
    id: "stage",
    header: "Pipeline stage",
    sortValue: (row) => row.currentStage,
    cell: (row) => (
      <div className="font-medium text-creaw-ink-soft">
        {stageName(row, stages)}
        <p className="text-[12.5px] font-normal text-creaw-faint">
          {row.stageCount ? `Step ${row.currentStage + 1} of ${row.stageCount}` : "No pipeline"}
        </p>
      </div>
    ),
  },
  {
    id: "registered",
    header: "Registered",
    sortValue: (row) => dateSortValue(row.registered),
    cell: (row) => (
      <span className="whitespace-nowrap font-medium text-creaw-ink-soft">
        {formatDate(row.registered)}
      </span>
    ),
  },
  {
    id: "dueDiligence",
    header: "Due diligence",
    sortValue: (row) => row.dueDiligence,
    cell: (row) => (
      <StatusBadge tone={dueDiligenceTone(row.dueDiligence)}>
        {titleCase(row.dueDiligence)}
      </StatusBadge>
    ),
  },
  recordStatusColumn((row) => row.status),
  updatedColumn((row) => row.updated),
];

/**
 * The WRO pillar's partner register, carrying over the field app's
 * organisation list: filters, a profile for each organisation, registration,
 * pipeline moves and scored assessments. Paged by the API.
 */
export function OrganisationRegister({
  initial,
  stages,
  canAssess,
  canRegister,
  canMove,
}: {
  /** The first page, rendered by the server. */
  initial: PaginatedData<OrganisationView>;
  /** The WRO pipeline's stages, in order. */
  stages: readonly PipelineStageDef[];
  /** Whether the user may record assessments. */
  canAssess: boolean;
  canRegister: boolean;
  canMove: boolean;
}) {
  const router = useRouter();
  const list = usePagedList<OrganisationView, ListQuery>(
    initial,
    { page: 1, pageSize: initial.pageSize },
    listOrganisationsAction
  );
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<
    { kind: "register" } | { kind: "stage"; stage: OrganisationStage } | { kind: "assess" } | null
  >(null);
  const [feedback, setFeedback] = useState("");
  const detail = useRecordDetail(selectedId, loadOrganisationDetailAction);
  const selected = list.data.items.find((row) => row.id === selectedId) ?? null;
  const assessmentOptions = useLoadedOptions(modal?.kind === "assess", loadAssessmentOptionsAction);
  const columns = columnsFor(stages);
  const active =
    (Object.keys(filters) as Filter[]).find(
      (label) =>
        JSON.stringify(filters[label] ?? null) === JSON.stringify(list.query.filters ?? null)
    ) ?? "All";
  // The pipeline with when this organisation reached each stage (known once its detail loads).
  const withProgress: OrganisationStage[] = stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    reachedAt: detail.data?.reachedAt[stage.id] ?? null,
  }));
  const done = (message: string) => {
    setModal(null);
    setFeedback(message);
    void list.refresh();
    detail.reload();
    router.refresh();
  };

  return (
    <>
      <FormBanner tone="success">{feedback}</FormBanner>
      {!modal && <FormBanner tone="error">{list.error}</FormBanner>}
      <TableCard
        title="Partner organisations"
        subtitle="Women's rights organisations moving from onboarding to a sub-grant"
        chipsLabel="Organisation filter"
        chips={(Object.keys(filters) as Filter[]).map((label) => ({
          label,
          active: active === label,
          onSelect: () => list.filter({ filters: filters[label] }),
        }))}
        search={{
          value: search,
          label: "Search organisations",
          onChange: (value) => {
            setSearch(value);
            list.filter({ search: value || undefined });
          },
        }}
        actions={
          canRegister && (
            <Button size="sm" className="h-10" onClick={() => setModal({ kind: "register" })}>
              <Building2 />
              Register organisation
            </Button>
          )
        }
        footer={
          <Pagination
            page={list.data.page}
            pageSize={list.data.pageSize as PageSize}
            totalItems={list.data.totalItems}
            hint="Click a row to open the organisation"
            onPageChange={(page) => list.filter({ page }, false)}
            onPageSizeChange={(pageSize) => list.filter({ pageSize })}
          />
        }
      >
        <DataTable
          framed={false}
          label="Partner organisations"
          columns={columns}
          rows={list.data.items}
          getRowId={(row) => row.id}
          filtered={list.data.items.length === 0 && (active !== "All" || search.length > 0)}
          onRowOpen={(row) => setSelectedId(row.id)}
          rowOpenLabel={(row) => `Open ${row.name}`}
          sort={list.query.sort}
          onSortChange={(sort) => list.filter({ sort })}
        />
      </TableCard>
      <OrganisationDrawer
        organisation={modal === null ? selected : null}
        stages={withProgress}
        canMove={canMove}
        canAssess={canAssess}
        onClose={() => setSelectedId(null)}
        onMove={(stage) => setModal({ kind: "stage", stage })}
        onAssess={() => setModal({ kind: "assess" })}
      />
      <RegisterOrganisationDialog
        open={modal?.kind === "register"}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <StageDialog
        organisation={modal?.kind === "stage" ? selected : null}
        stage={modal?.kind === "stage" ? modal.stage : null}
        onClose={() => setModal(null)}
        onDone={done}
      />
      {canAssess && assessmentOptions.data && (
        <NewAssessmentDialog
          key={selected?.id ?? "none"}
          open={modal?.kind === "assess"}
          options={assessmentOptions.data}
          organisationId={selected?.id}
          onClose={() => setModal(null)}
          onDone={done}
        />
      )}
    </>
  );
}
