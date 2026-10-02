"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { recordStatusColumn, updatedColumn } from "@/components/data-table/record-columns";
import { withSortValues } from "@/components/data-table/sorting";
import { TableCard } from "@/components/data-table/table-card";
import { usePagedList } from "@/components/data-table/use-paged-list";
import { PageHeading, type PageHeadingText } from "@/components/portal/page-heading";
import { PillarChip } from "@/components/portal/pillars";
import { FormBanner } from "@/components/ui/form-banner";
import { fieldClass, filterSelectClass } from "@/components/ui/form-styles";
import { FieldGrid, SectionTitle } from "@/components/ui/record-parts";
import { RecordDrawer } from "@/components/ui/record-drawer";
import { RecordSection } from "@/components/ui/record-section";
import { StatusBadge } from "@/components/ui/status-badge";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { useRecordDetail } from "@/components/ui/use-record-detail";
import type { ListQuery } from "@/lib/api/list";
import { hasPermission, type EffectiveGrant } from "@/lib/auth/grants";
import { formatDate, initials, titleCase } from "@/lib/format";
import type { PaginatedData } from "@/types/api";
import {
  deleteDonorAction,
  listDonorsAction,
  loadDonorDetailAction,
  saveDonorAction,
  setDonorStatusAction,
} from "./actions";
import type { DonorView } from "./api";

const money = (value: number | null) =>
  value === null ? "—" : `KES ${value.toLocaleString("en-KE")}`;

const columns: DataColumn<DonorView>[] = withSortValues(
  {
    donor: (row) => row.name,
    projects: (row) => row.projects,
    active: (row) => row.activeProjects,
    awarded: (row) => row.awarded,
  },
  [
    {
      id: "donor",
      header: "Donor",
      cell: (row) => <span className="font-semibold">{row.name}</span>,
    },
    { id: "projects", header: "Projects", cell: (row) => row.projects ?? "—" },
    { id: "active", header: "Active projects", cell: (row) => row.activeProjects ?? "—" },
    {
      id: "awarded",
      header: "Awarded",
      cell: (row) => <span className="whitespace-nowrap">{money(row.awarded)}</span>,
    },
    recordStatusColumn((row: DonorView) => row.status),
    updatedColumn((row: DonorView) => row.updated),
  ]
);

