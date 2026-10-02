"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { dateSortValue } from "@/components/data-table/sorting";
import { TableCard } from "@/components/data-table/table-card";
import { usePagedList } from "@/components/data-table/use-paged-list";
import { useRecordDetail } from "@/components/ui/use-record-detail";
import type { ListQuery } from "@/lib/api/list";
import { recordStatusColumn, updatedColumn } from "@/components/data-table/record-columns";
import { auditedExportAction } from "@/components/portal/data-actions";
import { DocumentViewer, type ViewedDocument } from "@/components/ui/document-viewer";
import { ExportButton } from "@/components/ui/export-button";
import { FormBanner } from "@/components/ui/form-banner";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import { listSessionsAction, loadSessionDetailAction, viewSessionFileAction } from "../actions";
import type { AttendeeView, SessionPermissions, SessionView, SessionWorkspace } from "../model";
import { CoveragePanel, type TopicFilter } from "./coverage-panel";
import {
  AddAttendeeDialog,
  AttachSessionFileDialog,
  RemoveAttendeeDialog,
  SessionFormDialog,
} from "./session-dialogs";
import { FacilitatorName, SessionDrawer } from "./session-drawer";

const text = "font-medium text-creaw-ink-soft";

const columns: DataColumn<SessionView>[] = [
  {
    id: "type",
    header: "Activity type",
    sortValue: (row) => row.activityType,
    cell: (row) => <span className="font-semibold">{row.activityType}</span>,
  },
  {
    id: "topic",
    header: "Topic",
    sortValue: (row) => row.topic,
    cell: (row) => (
      <span className={`flex items-center gap-2 ${text}`}>
        {row.topic}
        {row.topicId === null && <StatusBadge tone="neutral">Other</StatusBadge>}
      </span>
    ),
  },
  {
    id: "date",
    header: "Date",
    sortValue: (row) => dateSortValue(row.date),
    cell: (row) => <span className={`whitespace-nowrap ${text}`}>{formatDate(row.date)}</span>,
  },
  {
    id: "venue",
    header: "Venue",
    sortValue: (row) => row.venue ?? "",
    cell: (row) => <span className={text}>{row.venue ?? "Not recorded"}</span>,
  },
  {
    id: "facilitator",
    header: "Facilitator",
    sortValue: (row) => row.facilitator.name,
    cell: (row) => <FacilitatorName facilitator={row.facilitator} className={text} />,
  },
  {
    id: "attendees",
    header: "Attendees",
    sortValue: (row) => row.attendeeCount,
    cell: (row) => <span className={text}>{row.attendeeCount}</span>,
  },
  recordStatusColumn((row) => row.status),
  updatedColumn((row) => row.updated),
];

/** The API filters that a chip and a picked topic ask for; a topic wins over the chip. */
function sessionFilters(typeId: number | null, topic?: TopicFilter | null): ListQuery["filters"] {
  if (topic)
    return topic.topicId !== null
      ? { activity_type_id: topic.activityTypeId, activity_topic_id: topic.topicId }
      : { activity_type_id: topic.activityTypeId, topic: topic.topic };
  return typeId === null ? undefined : { activity_type_id: typeId };
}

