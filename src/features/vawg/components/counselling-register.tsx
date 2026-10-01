"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake, Pencil, Scale } from "lucide-react";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { TableCard } from "@/components/data-table/table-card";
import { usePagedList } from "@/components/data-table/use-paged-list";
import { pillarLook } from "@/components/portal/pillars";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/ui/form-banner";
import { MaskedField } from "@/components/ui/masked-field";
import { RecordDrawer } from "@/components/ui/record-drawer";
import { SectionTitle } from "@/components/ui/record-parts";
import { StatusBadge } from "@/components/ui/status-badge";
import { useRecordDetail } from "@/components/ui/use-record-detail";
import type { ListQuery } from "@/lib/api/list";
import { formatDate, initials } from "@/lib/format";
import { listSurvivorsAction, loadSurvivorSessionsAction } from "../actions";
import {
  counsellingTypeLabels,
  VAWG_PILLAR_ID,
  type CounsellingPermissions,
  type CounsellingSessionView,
  type CounsellorView,
  type SurvivorCounselling,
  type VawgWorkspace,
} from "../model";
import { CounsellingFormDialog } from "./counselling-dialogs";

const text = "font-medium text-creaw-ink-soft";
const kindTag = { staff: "Staff", provider: "Provider" } as const;
const typeLabel = (session: CounsellingSessionView) =>
  session.type ? counsellingTypeLabels[session.type] : "Session";

/** A counsellor's name with a small Staff or Provider tag. */
export function CounsellorName({ counsellor }: { counsellor: CounsellorView }) {
  return (
    <span className="flex items-center gap-2">
      {counsellor.name}
      {counsellor.kind && <StatusBadge tone="neutral">{kindTag[counsellor.kind]}</StatusBadge>}
    </span>
  );
}

const columns: DataColumn<SurvivorCounselling>[] = [
  {
    id: "survivor",
    header: "Survivor",
    sortValue: (row) => row.name,
    cell: (row) => <span className="font-semibold">{row.name}</span>,
  },
  {
    id: "sessions",
    header: "Sessions",
    sortValue: (row) => row.sessionCount,
    cell: (row) => <span className={text}>{row.sessionCount}</span>,
  },
  {
    id: "last",
    header: "Last session",
    sortValue: (row) => row.lastDate ?? "",
    cell: (row) =>
      row.lastDate ? (
        <div>
          <span className={`whitespace-nowrap ${text}`}>{formatDate(row.lastDate)}</span>
          <p className="text-[12.5px] text-creaw-faint">
            {row.lastType ? counsellingTypeLabels[row.lastType] : "Session"}
          </p>
        </div>
      ) : (
        <span className={text}>No sessions yet</span>
      ),
  },
  {
    id: "counsellor",
    header: "Counsellor",
    sortValue: (row) => row.lastCounsellor?.name ?? "",
    cell: (row) => (
      <span className={text}>
        {row.lastCounsellor ? <CounsellorName counsellor={row.lastCounsellor} /> : "—"}
      </span>
    ),
  },
  {
    id: "case",
    header: "Legal case",
    sortValue: (row) => row.caseNumber ?? "",
    cell: (row) => <span className={`whitespace-nowrap ${text}`}>{row.caseNumber ?? "None"}</span>,
  },
];

const chips = ["All", "With a legal case", "Counselling only"] as const;

