"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination } from "@/components/data-table/pagination";
import { dateSortValue } from "@/components/data-table/sorting";
import { TableCard } from "@/components/data-table/table-card";
import { useClientPaging } from "@/components/data-table/use-client-paging";
import { useClientSort } from "@/components/data-table/use-client-sort";
import { pillarLook } from "@/components/portal/pillars";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/ui/form-banner";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { formatDate, initials, titleCase } from "@/lib/format";
import type { AssessmentOptions } from "@/features/assessments/api";
import { NewAssessmentDialog } from "@/features/assessments/cards/assessment-dialogs";
import { WRO_PILLAR_ID, type OrganisationStage, type OrganisationView } from "../model";
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

/** Index of the "Contract" stage; an organisation at or past it is contracted. */
const contractIndex = (row: OrganisationView) =>
  row.stages.findIndex((stage) => /contract/i.test(stage.name));
const isContracted = (row: OrganisationView) =>
  contractIndex(row) >= 0 && row.currentStage >= contractIndex(row);

const filters = {
  All: () => true,
  "Due diligence": (row: OrganisationView) => !isContracted(row) && row.dueDiligence !== "passed",
  Contracted: isContracted,
} as const;
type Filter = keyof typeof filters;

const stageOf = (row: OrganisationView) => row.stages[row.currentStage]?.name ?? "Not started";

const columns: DataColumn<OrganisationView>[] = [
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
        {stageOf(row)}
        <p className="text-[12.5px] font-normal text-creaw-faint">
          {row.stages.length
            ? `Step ${row.currentStage + 1} of ${row.stages.length}`
            : "No pipeline"}
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
];

/**
 * The WRO pillar's partner register, carrying over the field app's
 * organisation list: filters, a profile for each organisation, registration,
 * pipeline moves and scored assessments.
 */
export function OrganisationRegister({
  organisations,
  wards,
  assessmentOptions,
  canRegister,
  canMove,
  canReveal,
}: {
  organisations: readonly OrganisationView[];
  wards: readonly { id: number; name: string }[];
  /** Present when the user may record assessments. */
  assessmentOptions?: AssessmentOptions;
  canRegister: boolean;
  canMove: boolean;
  canReveal: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<
    { kind: "register" } | { kind: "stage"; stage: OrganisationStage } | { kind: "assess" } | null
  >(null);
  const [feedback, setFeedback] = useState("");
  const selected = organisations.find((row) => row.id === selectedId) ?? null;
  const needle = search.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      organisations.filter(
        (row) =>
          filters[filter](row) &&
          (!needle ||
            `${row.name} ${row.registrationNumber ?? ""} ${row.county} ${row.ward}`
              .toLocaleLowerCase()
              .includes(needle))
      ),
    [organisations, filter, needle]
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
        title="Partner organisations"
        subtitle="Women's rights organisations moving from onboarding to a sub-grant"
        chipsLabel="Organisation filter"
        chips={(Object.keys(filters) as Filter[]).map((label) => ({
          label,
          active: filter === label,
          onSelect: () => {
            setFilter(label);
            resetPage();
          },
        }))}
        search={{
          value: search,
          label: "Search organisations",
          onChange: (value) => {
            setSearch(value);
            resetPage();
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
        footer={<Pagination {...pager} hint="Click a row to open the organisation" />}
      >
        <DataTable
          framed={false}
          label="Partner organisations"
          columns={columns}
          rows={pageRows}
          getRowId={(row) => row.id}
          filtered={filtered.length === 0 && (filter !== "All" || needle.length > 0)}
          onRowOpen={(row) => setSelectedId(row.id)}
          rowOpenLabel={(row) => `Open ${row.name}`}
          sort={sorting.sort}
          onSortChange={(sort) => {
            sorting.onSortChange(sort);
            resetPage();
          }}
        />
      </TableCard>
      <OrganisationDrawer
        organisation={modal === null ? selected : null}
        canMove={canMove}
        canReveal={canReveal}
        canAssess={Boolean(assessmentOptions)}
        onClose={() => setSelectedId(null)}
        onMove={(stage) => setModal({ kind: "stage", stage })}
        onAssess={() => setModal({ kind: "assess" })}
      />
      <RegisterOrganisationDialog
        open={modal?.kind === "register"}
        wards={wards}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <StageDialog
        organisation={modal?.kind === "stage" ? selected : null}
        stage={modal?.kind === "stage" ? modal.stage : null}
        onClose={() => setModal(null)}
        onDone={done}
      />
      {assessmentOptions && (
        <NewAssessmentDialog
          key={selected?.id ?? "none"}
          open={modal?.kind === "assess"}
          options={assessmentOptions}
          organisationId={selected?.id}
          onClose={() => setModal(null)}
          onDone={done}
        />
      )}
    </>
  );
}