/** Creates or edits a donor, including its status and the reason for it. */
function DonorDialog({
  open,
  donor,
  onClose,
  onDone,
}: {
  open: boolean;
  /** The donor being edited, or null to add one. */
  donor: DonorView | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "") || null;
    void submit.run(
      saveDonorAction({
        id: donor?.id,
        name: String(form.get("name") ?? ""),
        notes: text("notes"),
        ...(donor
          ? { status: String(form.get("status")), statusDescription: text("statusDescription") }
          : {}),
      }),
      donor ? "Donor updated." : "Donor added."
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
      title={donor ? "Edit donor" : "New donor"}
      description="A funding partner that projects and assessments can point at."
      error={submit.error}
    >
      <form key={donor?.id ?? "new"} className="grid gap-3 sm:grid-cols-2" onSubmit={send}>
        <label className="text-sm sm:col-span-2">
          Donor name
          <input
            name="name"
            required
            maxLength={160}
            defaultValue={donor?.name}
            className={fieldClass}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          Notes
          <textarea
            name="notes"
            rows={3}
            maxLength={2000}
            defaultValue={donor?.notes ?? ""}
            className={fieldClass}
          />
        </label>
        {donor && (
          <>
            <label className="text-sm">
              Status
              <select name="status" defaultValue={donor.status} className={fieldClass}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <label className="text-sm">
              Status reason
              <input
                name="statusDescription"
                maxLength={255}
                defaultValue={donor.statusDescription ?? ""}
                className={fieldClass}
              />
            </label>
          </>
        )}
        <div className="sm:col-span-2">
          <Button type="button" variant="outline" disabled={submit.busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submit.busy}>
            {donor ? "Save changes" : "Add donor"}
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

/** Deactivates a donor (optional reason) or brings it back. */
function StatusDialog({
  open,
  donor,
  onClose,
  onDone,
}: {
  open: boolean;
  donor: DonorView | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  if (!donor) return null;
  const deactivating = donor.status === "ACTIVE";
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    void submit.run(
      setDonorStatusAction({
        id: donor!.id,
        status: deactivating ? "INACTIVE" : "ACTIVE",
        reason,
      }),
      deactivating ? "Donor deactivated." : "Donor reactivated."
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
      title={deactivating ? "Deactivate donor" : "Reactivate donor"}
      description={donor.name}
      error={submit.error}
    >
      <form className="space-y-4" onSubmit={send}>
        <p className="text-sm">
          {deactivating
            ? "An inactive donor keeps its existing projects but cannot be chosen for new ones."
            : "The donor can be chosen for new projects again."}
        </p>
        {deactivating && (
          <label className="block text-sm">
            Reason (optional)
            <input name="reason" maxLength={255} className={fieldClass} />
          </label>
        )}
        <div>
          <Button type="button" variant="outline" disabled={submit.busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submit.busy}>
            {deactivating ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

/** Confirms deleting a donor; refused by the API while projects still point at it. */
function DeleteDialog({
  open,
  donor,
  onClose,
  onDone,
}: {
  open: boolean;
  donor: DonorView | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  if (!donor) return null;
  return (
    <ActionDialog
      open={open}
      busy={submit.busy}
      onClose={() => {
        submit.clearError();
        onClose();
      }}
      title="Delete donor"
      description={donor.name}
      error={submit.error}
    >
      <p className="text-sm">
        This removes the donor from every list. It is only possible while no projects point at it;
        otherwise deactivate it instead.
      </p>
      <div>
        <Button type="button" variant="outline" disabled={submit.busy} onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          disabled={submit.busy}
          onClick={() => void submit.run(deleteDonorAction({ id: donor.id }), "Donor deleted.")}
        >
          Delete donor
        </Button>
      </div>
    </ActionDialog>
  );
}

/** The donors who fund CREAW's projects, with how many projects and how much each has. */
export function DonorsContent({
  heading,
  initial,
  grants,
}: {
  heading?: PageHeadingText;
  initial: PaginatedData<DonorView>;
  grants: readonly EffectiveGrant[];
}) {
  const router = useRouter();
  const list = usePagedList<DonorView, ListQuery>(
    initial,
    { page: 1, pageSize: 25 },
    listDonorsAction
  );
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<"new" | "edit" | "status" | "delete" | null>(null);
  const [feedback, setFeedback] = useState("");
  const detail = useRecordDetail(selectedId, loadDonorDetailAction);
  const selected = list.data.items.find((row) => row.id === selectedId) ?? null;
  const canManage = hasPermission(grants, "LOOKUP_MANAGE");

  const done = (message: string) => {
    if (modal === "delete") setSelectedId(null);
    setModal(null);
    setFeedback(message);
    void list.refresh();
    router.refresh();
  };

  const actions = canManage && (
    <Button onClick={() => setModal("new")}>
      <Plus size={16} />
      New donor
    </Button>
  );

  return (
    <div className="space-y-5">
      {heading && <PageHeading {...heading} />}
      <FormBanner tone="success">{feedback}</FormBanner>
      {!modal && <FormBanner tone="error">{list.error}</FormBanner>}
      <TableCard
        actions={actions}
        title="Donors"
        subtitle="Funding partners — projects point at a donor"
        filters={
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Status</span>
            <select
              aria-label="Status"
              value={String(list.query.filters?.status ?? "")}
              onChange={(event) =>
                list.filter({
                  filters: event.target.value ? { status: event.target.value } : undefined,
                })
              }
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
          label: "Search donors",
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
            hint="Click a row to open the donor"
            onPageChange={(page) => list.filter({ page }, false)}
            onPageSizeChange={(pageSize) => list.filter({ pageSize })}
          />
        }
      >
        <DataTable
          framed={false}
          label="Donors"
          columns={columns}
          sort={list.query.sort}
          onSortChange={(sort) => list.filter({ sort })}
          rows={list.data.items}
          getRowId={(row) => row.id}
          loading={list.loading}
          filtered={Boolean(list.query.search || list.query.filters)}
          onRowOpen={(row) => setSelectedId(row.id)}
          rowOpenLabel={(row) => `Open donor ${row.name}`}
        />
      </TableCard>
      {selected && (
        <RecordDrawer
          open={modal === null}
          onClose={() => setSelectedId(null)}
          initials={initials(selected.name)}
          kind="Donor"
          title={selected.name}
          subtitle={`${selected.projects ?? 0} project${selected.projects === 1 ? "" : "s"}`}
          status={
            <StatusBadge tone={selected.status === "ACTIVE" ? "success" : "neutral"}>
              {titleCase(selected.status)}
            </StatusBadge>
          }
          actions={
            canManage && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Edit donor"
                  onClick={() => setModal("edit")}
                >
                  <Pencil aria-hidden="true" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => setModal("status")}>
                  {selected.status === "ACTIVE" ? (
                    <PowerOff aria-hidden="true" />
                  ) : (
                    <Power aria-hidden="true" />
                  )}
                  {selected.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setModal("delete")}>
                  <Trash2 aria-hidden="true" />
                  Delete
                </Button>
              </>
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
                      ["Projects", selected.projects ?? "—"],
                      ["Active projects", selected.activeProjects ?? "—"],
                      ["Awarded", money(selected.awarded)],
                    ]}
                  />
                  <RecordSection
                    status={selected.status}
                    statusDescription={selected.statusDescription}
                    created={selected.created}
                    updated={selected.updated}
                    notes={[["Notes", selected.notes ?? "—"]]}
                  />
                  <section className="flex flex-col gap-2.5" aria-label="Projects">
                    <SectionTitle>Projects</SectionTitle>
                    {detail.loading && <p className="text-[13.5px] text-creaw-faint">Loading…</p>}
                    {detail.error && (
                      <p className="text-[13.5px] text-creaw-faint">{detail.error}</p>
                    )}
                    {detail.data?.projects.map((project) => (
                      <a
                        key={project.id}
                        href="/projects"
                        className="flex items-center justify-between gap-3 rounded-xl border border-creaw-line bg-white px-4 py-3 text-[14px]"
                      >
                        <span>
                          <span className="font-semibold">{project.name}</span>
                          <span className="block text-[12.5px] text-creaw-faint">
                            {project.end ? `Ends ${formatDate(project.end)}` : "No end date"}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <PillarChip id={project.pillarId} fallback={project.pillar} />
                          <StatusBadge tone={project.status === "ACTIVE" ? "success" : "neutral"}>
                            {titleCase(project.status)}
                          </StatusBadge>
                        </span>
                      </a>
                    ))}
                    {detail.data && detail.data.projects.length === 0 && (
                      <p className="text-[13.5px] text-creaw-faint">
                        No projects point at this donor yet.
                      </p>
                    )}
                  </section>
                </div>
              ),
            },
          ]}
        />
      )}
      <DonorDialog
        open={modal === "new" || modal === "edit"}
        donor={modal === "edit" ? selected : null}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <StatusDialog
        open={modal === "status"}
        donor={selected}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <DeleteDialog
        open={modal === "delete"}
        donor={selected}
        onClose={() => setModal(null)}
        onDone={done}
      />
    </div>
  );
}
