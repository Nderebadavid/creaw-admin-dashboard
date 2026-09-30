"use client";
import { useMemo, useState } from "react";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination } from "@/components/data-table/pagination";
import { dateSortValue } from "@/components/data-table/sorting";
import { TableCard } from "@/components/data-table/table-card";
import { useClientPaging } from "@/components/data-table/use-client-paging";
import { useClientSort } from "@/components/data-table/use-client-sort";
import { auditedExportAction } from "@/components/portal/data-actions";
import { ExportButton } from "@/components/ui/export-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import type { SessionPermissions, SessionView, SessionWorkspace } from "../model";
import { CoveragePanel } from "./coverage-panel";

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
    sortValue: (row) => row.facilitator,
    cell: (row) => <span className={text}>{row.facilitator}</span>,
  },
  {
    id: "attendees",
    header: "Attendees",
    sortValue: (row) => row.attendees.length,
    cell: (row) => <span className={text}>{row.attendees.length}</span>,
  },
];

/** The session register. Opening a row selects it for the record panel. */
export function SessionRegister({
  workspace,
  can,
  topic,
  onClearTopic,
}: {
  workspace: SessionWorkspace;
  can: SessionPermissions;
  topic?: string | null;
  onClearTopic?: () => void;
}) {
  const [type, setType] = useState("All");
  const [search, setSearch] = useState("");
  const [, setSelectedId] = useState<number | null>(null);
  const types = useMemo(
    () => ["All", ...new Set(workspace.sessions.map((row) => row.activityType))],
    [workspace.sessions]
  );
  const needle = search.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      workspace.sessions.filter(
        (row) =>
          (type === "All" || row.activityType === type) &&
          (!topic || row.topic === topic) &&
          (!needle ||
            [row.activityType, row.topic, row.venue, row.facilitator]
              .join(" ")
              .toLocaleLowerCase()
              .includes(needle))
      ),
    [workspace.sessions, type, topic, needle]
  );
  const { rows, sorting } = useClientSort(filtered, columns);
  const { pageRows, pager, resetPage } = useClientPaging(rows);

  return (
    <TableCard
      title="Session register"
      subtitle="Attendance arrives from the mobile app — open a session to review or correct it"
      chipsLabel="Activity type"
      chips={types.map((label) => ({
        label,
        active: type === label,
        onSelect: () => {
          setType(label);
          resetPage();
        },
      }))}
      search={{
        value: search,
        label: "Search sessions",
        onChange: (value) => {
          setSearch(value);
          resetPage();
        },
      }}
      filters={
        topic ? (
          <p role="status" className="flex items-center gap-3 rounded-xl bg-creaw-line/40 px-4 py-2 text-sm">
            Showing sessions on {topic}
            <button type="button" onClick={onClearTopic} className="font-semibold underline">
              Clear
            </button>
          </p>
        ) : null
      }
      actions={
        can.export && (
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
        )
      }
      footer={<Pagination {...pager} hint="Click a row to open the session" />}
    >
      <DataTable
        framed={false}
        label="Session register"
        columns={columns}
        rows={pageRows}
        getRowId={(row) => row.id}
        filtered={filtered.length === 0 && (type !== "All" || needle.length > 0 || !!topic)}
        onRowOpen={(row) => setSelectedId(row.id)}
        rowOpenLabel={(row) => `Open ${row.topic}, ${formatDate(row.date)}`}
        sort={sorting.sort}
        onSortChange={(sort) => {
          sorting.onSortChange(sort);
          resetPage();
        }}
      />
    </TableCard>
  );
}

/** Coverage above the register; clicking a topic filters the register to it. */
export function SessionWorkspaceView({
  workspace,
  can,
}: {
  workspace: SessionWorkspace;
  can: SessionPermissions;
}) {
  const [topic, setTopic] = useState<string | null>(null);
  return (
    <>
      <CoveragePanel workspace={workspace} onTopic={setTopic} />
      <SessionRegister workspace={workspace} can={can} topic={topic} onClearTopic={() => setTopic(null)} />
    </>
  );
}
