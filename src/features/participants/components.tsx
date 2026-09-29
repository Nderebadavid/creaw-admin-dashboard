"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { TableCard } from "@/components/data-table/table-card";
import { ExportButton } from "@/components/ui/export-button";
import { PageHeading } from "@/components/portal/page-heading";
import { hasPermission, hasModulePermission, type EffectiveGrant } from "@/lib/auth/grants";
import type { ParticipantCatalog, ParticipantPage, ParticipantView } from "./api";
import { exportParticipantsAction } from "./actions";
import { participantColumns } from "./registry/columns";
import { ParticipantDrawer } from "./registry/participant-drawer";
import { EditParticipantDialog, RegisterParticipantDialog } from "./registry/participant-dialogs";
import { useParticipantList } from "./registry/use-participant-list";

/**
 * Participant registry: one record per person across every pillar. Rows open a
 * record drawer; registering and editing happen in dialogs.
 */
export function ParticipantsContent({
  heading,
  initial,
  catalog,
  grants,
}: {
  /** Page heading; the registry's actions render beside it. */
  heading?: { title: string; section: string; description: string };
  initial: ParticipantPage;
  catalog: ParticipantCatalog;
  grants: EffectiveGrant[];
}) {
  const list = useParticipantList(initial);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState("");
  const [selected, setSelected] = useState<ParticipantView | null>(null);
  const [modal, setModal] = useState<"register" | "edit" | null>(null);
  const enrollablePillars = catalog.pillars.filter((item) =>
    hasPermission(grants, "PARTICIPANT_EDIT", { pillarId: item.id })
  );
  const pillarName = (id: number) =>
    catalog.pillars.find((item) => item.id === id)?.name ?? `Pillar #${id}`;

  const done = (message: string) => {
    setModal(null);
    setSelected(null);
    setFeedback(message);
    void list.refresh();
  };

  const actions = (
    <>
      {hasModulePermission(grants, "REPORT_EXPORT_CSV") && (
        <ExportButton exportAction={() => exportParticipantsAction(list.query)} />
      )}
      {enrollablePillars.length > 0 && (
        <Button onClick={() => setModal("register")}>
          <UserPlus size={16} />
          Register participant
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-5">
      {heading ? <PageHeading {...heading} actions={actions} /> : actions}
      {feedback && (
        <p
          role="status"
          className="rounded-xl bg-creaw-success-soft px-4 py-3 text-sm text-creaw-success"
        >
          {feedback}
        </p>
      )}
      {list.error && !modal && (
        <p
          role="alert"
          className="rounded-xl bg-creaw-danger-soft px-4 py-3 text-sm text-creaw-danger"
        >
          {list.error}
        </p>
      )}
      <TableCard
        title="Participant registry"
        subtitle="IDs masked — reveal inside a record (logged)"
        chipsLabel="Pillar filter"
        chips={[
          {
            label: "All",
            active: !list.query.pillarId,
            onSelect: () => list.filter({ pillarId: undefined }),
          },
          ...catalog.pillars.map((pillar) => ({
            label: pillar.name,
            active: list.query.pillarId === pillar.id,
            onSelect: () => list.filter({ pillarId: pillar.id }),
          })),
        ]}
        filters={
          catalog.counties.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only">County</span>
              <select
                aria-label="County"
                value={list.query.countyId ?? ""}
                onChange={(event) =>
                  list.filter({ countyId: Number(event.target.value) || undefined })
                }
                className="h-10 rounded-[10px] border border-creaw-line-strong bg-white px-3"
              >
                <option value="">All counties</option>
                {catalog.counties.map((county) => (
                  <option key={county.id} value={county.id}>
                    {county.name}
                  </option>
                ))}
              </select>
            </label>
          )
        }
        search={{
          value: search,
          label: "Search participants",
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
          label="Participants"
          columns={participantColumns(pillarName)}
          rows={list.data.items}
          getRowId={(row) => row.id}
          loading={list.loading}
          filtered={Boolean(list.query.pillarId || list.query.countyId || list.query.search)}
          onRowOpen={setSelected}
          rowOpenLabel={(row) => `Open participant ${row.name}`}
        />
      </TableCard>
      <ParticipantDrawer
        participant={modal === null ? selected : null}
        grants={grants}
        pillarName={pillarName}
        onClose={() => setSelected(null)}
        onEdit={() => setModal("edit")}
      />
      <RegisterParticipantDialog
        open={modal === "register"}
        catalog={catalog}
        pillars={enrollablePillars}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <EditParticipantDialog
        participant={modal === "edit" ? selected : null}
        onClose={() => setModal(null)}
        onDone={done}
      />
    </div>
  );
}