/** One survivor's counselling as the record panel: sessions in order and any linked case. */
function SurvivorDrawer({
  survivor,
  sessions,
  loading,
  can,
  onClose,
  onLog,
  onEdit,
}: {
  survivor: SurvivorCounselling | null;
  /** The survivor's sessions in order, once loaded. */
  sessions: CounsellingSessionView[] | null;
  loading: boolean;
  can: CounsellingPermissions;
  onClose: () => void;
  onLog: () => void;
  onEdit: (session: CounsellingSessionView) => void;
}) {
  if (!survivor) return null;
  const look = pillarLook(VAWG_PILLAR_ID);
  const list = sessions ?? [];
  return (
    <RecordDrawer
      open
      onClose={onClose}
      initials={initials(survivor.name)}
      kind="Counselling · VAWG"
      title={survivor.name}
      subtitle={
        survivor.lastDate
          ? `${survivor.sessionCount} sessions · last ${formatDate(survivor.lastDate)}`
          : "No sessions yet"
      }
      accent={look?.color}
      tint={look?.tint}
      status={
        <StatusBadge tone={survivor.caseNumber ? "info" : "neutral"}>
          {survivor.caseNumber ? `Legal case ${survivor.caseNumber}` : "Counselling only"}
        </StatusBadge>
      }
      actions={
        <Button size="sm" disabled={!can.log} onClick={onLog}>
          <HeartHandshake />
          Log session
        </Button>
      }
      tabs={[
        {
          id: "sessions",
          label: `Sessions (${survivor.sessionCount})`,
          content: (
            <div className="flex flex-col gap-2.5">
              <SectionTitle note="Notes are confidential and always shown masked.">
                Counselling sessions
              </SectionTitle>
              {loading && (
                <p role="status" className="text-[13.5px] text-creaw-faint">
                  Loading sessions…
                </p>
              )}
              {list.map((session) => (
                <article
                  key={session.id}
                  aria-label={`Session ${session.number}`}
                  className="flex flex-col gap-1.5 rounded-xl border border-creaw-line bg-white px-3.5 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold">
                        {`Session ${session.number} · ${typeLabel(session)}`}
                      </span>
                      <span className="text-[12.5px] text-creaw-faint">
                        {formatDate(session.date)}
                      </span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!can.log}
                      aria-label={`Edit session ${session.number}`}
                      onClick={() => onEdit(session)}
                    >
                      <Pencil />
                      Edit
                    </Button>
                  </div>
                  <span className="text-[13px]">
                    <CounsellorName counsellor={session.counsellor} />
                  </span>
                  <MaskedField
                    label={`Session ${session.number} notes`}
                    maskedValue={session.notes ?? "No notes"}
                  />
                </article>
              ))}
              {!loading && list.length === 0 && (
                <p className="text-[13.5px] text-creaw-faint">No counselling sessions yet.</p>
              )}
            </div>
          ),
        },
        {
          id: "linked",
          label: "Linked records",
          content: survivor.caseNumber ? (
            <div className="flex items-center gap-3 rounded-xl border border-creaw-line bg-white px-3.5 py-3">
              <Scale size={20} aria-hidden="true" style={{ color: look?.color }} />
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{survivor.caseNumber}</span>
                <span className="text-[12.5px] text-creaw-faint">
                  Legal case · open it from the legal case register
                </span>
              </span>
            </div>
          ) : (
            <p className="text-[13.5px] text-creaw-faint">
              No legal case. Counselling can continue without one.
            </p>
          ),
        },
      ]}
    />
  );
}

/** Every VAWG survivor's counselling, paged by the API, with logging. */
export function CounsellingRegister({
  workspace,
  can,
}: {
  workspace: Pick<VawgWorkspace, "counselling" | "currentUserId">;
  can: CounsellingPermissions;
}) {
  const router = useRouter();
  const initial = workspace.counselling!;
  const list = usePagedList<SurvivorCounselling, ListQuery>(
    initial,
    { page: 1, pageSize: initial.pageSize },
    listSurvivorsAction
  );
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<
    { kind: "log" } | { kind: "edit"; session: CounsellingSessionView } | null
  >(null);
  const [feedback, setFeedback] = useState("");
  const detail = useRecordDetail(selectedId, loadSurvivorSessionsAction);
  const selected = list.data.items.find((row) => row.enrollmentId === selectedId) ?? null;
  const chip = list.query.filters?.has_legal_case;
  const active = chip === undefined ? "All" : chip === "true" ? chips[1] : chips[2];
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
        title="Counselling register"
        subtitle="Psychosocial counselling, with or without a legal case — open a survivor for their sessions"
        chipsLabel="Legal case"
        chips={chips.map((label) => ({
          label,
          active: active === label,
          onSelect: () =>
            list.filter({
              filters:
                label === "All"
                  ? undefined
                  : { has_legal_case: label === "With a legal case" ? "true" : "false" },
            }),
        }))}
        search={{
          value: search,
          label: "Search counselling register",
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
            hint="Click a row to open the survivor's sessions"
            onPageChange={(page) => list.filter({ page }, false)}
            onPageSizeChange={(pageSize) => list.filter({ pageSize })}
          />
        }
      >
        <DataTable
          framed={false}
          label="Counselling register"
          columns={columns}
          rows={list.data.items}
          getRowId={(row) => row.enrollmentId}
          filtered={list.data.items.length === 0 && (active !== "All" || search.length > 0)}
          onRowOpen={(row) => setSelectedId(row.enrollmentId)}
          rowOpenLabel={(row) => `Open counselling for ${row.name}`}
          sort={list.query.sort}
          onSortChange={(sort) => list.filter({ sort })}
        />
      </TableCard>
      <SurvivorDrawer
        survivor={modal === null ? selected : null}
        sessions={detail.data}
        loading={detail.loading}
        can={can}
        onClose={() => setSelectedId(null)}
        onLog={() => setModal({ kind: "log" })}
        onEdit={(session) => setModal({ kind: "edit", session })}
      />
      <CounsellingFormDialog
        key={
          modal === null
            ? "closed"
            : modal.kind === "edit"
              ? `edit-${modal.session.id}`
              : `log-${selectedId}`
        }
        open={modal !== null}
        currentUserId={workspace.currentUserId}
        enrollmentId={selected?.enrollmentId}
        session={modal?.kind === "edit" ? modal.session : null}
        onClose={() => setModal(null)}
        onDone={done}
      />
    </>
  );
}
