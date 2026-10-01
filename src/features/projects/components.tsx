"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { recordStatusColumn, updatedColumn } from "@/components/data-table/record-columns";
import { withSortValues } from "@/components/data-table/sorting";
import { TableCard } from "@/components/data-table/table-card";
import { usePagedList } from "@/components/data-table/use-paged-list";
import { PageHeading, type PageHeadingText } from "@/components/portal/page-heading";
import { PillarChip, pillarLook } from "@/components/portal/pillars";
import { FormBanner } from "@/components/ui/form-banner";
import { fieldClass, filterSelectClass } from "@/components/ui/form-styles";
import { FieldGrid, SectionTitle } from "@/components/ui/record-parts";
import { RecordDrawer } from "@/components/ui/record-drawer";
import { RecordSection } from "@/components/ui/record-section";
import { StatusBadge } from "@/components/ui/status-badge";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { useLoadedOptions } from "@/components/ui/use-loaded-options";
import { useRecordDetail } from "@/components/ui/use-record-detail";
import type { ListQuery } from "@/lib/api/list";
import type { EffectiveGrant } from "@/lib/auth/grants";
import { hasPermission } from "@/lib/auth/grants";
import { formatDate, titleCase } from "@/lib/format";
import type { PaginatedData } from "@/types/api";
import {
  listProjectsAction,
  loadProjectDetailAction,
  loadProjectOptionsAction,
  saveProjectAction,
} from "./actions";
import type { ProjectView } from "./api";

const kes = (value: number) => `KES ${value.toLocaleString("en-KE")}`;
const money = (value: number | null) => (value === null ? "—" : kes(value));
const period = (project: ProjectView) =>
  project.start || project.end
    ? `${project.start ? formatDate(project.start) : "—"} – ${project.end ? formatDate(project.end) : "open"}`
    : "No dates set";

const columns: DataColumn<ProjectView>[] = withSortValues(
  {
    project: (row) => row.name,
    pillar: (row) => row.pillar,
    donor: (row) => row.donor,
    period: (row) => row.start,
    applications: (row) => row.applications,
    awarded: (row) => row.awarded,
    disbursed: (row) => row.disbursed,
    overdue: (row) => row.reportsOverdue,
  },
  [
    {
      id: "project",
      header: "Project",
      cell: (row) => <span className="font-semibold">{row.name}</span>,
    },
    {
      id: "pillar",
      header: "Pillar",
      cell: (row) => <PillarChip id={row.pillarId} fallback={row.pillar} />,
    },
    {
      id: "donor",
      header: "Donor",
      cell: (row) => <span className="text-creaw-ink-soft">{row.donor ?? "—"}</span>,
    },
    {
      id: "period",
      header: "Period",
      cell: (row) => <span className="whitespace-nowrap text-creaw-ink-soft">{period(row)}</span>,
    },
    {
      id: "applications",
      header: "Applications",
      cell: (row) => row.applications ?? "—",
    },
    {
      id: "awarded",
      header: "Awarded",
      cell: (row) => <span className="whitespace-nowrap">{money(row.awarded)}</span>,
    },
    {
      id: "disbursed",
      header: "Disbursed",
      cell: (row) => <span className="whitespace-nowrap">{money(row.disbursed)}</span>,
    },
    {
      id: "overdue",
      header: "Reports overdue",
      cell: (row) =>
        row.reportsOverdue === null ? (
          "—"
        ) : row.reportsOverdue > 0 ? (
          <StatusBadge tone="danger">{row.reportsOverdue} overdue</StatusBadge>
        ) : (
          <StatusBadge tone="success">None</StatusBadge>
        ),
    },
    recordStatusColumn((row: ProjectView) => row.status),
    updatedColumn((row: ProjectView) => row.updated),
  ]
);

