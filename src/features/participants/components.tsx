"use client";

import { filterSelectClass } from "@/components/ui/form-styles";
import { FormBanner } from "@/components/ui/form-banner";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { TableCard } from "@/components/data-table/table-card";
import { ExportButton } from "@/components/ui/export-button";
import { PageHeading, type PageHeadingText } from "@/components/portal/page-heading";
import { pillarLook } from "@/components/portal/pillars";
import { hasPermission, hasModulePermission, type EffectiveGrant } from "@/lib/auth/grants";
import type { ParticipantCatalog, ParticipantPage, ParticipantQuery, ParticipantView } from "./api";
import { SRHR_PILLAR_ID } from "./curriculum";
import { exportParticipantsAction, listParticipantsAction } from "./actions";
import { participantColumns } from "./registry/columns";
import { ParticipantDrawer } from "./registry/participant-drawer";
import { EditParticipantDialog, RegisterParticipantDialog } from "./registry/participant-dialogs";
import { usePagedList } from "@/components/data-table/use-paged-list";

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
  heading?: PageHeadingText;
  initial: ParticipantPage;
  catalog: ParticipantCatalog;
  grants: EffectiveGrant[];
}) {
  const list = usePagedList<ParticipantView, ParticipantQuery>(
    initial,
    { page: 1, pageSize: 25 },
    listParticipantsAction
  );
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState("");
  const [selected, setSelected] = useState<ParticipantView | null>(null);
  const [modal, setModal] = useState<"register" | "edit" | null>(null);
  const enrollablePillars = catalog.pillars.filter((item) =>
    hasPermission(grants, "PARTICIPANT_EDIT", { pillarId: item.id })
  );
  // Short names ("VAWG"), as in the design's chips; the registry name is the fallback.
  const pillarName = (id: number) =>
    pillarLook(id)?.name ?? catalog.pillars.find((item) => item.id === id)?.name ?? `Pillar #${id}`;

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
      <FormBanner tone="success">{feedback}</FormBanner>
      {!modal && <FormBanner tone="error">{list.error}</FormBanner>}
      <TableCard
        title="Participant registry"
        subtitle="One registry across every pillar"
        chipsLabel="Pillar filter"
        chips={[
          {
            label: "All",
            active: !list.query.pillarId,
            onSelect: () => list.filter({ pillarId: undefined }),
          },
          ...catalog.pillars.map((pillar) => ({
            label: pillarName(pillar.id),
            active: list.query.pillarId === pillar.id,
            onSelect: () => list.filter({ pillarId: pillar.id }),
          })),
        ]}
        filters={
          <>
            {hasPermission(grants, "PARTICIPANT_VIEW", { pillarId: SRHR_PILLAR_ID }) && (
              <label className="flex items-center gap-2 text-sm">
                <span className="sr-only">Curriculum</span>
                <select
                  aria-label="Curriculum"
                  value={list.query.behind ? "behind" : ""}
                  onChange={(event) =>
                    list.filter({ behind: event.target.value === "behind" ? true : undefined })
                  }
                  className={filterSelectClass}
                >
                  <option value="">All progress</option>
                  <option value="behind">Behind on curriculum</option>
                </select>
              </label>
            )}
            {catalog.counties.length > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <span className="sr-only">County</span>
                <select
                  aria-label="County"
                  value={list.query.countyId ?? ""}
                  onChange={(event) =>
                    list.filter({ countyId: Number(event.target.value) || undefined })
                  }
                  className={filterSelectClass}
                >
                  <option value="">All counties</option>
                  {catalog.counties.map((county) => (
                    <option key={county.id} value={county.id}>
                      {county.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
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
          sort={list.query.sort}
          onSortChange={(sort) => list.filter({ sort })}
          rows={list.data.items}
          getRowId={(row) => row.id}
          loading={list.loading}
          filtered={Boolean(
            list.query.pillarId || list.query.countyId || list.query.search || list.query.behind
          )}
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
