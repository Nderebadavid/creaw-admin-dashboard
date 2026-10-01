"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake, Pencil, Scale } from "lucide-react";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination } from "@/components/data-table/pagination";
import { TableCard } from "@/components/data-table/table-card";
import { useClientPaging } from "@/components/data-table/use-client-paging";
import { useClientSort } from "@/components/data-table/use-client-sort";
import { pillarLook } from "@/components/portal/pillars";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/ui/form-banner";
import { MaskedField } from "@/components/ui/masked-field";
import { RecordDrawer } from "@/components/ui/record-drawer";
import { SectionTitle } from "@/components/ui/record-parts";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, initials } from "@/lib/format";
import { revealCounsellingNotesAction } from "../actions";
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
const last = (row: SurvivorCounselling) => row.sessions.at(-1) ?? null;

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
    sortValue: (row) => row.sessions.length,
    cell: (row) => <span className={text}>{row.sessions.length}</span>,
  },
  {
    id: "last",
    header: "Last session",
    sortValue: (row) => last(row)?.date ?? "",
    cell: (row) => {
      const session = last(row);
      return session ? (
        <div>
          <span className={`whitespace-nowrap ${text}`}>{formatDate(session.date)}</span>
          <p className="text-[12.5px] text-creaw-faint">{typeLabel(session)}</p>
        </div>
      ) : (
        <span className={text}>No sessions yet</span>
      );
    },
  },
  {
    id: "counsellor",
    header: "Counsellor",
    sortValue: (row) => last(row)?.counsellor.name ?? "",
    cell: (row) => {
      const session = last(row);
      return session ? (
        <span className={text}>
          <CounsellorName counsellor={session.counsellor} />
        </span>
      ) : (
        <span className={text}>—</span>
      );
    },
  },
  {
    id: "case",
    header: "Legal case",
    sortValue: (row) => row.caseNumber ?? "",
    cell: (row) => <span className={`whitespace-nowrap ${text}`}>{row.caseNumber ?? "None"}</span>,
  },
];

const chips = ["All", "With a legal case", "Counselling only"] as const;
type Chip = (typeof chips)[number];

/** One survivor's counselling as the record panel: sessions in order and any linked case. */
function SurvivorDrawer({
  survivor,
  can,
  onClose,
  onLog,
  onEdit,
}: {
  survivor: SurvivorCounselling | null;
  can: CounsellingPermissions;
  onClose: () => void;
  onLog: () => void;
  onEdit: (session: CounsellingSessionView) => void;
}) {
  if (!survivor) return null;
  const look = pillarLook(VAWG_PILLAR_ID);
  const latest = last(survivor);
  return (
    <RecordDrawer
      open
      onClose={onClose}
      initials={initials(survivor.name)}
      kind="Counselling · VAWG"
      title={survivor.name}
      subtitle={
        latest
          ? `${survivor.sessions.length} sessions · last ${formatDate(latest.date)}`
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
          label: `Sessions (${survivor.sessions.length})`,
          content: (
            <div className="flex flex-col gap-2.5">
              <SectionTitle note="Notes are confidential: each reveal is recorded in the audit log.">
                Counselling sessions
              </SectionTitle>
              {survivor.sessions.map((session) => (
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
                    revealAction={
                      can.reveal && session.notes
                        ? () => revealCounsellingNotesAction(session.id)
                        : undefined
                    }
                  />
                </article>
              ))}
              {survivor.sessions.length === 0 && (
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

/** Every VAWG survivor's counselling, one row each, with logging and audited note reveals. */
export function CounsellingRegister({
  workspace,
  can,
}: {
  workspace: VawgWorkspace;
  can: CounsellingPermissions;
}) {
  const router = useRouter();
  const rowsAll = useMemo(() => workspace.counselling ?? [], [workspace.counselling]);
  const [chip, setChip] = useState<Chip>("All");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<
    { kind: "log" } | { kind: "edit"; session: CounsellingSessionView } | null
  >(null);
  const [feedback, setFeedback] = useState("");
  const selected = rowsAll.find((row) => row.enrollmentId === selectedId) ?? null;
  const needle = search.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      rowsAll.filter(
        (row) =>
          (chip === "All" ||
            (chip === "With a legal case" ? row.caseNumber !== null : row.caseNumber === null)) &&
          (!needle ||
            [row.name, row.caseNumber, ...row.sessions.map((session) => session.counsellor.name)]
              .join(" ")
              .toLocaleLowerCase()
              .includes(needle))
      ),
    [rowsAll, chip, needle]
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
        title="Counselling register"
        subtitle="Psychosocial counselling, with or without a legal case — open a survivor for their sessions"
        chipsLabel="Legal case"
        chips={chips.map((label) => ({
          label,
          active: chip === label,
          onSelect: () => {
            setChip(label);
            resetPage();
          },
        }))}
        search={{
          value: search,
          label: "Search counselling register",
          onChange: (value) => {
            setSearch(value);
            resetPage();
          },
        }}
        footer={<Pagination {...pager} hint="Click a row to open the survivor's sessions" />}
      >
        <DataTable
          framed={false}
          label="Counselling register"
          columns={columns}
          rows={pageRows}
          getRowId={(row) => row.enrollmentId}
          filtered={filtered.length === 0 && (chip !== "All" || needle.length > 0)}
          onRowOpen={(row) => setSelectedId(row.enrollmentId)}
          rowOpenLabel={(row) => `Open counselling for ${row.name}`}
          sort={sorting.sort}
          onSortChange={(sort) => {
            sorting.onSortChange(sort);
            resetPage();
          }}
        />
      </TableCard>
      <SurvivorDrawer
        survivor={modal === null ? selected : null}
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
        workspace={workspace}
        enrollmentId={selected?.enrollmentId}
        session={modal?.kind === "edit" ? modal.session : null}
        onClose={() => setModal(null)}
        onDone={done}
      />
    </>
  );
}