/** Creates or edits a project: its pillar, donor, dates and notes. */
function ProjectDialog({
  open,
  project,
  pillarIds,
  onClose,
  onDone,
}: {
  open: boolean;
  /** The project being edited, or null to create one. */
  project: ProjectView | null;
  /** Pillars the user may manage projects in. */
  pillarIds: number[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const options = useLoadedOptions(open, loadProjectOptionsAction);
  const submit = useActionSubmit(onDone);
  // The menus remount when the options arrive, so the current pillar and donor are selected.
  const pillars = (options.data?.pillars ?? []).filter((item) => pillarIds.includes(item.id));
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "") || null;
    void submit.run(
      saveProjectAction({
        id: project?.id,
        pillarId: Number(form.get("pillarId")),
        name: String(form.get("name") ?? ""),
        donorId: Number(form.get("donorId")) || null,
        startDate: text("startDate"),
        endDate: text("endDate"),
        notes: text("notes"),
      }),
      project ? "Project updated." : "Project created."
    );
  }
  return (
    <ActionDialog
      open={open}
      busy={submit.busy}
      onClose={() => {
        submit.clearError();
        onClose();
      }}
      title={project ? "Edit project" : "New project"}
      description="A funded initiative that grants, awards and reports attach to."
      error={submit.error || options.error}
      className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
    >
      <form key={project?.id ?? "new"} className="grid gap-3 sm:grid-cols-2" onSubmit={send}>
        <label className="text-sm sm:col-span-2">
          Project name
          <input
            name="name"
            required
            maxLength={200}
            defaultValue={project?.name}
            className={fieldClass}
          />
        </label>
        <label className="text-sm">
          Pillar
          <select
            key={options.data ? "ready" : "loading"}
            name="pillarId"
            required
            defaultValue={project?.pillarId ?? ""}
            className={fieldClass}
          >
            <option value="" disabled>
              Choose a pillar
            </option>
            {pillars.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Donor
          <select
            key={options.data ? "ready" : "loading"}
            name="donorId"
            defaultValue={project?.donorId ?? ""}
            className={fieldClass}
          >
            <option value="">No donor</option>
            {(options.data?.donors ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Start date
          <input
            name="startDate"
            type="date"
            defaultValue={project?.start?.slice(0, 10)}
            className={fieldClass}
          />
        </label>
        <label className="text-sm">
          End date
          <input
            name="endDate"
            type="date"
            defaultValue={project?.end?.slice(0, 10)}
            className={fieldClass}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          Notes
          <textarea
            name="notes"
            rows={3}
            maxLength={2000}
            defaultValue={project?.notes ?? ""}
            className={fieldClass}
          />
        </label>
        <div className="sm:col-span-2">
          <Button type="button" variant="outline" disabled={submit.busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submit.busy || options.loading}>
            {project ? "Save changes" : "Create project"}
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

/** Funded projects across the pillars the user can see: donor, dates and grant figures. */
export function ProjectsContent({
  heading,
  initial,
  pillars,
  grants,
}: {
  heading?: PageHeadingText;
  initial: PaginatedData<ProjectView>;
  /** Pillars to filter by. */
  pillars: { id: number; name: string }[];
  grants: readonly EffectiveGrant[];
}) {
  const router = useRouter();
  const list = usePagedList<ProjectView, ListQuery>(
    initial,
    { page: 1, pageSize: 25 },
    listProjectsAction
  );
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<"new" | "edit" | null>(null);
  const [feedback, setFeedback] = useState("");
  const detail = useRecordDetail(selectedId, loadProjectDetailAction);
  const selected = list.data.items.find((row) => row.id === selectedId) ?? null;
  const managedPillars = pillars
    .filter((item) => hasPermission(grants, "NARRATIVE_REPORT_MANAGE", { pillarId: item.id }))
    .map((item) => item.id);
  const canManage = (pillarId: number) => managedPillars.includes(pillarId);

  const done = (message: string) => {
    setModal(null);
    setFeedback(message);
    void list.refresh();
    router.refresh();
  };
  const pillarFilter = list.query.filters?.pillar_id;
  const filterBy = (patch: Record<string, string | number | undefined>) =>
    list.filter({ filters: { ...list.query.filters, ...patch } });

  const actions = managedPillars.length > 0 && (
    <Button onClick={() => setModal("new")}>
      <Plus size={16} />
      New project
    </Button>
  );
  const look = selected ? pillarLook(selected.pillarId) : undefined;

  return (
    <div className="space-y-5">
      {heading ? <PageHeading {...heading} actions={actions || undefined} /> : actions}
      <FormBanner tone="success">{feedback}</FormBanner>
      {!modal && <FormBanner tone="error">{list.error}</FormBanner>}
      <TableCard
        title="Projects"
        subtitle="Funded initiatives — grants, awards and reports attach to a project"
        chipsLabel="Pillar filter"
        chips={[
          {
            label: "All",
            active: !pillarFilter,
            onSelect: () => filterBy({ pillar_id: undefined }),
          },
          ...pillars.map((pillar) => ({
            label: pillarLook(pillar.id)?.name ?? pillar.name,
            active: String(pillarFilter) === String(pillar.id),
            onSelect: () => filterBy({ pillar_id: pillar.id }),
          })),
        ]}
        filters={
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Status</span>
            <select
              aria-label="Status"
              value={String(list.query.filters?.status ?? "")}
              onChange={(event) => filterBy({ status: event.target.value || undefined })}
              className={filterSelectClass}
            >
              <option value="">Any status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
        }
        search={{
          value: search,
          label: "Search projects",
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
            hint="Click a row to open the project"
            onPageChange={(page) => list.filter({ page }, false)}
            onPageSizeChange={(pageSize) => list.filter({ pageSize })}
          />
        }
      >
        <DataTable
          framed={false}
          label="Projects"
          columns={columns}
          sort={list.query.sort}
          onSortChange={(sort) => list.filter({ sort })}
          rows={list.data.items}
          getRowId={(row) => row.id}
          loading={list.loading}
          filtered={Boolean(list.query.search || list.query.filters)}
          onRowOpen={(row) => setSelectedId(row.id)}
          rowOpenLabel={(row) => `Open project ${row.name}`}
        />
      </TableCard>
      {selected && (
        <RecordDrawer
          open={modal === null}
          onClose={() => setSelectedId(null)}
          initials={selected.pillar.slice(0, 2).toUpperCase()}
          kind={`Project · ${selected.pillar}`}
          title={selected.name}
          subtitle={`${selected.donor ?? "No donor"} · ${period(selected)}`}
          accent={look?.color}
          tint={look?.tint}
          status={
            <StatusBadge tone={selected.status === "ACTIVE" ? "success" : "neutral"}>
              {titleCase(selected.status)}
            </StatusBadge>
          }
          actions={
            canManage(selected.pillarId) && (
              <Button
                variant="outline"
                size="sm"
                aria-label="Edit project"
                onClick={() => setModal("edit")}
              >
                <Pencil aria-hidden="true" />
                Edit
              </Button>
            )
          }
          tabs={[
            {
              id: "overview",
              label: "Overview",
              content: (
                <div className="flex flex-col gap-[22px]">
                  <FieldGrid
                    fields={[
                      ["Pillar", selected.pillar],
                      ["Donor", selected.donor ?? "—"],
                      ["Starts", selected.start ? formatDate(selected.start) : "—"],
                      ["Ends", selected.end ? formatDate(selected.end) : "—"],
                      ["Applications", selected.applications ?? "—"],
                      ["Awards", selected.awards ?? "—"],
                      ["Awarded", money(selected.awarded)],
                      ["Disbursed", money(selected.disbursed)],
                    ]}
                  />
                  <RecordSection
                    status={selected.status}
                    statusDescription={selected.statusDescription}
                    created={selected.created}
                    updated={selected.updated}
                    notes={[["Notes", selected.notes ?? "—"]]}
                  />
                  <section className="flex flex-col gap-2.5" aria-label="Applications">
                    <SectionTitle>Grant applications</SectionTitle>
                    {detail.loading && <p className="text-[13.5px] text-creaw-faint">Loading…</p>}
                    {detail.error && (
                      <p className="text-[13.5px] text-creaw-faint">{detail.error}</p>
                    )}
                    {detail.data?.applications.map((item) => (
                      <a
                        key={item.id}
                        href={`/grants/${item.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-creaw-line bg-white px-4 py-3 text-[14px]"
                      >
                        <span>
                          <span className="font-semibold">{item.applicant}</span>
                          <span className="block text-[12.5px] text-creaw-faint">
                            {titleCase(item.grantType)} · {kes(item.amount)}
                          </span>
                        </span>
                        <StatusBadge tone="neutral">{titleCase(item.status)}</StatusBadge>
                      </a>
                    ))}
                    {detail.data && detail.data.applications.length === 0 && (
                      <p className="text-[13.5px] text-creaw-faint">
                        No applications for this project yet.
                      </p>
                    )}
                  </section>
                  {detail.data && detail.data.reports.length > 0 && (
                    <section className="flex flex-col gap-2.5" aria-label="Reporting periods">
                      <SectionTitle>Reporting periods</SectionTitle>
                      {detail.data.reports.map((report) => (
                        <div
                          key={report.id}
                          className="flex items-center justify-between rounded-xl border border-creaw-line bg-white px-4 py-3 text-[14px]"
                        >
                          <span>
                            {report.period}
                            <span className="block text-[12.5px] text-creaw-faint">
                              Due {formatDate(report.due)}
                            </span>
                          </span>
                          <StatusBadge tone={report.submitted ? "success" : "warning"}>
                            {report.submitted
                              ? `Submitted ${formatDate(report.submitted)}`
                              : "Not submitted"}
                          </StatusBadge>
                        </div>
                      ))}
                    </section>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}
      <ProjectDialog
        open={modal !== null}
        project={modal === "edit" ? selected : null}
        pillarIds={managedPillars}
        onClose={() => setModal(null)}
        onDone={done}
      />
    </div>
  );
}