/** The session register, paged by the API. Opening a row selects it for the record panel. */
export function SessionRegister({
  workspace,
  can,
  topic,
  onClearTopic,
  toolbar,
}: {
  workspace: SessionWorkspace;
  can: SessionPermissions;
  topic?: TopicFilter | null;
  onClearTopic?: () => void;
  /** Extra buttons for the register's toolbar, e.g. logging a new record. */
  toolbar?: React.ReactNode;
}) {
  const router = useRouter();
  const pillar = workspace.pillar;
  const list = usePagedList<SessionView, ListQuery>(
    workspace.sessions,
    { page: 1, pageSize: workspace.sessions.pageSize },
    (query) => listSessionsAction(pillar, query)
  );
  const [typeId, setTypeId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<
    | { kind: "edit" }
    | { kind: "attach" }
    | { kind: "add" }
    | { kind: "remove"; attendee: AttendeeView }
    | null
  >(null);
  const [viewing, setViewing] = useState<ViewedDocument | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState<number | null>(null);
  const detail = useRecordDetail(selectedId, (id) => loadSessionDetailAction(pillar, id));
  const selected = list.data.items.find((row) => row.id === selectedId) ?? null;

  // A chip or a topic picked in the coverage panel changes what the API is asked for.
  const filtersKey = JSON.stringify(sessionFilters(typeId, topic) ?? null);
  const seenFilters = useRef(filtersKey);
  const filter = list.filter;
  useEffect(() => {
    if (seenFilters.current === filtersKey) return;
    seenFilters.current = filtersKey;
    filter({ filters: sessionFilters(typeId, topic) });
  }, [filtersKey, typeId, topic, filter]);

  const done = (message: string) => {
    setModal(null);
    setFeedback(message);
    void list.refresh();
    detail.reload();
    router.refresh();
  };
  async function view(documentId: number) {
    if (!selected || openingId !== null) return;
    setError("");
    setOpeningId(documentId);
    try {
      const result = await viewSessionFileAction(workspace.pillar, selected.id, documentId);
      if (result.success && result.document) setViewing(result.document);
      else setError(result.message);
    } catch {
      setError("Could not open the file. Please try again.");
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <>
      <FormBanner tone="success">{feedback}</FormBanner>
      <FormBanner tone="error">{error}</FormBanner>
      {!modal && <FormBanner tone="error">{list.error}</FormBanner>}
      <TableCard
        title="Session register"
        subtitle="Attendance arrives from the mobile app — open a session to review or correct it"
        chipsLabel="Activity type"
        chips={[
          { label: "All", id: null },
          ...workspace.coverage.map((type) => ({ label: type.name, id: type.activityTypeId })),
        ].map(({ label, id }) => ({
          label,
          active: typeId === id,
          onSelect: () => setTypeId(id),
        }))}
        search={{
          value: search,
          label: "Search sessions",
          onChange: (value) => {
            setSearch(value);
            list.filter({ search: value || undefined });
          },
        }}
        filters={
          topic ? (
            <p
              role="status"
              className="flex items-center gap-3 rounded-xl bg-creaw-line/40 px-4 py-2 text-sm"
            >
              Showing sessions on {topic.topic}
              <button type="button" onClick={onClearTopic} className="font-semibold underline">
                Clear
              </button>
            </p>
          ) : null
        }
        actions={
          <>
            {toolbar}
            {can.export && (
              <ExportButton
                label="CSV"
                exportAction={() =>
                  auditedExportAction({
                    path: `/pillars/${workspace.pillar}`,
                    routeTemplate: "/pillars/:pillar",
                    query: { table: "activity_session" },
                  })
                }
              />
            )}
          </>
        }
        footer={
          <Pagination
            page={list.data.page}
            pageSize={list.data.pageSize as PageSize}
            totalItems={list.data.totalItems}
            hint="Click a row to open the session"
            onPageChange={(page) => list.filter({ page }, false)}
            onPageSizeChange={(pageSize) => list.filter({ pageSize })}
          />
        }
      >
        <DataTable
          framed={false}
          label="Session register"
          columns={columns}
          rows={list.data.items}
          getRowId={(row) => row.id}
          filtered={
            list.data.items.length === 0 && (typeId !== null || search.length > 0 || !!topic)
          }
          onRowOpen={(row) => setSelectedId(row.id)}
          rowOpenLabel={(row) => `Open ${row.topic}, ${formatDate(row.date)}`}
          sort={list.query.sort}
          onSortChange={(sort) => list.filter({ sort })}
        />
      </TableCard>
      <SessionDrawer
        session={modal === null ? selected : null}
        detail={detail.data}
        detailLoading={detail.loading}
        pillar={workspace.pillar}
        can={can}
        onClose={() => setSelectedId(null)}
        onEdit={() => setModal({ kind: "edit" })}
        onAttach={() => setModal({ kind: "attach" })}
        onAddAttendee={() => setModal({ kind: "add" })}
        onRemoveAttendee={(attendee) => setModal({ kind: "remove", attendee })}
        onView={(documentId) => void view(documentId)}
        openingId={openingId}
      />
      <SessionFormDialog
        key={modal?.kind === "edit" ? `edit-${selectedId}` : "edit-closed"}
        open={modal?.kind === "edit"}
        pillar={workspace.pillar}
        currentUser={workspace.currentUser}
        session={selected}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <AddAttendeeDialog
        key={modal?.kind === "add" ? `add-${selectedId}` : "add-closed"}
        session={modal?.kind === "add" ? selected : null}
        attendees={detail.data?.attendees ?? []}
        pillar={workspace.pillar}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <RemoveAttendeeDialog
        session={modal?.kind === "remove" ? selected : null}
        pillar={workspace.pillar}
        attendee={modal?.kind === "remove" ? modal.attendee : null}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <AttachSessionFileDialog
        key={modal?.kind === "attach" ? `attach-${selectedId}` : "attach-closed"}
        session={modal?.kind === "attach" ? selected : null}
        pillar={workspace.pillar}
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

/** Coverage above the register; clicking a topic filters the register to it. */
export function SessionWorkspaceView({
  workspace,
  can,
  toolbar,
}: {
  workspace: SessionWorkspace;
  can: SessionPermissions;
  /** Extra buttons for the register's toolbar, e.g. logging a new record. */
  toolbar?: React.ReactNode;
}) {
  const [topic, setTopic] = useState<TopicFilter | null>(null);
  return (
    <>
      <CoveragePanel workspace={workspace} onTopic={setTopic} />
      <SessionRegister
        workspace={workspace}
        can={can}
        topic={topic}
        onClearTopic={() => setTopic(null)}
        toolbar={toolbar}
      />
    </>
  );
}
